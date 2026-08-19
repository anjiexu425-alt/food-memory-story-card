'use strict';

/**
 * 单文件可翻转 HTML 生成器（V1）。
 *
 * 产物约束（由 assertSelfContained 校验）：
 * - 单文件：全部 CSS / JS 内联；
 * - 正面视觉只能是 data:image/... 的 data URI（主路径）或内联 SVG（fallback）；
 * - 禁止 <script src>、<link stylesheet>、外部 url()，保证离线可用。
 *
 * 记忆诚实：背面字段默认输出空位（________），只填入调用方（agent）
 * 从用户/照片确认过的真实信息，绝不自行编造日期、地点、同行人、经历。
 */

const DEFAULT_FIELDS = [
  { label: '日期', value: '' },
  { label: '地点', value: '' },
  { label: '一起吃的人', value: '' },
  { label: '心情', value: '' },
];

const STYLE = `
* { box-sizing: border-box; margin: 0; padding: 0; }
body {
  min-height: 100vh; display: grid; place-items: center;
  background: radial-gradient(circle at 50% 30%, #f2ead9 0%, #e6dbc4 100%);
  font-family: "PingFang SC", "Hiragino Sans GB", "Microsoft YaHei", "Noto Sans SC", system-ui, sans-serif;
  padding: 24px; -webkit-tap-highlight-color: transparent;
}
.scene { perspective: 1800px; }
.card {
  position: relative; width: min(720px, 92vw); aspect-ratio: 3 / 2;
  cursor: pointer; transform-style: preserve-3d;
  transition: transform .85s cubic-bezier(.35, .1, .2, 1);
}
.card.flipped { transform: rotateY(180deg); }
.face {
  position: absolute; inset: 0;
  backface-visibility: hidden; -webkit-backface-visibility: hidden;
  border-radius: 18px; overflow: hidden; background: #faf5ec;
  box-shadow: 0 2px 4px rgba(90,70,50,.12), 0 14px 40px rgba(90,70,50,.22);
}
.front { display: flex; flex-direction: column; padding: 14px 18px; }
.back { transform: rotateY(180deg); display: grid; place-items: center; padding: 24px; }
.corner-tag {
  display: flex; justify-content: space-between; align-items: center;
  font-size: clamp(9px,1.4vw,12px); letter-spacing: .18em; color: #9a8267;
  text-transform: uppercase; margin-bottom: 6px;
}
.corner-tag .hint { letter-spacing: .05em; opacity: .8; }
.front-main { flex: 1; display: flex; gap: 14px; min-height: 0; }
.art-wrap {
  flex: 1.55; border-radius: 10px; overflow: hidden; background: #f1e7d4;
  box-shadow: inset 0 0 0 2px rgba(150,120,85,.12); display: flex;
}
.art-wrap img.art, .art-wrap svg { width: 100%; height: 100%; display: block; object-fit: cover; }
.art-css { align-items: center; justify-content: center; font-size: 56px; color: #c9b493; }
.sticker-panel { flex: 1; display: flex; flex-direction: column; justify-content: center; gap: 10px; }
.stickers { display: grid; grid-template-columns: repeat(3, 1fr); gap: 9px; place-items: center; }
.sticker {
  width: clamp(34px,5.5vw,58px); height: clamp(34px,5.5vw,58px); border-radius: 50%;
  display: grid; place-items: center; font-size: clamp(16px,2.6vw,28px);
  background: #fff; border: 2px solid #f4ead6; box-shadow: 0 3px 6px rgba(90,70,50,.16);
}
.sticker:nth-child(1) { transform: rotate(-8deg); background: #f0e2cd; }
.sticker:nth-child(2) { transform: rotate(7deg); background: #f5e8bd; }
.sticker:nth-child(3) { transform: rotate(-4deg); background: #f6e6b2; }
.sticker:nth-child(4) { transform: rotate(9deg); background: #f6dcbd; }
.sticker:nth-child(5) { transform: rotate(-6deg); background: #d9e3e6; }
.sticker:nth-child(6) { transform: rotate(5deg); background: #eed8d2; }
.keywords {
  text-align: center; font-size: clamp(12px,2vw,20px); font-weight: 700;
  letter-spacing: .35em; color: #6b5540; margin-top: 8px;
}
.back-inner {
  width: 100%; height: 100%; display: flex; flex-direction: column;
  justify-content: center; gap: 12px; padding: 8px 10px;
  background-image: repeating-linear-gradient(transparent 0 30px, rgba(150,120,85,.10) 30px 31px);
}
.back-title { font-size: clamp(10px,1.5vw,13px); letter-spacing: .2em; color: #a08a6e; }
.story { font-size: clamp(12px,1.9vw,17px); line-height: 1.9; color: #4a3829; text-align: justify; white-space: pre-line; }
.fields { display: flex; flex-wrap: wrap; gap: 10px 22px; font-size: clamp(11px,1.7vw,15px); color: #5c4a38; }
.field .label { color: #a08a6e; margin-right: 6px; letter-spacing: .05em; }
.field .value { border-bottom: 1px dashed #c8b393; padding: 0 4px; }
.field .value.blank { color: #b9a686; letter-spacing: .12em; }
.back-footer { margin-top: 2px; font-size: clamp(10px,1.4vw,12px); color: #b09a7d; letter-spacing: .2em; }
/* ============ 背面可编辑（contenteditable） ============ */
[contenteditable="true"] { outline: none; cursor: text; border-radius: 3px; }
[contenteditable="true"]:hover { box-shadow: 0 0 0 1px dashed rgba(160,142,110,.5); }
[contenteditable="true"]:focus { box-shadow: 0 0 0 2px dashed #a08a6e; background: #fffdf7; }
/* 空位占位：元素为空时用 CSS 显示占位符，用户一点即消失可直接输入 */
.value.blank:empty::before { content: "________"; color: #b9a686; letter-spacing: .12em; }
.story:empty::before { content: "（写下这一刻的回忆…）"; color: #b9a686; letter-spacing: 0; }
@media (max-width: 560px) {
  .card { aspect-ratio: 3 / 4; }
  .front-main { flex-direction: column; }
  .art-wrap { flex: 1.4; }
  .sticker-panel { flex: 1; justify-content: center; }
  .stickers { grid-template-columns: repeat(6, 1fr); }
  .keywords { letter-spacing: .22em; }
  .back-inner { gap: 8px; }
}
`;

