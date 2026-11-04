import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { test } from 'node:test';
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { deleteProblem, distProblem, etagMd5, plan, remove, upload } from './publish-html.mjs';

const md5 = (text) => createHash('md5').update(text).digest('hex');

test('etagMd5 reads a plain MD5 and refuses multipart or KMS ETags', () => {
  assert.equal(etagMd5(`"${md5('a')}"`), md5('a'));
  assert.equal(etagMd5(md5('a')), md5('a'));
  assert.equal(etagMd5(`"${md5('a')}-3"`), null);
  assert.equal(etagMd5('"not-an-md5"'), null);
});

test('plan uploads only new or changed HTML, and treats an unverifiable ETag as changed', () => {
  const local = new Map([
    ['index.html', md5('same')],
    ['a/changed.html', md5('new')],
    ['a/new.html', md5('fresh')],
    ['a/multipart.html', md5('x')],
    ['_astro/app.js', md5('js')],
  ]);
  const remote = new Map([
    ['index.html', `"${md5('same')}"`],
    ['a/changed.html', `"${md5('old')}"`],
    ['a/multipart.html', `"${md5('x')}-2"`],
    ['_astro/app.js', `"${md5('other')}"`], // assets are the sync step's job, not this script's
  ]);
  const { uploads, summary } = plan(local, remote);
  assert.deepEqual(uploads.sort(), ['a/changed.html', 'a/multipart.html', 'a/new.html']);
  assert.equal(summary.uploadsNew, 1);
  assert.equal(summary.uploadsChanged, 2);
});

test('plan deletes every key that is no longer built, HTML included, and nothing else', () => {
  const local = new Map([['index.html', md5('a')], ['_astro/app.js', md5('b')]]);
  const remote = new Map([
    ['index.html', `"${md5('a')}"`],
    ['_astro/app.js', `"${md5('b')}"`],
    ['api/rust/old/struct.Gone.html', '"e1"'],
    ['_astro/old.css', '"e2"'],
  ]);
  const { deletes, summary } = plan(local, remote);
  assert.deepEqual(deletes.sort(), ['_astro/old.css', 'api/rust/old/struct.Gone.html']);
  assert.equal(summary.deletesHtml, 1);
  assert.equal(summary.deletesOther, 1);
});

test('plan against an unchanged site does nothing', () => {
  const local = new Map([['index.html', md5('a')]]);
  const remote = new Map([['index.html', `"${md5('a')}"`]]);
  const { uploads, deletes } = plan(local, remote);
  assert.equal(uploads.length, 0);
  assert.equal(deletes.length, 0);
});

test('distProblem refuses a dist/ that is too small or lacks the core pages', () => {
  const full = new Map(Array.from({ length: 2500 }, (_, i) => [`p${i}.html`, 'x']));
  assert.match(distProblem(full), /lacks index\.html, user-guide\/index\.html/);
  full.set('index.html', 'x');
  full.set('user-guide/index.html', 'x');
  assert.equal(distProblem(full), null);
  assert.match(distProblem(new Map([['index.html', 'x'], ['user-guide/index.html', 'x']])), /only 2 files/);
  assert.match(distProblem(new Map()), /only 0 files/);
});

test('deleteProblem refuses a plan that deletes over half the bucket', () => {
  assert.equal(deleteProblem({ deletes: 40, remoteObjects: 100 }), null);
  assert.equal(deleteProblem({ deletes: 50, remoteObjects: 100 }), null);
  assert.match(deleteProblem({ deletes: 51, remoteObjects: 100 }), /more than half/);
  assert.equal(deleteProblem({ deletes: 0, remoteObjects: 0 }), null);
});

test('upload sends the keys in one recursive copy of a staging folder, then removes it', async () => {
  const root = mkdtempSync(join(tmpdir(), 'publish-html-test-'));
  mkdirSync(join(root, 'a', 'b'), { recursive: true });
  writeFileSync(join(root, 'index.html'), 'home');
  writeFileSync(join(root, 'a', 'b', 'page.html'), 'page');
  writeFileSync(join(root, 'skipped.html'), 'not in keys');
  const calls = [];
  const staged = [];
  try {
    await upload('b', root, ['index.html', 'a/b/page.html'], async (args) => {
      calls.push(args);
      const stage = args[2];
      staged.push(stage, readFileSync(join(stage, 'index.html'), 'utf8'), readFileSync(join(stage, 'a', 'b', 'page.html'), 'utf8'));
      staged.push(existsSync(join(stage, 'skipped.html')));
      return '';
    });
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
  assert.equal(calls.length, 1, 'one aws call, not one per file');
  assert.deepEqual(calls[0].slice(0, 2), ['s3', 'cp']);
  const target = new URL(calls[0][3]);
  assert.deepEqual([target.protocol, target.hostname, target.pathname], ['s3:', 'b', '/']);
  assert.ok(calls[0].includes('--recursive'));
  assert.deepEqual(staged.slice(1), ['home', 'page', false]);
  assert.equal(existsSync(staged[0]), false, 'the staging folder is gone');
});

test('upload calls nothing when there is nothing to send, and cleans up when aws fails', async () => {
  const calls = [];
  await upload('b', 'dist', [], async (args) => calls.push(args));
  assert.equal(calls.length, 0);
  const root = mkdtempSync(join(tmpdir(), 'publish-html-test-'));
  writeFileSync(join(root, 'index.html'), 'home');
  let stage;
  try {
    await assert.rejects(
      upload('b', root, ['index.html'], async (args) => {
        stage = args[2];
        throw new Error('aws s3 cp exited 1');
      }),
      /exited 1/,
    );
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
  assert.equal(existsSync(stage), false);
});

test('remove deletes in batches of at most 1000 keys and fails on a per-key error', async () => {
  const keys = Array.from({ length: 2300 }, (_, i) => `old/${i}.html`);
  const sizes = [];
  const seen = new Set();
  await remove('b', keys, async (args) => {
    const body = JSON.parse(readFileSync(args[args.indexOf('--delete') + 1].replace('file://', ''), 'utf8'));
    sizes.push(body.Objects.length);
    for (const { Key } of body.Objects) seen.add(Key);
    return '';
  });
  assert.deepEqual(sizes.sort((a, b) => b - a), [1000, 1000, 300]);
  assert.equal(seen.size, 2300);

  await assert.rejects(
    remove('b', ['x.html'], async () => JSON.stringify({ Errors: [{ Key: 'x.html', Code: 'AccessDenied', Message: 'no' }] })),
    /AccessDenied/,
  );
});
