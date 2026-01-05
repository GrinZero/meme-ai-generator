/**
 * WeChat Sticker Standardization Service
 * 
 * 微信表情平台标准化服务
 * 协调 AI 生成和图像处理流程，生成符合微信表情平台规范的 P1/P2/P3 图片
 * 
 * Requirements: 3.1-3.7
 */

import type { APIConfig } from '../types/api';
import type { UploadedImage } from '../types/image';
import type {
  SourceImage,
  ProcessedImage,
  StandardizationPrompts,
  StandardizationResult,
  StandardizationError,
} from '../types/wechatStandardization';
import { generateImage, cancelGeneration as cancelAIGeneration } from './aiService';
import {
  processToBanner,
  processToCover,
  processToIcon,
  compressToBannerLimit,
  compressToCoverLimit,
  compressToIconLimit,
} from './wechatImageProcessor';
import {
  removeBackgroundForCover,
  removeBackgroundForIcon,
} from './wechatBackgroundRemover';
import { WECHAT_SPECS } from './wechatConstants';

/**
 * 生成进度回调类型
 */
export type ProgressCallback = (
  type: 'p1' | 'p2' | 'p3',
  stage: 'generating' | 'processing' | 'completed' | 'error',
  progress?: number,
  error?: string
) => void;

/**
 * 将 SourceImage 转换为 UploadedImage（用于 AI 服务）
 */
function sourceImagesToUploadedImages(sourceImages: SourceImage[]): UploadedImage[] {
  return sourceImages.map((img) => ({
    id: img.id,
    file: img.file,
    preview: img.preview,
    type: 'material' as const,
  }));
}

/**
 * 创建标准化错误对象
 */
function createError(
  type: StandardizationError['type'],
  message: string,
  details?: unknown
): StandardizationError {
  return { type, message, details };
}

/**
 * 生成 P1 横幅图
 * 
 * 流程：
 * 1. 调用 AI API 生成基础图例
 * 2. 调整尺寸为 750×400
 * 3. 压缩至 ≤500KB
 * 
 * Requirements: 3.2, 4.1, 4.6, 6.6
 * 
 * @param sourceImages - 源图片列表
 * @param prompt - P1 提示词
 * @param apiConfig - API 配置
 * @param onProgress - 进度回调（可选）
 * @returns 处理后的 P1 横幅图
 */
export async function generateBanner(
  sourceImages: SourceImage[],
  prompt: string,
  apiConfig: APIConfig,
  onProgress?: ProgressCallback
): Promise<ProcessedImage> {
  try {
    // 1. AI 生成
    onProgress?.('p1', 'generating', 0);
    
    const uploadedImages = sourceImagesToUploadedImages(sourceImages);
    const result = await generateImage(apiConfig, prompt, uploadedImages);
    
    if (!result.success || !result.imageBlob) {
      throw createError(
        'AI_GENERATION_FAILED',
        result.error || 'AI 生成 P1 横幅失败'
      );
    }
    
    onProgress?.('p1', 'generating', 50);
    
    // 2. 图像处理（尺寸调整）
    onProgress?.('p1', 'processing');
    
    const processedImage = await processToBanner(result.imageBlob);
    
    // 3. 压缩至大小限制
    const compressedBlob = await compressToBannerLimit(processedImage.blob);
    
    // 更新处理后的图片信息
    const finalImage: ProcessedImage = {
      ...processedImage,
      blob: compressedBlob,
      sizeKB: compressedBlob.size / 1024,
      // 更新预览 URL
      preview: URL.createObjectURL(compressedBlob),
    };
    
    // 释放旧的预览 URL
    if (processedImage.preview !== finalImage.preview) {
      URL.revokeObjectURL(processedImage.preview);
    }
    
    onProgress?.('p1', 'completed');
    
    return finalImage;
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    onProgress?.('p1', 'error', undefined, errorMessage);
    
    if ((error as StandardizationError).type) {
      throw error;
    }
    
    throw createError('IMAGE_PROCESSING_FAILED', `P1 横幅处理失败: ${errorMessage}`, error);
  }
}

/**
 * 生成 P2 封面图
 * 
 * 流程：
 * 1. 调用 AI API 生成基础图例
 * 2. 背景透明化处理
 * 3. 调整尺寸为 240×240
 * 4. 压缩至 ≤500KB
 * 
 * Requirements: 3.3, 4.2, 4.7, 5.1, 5.3, 6.7
 * 
 * @param sourceImages - 源图片列表
 * @param prompt - P2 提示词
 * @param apiConfig - API 配置
 * @param onProgress - 进度回调（可选）
 * @returns 处理后的 P2 封面图
 */
