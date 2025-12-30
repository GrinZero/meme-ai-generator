/**
 * AI Service - AI API 适配器
 * 
 * 支持 Gemini 和 OpenAI 风格的 API
 * 
 * Requirements: 5.1
 */

import { GoogleGenerativeAI, GenerativeModel } from '@google/generative-ai';
import type { APIConfig } from '../types/api';
import type { UploadedImage } from '../types/image';

/**
 * AI 生成结果
 */
export interface GenerationResult {
  success: boolean;
  imageBlob?: Blob;
  error?: string;
}

/**
 * 错误类型枚举
 */
export type AIErrorType = 
  | 'INVALID_API_KEY'
  | 'RATE_LIMIT'
  | 'NETWORK_ERROR'
  | 'TIMEOUT'
  | 'INVALID_RESPONSE'
  | 'CANCELLED'
  | 'UNKNOWN';

/**
 * AI 错误类
 */
export class AIError extends Error {
  type: AIErrorType;
  
  constructor(type: AIErrorType, message: string) {
    super(message);
    this.type = type;
    this.name = 'AIError';
  }
}

/**
 * 将错误类型转换为用户友好的消息
 */
export function getErrorMessage(type: AIErrorType): string {
  const messages: Record<AIErrorType, string> = {
    INVALID_API_KEY: 'API Key 无效，请检查配置',
    RATE_LIMIT: '请求过于频繁，请稍后再试',
    NETWORK_ERROR: '网络连接失败，请检查网络',
    TIMEOUT: '请求超时，请重试',
    INVALID_RESPONSE: 'AI 返回了无效的响应',
    CANCELLED: '生成已取消',
    UNKNOWN: '发生未知错误，请重试',
  };
  return messages[type];
}

/**
 * 将 File 转换为 base64 字符串
 */
async function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result as string;
      // 移除 data:image/xxx;base64, 前缀
      const base64 = result.split(',')[1];
      resolve(base64);
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

/**
 * 获取文件的 MIME 类型
 */
function getMimeType(file: File): string {
  return file.type || 'image/png';
}

/**
 * 将 base64 图片数据转换为 Blob
 */
function base64ToBlob(base64: string, mimeType: string = 'image/png'): Blob {
  const byteCharacters = atob(base64);
  const byteNumbers = new Array(byteCharacters.length);
  for (let i = 0; i < byteCharacters.length; i++) {
    byteNumbers[i] = byteCharacters.charCodeAt(i);
  }
  const byteArray = new Uint8Array(byteNumbers);
  return new Blob([byteArray], { type: mimeType });
}

/**
 * AbortController 管理器
 */
let currentAbortController: AbortController | null = null;

/**
 * 取消当前生成请求
 */
export function cancelGeneration(): void {
  if (currentAbortController) {
    currentAbortController.abort();
    currentAbortController = null;
  }
}

/**
 * Gemini API 适配器
 * 使用 @google/generative-ai SDK
 */
export async function generateWithGemini(
  config: APIConfig,
  prompt: string,
  images: UploadedImage[]
): Promise<GenerationResult> {
  currentAbortController = new AbortController();
  
  try {
    // 初始化 Gemini 客户端
    const genAI = new GoogleGenerativeAI(config.apiKey);
    
    // 获取模型，使用配置的模型或默认模型
    const modelName = config.model || 'gemini-2.0-flash-exp';
    const model: GenerativeModel = genAI.getGenerativeModel({ 
      model: modelName,
    });

    // 准备图片数据
    const imageParts = await Promise.all(
      images.map(async (img) => ({
        inlineData: {
          data: await fileToBase64(img.file),
          mimeType: getMimeType(img.file),
        },
      }))
    );

    // 检查是否已取消
    if (currentAbortController?.signal.aborted) {
      throw new AIError('CANCELLED', '生成已取消');
    }

    // 发送请求
    const result = await model.generateContent([prompt, ...imageParts]);
    
    // 检查是否已取消
    if (currentAbortController?.signal.aborted) {
      throw new AIError('CANCELLED', '生成已取消');
    }

    const response = result.response;
    
    // 检查响应中是否有图片
    const candidates = response.candidates;
    if (!candidates || candidates.length === 0) {
      throw new AIError('INVALID_RESPONSE', 'AI 返回了无效的响应');
    }

    // 查找图片内容
    for (const candidate of candidates) {
      const parts = candidate.content?.parts;
      if (!parts) continue;
      
      for (const part of parts) {
        // 检查是否有内联数据（图片）
        if ('inlineData' in part && part.inlineData) {
          const { data, mimeType } = part.inlineData;
          const blob = base64ToBlob(data, mimeType);
          return { success: true, imageBlob: blob };
        }
      }
    }

    // 如果没有找到图片，返回错误
    throw new AIError('INVALID_RESPONSE', 'AI 未返回图片');
    
  } catch (error) {
    if (error instanceof AIError) {
      return { success: false, error: getErrorMessage(error.type) };
    }
    
    // 处理其他错误
    const errorMessage = error instanceof Error ? error.message : String(error);
    
    if (errorMessage.includes('API key')) {
      return { success: false, error: getErrorMessage('INVALID_API_KEY') };
    }
    if (errorMessage.includes('quota') || errorMessage.includes('rate')) {
      return { success: false, error: getErrorMessage('RATE_LIMIT') };
    }
    if (errorMessage.includes('network') || errorMessage.includes('fetch')) {
      return { success: false, error: getErrorMessage('NETWORK_ERROR') };
    }
    if (errorMessage.includes('timeout')) {
      return { success: false, error: getErrorMessage('TIMEOUT') };
    }
    
    return { success: false, error: getErrorMessage('UNKNOWN') };
  } finally {
    currentAbortController = null;
  }
}


