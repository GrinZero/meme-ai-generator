/**
 * API 配置相关类型定义
 */

export type APIStyle = 'gemini' | 'openai';

/**
 * OpenAI 生成模式
 * - chat: 使用 chat.completions API (适用于 GPT-4o 等支持图片生成的聊天模型)
 * - images: 使用 images.generate API (适用于 DALL-E 3 等专用图片生成模型)
 */
export type OpenAIGenerationMode = 'chat' | 'images';

export interface APIConfig {
  apiKey: string;
  baseUrl: string;
  style: APIStyle;
  model?: string;
  /** OpenAI 生成模式，默认为 'chat' */
  openaiGenerationMode?: OpenAIGenerationMode;
}

export interface AIAPIService {
  generateImage(prompt: string, images: ImageData[]): Promise<Blob>;
  validateConfig(config: APIConfig): Promise<boolean>;
}