export async function generateCover(
  sourceImages: SourceImage[],
  prompt: string,
  apiConfig: APIConfig,
  onProgress?: ProgressCallback
): Promise<ProcessedImage> {
  try {
    // 1. AI 生成
    onProgress?.('p2', 'generating', 0);
    
    const uploadedImages = sourceImagesToUploadedImages(sourceImages);
    const result = await generateImage(apiConfig, prompt, uploadedImages);
    
    if (!result.success || !result.imageBlob) {
      throw createError(
        'AI_GENERATION_FAILED',
        result.error || 'AI 生成 P2 封面失败'
      );
    }
    
    onProgress?.('p2', 'generating', 30);
    
    // 2. 背景透明化
    onProgress?.('p2', 'processing');
    
    const bgRemovalResult = await removeBackgroundForCover(result.imageBlob);
    
    if (bgRemovalResult.didFallback) {
      console.warn('[wechatStandardizationService] P2 背景移除使用了回退算法:', bgRemovalResult.error);
    }
    
    onProgress?.('p2', 'generating', 60);
    
    // 3. 图像处理（尺寸调整）
    const processedImage = await processToCover(bgRemovalResult.blob);
    
    // 4. 压缩至大小限制
    const compressedBlob = await compressToCoverLimit(processedImage.blob);
    
    // 更新处理后的图片信息
    const finalImage: ProcessedImage = {
      ...processedImage,
      blob: compressedBlob,
      sizeKB: compressedBlob.size / 1024,
      hasTransparency: true,
      preview: URL.createObjectURL(compressedBlob),
    };
    
    // 释放旧的预览 URL
    if (processedImage.preview !== finalImage.preview) {
      URL.revokeObjectURL(processedImage.preview);
    }
    
    onProgress?.('p2', 'completed');
    
    return finalImage;
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    onProgress?.('p2', 'error', undefined, errorMessage);
    
    if ((error as StandardizationError).type) {
      throw error;
    }
    
    throw createError('IMAGE_PROCESSING_FAILED', `P2 封面处理失败: ${errorMessage}`, error);
  }
}

/**
 * 生成 P3 图标
 * 
 * 流程：
 * 1. 调用 AI API 生成基础图例
 * 2. 背景透明化处理
 * 3. 调整尺寸为 50×50
 * 4. 压缩至 ≤100KB
 * 
 * Requirements: 3.4, 4.3, 4.8, 5.2, 5.3, 6.8
 * 
 * @param sourceImages - 源图片列表
 * @param prompt - P3 提示词
 * @param apiConfig - API 配置
 * @param onProgress - 进度回调（可选）
 * @returns 处理后的 P3 图标
 */
export async function generateIcon(
  sourceImages: SourceImage[],
  prompt: string,
  apiConfig: APIConfig,
  onProgress?: ProgressCallback
): Promise<ProcessedImage> {
  try {
    // 1. AI 生成
    onProgress?.('p3', 'generating', 0);
    
    const uploadedImages = sourceImagesToUploadedImages(sourceImages);
    const result = await generateImage(apiConfig, prompt, uploadedImages);
    
    if (!result.success || !result.imageBlob) {
      throw createError(
        'AI_GENERATION_FAILED',
        result.error || 'AI 生成 P3 图标失败'
      );
    }
    
    onProgress?.('p3', 'generating', 30);
    
    // 2. 背景透明化
    onProgress?.('p3', 'processing');
    
    const bgRemovalResult = await removeBackgroundForIcon(result.imageBlob);
    
    if (bgRemovalResult.didFallback) {
      console.warn('[wechatStandardizationService] P3 背景移除使用了回退算法:', bgRemovalResult.error);
    }
    
    onProgress?.('p3', 'generating', 60);
    
    // 3. 图像处理（尺寸调整）
    const processedImage = await processToIcon(bgRemovalResult.blob);
    
    // 4. 压缩至大小限制
    const compressedBlob = await compressToIconLimit(processedImage.blob);
    
    // 更新处理后的图片信息
    const finalImage: ProcessedImage = {
      ...processedImage,
      blob: compressedBlob,
      sizeKB: compressedBlob.size / 1024,
      hasTransparency: true,
      preview: URL.createObjectURL(compressedBlob),
    };
    
    // 释放旧的预览 URL
    if (processedImage.preview !== finalImage.preview) {
      URL.revokeObjectURL(processedImage.preview);
    }
    
    onProgress?.('p3', 'completed');
    
    return finalImage;
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    onProgress?.('p3', 'error', undefined, errorMessage);
    
    if ((error as StandardizationError).type) {
      throw error;
    }
    
    throw createError('IMAGE_PROCESSING_FAILED', `P3 图标处理失败: ${errorMessage}`, error);
  }
}


