/**
 * 微信表情平台图像处理服务
 * 负责图片尺寸调整、居中裁剪、格式转换
 */

import type { ProcessedImage, ResizeOptions } from '../types/wechatStandardization';
import { WECHAT_SPECS, COMPRESSION_CONFIG } from './wechatConstants';

/**
 * 生成唯一 ID
 */
function generateId(): string {
  return `${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
}

/**
 * 将 Blob 转换为 HTMLImageElement
 */
async function blobToImage(blob: Blob): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    const url = URL.createObjectURL(blob);
    
    img.onload = () => {
      URL.revokeObjectURL(url);
      resolve(img);
    };
    
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error('Failed to load image'));
    };
    
    img.src = url;
  });
}

/**
 * 将 Canvas 转换为 Blob
 */
async function canvasToBlob(
  canvas: HTMLCanvasElement,
  format: 'png' | 'jpeg',
  quality?: number
): Promise<Blob> {
  return new Promise((resolve, reject) => {
    const mimeType = format === 'jpeg' ? 'image/jpeg' : 'image/png';
    canvas.toBlob(
      (blob) => {
        if (blob) {
          resolve(blob);
        } else {
          reject(new Error('Failed to convert canvas to blob'));
        }
      },
      mimeType,
      quality
    );
  });
}


/**
 * 计算居中裁剪的源区域
 * 保持目标宽高比，从源图片中心裁剪
 */
function calculateCenterCropArea(
  srcWidth: number,
  srcHeight: number,
  targetWidth: number,
  targetHeight: number
): { sx: number; sy: number; sw: number; sh: number } {
  const targetRatio = targetWidth / targetHeight;
  const srcRatio = srcWidth / srcHeight;
  
  let sw: number;
  let sh: number;
  let sx: number;
  let sy: number;
  
  if (srcRatio > targetRatio) {
    // 源图片更宽，需要裁剪左右
    sh = srcHeight;
    sw = srcHeight * targetRatio;
    sx = (srcWidth - sw) / 2;
    sy = 0;
  } else {
    // 源图片更高，需要裁剪上下
    sw = srcWidth;
    sh = srcWidth / targetRatio;
    sx = 0;
    sy = (srcHeight - sh) / 2;
  }
  
  return { sx, sy, sw, sh };
}

/**
 * 调整图片尺寸（居中裁剪，保持比例）
 * @param imageBlob 源图片 Blob
 * @param targetWidth 目标宽度
 * @param targetHeight 目标高度
 * @param options 调整选项
 * @returns 调整后的图片 Blob
 */
export async function resizeImage(
  imageBlob: Blob,
  targetWidth: number,
  targetHeight: number,
  options: ResizeOptions = {}
): Promise<Blob> {
  const {
    format = 'png',
    quality = 0.92,
  } = options;
  
  const img = await blobToImage(imageBlob);
  
  // 创建 canvas
  const canvas = document.createElement('canvas');
  canvas.width = targetWidth;
  canvas.height = targetHeight;
  
  const ctx = canvas.getContext('2d');
  if (!ctx) {
    throw new Error('Failed to get canvas context');
  }
  
  // 计算居中裁剪区域
  const { sx, sy, sw, sh } = calculateCenterCropArea(
    img.width,
    img.height,
    targetWidth,
    targetHeight
  );
  
  // 绘制图片（居中裁剪）
  ctx.drawImage(
    img,
    sx, sy, sw, sh,  // 源区域
    0, 0, targetWidth, targetHeight  // 目标区域
  );
  
  // 转换为 Blob
  return canvasToBlob(canvas, format, format === 'jpeg' ? quality : undefined);
}


/**
 * 压缩图片至指定大小
 * @param imageBlob 源图片 Blob
 * @param maxSizeKB 最大文件大小 (KB)
 * @param format 输出格式 ('png' | 'jpeg')
 * @returns 压缩后的图片 Blob
 */
export async function compressImage(
  imageBlob: Blob,
  maxSizeKB: number,
  format: 'png' | 'jpeg'
): Promise<Blob> {
  const maxSizeBytes = maxSizeKB * 1024;
  
  // 如果已经小于目标大小，直接返回
  if (imageBlob.size <= maxSizeBytes) {
    return imageBlob;
  }
  
  const img = await blobToImage(imageBlob);
  const canvas = document.createElement('canvas');
  canvas.width = img.width;
  canvas.height = img.height;
  
  const ctx = canvas.getContext('2d');
  if (!ctx) {
    throw new Error('Failed to get canvas context');
  }
  
  ctx.drawImage(img, 0, 0);
  
  // PNG 格式：尝试转换为 JPEG 进行压缩（如果允许），否则缩小尺寸
  if (format === 'png') {
    // PNG 无损格式，只能通过缩小尺寸来减小文件大小
    let scale = 1;
    let compressedBlob = await canvasToBlob(canvas, 'png');
    
    while (compressedBlob.size > maxSizeBytes && scale > 0.1) {
      scale -= 0.1;
      const newWidth = Math.floor(img.width * scale);
      const newHeight = Math.floor(img.height * scale);
      
      canvas.width = newWidth;
      canvas.height = newHeight;
      ctx.drawImage(img, 0, 0, newWidth, newHeight);
      compressedBlob = await canvasToBlob(canvas, 'png');
    }
    
    return compressedBlob;
  }
  
  // JPEG 格式：通过降低质量来压缩
  let quality = COMPRESSION_CONFIG.INITIAL_JPEG_QUALITY;
  let compressedBlob = await canvasToBlob(canvas, 'jpeg', quality);
  
  while (compressedBlob.size > maxSizeBytes && quality > COMPRESSION_CONFIG.MIN_JPEG_QUALITY) {
    quality -= COMPRESSION_CONFIG.QUALITY_STEP;
    compressedBlob = await canvasToBlob(canvas, 'jpeg', quality);
  }
  
  // 如果质量降到最低仍然超过大小限制，尝试缩小尺寸
  if (compressedBlob.size > maxSizeBytes) {
    let scale = 0.9;
    while (compressedBlob.size > maxSizeBytes && scale > 0.1) {
      const newWidth = Math.floor(img.width * scale);
      const newHeight = Math.floor(img.height * scale);
      
      canvas.width = newWidth;
      canvas.height = newHeight;
      ctx.drawImage(img, 0, 0, newWidth, newHeight);
      compressedBlob = await canvasToBlob(canvas, 'jpeg', COMPRESSION_CONFIG.MIN_JPEG_QUALITY);
      scale -= 0.1;
    }
  }
  
  return compressedBlob;
}

/**
 * 压缩图片至 P1 横幅大小限制 (≤500KB)
 * @param imageBlob 源图片 Blob
 * @returns 压缩后的图片 Blob
 */
export async function compressToBannerLimit(imageBlob: Blob): Promise<Blob> {
  return compressImage(imageBlob, WECHAT_SPECS.BANNER.maxSizeKB, 'jpeg');
}

/**
 * 压缩图片至 P2 封面大小限制 (≤500KB)
 * @param imageBlob 源图片 Blob
 * @returns 压缩后的图片 Blob
 */
export async function compressToCoverLimit(imageBlob: Blob): Promise<Blob> {
  return compressImage(imageBlob, WECHAT_SPECS.COVER.maxSizeKB, 'png');
}

/**
 * 压缩图片至 P3 图标大小限制 (≤100KB)
 * @param imageBlob 源图片 Blob
 * @returns 压缩后的图片 Blob
 */
export async function compressToIconLimit(imageBlob: Blob): Promise<Blob> {
  return compressImage(imageBlob, WECHAT_SPECS.ICON.maxSizeKB, 'png');
}

/**
 * 压缩图片至 P4 赞赏引导图大小限制 (≤500KB)
 * @param imageBlob 源图片 Blob
 * @returns 压缩后的图片 Blob
 */
export async function compressToAppreciationGuideLimit(imageBlob: Blob): Promise<Blob> {
  return compressImage(imageBlob, WECHAT_SPECS.APPRECIATION_GUIDE.maxSizeKB, 'jpeg');
}

/**
 * 压缩图片至 P5 赞赏致谢图大小限制 (≤500KB)
 * @param imageBlob 源图片 Blob
 * @returns 压缩后的图片 Blob
 */
export async function compressToAppreciationThanksLimit(imageBlob: Blob): Promise<Blob> {
  return compressImage(imageBlob, WECHAT_SPECS.APPRECIATION_THANKS.maxSizeKB, 'jpeg');
}

/**
 * 创建 ProcessedImage 对象
 */
async function createProcessedImage(
  blob: Blob,
  type: 'banner' | 'cover' | 'icon' | 'appreciationGuide' | 'appreciationThanks',
  width: number,
  height: number,
  format: 'png' | 'jpeg',
  hasTransparency: boolean
): Promise<ProcessedImage> {
  const preview = URL.createObjectURL(blob);
  const sizeKB = blob.size / 1024;
  
  return {
    id: generateId(),
    type,
    blob,
    preview,
    width,
    height,
    sizeKB,
    format,
    hasTransparency,
  };
}

/**
 * 处理图片为 P1 横幅规格 (750×400)
 * @param imageBlob 源图片 Blob
 * @returns 处理后的 ProcessedImage
 */
export async function processToBanner(imageBlob: Blob): Promise<ProcessedImage> {
  const { width, height } = WECHAT_SPECS.BANNER;
  
  // 调整尺寸
  const resizedBlob = await resizeImage(imageBlob, width, height, {
    format: 'png',
    quality: 0.92,
  });
  
  return createProcessedImage(
    resizedBlob,
    'banner',
    width,
    height,
    'png',
    false  // P1 不需要透明背景
  );
}

/**
 * 处理图片为 P2 封面规格 (240×240)
 * @param imageBlob 源图片 Blob
 * @returns 处理后的 ProcessedImage
 */
export async function processToCover(imageBlob: Blob): Promise<ProcessedImage> {
  const { width, height } = WECHAT_SPECS.COVER;
  
  // 调整尺寸
  const resizedBlob = await resizeImage(imageBlob, width, height, {
    format: 'png',
  });
  
  return createProcessedImage(
    resizedBlob,
    'cover',
    width,
    height,
    'png',
    true  // P2 需要透明背景（背景移除在其他服务处理）
  );
}

/**
 * 处理图片为 P3 图标规格 (50×50)
 * @param imageBlob 源图片 Blob
 * @returns 处理后的 ProcessedImage
 */
export async function processToIcon(imageBlob: Blob): Promise<ProcessedImage> {
  const { width, height } = WECHAT_SPECS.ICON;
  
  // 调整尺寸
  const resizedBlob = await resizeImage(imageBlob, width, height, {
    format: 'png',
  });
  
  return createProcessedImage(
    resizedBlob,
    'icon',
    width,
    height,
    'png',
    true  // P3 需要透明背景（背景移除在其他服务处理）
  );
}

/**
 * 处理图片为 P4 赞赏引导图规格 (750×560)
 * @param imageBlob 源图片 Blob
 * @returns 处理后的 ProcessedImage
 */
export async function processToAppreciationGuide(imageBlob: Blob): Promise<ProcessedImage> {
  const { width, height } = WECHAT_SPECS.APPRECIATION_GUIDE;
  
  // 调整尺寸
  const resizedBlob = await resizeImage(imageBlob, width, height, {
    format: 'png',
    quality: 0.92,
  });
  
  return createProcessedImage(
    resizedBlob,
    'appreciationGuide',
    width,
    height,
    'png',
    false  // P4 不需要透明背景
  );
}

/**
 * 处理图片为 P5 赞赏致谢图规格 (750×750)
 * @param imageBlob 源图片 Blob
 * @returns 处理后的 ProcessedImage
 */
export async function processToAppreciationThanks(imageBlob: Blob): Promise<ProcessedImage> {
  const { width, height } = WECHAT_SPECS.APPRECIATION_THANKS;
  
  // 调整尺寸
  const resizedBlob = await resizeImage(imageBlob, width, height, {
    format: 'png',
    quality: 0.92,
  });
  
  return createProcessedImage(
    resizedBlob,
    'appreciationThanks',
    width,
    height,
    'png',
    false  // P5 不需要透明背景
  );
}

/**
 * 获取图片尺寸
 */
export async function getImageDimensions(blob: Blob): Promise<{ width: number; height: number }> {
  const img = await blobToImage(blob);
  return { width: img.width, height: img.height };
}

/**
 * 导出 WeChatImageProcessor 对象（符合接口定义）
 */
export const WeChatImageProcessor = {
  resizeImage,
  processToBanner,
  processToCover,
  processToIcon,
  processToAppreciationGuide,
  processToAppreciationThanks,
  getImageDimensions,
  compressImage,
  compressToBannerLimit,
  compressToCoverLimit,
  compressToIconLimit,
  compressToAppreciationGuideLimit,
  compressToAppreciationThanksLimit,
};

export default WeChatImageProcessor;
