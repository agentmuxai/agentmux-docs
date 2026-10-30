#!/usr/bin/env node
/**
 * Publish dist/'s HTML to the docs bucket and remove what is no longer built.
 *
 * Runs in the deploy after the non-HTML assets are synced, and before the
 * CloudFront invalidation:
 *
 *   1. upload every HTML file that is new or whose content differs from the
 *      bucket's copy;
 *   2. only then delete every key that is not in dist/ (HTML included), so the
 *      live site never links to a page that is gone while the deploy runs.
 *
 * Why not `aws s3 sync` for HTML: normalize-mtimes gives every file the same
 * mtime, so sync skips a page whose only change is the CSS hash inside it (same
 * size, same mtime), and the page keeps pointing at a deleted CSS bundle. The
 * deploy used to force-upload every HTML file instead (about 15k PUTs per
 * deploy) and never deleted HTML, so pages whose path changes per build piled
 * up in the bucket. Here a file is compared by content: the MD5 of the local
 * file against the object's ETag, which is the MD5 for a single-part upload to
 * a bucket that does not use KMS encryption. Any object whose ETag is not a
 * plain MD5 (multipart, KMS) counts as changed, so the worst case is the old
 * behaviour, never a stale page.
 *
 * Usage: node scripts/publish-html.mjs --bucket <name> [--dist dist] [--dry-run]
 *   --dry-run  list the bucket (read-only) and print what a deploy would
 *              upload and delete; change nothing.
 * The bucket may also come from DOCS_BUCKET.
 */

import { createHash } from 'node:crypto';
import { createReadStream } from 'node:fs';
import { mkdtemp, readdir, rm, writeFile } from 'node:fs/promises';
import { spawn } from 'node:child_process';
import { tmpdir } from 'node:os';
import { join, relative, sep } from 'node:path';
import { createInterface } from 'node:readline';
import { pathToFileURL } from 'node:url';

const UPLOAD_CONCURRENCY = 16;
const DELETE_CONCURRENCY = 6;
const DELETE_BATCH = 1000; // the S3 DeleteObjects limit

// A deploy whose dist/ is smaller than this, or lacks the pages below, is a
// broken build: refuse to delete anything on its word.
const MIN_LOCAL_FILES = 2000;
const REQUIRED_KEYS = ['index.html', 'user-guide/index.html'];

const isHtml = (key) => key.endsWith('.html');

/** A plain MD5 ETag, or null for a multipart (`<md5>-<n>`) or KMS-encrypted one. */
export function etagMd5(etag) {
  const bare = String(etag).replace(/^"|"$/g, '');
  return /^[0-9a-f]{32}$/.test(bare) ? bare : null;
}

/**
 * What a deploy does, given the local files (key -> md5 hex, every key under
 * dist/) and the bucket's objects (key -> ETag).
 */
export function plan(local, remote) {
  const uploads = [];
  let created = 0;
  let changed = 0;
  for (const [key, md5] of local) {
    if (!isHtml(key)) continue;
    const etag = remote.get(key);
    if (etag === undefined) {
      created++;
      uploads.push(key);
    } else if (etagMd5(etag) !== md5) {
      changed++;
      uploads.push(key);
    }
  }
  const deletes = [];
  let deletedHtml = 0;
  for (const key of remote.keys()) {
    if (local.has(key)) continue;
    deletes.push(key);
    if (isHtml(key)) deletedHtml++;
  }
  return {
    uploads,
    deletes,
    summary: {
      localFiles: local.size,
      localHtml: [...local.keys()].filter(isHtml).length,
      remoteObjects: remote.size,
      uploadsNew: created,
      uploadsChanged: changed,
      deletes: deletes.length,
      deletesHtml: deletedHtml,
      deletesOther: deletes.length - deletedHtml,
    },
  };
}

/** Why dist/ must not be trusted to decide deletions, or null when it can be. */
export function distProblem(local) {
  if (local.size < MIN_LOCAL_FILES) {
    return `dist/ has only ${local.size} files (expected at least ${MIN_LOCAL_FILES})`;
  }
  const missing = REQUIRED_KEYS.filter((key) => !local.has(key));
  if (missing.length) return `dist/ lacks ${missing.join(', ')}`;
  return null;
}

async function md5File(path) {
  const hash = createHash('md5');
  for await (const chunk of createReadStream(path)) hash.update(chunk);
  return hash.digest('hex');
}

/** key (forward slashes, relative to root) -> md5 of every regular file under root. */
async function hashTree(root) {
  const files = [];
  async function walk(dir) {
    for (const entry of await readdir(dir, { withFileTypes: true })) {
      const path = join(dir, entry.name);
      if (entry.isDirectory()) await walk(path);
      else if (entry.isFile()) files.push(path);
    }
  }
  await walk(root);
  const local = new Map();
  await pool(files, 32, async (path) => {
    local.set(relative(root, path).split(sep).join('/'), await md5File(path));
  });
  return local;
}

