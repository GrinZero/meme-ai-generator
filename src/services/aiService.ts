/* eslint-disable @typescript-eslint/no-explicit-any */
/**
 * AI Service - AI API 适配器
 * 
 * 支持 Gemini 和 OpenAI 风格的 API
 * 
 * Requirements: 5.1
 */

import { GoogleGenerativeAI, GenerativeModel } from '@google/generative-ai';
import OpenAI from 'openai';
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
    // 如果配置了自定义 baseUrl，需要通过 requestOptions 传递
    const modelName = config.model || 'gemini-2.0-flash-exp';
    const requestOptions = config.baseUrl ? { baseUrl: config.baseUrl } : undefined;
    const model: GenerativeModel = genAI.getGenerativeModel({ 
      model: modelName,
    }, requestOptions);

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
    console.error('[AI Service] Gemini Error:', error);
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
 * 从 URL 获取图片 Blob
 */
async function fetchImageFromUrl(url: string): Promise<Blob> {
  const response = await fetch(url);
  if (!response.ok) {
    throw new AIError('NETWORK_ERROR', '无法获取生成的图片');
  }
  return response.blob();
}

/**
 * 将图片文件转换为 data URL
 */
async function fileToDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

/**
 * OpenAI Images API 适配器
 * 使用 client.images.generate (适用于 DALL-E 3、豆包等专用图片生成模型)
 * 支持通过 extra_body.image 传递多张参考图片
 */
