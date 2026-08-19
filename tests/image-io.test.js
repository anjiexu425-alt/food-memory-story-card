'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');
const fs = require('node:fs');
const os = require('node:os');

const {
  detectMime,
  fileToDataUri,
  svgToDataUri,
  isDataUri,
  isHttpUrl,
  assertEmbeddable,
} = require('../helpers/image-io');

const PNG_1PX_B64 =
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==';

const FIXTURE_PNG = path.join(__dirname, 'fixtures', 'sample.png');

test('detectMime 识别 PNG / JPEG / 未知', () => {
  assert.equal(detectMime(Buffer.from(PNG_1PX_B64, 'base64')), 'image/png');
  const jpeg = Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0]);
  assert.equal(detectMime(jpeg), 'image/jpeg');
  assert.equal(detectMime(Buffer.from('not-an-image')), null);
  assert.equal(detectMime(Buffer.alloc(4)), null);
});

test('fileToDataUri 真实读取文件并生成可解码的 data URI', async () => {
  const uri = await fileToDataUri(FIXTURE_PNG);
  assert.ok(uri.startsWith('data:image/png;base64,'));
  const b64 = uri.slice('data:image/png;base64,'.length);
  assert.deepEqual(Buffer.from(b64, 'base64'), fs.readFileSync(FIXTURE_PNG));
});

test('fileToDataUri 对不存在的文件抛错（不伪造）', async () => {
  await assert.rejects(() => fileToDataUri('/definitely/not/here.png'));
});

test('svgToDataUri 生成 UTF-8 安全的 data URI', () => {
  const svg = '<svg xmlns="http://www.w3.org/2000/svg"><text>🍜 面</text></svg>';
  const uri = svgToDataUri(svg);
  assert.ok(uri.startsWith('data:image/svg+xml;charset=utf-8,'));
  const decoded = decodeURIComponent(uri.slice('data:image/svg+xml;charset=utf-8,'.length));
  assert.ok(decoded.includes('🍜'));
  assert.throws(() => svgToDataUri('not svg'));
});

test('isDataUri / isHttpUrl 判定', () => {
  assert.ok(isDataUri('data:image/png;base64,abc'));
  assert.ok(!isDataUri('images/foo.png'));
  assert.ok(isHttpUrl('https://example.com/a.png'));
  assert.ok(!isHttpUrl('data:image/png;base64,abc'));
  assert.ok(!isHttpUrl('/local/path/a.png'));
});

test('assertEmbeddable 拦截假路径与假 base64，放行真实 data:image', () => {
  assert.doesNotThrow(() => assertEmbeddable('data:image/jpeg;base64,AAAA'));
  assert.throws(() => assertEmbeddable('/fake/path/img.png'));
  assert.throws(() => assertEmbeddable('data:fake'));
  assert.throws(() => assertEmbeddable(undefined));
});
