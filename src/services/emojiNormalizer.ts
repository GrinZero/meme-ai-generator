/**
 * 表情包标准化器
 * 负责将提取的图片标准化为 240×240 像素
 * 
 * Requirements: 6.1, 6.2, 6.3, 6.4, 6.5
 */

import type { ExtractedEmoji, BoundingBox } from '../types/image';
import { imageDataToBlob, imageDataToPreviewUrl } from './imageSplitter';

/**
 * 标准化配置选项
 */
export interface NormalizationOptions {
  /** 输出尺寸（默认 240） */
  outputSize?: number;
  /** 是否使用高质量缩放（默认 true） */
  highQualityResize?: boolean;
}

const DEFAULT_OPTIONS: Required<NormalizationOptions> = {
  outputSize: 240,
  highQualityResize: true,
};

/**
 * 计算保持宽高比的缩放尺寸
 * 
 * @param srcWidth 源宽度
 * @param srcHeight 源高度
 * @param targetSize 目标尺寸（正方形边长）
 * @returns 缩放后的宽高
 */
export function calculateScaledSize(
  srcWidth: number,
  srcHeight: number,
  targetSize: number
): { width: number; height: number } {
  if (srcWidth <= 0 || srcHeight <= 0) {
    return { width: 0, height: 0 };
  }
  
  const aspectRatio = srcWidth / srcHeight;
  
  let width: number;
  let height: number;
  
  if (aspectRatio >= 1) {
    // 宽度较大或相等，以宽度为基准
    width = targetSize;
    height = Math.round(targetSize / aspectRatio);
  } else {
    // 高度较大，以高度为基准
    height = targetSize;
    width = Math.round(targetSize * aspectRatio);
  }
  
  return { width, height };
}

/**
 * 计算居中位置
 * 
 * @param contentSize 内容尺寸
 * @param canvasSize 画布尺寸
 * @returns 居中偏移量
 */
export function calculateCenterOffset(
  contentSize: { width: number; height: number },
  canvasSize: number
): { x: number; y: number } {
  return {
    x: Math.floor((canvasSize - contentSize.width) / 2),
    y: Math.floor((canvasSize - contentSize.height) / 2),
  };
}

/**
 * 标准化 ImageData 到指定尺寸
 * 保持宽高比，居中放置，透明填充
 * 
 * @param imageData 原始图片数据
 * @param options 标准化选项
 * @returns 标准化后的 ImageData
 * 
 * Requirements: 6.1, 6.2, 6.3, 6.5
 */
export function normalizeImageData(
  imageData: ImageData,
  options: NormalizationOptions = {}
): ImageData {
  const { outputSize, highQualityResize } = { ...DEFAULT_OPTIONS, ...options };
  
  const srcWidth = imageData.width;
  const srcHeight = imageData.height;
  
  // Calculate scaled size (maintaining aspect ratio)
  const scaledSize = calculateScaledSize(srcWidth, srcHeight, outputSize);
  
  // Calculate center offset
  const offset = calculateCenterOffset(scaledSize, outputSize);
  
  // Create source canvas with original image data
  const srcCanvas = document.createElement('canvas');
  srcCanvas.width = srcWidth;
  srcCanvas.height = srcHeight;
  const srcCtx = srcCanvas.getContext('2d')!;
  srcCtx.putImageData(imageData, 0, 0);
  
  // Create output canvas
  const outputCanvas = document.createElement('canvas');
  outputCanvas.width = outputSize;
  outputCanvas.height = outputSize;
  const outputCtx = outputCanvas.getContext('2d')!;
  
  // Set high quality scaling
  if (highQualityResize) {
    outputCtx.imageSmoothingEnabled = true;
    outputCtx.imageSmoothingQuality = 'high';
  } else {
    outputCtx.imageSmoothingEnabled = false;
  }
  
  // Clear canvas (transparent background)
  outputCtx.clearRect(0, 0, outputSize, outputSize);
  
  // Draw scaled image centered on output canvas
  outputCtx.drawImage(
    srcCanvas,
    0, 0, srcWidth, srcHeight,
    offset.x, offset.y, scaledSize.width, scaledSize.height
  );
  
  // Get result ImageData
  return outputCtx.getImageData(0, 0, outputSize, outputSize);
}

