#!/usr/bin/env node
/**
 * Normalize mtimes on every file under dist/ to a fixed past timestamp.
 *
 * Why: `aws s3 sync` decides "upload this file or skip" by comparing
 * (size, last-modified-time). Each `npm run build:full` regenerates the
 * entire dist/ tree with brand-new mtimes — so even when the build is
 * byte-for-byte identical to the previous one (Pagefind index, rustdoc
 * HTML, unchanged Astro pages…), sync sees local-newer-than-S3 and
 * re-uploads it. That added ~7 min to the test deploy on 2026-05-27
 * for ~3000 files whose contents had not changed at all.
 *
 * After this script runs, every local file's mtime is older than any
 * S3 object's mtime, so sync's comparison resolves to:
 *   - sizes equal AND local-not-newer → SKIP  ← the common case
 *   - sizes differ                    → upload (still correct: real
 *                                       content changes always alter
 *                                       byte-length for HTML/JS/CSS
 *                                       output of these tools)
 *
 * Trade-off: a hypothetical content change that PRESERVES byte size
 * would be missed. That can't happen for prose HTML produced by Astro
 * (any visible-text edit changes length) and is astronomically unlikely
 * for typedoc/rustdoc HTML. If we ever hit it, switch to a content-hash
 * comparison in deploy-cli's Phase A (planned followup; see
 * dev-tools#338 for the HTML version).
 */

import { utimes, readdir } from 'node:fs/promises';
import { join } from 'node:path';

// A fixed PAST date — older than any S3 object (uploaded in real time) so
// `aws s3 sync` resolves "local not newer" → SKIP for unchanged files.
//
// NOT the Unix epoch (1970-01-01T00:00:00Z): the AWS CLI flags a mtime at/near
// epoch 0 as "File has an invalid timestamp. Passing epoch time as timestamp"
// and then exits with code 2 (on Windows the FILETIME→epoch conversion of 0
// underflows). deploy-cli treats that non-zero exit as an upload failure and
// aborts before the CloudFront invalidation. A valid, well-after-epoch date
// keeps the skip-unchanged optimization without tripping the warning.
const FIXED_DATE = new Date('2000-01-01T00:00:00Z');
const ROOT = process.argv[2] ?? 'dist';

let fileCount = 0;

async function walk(dir) {
  const entries = await readdir(dir, { withFileTypes: true });
  await Promise.all(
    entries.map(async (entry) => {
      const path = join(dir, entry.name);
      if (entry.isDirectory()) {
        await walk(path);
      } else if (entry.isFile()) {
        await utimes(path, FIXED_DATE, FIXED_DATE);
        fileCount++;
      }
      // Symlinks and special files are skipped intentionally — dist/ from
      // Astro/typedoc/rustdoc doesn't produce them, and `utimes` would
      // follow the symlink target which may live outside dist/.
    })
  );
}

const startedAt = Date.now();
await walk(ROOT);
const ms = Date.now() - startedAt;
console.log(`[normalize-mtimes] set mtime on ${fileCount} file(s) under ${ROOT}/ in ${ms}ms`);
