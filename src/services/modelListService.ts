/**
 * Model List Service - 动态模型列表获取服务
 * 
 * 支持从 Gemini 和 OpenAI 风格 API 获取可用模型列表
 * 
 * Requirements: 1.7, 2.1, 2.2, 2.3, 3.1, 3.2, 3.3, 4.5
 */

import OpenAI from 'openai';
import type { APIConfig, APIStyle } from '../types/api';

/**
 * 模型信息接口
 */
export interface ModelInfo {
  id: string;           // 模型 ID，用于 API 调用
  name: string;         // 显示名称
  description?: string; // 模型描述（可选）
}

/**
 * 获取模型列表结果接口
 */
export interface FetchModelsResult {
  success: boolean;
  models?: ModelInfo[];
  error?: string;
}

/**
 * 缓存条目接口
 */
interface CacheEntry {
  models: ModelInfo[];
  timestamp: number;
}

/**
 * Gemini API 响应格式
 */
interface GeminiModelsResponse {
  models: Array<{
    name: string;
    displayName: string;
    description: string;
    supportedGenerationMethods: string[];
  }>;
}



// 缓存有效期（毫秒）- 5 分钟
const CACHE_TTL = 5 * 60 * 1000;

// 模型列表缓存
const modelCache = new Map<string, CacheEntry>();

/**
 * 默认 Gemini 模型列表
 */
export const DEFAULT_GEMINI_MODELS: ModelInfo[] = [
  { id: 'gemini-2.0-flash-exp', name: 'Gemini 2.0 Flash (Experimental)' },
  { id: 'gemini-1.5-pro', name: 'Gemini 1.5 Pro' },
  { id: 'gemini-1.5-flash', name: 'Gemini 1.5 Flash' },
];

/**
 * 默认 OpenAI 模型列表
 */
export const DEFAULT_OPENAI_MODELS: ModelInfo[] = [
  { id: 'gpt-4o', name: 'GPT-4o' },
  { id: 'gpt-4o-mini', name: 'GPT-4o Mini' },
  { id: 'gpt-4-turbo', name: 'GPT-4 Turbo' },
  { id: 'dall-e-3', name: 'DALL-E 3' },
];

/**
 * 生成缓存 key
 */
export function generateCacheKey(style: APIStyle, apiKey: string, baseUrl: string): string {
  return `${style}:${apiKey}:${baseUrl}`;
}

/**
 * 检查缓存是否有效
 */
function isCacheValid(entry: CacheEntry): boolean {
  return Date.now() - entry.timestamp < CACHE_TTL;
}

/**
 * 获取缓存的模型列表
 */
function getCachedModels(cacheKey: string): ModelInfo[] | null {
  const entry = modelCache.get(cacheKey);
  if (entry && isCacheValid(entry)) {
    return entry.models;
  }
  // 清除过期缓存
  if (entry) {
    modelCache.delete(cacheKey);
  }
  return null;
}

/**
 * 设置模型列表缓存
 */
function setCachedModels(cacheKey: string, models: ModelInfo[]): void {
  modelCache.set(cacheKey, {
    models,
    timestamp: Date.now(),
  });
}

/**
 * 清除所有缓存
 */
export function clearCache(): void {
  modelCache.clear();
}

/**
 * 获取默认模型列表
 */
export function getDefaultModels(style: APIStyle): ModelInfo[] {
  return style === 'gemini' ? DEFAULT_GEMINI_MODELS : DEFAULT_OPENAI_MODELS;
}

/**
 * 构建 Gemini 模型列表 API URL
 */
export function buildGeminiModelsUrl(baseUrl: string, apiKey: string): string {
  const defaultBaseUrl = 'https://generativelanguage.googleapis.com';
  const effectiveBaseUrl = baseUrl || defaultBaseUrl;
  // Remove all trailing slashes
  const cleanBaseUrl = effectiveBaseUrl.replace(/\/+$/, '');
  return `${cleanBaseUrl}/v1beta/models?key=${apiKey}`;
}

/**
 * 构建 OpenAI 风格模型列表 API URL (仅用于缓存 key)
 */
export function buildOpenAIModelsUrl(baseUrl: string): string {
  const defaultBaseUrl = 'https://api.openai.com';
  const effectiveBaseUrl = baseUrl || defaultBaseUrl;
  // Remove all trailing slashes
  const cleanBaseUrl = effectiveBaseUrl.replace(/\/+$/, '');
  return `${cleanBaseUrl}/v1/models`;
}