/**
 * 标准化表情包
 * 将提取的表情包标准化为 240×240 像素
 * 
 * @param imageData 原始图片数据
 * @param originalBoundingBox 原始边界框
 * @param options 标准化选项
 * @returns 标准化后的 ExtractedEmoji
 * 
 * Requirements: 6.1, 6.2, 6.3, 6.5
 */
export async function normalizeEmoji(
  imageData: ImageData,
  _originalBoundingBox: BoundingBox,
  options: NormalizationOptions = {}
): Promise<ExtractedEmoji> {
  const { outputSize } = { ...DEFAULT_OPTIONS, ...options };
  
  // 标准化图片数据
  const normalizedData = normalizeImageData(imageData, options);
  
  // 转换为 Blob 和预览 URL
  const blob = await imageDataToBlob(normalizedData);
  const preview = imageDataToPreviewUrl(normalizedData);
  
  // 生成唯一 ID
  const id = `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
  
  return {
    id,
    blob,
    preview,
    boundingBox: {
      x: 0,
      y: 0,
      width: outputSize,
      height: outputSize,
    },
  };
}

/**
 * 批量标准化表情包
 * 
 * @param emojis 原始表情包数组（包含 ImageData）
 * @param options 标准化选项
 * @returns 标准化后的 ExtractedEmoji 数组
 */
export async function normalizeAllEmojis(
  emojis: Array<{ imageData: ImageData; boundingBox: BoundingBox }>,
  options: NormalizationOptions = {}
): Promise<ExtractedEmoji[]> {
  const results: ExtractedEmoji[] = [];
  
  for (const emoji of emojis) {
    try {
      const normalized = await normalizeEmoji(
        emoji.imageData,
        emoji.boundingBox,
        options
      );
      results.push(normalized);
    } catch (error) {
      console.error('[EmojiNormalizer] Failed to normalize emoji:', error);
    }
  }
  
  return results;
}

/**
 * 检查 ImageData 是否已经是标准尺寸
 * 
 * @param imageData 图片数据
 * @param targetSize 目标尺寸
 * @returns 是否已标准化
 */
export function isAlreadyNormalized(
  imageData: ImageData,
  targetSize: number = 240
): boolean {
  return imageData.width === targetSize && imageData.height === targetSize;
}

/**
 * 获取 ImageData 中非透明像素的边界框
 * 用于计算实际内容区域
 * 
 * @param imageData 图片数据
 * @returns 内容边界框，如果全透明则返回 null
 */
export function getContentBounds(imageData: ImageData): BoundingBox | null {
  const { width, height, data } = imageData;
  
  let minX = width;
  let minY = height;
  let maxX = 0;
  let maxY = 0;
  let hasContent = false;
  
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const alpha = data[(y * width + x) * 4 + 3];
      if (alpha > 0) {
        hasContent = true;
        minX = Math.min(minX, x);
        minY = Math.min(minY, y);
        maxX = Math.max(maxX, x);
        maxY = Math.max(maxY, y);
      }
    }
  }
  
  if (!hasContent) {
    return null;
  }
  
  return {
    x: minX,
    y: minY,
    width: maxX - minX + 1,
    height: maxY - minY + 1,
  };
}

/**
 * 验证标准化结果
 * 检查输出是否符合要求
 * 
 * @param imageData 标准化后的图片数据
 * @param expectedSize 期望的尺寸
 * @returns 验证结果
 */
export function validateNormalization(
  imageData: ImageData,
  expectedSize: number = 240
): { valid: boolean; errors: string[] } {
  const errors: string[] = [];
  
  // 检查尺寸
  if (imageData.width !== expectedSize) {
    errors.push(`Width mismatch: expected ${expectedSize}, got ${imageData.width}`);
  }
  if (imageData.height !== expectedSize) {
    errors.push(`Height mismatch: expected ${expectedSize}, got ${imageData.height}`);
  }
  
  return {
    valid: errors.length === 0,
    errors,
  };
}
