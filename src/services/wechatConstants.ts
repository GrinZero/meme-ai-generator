/**
 * 微信表情平台标准化常量定义
 */

import type { StandardizationPrompts } from '../types/wechatStandardization';

/**
 * 微信表情平台图片规格
 */
export const WECHAT_SPECS = {
  /** P1 详情页横幅 */
  BANNER: {
    width: 750,
    height: 400,
    maxSizeKB: 500,
    formats: ['png', 'jpeg'] as const,
    requiresTransparency: false,
    name: 'banner',
    displayName: '详情页横幅',
    fileName: 'banner_750x400',
  },
  /** P2 表情封面图 */
  COVER: {
    width: 240,
    height: 240,
    maxSizeKB: 500,
    formats: ['png'] as const,
    requiresTransparency: true,
    name: 'cover',
    displayName: '表情封面图',
    fileName: 'cover_240x240',
  },
  /** P3 聊天页图标 */
  ICON: {
    width: 50,
    height: 50,
    maxSizeKB: 100,
    formats: ['png'] as const,
    requiresTransparency: true,
    name: 'icon',
    displayName: '聊天页图标',
    fileName: 'icon_50x50',
  },
  /** P4 赞赏引导图 */
  APPRECIATION_GUIDE: {
    width: 750,
    height: 560,
    maxSizeKB: 500,
    formats: ['png', 'jpeg', 'gif'] as const,
    requiresTransparency: false,
    name: 'appreciationGuide',
    displayName: '赞赏引导图',
    fileName: 'appreciation_guide_750x560',
  },
  /** P5 赞赏致谢图 */
  APPRECIATION_THANKS: {
    width: 750,
    height: 750,
    maxSizeKB: 500,
    formats: ['png', 'jpeg', 'gif'] as const,
    requiresTransparency: false,
    name: 'appreciationThanks',
    displayName: '赞赏致谢图',
    fileName: 'appreciation_thanks_750x750',
  },
} as const;

/**
 * 支持的图片格式
 */
export const SUPPORTED_IMAGE_FORMATS = {
  /** 支持的 MIME 类型 */
  MIME_TYPES: [
    'image/png',
    'image/jpeg',
    'image/jpg',
    'image/webp',
  ] as const,
  /** 支持的文件扩展名 */
  EXTENSIONS: ['.png', '.jpg', '.jpeg', '.webp'] as const,
  /** 用于文件选择器的 accept 属性 */
  ACCEPT: 'image/png,image/jpeg,image/webp',
} as const;

/**
 * 上传限制
 */
export const UPLOAD_LIMITS = {
  /** 最大上传图片数量 */
  MAX_IMAGE_COUNT: 20,
  /** 单张图片最大大小 (MB) */
  MAX_FILE_SIZE_MB: 10,
} as const;

/**
 * 默认提示词
 */