/** Run `worker` over `items`, at most `limit` at a time; the first failure rejects. */
async function pool(items, limit, worker) {
  let next = 0;
  async function lane() {
    while (next < items.length) {
      const item = items[next++];
      await worker(item);
    }
  }
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, lane));
}

function aws(args) {
  return new Promise((resolve, reject) => {
    const child = spawn('aws', args, { stdio: ['ignore', 'pipe', 'pipe'] });
    let out = '';
    let err = '';
    child.stdout.on('data', (d) => (out += d));
    child.stderr.on('data', (d) => (err += d));
    child.on('error', reject);
    child.on('close', (code) =>
      code === 0 ? resolve(out) : reject(new Error(`aws ${args.slice(0, 2).join(' ')} exited ${code}: ${err.trim()}`)),
    );
  });
}

/** key -> ETag for every object in the bucket. */
async function listBucket(bucket) {
  const child = spawn(
    'aws',
    [
      's3api', 'list-objects-v2',
      '--bucket', bucket,
      '--query', 'Contents[].[Key,ETag]',
      '--output', 'text',
    ],
    { stdio: ['ignore', 'pipe', 'pipe'] },
  );
  let err = '';
  child.stderr.on('data', (d) => (err += d));
  const exit = new Promise((resolve, reject) => {
    child.on('error', reject);
    child.on('close', resolve);
  });
  const remote = new Map();
  for await (const line of createInterface({ input: child.stdout })) {
    if (line === 'None' || line === '') continue; // an empty page, or an empty bucket
    const tab = line.lastIndexOf('\t');
    if (tab < 1) throw new Error(`unexpected line in the bucket listing: ${JSON.stringify(line.slice(0, 80))}`);
    remote.set(line.slice(0, tab), line.slice(tab + 1));
  }
  const code = await exit;
  if (code !== 0) throw new Error(`listing the bucket failed (exit ${code}): ${err.trim()}`);
  return remote;
}

async function upload(bucket, root, keys) {
  let done = 0;
  await pool(keys, UPLOAD_CONCURRENCY, async (key) => {
    await aws(['s3', 'cp', join(root, ...key.split('/')), `s3://${bucket}/${key}`, '--only-show-errors']);
    if (++done % 100 === 0) console.log(`[publish-html] uploaded ${done}/${keys.length}`);
  });
}

async function remove(bucket, keys) {
  const batches = [];
  for (let i = 0; i < keys.length; i += DELETE_BATCH) batches.push(keys.slice(i, i + DELETE_BATCH));
  const dir = await mkdtemp(join(tmpdir(), 'publish-html-'));
  let doneBatches = 0;
  try {
    await pool(batches.map((keysInBatch, n) => ({ keysInBatch, n })), DELETE_CONCURRENCY, async ({ keysInBatch, n }) => {
      const file = join(dir, `batch-${n}.json`);
      await writeFile(file, JSON.stringify({ Objects: keysInBatch.map((Key) => ({ Key })), Quiet: true }));
      const out = await aws(['s3api', 'delete-objects', '--bucket', bucket, '--delete', `file://${file}`, '--output', 'json']);
      const errors = out.trim() ? (JSON.parse(out).Errors ?? []) : [];
      if (errors.length) {
        throw new Error(`${errors.length} deletes failed in one batch, first: ${errors[0].Code} ${errors[0].Message}`);
      }
      if (++doneBatches % 50 === 0) console.log(`[publish-html] deleted ${doneBatches}/${batches.length} batches`);
    });
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
}

async function main() {
  const args = process.argv.slice(2);
  const flag = (name) => {
    const at = args.indexOf(name);
    return at === -1 ? undefined : args[at + 1];
  };
  const dryRun = args.includes('--dry-run');
  const bucket = flag('--bucket') ?? process.env.DOCS_BUCKET;
  const root = flag('--dist') ?? 'dist';
  if (!bucket) throw new Error('no bucket: pass --bucket or set DOCS_BUCKET');

  const local = await hashTree(root);
  const problem = distProblem(local);
  if (problem) throw new Error(`refusing to publish: ${problem}`);

  const remote = await listBucket(bucket);
  const { uploads, deletes, summary } = plan(local, remote);
  console.log(`[publish-html] ${dryRun ? 'dry run: ' : ''}${JSON.stringify(summary)}`);
  if (dryRun) {
    console.log(`[publish-html] sample uploads: ${uploads.slice(0, 5).join(', ') || '(none)'}`);
    console.log(`[publish-html] sample deletes: ${deletes.slice(0, 5).join(', ') || '(none)'}`);
    return;
  }

  await upload(bucket, root, uploads);
  await remove(bucket, deletes);
  console.log(`[publish-html] uploaded ${uploads.length}, deleted ${deletes.length}`);
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? '').href) {
  main().catch((error) => {
    console.error(`[publish-html] ${error.message}`);
    process.exit(1);
  });
}