/**
 * OpenAI 风格 API 适配器
 * 使用 fetch 发送请求，支持自定义 base URL
 */
export async function generateWithOpenAI(
  config: APIConfig,
  prompt: string,
  images: UploadedImage[]
): Promise<GenerationResult> {
  currentAbortController = new AbortController();
  
  try {
    // 构建 base URL
    const baseUrl = config.baseUrl || 'https://api.openai.com/v1';
    const endpoint = `${baseUrl.replace(/\/$/, '')}/chat/completions`;
    
    // 准备图片内容
    const imageContents = await Promise.all(
      images.map(async (img) => ({
        type: 'image_url' as const,
        image_url: {
          url: `data:${getMimeType(img.file)};base64,${await fileToBase64(img.file)}`,
        },
      }))
    );

    // 构建消息内容
    const content = [
      { type: 'text' as const, text: prompt },
      ...imageContents,
    ];

    // 检查是否已取消
    if (currentAbortController?.signal.aborted) {
      throw new AIError('CANCELLED', '生成已取消');
    }

    // 发送请求
    const response = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${config.apiKey}`,
      },
      body: JSON.stringify({
        model: config.model || 'gpt-4o',
        messages: [
          {
            role: 'user',
            content,
          },
        ],
        max_tokens: 4096,
      }),
      signal: currentAbortController.signal,
    });

    // 检查是否已取消
    if (currentAbortController?.signal.aborted) {
      throw new AIError('CANCELLED', '生成已取消');
    }

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      const errorMessage = errorData.error?.message || response.statusText;
      
      if (response.status === 401) {
        throw new AIError('INVALID_API_KEY', errorMessage);
      }
      if (response.status === 429) {
        throw new AIError('RATE_LIMIT', errorMessage);
      }
      throw new AIError('UNKNOWN', errorMessage);
    }

    const data = await response.json();
    
    // 检查响应格式
    const choices = data.choices;
    if (!choices || choices.length === 0) {
      throw new AIError('INVALID_RESPONSE', 'AI 返回了无效的响应');
    }

    const message = choices[0].message;
    if (!message || !message.content) {
      throw new AIError('INVALID_RESPONSE', 'AI 返回了无效的响应');
    }

    // OpenAI 的图片生成通常返回 URL 或 base64
    // 对于 chat completions，我们需要检查是否有图片数据
    const content_response = message.content;
    
    // 如果是字符串，可能包含 base64 图片数据
    if (typeof content_response === 'string') {
      // 尝试解析 base64 图片
      const base64Match = content_response.match(/data:image\/[^;]+;base64,([A-Za-z0-9+/=]+)/);
      if (base64Match) {
        const blob = base64ToBlob(base64Match[1]);
        return { success: true, imageBlob: blob };
      }
      
      // 如果没有图片，返回文本响应作为错误
      throw new AIError('INVALID_RESPONSE', 'AI 未返回图片，请使用支持图片生成的模型');
    }

    // 如果是数组，查找图片内容
    if (Array.isArray(content_response)) {
      for (const item of content_response) {
        if (item.type === 'image_url' && item.image_url?.url) {
          const url = item.image_url.url;
          if (url.startsWith('data:')) {
            const base64Match = url.match(/data:image\/[^;]+;base64,([A-Za-z0-9+/=]+)/);
            if (base64Match) {
              const blob = base64ToBlob(base64Match[1]);
              return { success: true, imageBlob: blob };
            }
          } else {
            // 如果是 URL，需要下载图片
            const imageResponse = await fetch(url);
            const blob = await imageResponse.blob();
            return { success: true, imageBlob: blob };
          }
        }
      }
    }

    throw new AIError('INVALID_RESPONSE', 'AI 未返回图片');
    
  } catch (error) {
    if (error instanceof AIError) {
      return { success: false, error: getErrorMessage(error.type) };
    }
    
    // 处理 AbortError
    if (error instanceof Error && error.name === 'AbortError') {
      return { success: false, error: getErrorMessage('CANCELLED') };
    }
    
    // 处理其他错误
    const errorMessage = error instanceof Error ? error.message : String(error);
    
    if (errorMessage.includes('API key') || errorMessage.includes('Unauthorized')) {
      return { success: false, error: getErrorMessage('INVALID_API_KEY') };
    }
    if (errorMessage.includes('quota') || errorMessage.includes('rate')) {
      return { success: false, error: getErrorMessage('RATE_LIMIT') };
    }
    if (errorMessage.includes('network') || errorMessage.includes('Failed to fetch')) {
      return { success: false, error: getErrorMessage('NETWORK_ERROR') };
    }
    if (errorMessage.includes('timeout')) {
      return { success: false, error: getErrorMessage('TIMEOUT') };
    }
    
    return { success: false, error: getErrorMessage('UNKNOWN') };
  } finally {
    currentAbortController = null;
  }
}

/**
 * 统一的生成接口
 * 根据配置的 API 风格选择对应的适配器
 */
export async function generateImage(
  config: APIConfig,
  prompt: string,
  images: UploadedImage[]
): Promise<GenerationResult> {
  if (config.style === 'gemini') {
    return generateWithGemini(config, prompt, images);
  } else {
    return generateWithOpenAI(config, prompt, images);
  }
}
