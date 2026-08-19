'use strict';

/**
 * 宿主能力探测与路由（V1）。
 *
 * 设计原则：不写死任何工具名（read_image / 图像生成工具等）。
 * 宿主（agent）把自身三项能力以布尔值显式传入，或通过环境变量注入；
 * 本模块只负责：归一化能力 → 计算路由 → 输出可读说明。
 */

const ROUTES = Object.freeze({
  /** 主路径：读图 → 生图 → 取图 → base64 嵌入 HTML */
  FULL: 'full',
  /** 降级：生图成功但拿不到生成图片文件 → 生成图单独交付 + HTML 用原图/SVG */
  SPLIT_DELIVERY: 'split-delivery',
  /** 降级：无视觉或无生图 → inline SVG/CSS 手帐视觉（画面锚点来自文字描述或原图） */
  SVG_FALLBACK: 'svg-fallback',
});

const ROUTE_DESCRIPTIONS = Object.freeze({
  'full':
    '主路径：读图 → 生图 → 取图 → 真实图片转 data URI 嵌入 HTML。',
  'split-delivery':
    '降级：能生图但拿不到生成图片文件 → 生成图单独交付给用户，HTML 改用原图或 inline SVG，并如实说明。',
  'svg-fallback':
    '降级：无视觉或无生图 → 不用位图；有可读取的原图则用原图，否则 inline SVG/CSS 手绘手帐视觉。画面锚点来自用户文字描述，绝不假装看过照片。',
});

/**
 * 归一化能力值为布尔。
 * 支持 boolean、字符串 'true'/'1'/'yes'/'on'、undefined/null。
 */
function toBool(value) {
  if (typeof value === 'boolean') return value;
  if (typeof value === 'string') {
    return ['true', '1', 'yes', 'on'].includes(value.trim().toLowerCase());
  }
  return false;
}

/** 归一化能力对象，输出确定的三项布尔值。 */
function normalize(caps = {}) {
  return {
    canReadImages: toBool(caps.canReadImages),
    canGenerateImages: toBool(caps.canGenerateImages),
    canAccessGeneratedImage: toBool(caps.canAccessGeneratedImage),
  };
}

/**
 * 计算路由（决策表）：
 * - FULL：读图 + 生图 + 可取到生成图文件
 * - SPLIT_DELIVERY：读图 + 生图，但取不到生成图文件
 * - SVG_FALLBACK：其余一切（无读图 → 不能假装看图；无生图 → 不能用位图）
 */
function resolveRoute(caps = {}) {
  const c = normalize(caps);
  if (c.canReadImages && c.canGenerateImages && c.canAccessGeneratedImage) {
    return ROUTES.FULL;
  }
  if (c.canReadImages && c.canGenerateImages) {
    return ROUTES.SPLIT_DELIVERY;
  }
  return ROUTES.SVG_FALLBACK;
}

/** 从环境变量读取宿主声明的能力（FOOD_CARD_* 或通用 CAN_* 前缀）。 */
function fromEnv(env = process.env) {
  return {
    canReadImages: env.FOOD_CARD_READ_IMAGES ?? env.CAN_READ_IMAGES,
    canGenerateImages: env.FOOD_CARD_GENERATE_IMAGES ?? env.CAN_GENERATE_IMAGES,
    canAccessGeneratedImage:
      env.FOOD_CARD_ACCESS_GENERATED_IMAGE ?? env.CAN_ACCESS_GENERATED_IMAGE,
  };
}

/**
 * 完整探测：显式声明优先，环境变量兜底。
 * 返回 { caps, route, description, isMainPath }。
 */
function detect(caps, env = process.env) {
  const merged = { ...fromEnv(env), ...(caps || {}) };
  const normalized = normalize(merged);
  const route = resolveRoute(normalized);
  return {
    caps: normalized,
    route,
    description: ROUTE_DESCRIPTIONS[route] || '',
    isMainPath: route === ROUTES.FULL,
  };
}

module.exports = { ROUTES, ROUTE_DESCRIPTIONS, toBool, normalize, resolveRoute, fromEnv, detect };