/**
 * 批量生成所有类型的图片（P1、P2、P3）
 * 
 * 按顺序生成 P1 横幅、P2 封面、P3 图标
 * 即使某个类型生成失败，也会继续生成其他类型
 * 
 * Requirements: 3.1, 3.5, 3.6, 3.7
 * 
 * @param sourceImages - 源图片列表
 * @param prompts - 三种类型的提示词
 * @param apiConfig - API 配置
 * @param onProgress - 进度回调（可选）
 * @returns 标准化处理结果（包含成功的图片和错误信息）
 */
export async function generateAll(
  sourceImages: SourceImage[],
  prompts: StandardizationPrompts,
  apiConfig: APIConfig,
  onProgress?: ProgressCallback
): Promise<StandardizationResult> {
  const result: StandardizationResult = {
    banner: null,
    cover: null,
    icon: null,
    errors: [],
  };

  // 检查源图片
  if (sourceImages.length === 0) {
    result.errors.push(createError(
      'AI_GENERATION_FAILED',
      '请先上传至少一张图片'
    ));
    return result;
  }

  // 1. 生成 P1 横幅
  try {
    result.banner = await generateBanner(sourceImages, prompts.p1, apiConfig, onProgress);
  } catch (error) {
    const err = error as StandardizationError;
    result.errors.push({
      type: err.type || 'AI_GENERATION_FAILED',
      message: err.message || 'P1 横幅生成失败',
      details: err.details,
    });
  }

  // 2. 生成 P2 封面
  try {
    result.cover = await generateCover(sourceImages, prompts.p2, apiConfig, onProgress);
  } catch (error) {
    const err = error as StandardizationError;
    result.errors.push({
      type: err.type || 'AI_GENERATION_FAILED',
      message: err.message || 'P2 封面生成失败',
      details: err.details,
    });
  }

  // 3. 生成 P3 图标
  try {
    result.icon = await generateIcon(sourceImages, prompts.p3, apiConfig, onProgress);
  } catch (error) {
    const err = error as StandardizationError;
    result.errors.push({
      type: err.type || 'AI_GENERATION_FAILED',
      message: err.message || 'P3 图标生成失败',
      details: err.details,
    });
  }

  return result;
}

/**
 * 取消当前生成
 */
export function cancelGeneration(): void {
  cancelAIGeneration();
}

/**
 * 验证处理结果是否符合微信规范
 * 
 * @param image - 处理后的图片
 * @returns 验证结果
 */
export function validateProcessedImage(image: ProcessedImage): {
  valid: boolean;
  errors: string[];
} {
  const errors: string[] = [];
  const spec = WECHAT_SPECS[image.type.toUpperCase() as keyof typeof WECHAT_SPECS];

  if (!spec) {
    errors.push(`未知的图片类型: ${image.type}`);
    return { valid: false, errors };
  }

  // 检查尺寸
  if (image.width !== spec.width || image.height !== spec.height) {
    errors.push(`尺寸不符合规范: 期望 ${spec.width}×${spec.height}，实际 ${image.width}×${image.height}`);
  }

  // 检查文件大小
  if (image.sizeKB > spec.maxSizeKB) {
    errors.push(`文件大小超出限制: 期望 ≤${spec.maxSizeKB}KB，实际 ${image.sizeKB.toFixed(2)}KB`);
  }

  // 检查格式
  const allowedFormats = spec.formats as readonly string[];
  if (!allowedFormats.includes(image.format)) {
    errors.push(`格式不符合规范: 期望 ${spec.formats.join('/')}, 实际 ${image.format}`);
  }

  // 检查透明度要求
  if (spec.requiresTransparency && !image.hasTransparency) {
    errors.push('图片需要透明背景');
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}

/**
 * 导出 StandardizationService 对象（符合接口定义）
 */
export const WeChatStandardizationService = {
  generateBanner,
  generateCover,
  generateIcon,
  generateAll,
  cancelGeneration,
  validateProcessedImage,
};

export default WeChatStandardizationService;
