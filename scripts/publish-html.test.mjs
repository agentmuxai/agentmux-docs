import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { test } from 'node:test';
import { distProblem, etagMd5, plan } from './publish-html.mjs';

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