function escapeHtml(value) {
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

/** 无位图时的最后兜底占位（诚实降级：产物中可明确看到是占位，不假装有图）。 */
const CSS_ONLY_PLACEHOLDER =
  '<!-- 注意：本卡无位图正面（宿主能力降级），下方为占位。如能取得真实图片，' +
  '请用 helpers/image-io.js 的 fileToDataUri() 转换后以 front.type="image" 重新生成。 -->\n' +
  '          <div class="art art-css" aria-hidden="true"><span>🍽️</span></div>';

/** 正面视觉：image(data URI) / svg(内联) / css-only(最后兜底)。返回 { html, warnings }。 */
function buildFrontVisual(front) {
  const warnings = [];
  if (front && front.type === 'image') {
    if (front.src && /^data:image\//i.test(front.src)) {
      return { html: `<img class="art" src="${front.src}" alt="美食手帐插画">`, warnings };
    }
    // 诚实原则：src 缺失或不是合法 data:image URI → 不写入假图，自动降级并记录警告
    warnings.push(
      'front.type=image 但未提供合法 data:image/... 的 src（收到：' +
        (typeof front.src === 'string' ? front.src.slice(0, 30) + '…' : typeof front.src) +
        '），已自动降级为 css-only 占位，未写入任何假路径/假 base64。'
    );
    return { html: CSS_ONLY_PLACEHOLDER, warnings };
  }
  if (front && front.type === 'svg' && typeof front.svg === 'string' && front.svg.includes('<svg')) {
    return { html: front.svg, warnings };
  }
  warnings.push('未提供任何正面视觉资源，输出 css-only 占位（inline SVG 或图片 fallback 均未生效）。');
  return { html: CSS_ONLY_PLACEHOLDER, warnings };
}

function buildStickers(stickers) {
  const list = Array.isArray(stickers) && stickers.length ? stickers : ['🍽️'];
  return list
    .map((s) => `<div class="sticker" title="${escapeHtml(s)}">${escapeHtml(s)}</div>`)
    .join('\n            ');
}

function buildFields(fields) {
  const list = Array.isArray(fields) && fields.length ? fields : DEFAULT_FIELDS;
  return list
    .map((f) => {
      const raw = f && typeof f.value === 'string' ? f.value.trim() : '';
      // 空值或纯下划线占位 → 按空处理：CSS :empty::before 显示占位符
      const value = raw && !/^_{2,}$/.test(raw) ? raw : '';
      const blank = value ? '' : ' blank';
      // contenteditable：用户可在浏览器里直接编辑日期/地点/心情等内容
      return `<div class="field"><span class="label">${escapeHtml(f.label)}</span><span class="value${blank}" contenteditable="true" spellcheck="false">${escapeHtml(value)}</span></div>`;
    })
    .join('\n            ');
}

/**
 * 组装单文件可翻转 HTML（详细版）。
 * @param {object} options
 *  - front: { type: 'image'|'svg', src?, svg?, stickers?: string[], keywords?: string[] }
 *  - back:  { title?, story?, fields?: {label,value}[], footer? }
 *  - meta:  { title?, tag? }
 * @returns {{ html: string, warnings: string[] }}
 */
function buildCardHtmlDetailed(options = {}) {
  const { front = {}, back = {}, meta = {} } = options;
  const keywords = Array.isArray(front.keywords) && front.keywords.length
    ? escapeHtml(front.keywords.join(' · '))
    : '';

  const { html: frontVisual, warnings } = buildFrontVisual(front);
  const stickers = buildStickers(front.stickers);
  const fields = buildFields(back.fields);
  const story = typeof back.story === 'string' && back.story.trim() ? back.story.trim() : '';
  const title = meta.title || '美食记忆故事卡';
  const tag = meta.tag || 'FOOD MEMORY STORY';
  const backTitle = back.title || '— 记忆 · 这一刻 —';
  const footer = back.footer || '✎ 日期/地点/心情/故事均可点击编辑 · 点其他位置翻回正面';

  const html = `<!DOCTYPE html>
<html lang="zh-CN">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>${escapeHtml(title)}</title>
<style>
${STYLE}
</style>
</head>
<body>
  <div class="scene">
    <div class="card" id="card" role="button" aria-label="点击翻转卡片">
      <div class="face front">
        <div class="corner-tag">
          <span>${escapeHtml(tag)}</span>
          <span class="hint">点击翻转 ↺</span>
        </div>
        <div class="front-main">
          <div class="art-wrap">${frontVisual}</div>
          <div class="sticker-panel">
            <div class="stickers">${stickers}</div>
          </div>
        </div>
        ${keywords ? `        <div class="keywords">${keywords}</div>` : ''}
      </div>
      <div class="face back">
        <div class="back-inner">
          <div class="back-title">${escapeHtml(backTitle)}</div>
          <p class="story" contenteditable="true" spellcheck="false">${story ? escapeHtml(story) : ''}</p>
          <div class="fields">${fields}</div>
          <div class="back-footer">${escapeHtml(footer)}</div>
        </div>
      </div>
    </div>
  </div>
  <script>
    var card = document.getElementById('card');
    card.addEventListener('click', function (e) {
      // 在可编辑区域（日期/地点/心情/故事）点击时聚焦编辑，不触发翻转
      if (e.target.closest('[contenteditable="true"]')) return;
      card.classList.toggle('flipped');
    });
  </script>
</body>
</html>
`;
  return { html, warnings };
}

/** 便捷版：只返回 HTML 字符串（降级警告见 buildCardHtmlDetailed）。 */
function buildCardHtml(options = {}) {
  return buildCardHtmlDetailed(options).html;
}

/**
 * 自包含校验：返回所有违反"单文件 / 无外部依赖"规则的描述列表。
 * 空数组 = 通过。供测试与 agent 组装后复核使用。
 */
function assertSelfContained(html) {
  const issues = [];
  if (/<script[^>]*\bsrc\s*=/i.test(html)) issues.push('存在外部 <script src>');
  if (/<link[^>]*\brel\s*=\s*["']?stylesheet/i.test(html)) issues.push('存在外部 <link stylesheet>');
  for (const m of html.matchAll(/<img[^>]*\bsrc\s*=\s*["']([^"']+)["']/gi)) {
    if (!/^data:image\//i.test(m[1])) issues.push(`<img> 引用了非 data: 资源: ${m[1].slice(0, 40)}`);
  }
  for (const m of html.matchAll(/url\(\s*["']?([^"')]+)["']?\s*\)/gi)) {
    if (!/^(data:|#)/i.test(m[1])) issues.push(`CSS url() 引用了外部资源: ${m[1].slice(0, 40)}`);
  }
  return issues;
}

module.exports = { buildCardHtml, buildCardHtmlDetailed, assertSelfContained, DEFAULT_FIELDS };
