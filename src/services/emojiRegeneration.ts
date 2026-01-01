/**
 * Emoji Regeneration Service
 * 负责单个表情的重新生成逻辑
 * 
 * Requirements: 7.3, 7.4
 */

import type { APIConfig } from '../types/api';
import type { UploadedImage, ExtractedEmoji } from '../types/image';
import { generateImage } from './aiService';
import { 
  loadImageFromBlob, 
  getImageDataFromImage, 
  detectBackgroundColor,
  removeBackgroundFloodFill,
  imageDataToBlob,
  imageDataToPreviewUrl,
} from './imageSplitter';

/**
 * 重新生成配置
 */
export interface RegenerationConfig {
  apiConfig: APIConfig;
  languagePreference: string;
  editPrompt: string;
  materialImages: UploadedImage[];
  referenceImages: UploadedImage[];
  /** 当前要重新生成的表情（会作为参考图发送给 AI） */
  currentEmoji?: ExtractedEmoji;
}

/**
 * 重新生成结果
 */
export interface RegenerationResult {
  success: boolean;
  emoji?: ExtractedEmoji;
  error?: string;
}

/**
 * 构建单个表情重新生成的提示词
 */
export function buildRegenerationPrompt(
  languagePreference: string,
  editPrompt: string
): string {
  const systemPrompt = `
要求：
1. 生成的图片必须是纯色背景，并且和主体颜色有强烈对比度
2. 只生成一个表情，不要生成多个`;

  const parts = [systemPrompt];

  if (languagePreference.trim()) {
    parts.push(`语言偏好：${languagePreference}`);
  }

  parts.push(`用户要求：${editPrompt}`);

  return parts.join('\n\n');
}

/**
 * 将 ExtractedEmoji 转换为 UploadedImage 格式
 */
function emojiToUploadedImage(emoji: ExtractedEmoji): UploadedImage {
  const file = new File([emoji.blob], 'current-emoji.png', { type: 'image/png' });
  
  return {
    id: `emoji-${emoji.id}`,
    file,
    preview: emoji.preview,
    type: 'reference',
  };
}

// 生成唯一 ID
const generateId = () => `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;

/**
 * 对单张图片进行背景移除处理（不做切割）
 */
async function processGeneratedImage(
  imageBlob: Blob,
  tolerance: number = 30
): Promise<ExtractedEmoji> {
  const img = await loadImageFromBlob(imageBlob);
  const imageData = getImageDataFromImage(img);
  
  // 检测背景色并移除
  const backgroundColor = detectBackgroundColor(imageData, { tolerance });
  const processedImageData = removeBackgroundFloodFill(imageData, backgroundColor, tolerance);
  
  const blob = await imageDataToBlob(processedImageData);
  const preview = imageDataToPreviewUrl(processedImageData);
  
  return {
    id: generateId(),
    blob,
    preview,
    boundingBox: {
      x: 0,
      y: 0,
      width: imageData.width,
      height: imageData.height,
    },
  };
}

/**
 * 重新生成单个表情
 * 
 * 流程：
 * 1. 构建重新生成提示词
 * 2. 调用 AI API 生成新图片（包含当前表情作为参考）
 * 3. 对生成的图片进行背景移除（不做切割）
 * 4. 返回处理后的表情供用户确认
 */
export async function regenerateEmoji(
  config: RegenerationConfig
): Promise<RegenerationResult> {
  const {
    apiConfig,
    languagePreference,
    editPrompt,
    materialImages,
    referenceImages,
    currentEmoji,
  } = config;

  try {
    const prompt = buildRegenerationPrompt(languagePreference, editPrompt);

    const allImages = [...materialImages, ...referenceImages];
    
    if (currentEmoji) {
      allImages.push(emojiToUploadedImage(currentEmoji));
    }

    const generateResult = await generateImage(apiConfig, prompt, allImages);

    if (!generateResult.success || !generateResult.imageBlob) {
      return {
        success: false,
        error: generateResult.error || '生成失败，请重试',
      };
    }

    // 只做背景移除，不做切割
    const emoji = await processGeneratedImage(generateResult.imageBlob, 30);

    return {
      success: true,
      emoji,
    };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : '发生未知错误';
    return {
      success: false,
      error: errorMessage,
    };
  }
}
