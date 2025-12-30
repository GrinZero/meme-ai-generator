/**
 * API 配置相关类型定义
 */

export type APIStyle = 'gemini' | 'openai';

export interface APIConfig {
  apiKey: string;
  baseUrl: string;
  style: APIStyle;
  model?: string;
}

export interface AIAPIService {
  generateImage(prompt: string, images: ImageData[]): Promise<Blob>;
  validateConfig(config: APIConfig): Promise<boolean>;
}
