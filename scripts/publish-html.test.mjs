import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { test } from 'node:test';
import { readFileSync } from 'node:fs';
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

test('upload sends each key to its own object', async () => {
  const calls = [];
  await upload('b', 'dist', ['index.html', 'a/b/page.html'], async (args) => calls.push(args));
  assert.equal(calls.length, 2);
  const targets = calls.map((args) => new URL(args[3]).pathname).sort();
  assert.deepEqual(targets, ['/a/b/page.html', '/index.html']);
  assert.ok(calls.every((args) => new URL(args[3]).hostname === 'b'));
  for (const args of calls) assert.deepEqual(args.slice(0, 2), ['s3', 'cp']);
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
