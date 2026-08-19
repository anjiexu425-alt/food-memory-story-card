'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');

const { buildCardHtml, buildCardHtmlDetailed, assertSelfContained, DEFAULT_FIELDS } = require('../helpers/html-builder');
const { fileToDataUri } = require('../helpers/image-io');

const FIXTURE_PNG = path.join(__dirname, 'fixtures', 'sample.png');

const FIXTURE_SVG =
  '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100">' +
  '<rect width="100" height="100" fill="#faf5ec"/>' +
  '<circle cx="50" cy="50" r="30" fill="#e6b04e"/>' +
  '</svg>';

const STORY = '这顿 brunch 是丹麦 solo trip 里的一餐。';

test('主路径：真实图片 data URI 嵌入，产物单文件自包含', async () => {
  const uri = await fileToDataUri(FIXTURE_PNG);
  const html = buildCardHtml({
    front: {
      type: 'image',
      src: uri,
      stickers: ['☕', '🥐', '🍳', '☀️', '🚲', '✈️'],
      keywords: ['HYGGE', 'SOLO', 'BRUNCH'],
    },
    back: {
      story: STORY,
      fields: [
        { label: '日期', value: '2026.06.04' },
        { label: '一起吃的人', value: '一个人' },
        { label: '心情', value: '' },
      ],
    },
    meta: { title: '丹麦 Solo Brunch', tag: 'DENMARK · SOLO TRIP' },
  });

  assert.ok(html.includes('data:image/png;base64,'));
  assert.ok(html.includes('rotateY(180deg)'));
  assert.ok(html.includes('classList.toggle'));
  assert.ok(html.includes('HYGGE · SOLO · BRUNCH'));
  assert.ok(html.includes('2026.06.04'));
  assert.deepEqual(assertSelfContained(html), []);
  // 单文件：恰好一个内联 <script> 且无 src
  assert.equal((html.match(/<script/g) || []).length, 1);
  assert.ok(!/<script[^>]*src=/i.test(html));
});

test('fallback：inline SVG 正面，同样单文件自包含', () => {
  const html = buildCardHtml({
    front: { type: 'svg', svg: FIXTURE_SVG, stickers: ['☕'], keywords: ['HYGGE'] },
    back: { story: STORY },
  });
  assert.ok(html.includes('<svg'));
  assert.ok(!html.includes('data:image/png'));
  assert.ok(html.includes('rotateY'));
  assert.deepEqual(assertSelfContained(html), []);
});

test('兜底：无任何视觉资源时输出 css-only 正面，卡片仍完整', () => {
  const html = buildCardHtml({ front: {}, back: { story: '' } });
  assert.ok(html.includes('art-css'));
  assert.ok(html.includes('classList.toggle'));
  assert.deepEqual(assertSelfContained(html), []);
});

test('记忆诚实：未提供字段时输出空位占位，不编造事实', () => {
  const html = buildCardHtml({ front: {}, back: { story: '' } });
  for (const label of ['日期', '地点', '一起吃的人', '心情']) {
    assert.ok(html.includes(label));
  }
  // 空位不再写死文本，而是 CSS :empty::before 占位符（点击即可编辑）
  assert.ok(html.includes('value blank'));
  assert.ok(html.includes(':empty::before'));
});

test('记忆诚实：提供的字段如实填入，缺的留空', () => {
  const html = buildCardHtml({
    front: {},
    back: { fields: [{ label: '日期', value: '2026.06.04' }, { label: '地点', value: '' }] },
  });
  assert.ok(html.includes('2026.06.04'));
  // 地点未提供 → 空值 + blank 占位（可编辑）
  assert.ok(html.includes('地点</span><span class="value blank" contenteditable="true"'));
  // 纯下划线输入也视为空位（不把 ________ 当真实内容）
  const html2 = buildCardHtml({ front: {}, back: { fields: [{ label: '心情', value: '________' }] } });
  assert.ok(html2.includes('心情</span><span class="value blank" contenteditable="true"'));
});

test('背面可编辑：字段与故事均为 contenteditable，编辑点击不翻转', () => {
  const html = buildCardHtml({
    front: {},
    back: { story: '一段故事。', fields: [{ label: '日期', value: '2026.06.04' }] },
  });
  assert.ok(html.includes('contenteditable="true"'));
  assert.ok(html.includes('<p class="story" contenteditable="true"'));
  // 空故事也渲染为可编辑元素（CSS 占位提示）
  const htmlEmpty = buildCardHtml({ front: {}, back: { story: '' } });
  assert.ok(htmlEmpty.includes('<p class="story" contenteditable="true"'));
  // 翻转 JS 保护可编辑区：点击编辑区不翻转
  assert.ok(html.includes("closest('[contenteditable=\"true\"]')"));
  // 默认 footer 提示可编辑
  assert.ok(html.includes('点击编辑'));
});

test('html-builder 遇到假路径/假 base64 自动降级，绝不写入假图', () => {
  // 假路径：不写入产物，降级为 css-only 占位，并给出警告
  const bad = buildCardHtmlDetailed({ front: { type: 'image', src: '/fake/path/img.png' } });
  assert.ok(!bad.html.includes('/fake/path/img.png'));
  assert.ok(bad.html.includes('art-css'));
  assert.ok(bad.warnings.length >= 1);
  assert.ok(bad.warnings[0].includes('未写入任何假路径/假 base64'));

  // 假 base64（非 data:image/）：同样降级
  const bad2 = buildCardHtmlDetailed({ front: { type: 'image', src: 'data:fake' } });
  assert.ok(!bad2.html.includes('data:fake'));
  assert.ok(bad2.warnings.length >= 1);

  // src 缺失：宽容 fallback，不抛错
  assert.doesNotThrow(() => buildCardHtml({ front: { type: 'image', src: undefined } }));
});

test('DEFAULT_FIELDS 全部是空位（不可包含编造的默认事实）', () => {
  for (const f of DEFAULT_FIELDS) {
    assert.equal(f.value, '', `字段 ${f.label} 默认值应为空`);
  }
});

test('HTML 转义：故事与字段中的特殊字符不会破坏结构', () => {
  const html = buildCardHtml({
    front: {},
    back: { story: '她说"很好吃" & <开心>', fields: [{ label: '心情', value: '平静' }] },
  });
  assert.ok(html.includes('&quot;'));
  assert.ok(html.includes('&lt;'));
  assert.ok(html.includes('&amp;'));
  assert.ok(!html.includes('<她说'));
});
