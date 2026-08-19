'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');

const {
  ROUTES,
  toBool,
  normalize,
  resolveRoute,
  fromEnv,
  detect,
} = require('../helpers/capabilities');

test('toBool 归一化各种能力表示', () => {
  assert.equal(toBool(true), true);
  assert.equal(toBool('true'), true);
  assert.equal(toBool('1'), true);
  assert.equal(toBool('YES'), true);
  assert.equal(toBool(' on '), true);
  assert.equal(toBool(false), false);
  assert.equal(toBool('false'), false);
  assert.equal(toBool('0'), false);
  assert.equal(toBool(undefined), false);
  assert.equal(toBool(null), false);
  assert.equal(toBool(0), false);
});

test('normalize 输出确定的三项布尔值', () => {
  assert.deepEqual(normalize({ canReadImages: 'true', canGenerateImages: 1, canAccessGeneratedImage: undefined }), {
    canReadImages: true,
    canGenerateImages: false,
    canAccessGeneratedImage: false,
  });
});

test('主路径：读图 + 生图 + 可取图 → full', () => {
  const caps = { canReadImages: true, canGenerateImages: true, canAccessGeneratedImage: true };
  assert.equal(resolveRoute(caps), ROUTES.FULL);
  const d = detect(caps, {});
  assert.equal(d.route, ROUTES.FULL);
  assert.equal(d.isMainPath, true);
  assert.ok(d.description.includes('主路径'));
});

test('降级：能生图但取不到生成图文件 → split-delivery', () => {
  const caps = { canReadImages: true, canGenerateImages: true, canAccessGeneratedImage: false };
  assert.equal(resolveRoute(caps), ROUTES.SPLIT_DELIVERY);
  assert.equal(detect(caps, {}).isMainPath, false);
});

test('降级：无视觉 → svg-fallback（即使能生图也不能假装看图）', () => {
  assert.equal(
    resolveRoute({ canReadImages: false, canGenerateImages: true, canAccessGeneratedImage: true }),
    ROUTES.SVG_FALLBACK
  );
  assert.equal(
    resolveRoute({ canReadImages: false, canGenerateImages: false, canAccessGeneratedImage: false }),
    ROUTES.SVG_FALLBACK
  );
});

test('降级：无生图 → svg-fallback', () => {
  assert.equal(
    resolveRoute({ canReadImages: true, canGenerateImages: false, canAccessGeneratedImage: true }),
    ROUTES.SVG_FALLBACK
  );
});

test('fromEnv 读取宿主声明的环境变量', () => {
  const env = {
    FOOD_CARD_READ_IMAGES: 'true',
    FOOD_CARD_GENERATE_IMAGES: '1',
    FOOD_CARD_ACCESS_GENERATED_IMAGE: 'no',
  };
  const c = normalize(fromEnv(env));
  assert.equal(c.canReadImages, true);
  assert.equal(c.canGenerateImages, true);
  assert.equal(c.canAccessGeneratedImage, false);
  assert.equal(resolveRoute(fromEnv(env)), ROUTES.SPLIT_DELIVERY);
});

test('detect：显式声明优先于环境变量', () => {
  const env = { FOOD_CARD_READ_IMAGES: 'true', FOOD_CARD_GENERATE_IMAGES: 'true' };
  const d = detect({ canReadImages: false }, env);
  assert.equal(d.caps.canReadImages, false); // 显式 false 覆盖环境变量
});
