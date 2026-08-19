# Examples（示例）

| 文件 | 说明 |
| --- | --- |
| `demo-card.html` | 可翻转卡片成品示例（inline SVG 手帐视觉，即「无生图能力」的降级产物）。双击用浏览器打开，点击卡片即可 3D 翻转。 |

## 三种产物形态（按宿主能力决定）

1. **主路径产物**（读图 + 生图 + 可取图）：正面是生成的**手帐风位图**，以 `data:image/...;base64` 内联嵌入 HTML。
2. **降级产物 A**（能读图 / 能取到原图，但无生图）：正面用**用户原图**（`fileToDataUri` 转换后内联）。
3. **降级产物 B**（无视觉或无生图、且无可用原图）：正面用 **inline SVG/CSS** 手绘（如 `demo-card.html`）。

## 用 helpers 重新生成（Node.js ≥ 18）

```js
const { fileToDataUri } = require('../helpers/image-io');
const { buildCardHtml, assertSelfContained } = require('../helpers/html-builder');

// 主路径：真实图片 → data URI → 嵌入
const src = await fileToDataUri('/path/to/photo.jpg');
const { html, warnings } = buildCardHtmlDetailed({
  front: { type: 'image', src, stickers: ['☕', '🥐', '🍳', '☀️', '🚲', '✈️'], keywords: ['HYGGE', 'SOLO', 'BRUNCH'] },
  back: { story: '只有从照片/用户确认过的内容才写进故事。', fields: [] },
  meta: { title: '美食记忆故事卡' },
});
if (assertSelfContained(html).length) throw new Error('产物违反自包含约束');
console.log(warnings.length ? `降级警告：${warnings.join('；')}` : '主路径产物，无降级');

// fallback：inline SVG
const html2 = buildCardHtml({
  front: { type: 'svg', svg: '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100">…</svg>' },
  back: { story: '' },
});
```

> 演示用真实 1×1 测试图：`tests/fixtures/sample.png`。