/**
 * 过滤 Gemini 模型 - 只保留支持 generateContent 的模型
 */
export function filterGeminiModels(models: GeminiModelsResponse['models']): ModelInfo[] {
  return models
    .filter(model => 
      model.supportedGenerationMethods?.includes('generateContent')
    )
    .map(model => ({
      id: model.name.replace(/^models\//, ''),
      name: model.displayName || model.name.replace(/^models\//, ''),
      description: model.description,
    }));
}

/**
 * 转换 OpenAI 模型响应为 ModelInfo
 */
export function transformOpenAIModels(models: OpenAI.Models.Model[]): ModelInfo[] {
  return models
    .map(model => ({
      id: model.id,
      name: model.id,
    }))
    .sort((a, b) => a.id.localeCompare(b.id));
}

/**
 * 从 Gemini API 获取模型列表
 */
async function fetchGeminiModels(config: APIConfig): Promise<FetchModelsResult> {
  try {
    const url = buildGeminiModelsUrl(config.baseUrl, config.apiKey);
    
    const response = await fetch(url, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      if (response.status === 401 || response.status === 403) {
        return { success: false, error: 'API Key 无效，无法获取模型列表' };
      }
      if (response.status === 429) {
        return { success: false, error: '请求过于频繁，请稍后再试' };
      }
      return { success: false, error: `API 返回错误: ${response.status}` };
    }

    const data: GeminiModelsResponse = await response.json();
    
    if (!data.models || !Array.isArray(data.models)) {
      return { success: false, error: 'API 返回了无效的响应' };
    }

    const models = filterGeminiModels(data.models);
    return { success: true, models };
  } catch (error) {
    if (error instanceof Error) {
      if (error.message.includes('Failed to fetch') || error.message.includes('network')) {
        return { success: false, error: '网络错误，无法获取模型列表' };
      }
    }
    return { success: false, error: '获取模型列表失败' };
  }
}

/**
 * 从 OpenAI 风格 API 获取模型列表
 */
async function fetchOpenAIModels(config: APIConfig): Promise<FetchModelsResult> {
  try {
    const client = new OpenAI({
      apiKey: config.apiKey,
      baseURL: config.baseUrl || 'https://api.openai.com/v1',
      dangerouslyAllowBrowser: true,
    });

    const response = await client.models.list();
    const models = transformOpenAIModels(Array.from(response.data));
    return { success: true, models };
  } catch (error) {
    // Check for OpenAI API error by duck typing (safer than instanceof with mocks)
    const apiError = error as { status?: number; message?: string };
    if (typeof apiError.status === 'number') {
      if (apiError.status === 401 || apiError.status === 403) {
        return { success: false, error: 'API Key 无效，无法获取模型列表' };
      }
      if (apiError.status === 429) {
        return { success: false, error: '请求过于频繁，请稍后再试' };
      }
      return { success: false, error: `API 返回错误: ${apiError.status}` };
    }
    if (error instanceof Error) {
      if (error.message.includes('Failed to fetch') || error.message.includes('network')) {
        return { success: false, error: '网络错误，无法获取模型列表' };
      }
    }
    return { success: false, error: '获取模型列表失败' };
  }
}

/**
 * 获取模型列表（统一入口）
 * 
 * @param config API 配置
 * @returns 获取结果，包含模型列表或错误信息
 */
export async function fetchModels(config: APIConfig): Promise<FetchModelsResult> {
  // 如果没有 API Key，返回默认列表
  if (!config.apiKey) {
    return { 
      success: true, 
      models: getDefaultModels(config.style) 
    };
  }

  // 检查缓存
  const cacheKey = generateCacheKey(config.style, config.apiKey, config.baseUrl);
  const cachedModels = getCachedModels(cacheKey);
  if (cachedModels) {
    return { success: true, models: cachedModels };
  }

  // 根据 API 风格获取模型列表
  const result = config.style === 'gemini' 
    ? await fetchGeminiModels(config)
    : await fetchOpenAIModels(config);

  // 成功时缓存结果
  if (result.success && result.models) {
    setCachedModels(cacheKey, result.models);
  }

  return result;
}
