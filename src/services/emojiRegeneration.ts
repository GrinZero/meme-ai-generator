/**
 * Emoji Regeneration Service
 * 负责单个表情的重新生成逻辑
 * 
 * Requirements: 7.3, 7.4
 */

import type { APIConfig } from '../types/api';
import type { UploadedImage, ExtractedEmoji } from '../types/image';
import { generateImage } from './aiService';
import { extractAllEmojis } from './imageSplitter';

/**
 * 重新生成配置
 */
export interface RegenerationConfig {
  apiConfig: APIConfig;
  languagePreference: string;
  editPrompt: string;
  materialImages: UploadedImage[];
  referenceImages: UploadedImage[];
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
 * 确保生成的表情有纯色背景便于提取
 */
export function buildRegenerationPrompt(
  languagePreference: string,
  editPrompt: string
): string {
  const systemPrompt = `你是一个表情包设计师。请根据用户的要求重新生成一个表情包。

要求：
1. 生成的图片必须是相同的纯色背景
2. 只生成一个表情，不要生成多个
3. 表情要清晰、完整，便于后续提取
4. 表情风格要参考用户提供的素材图
5. 我希望你认真读取图片中的形象特点，结合图片中的实际形象进行设计`;

  const parts = [systemPrompt];

  if (languagePreference.trim()) {
    parts.push(`语言偏好：${languagePreference}`);
  }

  parts.push(`用户要求：${editPrompt}`);

  return parts.join('\n\n');
}

/**
 * 重新生成单个表情
 * 
 * 流程：
 * 1. 构建重新生成提示词（确保纯色背景）
 * 2. 调用 AI API 生成新图片
 * 3. 自动分割提取新表情
 * 4. 返回提取的第一个表情
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
  } = config;

  try {
    // 1. 构建重新生成提示词
    const prompt = buildRegenerationPrompt(languagePreference, editPrompt);

    // 2. 合并所有参考图片
    const allImages = [...materialImages, ...referenceImages];

    // 3. 调用 AI API 生成
    const generateResult = await generateImage(apiConfig, prompt, allImages);

    if (!generateResult.success || !generateResult.imageBlob) {
      return {
        success: false,
        error: generateResult.error || '生成失败，请重试',
      };
    }

    // 4. 自动分割提取表情
    const emojis = await extractAllEmojis(generateResult.imageBlob, {
      useAdvancedRemoval: true,
      tolerance: 30,
      minArea: 100,
      minSize: 10,
    });

    if (emojis.length === 0) {
      return {
        success: false,
        error: '未能从生成的图片中提取表情，请重试',
      };
    }

    // 5. 返回第一个提取的表情
    return {
      success: true,
      emoji: emojis[0],
    };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : '发生未知错误';
    return {
      success: false,
      error: errorMessage,
    };
  }
}
