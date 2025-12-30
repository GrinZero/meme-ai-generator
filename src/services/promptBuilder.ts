/**
 * PromptBuilder - 提示词构建服务
 * 
 * 功能：
 * - 系统提示词模板（纯色背景、网格排列、参考素材）
 * - 组合系统提示词 + 语言偏好 + 用户提示词
 * 
 * Requirements: 4.2, 4.3
 */

import type { PromptConfig } from '../types/prompt';

/**
 * 系统提示词模板
 * 确保生成的表情包：
 * 1. 纯色背景（便于后续分割）
 * 2. 网格排列多个表情
 * 3. 参考用户上传的素材
 */
const SYSTEM_PROMPT = `你是一个表情包设计师。请根据用户提供的素材图和基准图，生成一系列表情包。

要求：
1. 生成的图片必须是纯色背景（推荐白色或浅灰色）
2. 在一张大图中生成多个表情（建议 3x3 或 4x4 网格排列）
3. 每个表情之间要有明显的间隔
4. 表情风格要参考用户提供的基准图
5. 表情内容要参考用户提供的素材图中的形象`;

/**
 * 构建系统提示词
 * @returns 系统提示词字符串
 */
export function buildSystemPrompt(): string {
  return SYSTEM_PROMPT;
}

/**
 * 构建完整提示词
 * 组合系统提示词 + 语言偏好 + 用户自定义提示词
 * 
 * @param config - 提示词配置，包含语言偏好和用户提示词
 * @returns 完整的提示词字符串
 */
export function buildFullPrompt(config: PromptConfig): string {
  const parts: string[] = [SYSTEM_PROMPT];

  // 添加语言偏好（如果有）
  if (config.languagePreference && config.languagePreference.trim()) {
    parts.push(config.languagePreference.trim());
  }

  // 添加用户自定义提示词（如果有）
  if (config.userPrompt && config.userPrompt.trim()) {
    parts.push(config.userPrompt.trim());
  }

  return parts.join('\n\n');
}

/**
 * 检查提示词配置是否有效
 * @param config - 提示词配置
 * @returns 是否有效
 */
export function isPromptConfigValid(config: PromptConfig): boolean {
  // 至少需要有用户提示词
  return !!(config.userPrompt && config.userPrompt.trim());
}

/**
 * 获取系统提示词（用于测试和调试）
 */
export function getSystemPrompt(): string {
  return SYSTEM_PROMPT;
}