export const DEFAULT_PROMPTS: StandardizationPrompts = {
  p1: `基于提供的表情包素材，创作一张微信表情详情页横幅图。
要求：
- 横幅构图（750×400），画面生动有趣、富有故事性
- 展现角色之间的互动或有趣的场景
- 可以使用动态姿势、夸张表情、有趣的情境
- 色调活泼明朗，与微信底色有较大区分
- 避免使用白色背景和纯色背景
- 图中避免出现任何文字信息
- 元素不能因拉伸或压扁导致变形
- 鼓励创意构图，让画面更加吸引眼球`,

  p2: `基于提供的表情包素材，创作一张微信表情封面图。
要求：
- 【重要】只生成单个角色的形象，绝对不要生成多个表情的拼接图或九宫格
- 【重要】不要生成表情包合集、网格排列或多图拼接
- 选取最具辨识度的单一角色形象
- 使用表情形象正面的半身像或全身像
- 避免只使用形象头部图片
- 画面尽量简洁，避免加入装饰元素
- 除纯文字类型表情外，避免出现文字
- 形象不应有白色描边，避免出现锯齿
- 背景需要透明或纯色便于后续处理`,

  p3: `基于提供的表情包素材，创作一张微信聊天页图标。
要求：
- 【重要】只生成单个角色的头部正面图，绝对不要生成多个表情的拼接图或九宫格
- 【重要】不要生成表情包合集、网格排列或多图拼接
- 选最具辨识度和清晰的单一角色头部
- 画面尽量简洁，避免加入装饰元素
- 使用仅含表情角色头部正面图像
- 形象不应有白色描边，避免出现锯齿
- 不要出现正方形边框
- 每张图片不应有过多留白
- 背景需要透明或纯色便于后续处理`,

  appreciationGuide: `基于提供的表情包素材，创作一张微信表情赞赏引导图。
要求：
- 尺寸 750×560 像素
- 用于吸引用户发赞赏，画面要有感染力
- 风格必须与表情包一致
- 可以展示角色做出感谢、期待、可爱的姿势
- 不可出现与表情不相关的内容
- 避免出现文字（除非是表情本身的文字风格）
- 色调温暖友好，让用户产生好感`,

  appreciationThanks: `基于提供的表情包素材，创作一张微信表情赞赏致谢图。
要求：
- 尺寸 750×750 像素
- 用于激发用户分享意愿，画面要有感染力
- 风格必须与表情包一致
- 可以展示角色做出感谢、开心、比心的姿势
- 不可出现与表情不相关的内容
- 避免出现文字（除非是表情本身的文字风格）
- 色调温暖友好，传达感谢之情`,
};

/**
 * 图片压缩配置
 */
export const COMPRESSION_CONFIG = {
  /** 初始 JPEG 质量 */
  INITIAL_JPEG_QUALITY: 0.92,
  /** 最低 JPEG 质量 */
  MIN_JPEG_QUALITY: 0.5,
  /** 每次压缩质量递减步长 */
  QUALITY_STEP: 0.05,
  /** PNG 压缩级别 (0-9) */
  PNG_COMPRESSION_LEVEL: 6,
} as const;

/**
 * 文件命名规范
 */
export const FILE_NAMING = {
  /** ZIP 包名称 */
  ZIP_NAME: 'wechat_sticker_pack.zip',
  /** 获取标准文件名 */
  getFileName: (type: 'banner' | 'cover' | 'icon' | 'appreciationGuide' | 'appreciationThanks', format: 'png' | 'jpeg'): string => {
    const spec = type === 'banner' ? WECHAT_SPECS.BANNER
      : type === 'cover' ? WECHAT_SPECS.COVER
      : type === 'icon' ? WECHAT_SPECS.ICON
      : type === 'appreciationGuide' ? WECHAT_SPECS.APPRECIATION_GUIDE
      : WECHAT_SPECS.APPRECIATION_THANKS;
    const ext = format === 'jpeg' ? 'jpg' : 'png';
    return `${spec.fileName}.${ext}`;
  },
} as const;

/**
 * 验证文件格式是否支持
 */
export function isValidImageFormat(mimeType: string): boolean {
  return SUPPORTED_IMAGE_FORMATS.MIME_TYPES.includes(
    mimeType as typeof SUPPORTED_IMAGE_FORMATS.MIME_TYPES[number]
  );
}

/**
 * 验证文件大小是否在限制内
 */
export function isValidFileSize(sizeBytes: number): boolean {
  const sizeMB = sizeBytes / (1024 * 1024);
  return sizeMB <= UPLOAD_LIMITS.MAX_FILE_SIZE_MB;
}

/**
 * 获取图片类型规格
 */
export function getSpecByType(type: 'banner' | 'cover' | 'icon' | 'appreciationGuide' | 'appreciationThanks') {
  switch (type) {
    case 'banner':
      return WECHAT_SPECS.BANNER;
    case 'cover':
      return WECHAT_SPECS.COVER;
    case 'icon':
      return WECHAT_SPECS.ICON;
    case 'appreciationGuide':
      return WECHAT_SPECS.APPRECIATION_GUIDE;
    case 'appreciationThanks':
      return WECHAT_SPECS.APPRECIATION_THANKS;
  }
}
