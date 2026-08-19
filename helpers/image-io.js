'use strict';

/**
 * 图片输入输出（V1）：把真实图片转换为可嵌入 HTML 的 data URI。
 *
 * 诚实原则：
 * - fileToDataUri 只做真实文件读取，绝不伪造 base64；
 * - assertEmbeddable 拦截任何非 data:image/ 的"资源"，防止假路径 / 假 base64 混入 HTML。
 */

const fs = require('fs');

const EXT_MIME = {
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif': 'image/gif',
  '.webp': 'image/webp',
  '.svg': 'image/svg+xml',
};

/** 用文件头魔术字节探测 MIME（PNG / JPEG / GIF / WebP）。 */
function detectMime(buffer) {
  if (!Buffer.isBuffer(buffer) || buffer.length < 12) return null;
  const is = (bytes) => bytes.every((b, i) => buffer[i] === b);
  if (is([0x89, 0x50, 0x4e, 0x47])) return 'image/png';
  if (is([0xff, 0xd8, 0xff])) return 'image/jpeg';
  if (is([0x47, 0x49, 0x46, 0x38])) return 'image/gif';
  if (is([0x52, 0x49, 0x46, 0x46]) && buffer.toString('ascii', 8, 12) === 'WEBP') {
    return 'image/webp';
  }
  return null;
}

/** MIME 探测失败时按扩展名兜底；仍未知则默认 image/jpeg。 */
function mimeFromPath(filePath) {
  const dot = String(filePath).lastIndexOf('.');
  const ext = dot >= 0 ? String(filePath).slice(dot).toLowerCase() : '';
  return EXT_MIME[ext] || 'image/jpeg';
}

/**
 * 本地图片文件 → data URI。
 * @param {string} filePath 本地文件路径
 * @returns {Promise<string>} 形如 data:image/jpeg;base64,....
 */
async function fileToDataUri(filePath) {
  const buffer = await fs.promises.readFile(filePath);
  const mime = detectMime(buffer) || mimeFromPath(filePath);
  return `data:${mime};base64,${buffer.toString('base64')}`;
}

/** 内联 SVG 字符串 → data URI（UTF-8 安全）。 */
function svgToDataUri(svg) {
  if (typeof svg !== 'string' || !svg.includes('<svg')) {
    throw new TypeError('svgToDataUri: 需要包含 <svg> 的字符串');
  }
  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
}

function isDataUri(value) {
  return typeof value === 'string' && value.startsWith('data:');
}

function isHttpUrl(value) {
  return typeof value === 'string' && /^https?:\/\//i.test(value);
}

/**
 * 校验资源可安全嵌入 HTML。
 * 必须是 data:image/ 开头的真实 data URI，否则抛错（阻止假路径 / 假 base64 进入产物）。
 */
function assertEmbeddable(resource) {
  if (typeof resource !== 'string' || !resource.startsWith('data:image/')) {
    throw new Error(
      '资源无法嵌入 HTML：必须是真实 data:image/... 的 data URI。' +
        '本地图片请用 fileToDataUri() 转换；生成图请由生成工具返回 base64 或文件路径后转换。' +
        `收到：${typeof resource === 'string' ? resource.slice(0, 40) + '…' : typeof resource}`
    );
  }
  return resource;
}

module.exports = {
  EXT_MIME,
  detectMime,
  mimeFromPath,
  fileToDataUri,
  svgToDataUri,
  isDataUri,
  isHttpUrl,
  assertEmbeddable,
};