export async function generateWithOpenAIImages(
  config: APIConfig,
  prompt: string,
  images: UploadedImage[]
): Promise<GenerationResult> {
  currentAbortController = new AbortController();
  
  try {
    const client = new OpenAI({
      apiKey: config.apiKey,
      baseURL: config.baseUrl || 'https://api.openai.com/v1',
      dangerouslyAllowBrowser: true,
    });

    // 检查是否已取消
    if (currentAbortController?.signal.aborted) {
      throw new AIError('CANCELLED', '生成已取消');
    }

    const model = config.model || 'dall-e-3';
    
    // 准备图片 data URL 列表（用于 extra_body）
    const imageDataUrls = await Promise.all(
      images.map(img => fileToDataUrl(img.file))
    );

    // 构建请求参数
    const requestParams: OpenAI.Images.ImageGenerateParams = {
      model: model,
      prompt: prompt,
      n: 1,
      size: '2k' as any,
      response_format: 'b64_json',
    };

    // 如果有参考图片，通过 extra_body 传递
    const requestOptions: { signal: AbortSignal; body?: Record<string, unknown> } = {
      signal: currentAbortController.signal,
    };
    
    if (imageDataUrls.length > 0) {
      // 使用 extra_body 传递图片（兼容豆包等 API）
      (requestParams as any).image = imageDataUrls
    }

    // 发送请求
    const response = await client.images.generate(requestParams, requestOptions);

    // 检查是否已取消
    if (currentAbortController?.signal.aborted) {
      throw new AIError('CANCELLED', '生成已取消');
    }

    const data = response.data;
    if (!data || data.length === 0) {
      throw new AIError('INVALID_RESPONSE', 'AI 未返回图片');
    }

    const imageData = data[0];
    
    // 优先使用 b64_json
    if (imageData.b64_json) {
      const blob = base64ToBlob(imageData.b64_json, 'image/png');
      return { success: true, imageBlob: blob };
    }
    
    // 如果返回的是 URL，则获取图片
    if (imageData.url) {
      const blob = await fetchImageFromUrl(imageData.url);
      return { success: true, imageBlob: blob };
    }

    throw new AIError('INVALID_RESPONSE', 'AI 未返回有效的图片数据');
    
  } catch (error) {
    console.error('[AI Service] OpenAI Images Error:', error);
    if (error instanceof AIError) {
      return { success: false, error: getErrorMessage(error.type) };
    }
    
    // 处理 AbortError
    if (error instanceof Error && error.name === 'AbortError') {
      return { success: false, error: getErrorMessage('CANCELLED') };
    }
    
    // 处理 OpenAI SDK 错误
    const apiError = error as { status?: number; message?: string };
    if (typeof apiError.status === 'number') {
      if (apiError.status === 401) {
        return { success: false, error: getErrorMessage('INVALID_API_KEY') };
      }
      if (apiError.status === 429) {
        return { success: false, error: getErrorMessage('RATE_LIMIT') };
      }
      return { success: false, error: apiError.message || getErrorMessage('UNKNOWN') };
    }
    
    // 处理其他错误
    const errorMessage = error instanceof Error ? error.message : String(error);
    
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
 * OpenAI Chat Completions API 适配器
 * 使用 chat.completions (适用于 GPT-4o 等支持图片生成的聊天模型)
 */
export async function generateWithOpenAIChat(
  config: APIConfig,
  prompt: string,
  images: UploadedImage[]
): Promise<GenerationResult> {
  currentAbortController = new AbortController();
  
  try {
    const client = new OpenAI({
      apiKey: config.apiKey,
      baseURL: config.baseUrl || 'https://api.openai.com/v1',
      dangerouslyAllowBrowser: true,
    });

    // 准备图片内容
    const imageContents: OpenAI.Chat.ChatCompletionContentPartImage[] = await Promise.all(
      images.map(async (img) => ({
        type: 'image_url' as const,
        image_url: {
          url: `data:${getMimeType(img.file)};base64,${await fileToBase64(img.file)}`,
        },
      }))
    );

    // 构建消息内容
    const content: OpenAI.Chat.ChatCompletionContentPart[] = [
      { type: 'text' as const, text: prompt },
      ...imageContents,
    ];

    // 检查是否已取消
    if (currentAbortController?.signal.aborted) {
      throw new AIError('CANCELLED', '生成已取消');
    }

    // 发送请求
    const response = await client.chat.completions.create({
      model: config.model || 'gpt-4o',
      messages: [
        {
          role: 'user',
          content,
        },
      ],
    }, {
      signal: currentAbortController.signal,
    });

    // 检查是否已取消
    if (currentAbortController?.signal.aborted) {
      throw new AIError('CANCELLED', '生成已取消');
    }

    // 检查响应格式
    const choices = response.choices;
    if (!choices || choices.length === 0) {
      throw new AIError('INVALID_RESPONSE', 'AI 返回了无效的响应');
    }

    const message = choices[0].message;

    // OpenAI 的图片生成通常返回 URL 或 base64
    // 对于 chat completions，我们需要检查是否有图片数据
    const content_response = message.content;
    
    // 首先检查 message.images 数组（Gemini 等模型的返回格式）
    const responseImages = (message as { images?: Array<{ image_url?: { url?: string } }> }).images;
    if (responseImages && responseImages.length > 0) {
      const imageUrl = responseImages[0]?.image_url?.url;
      if (imageUrl) {
        // 处理 data URL 格式
        const base64Match = imageUrl.match(/^data:image\/[^;]+;base64,(.+)$/);
        if (base64Match) {
          const blob = base64ToBlob(base64Match[1]);
          return { success: true, imageBlob: blob };
        }
        // 处理普通 URL（需要 fetch）
        try {
          const imageResponse = await fetch(imageUrl);
          const blob = await imageResponse.blob();
          return { success: true, imageBlob: blob };
        } catch {
          throw new AIError('INVALID_RESPONSE', '无法获取生成的图片');
        }
      }
    }
    
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

    throw new AIError('INVALID_RESPONSE', 'AI 未返回图片');
    
  } catch (error) {
    console.error('[AI Service] OpenAI Chat Error:', error);
    if (error instanceof AIError) {
      return { success: false, error: getErrorMessage(error.type) };
    }
    
    // 处理 AbortError
    if (error instanceof Error && error.name === 'AbortError') {
      return { success: false, error: getErrorMessage('CANCELLED') };
    }
    
    // 处理 OpenAI SDK 错误 (duck typing for better compatibility)
    const apiError = error as { status?: number; message?: string };
    if (typeof apiError.status === 'number') {
      if (apiError.status === 401) {
        return { success: false, error: getErrorMessage('INVALID_API_KEY') };
      }
      if (apiError.status === 429) {
        return { success: false, error: getErrorMessage('RATE_LIMIT') };
      }
      return { success: false, error: apiError.message || getErrorMessage('UNKNOWN') };
    }
    
    // 处理其他错误
    const errorMessage = error instanceof Error ? error.message : String(error);
    
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
 * OpenAI 风格 API 适配器
 * 根据配置的 generationMode 选择使用 chat 或 images API
 */
export async function generateWithOpenAI(
  config: APIConfig,
  prompt: string,
  images: UploadedImage[]
): Promise<GenerationResult> {
  // 根据配置选择生成模式
  const mode = config.openaiGenerationMode || 'chat';
  
  if (mode === 'images') {
    return generateWithOpenAIImages(config, prompt, images);
  } else {
    return generateWithOpenAIChat(config, prompt, images);
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
