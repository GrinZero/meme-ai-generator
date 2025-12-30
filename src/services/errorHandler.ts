/**
 * Error Handler - 错误处理服务
 * 
 * 提供用户友好的错误消息和重试机制
 * 
 * Requirements: 5.4
 */

import type { AIErrorType } from './aiService';

/**
 * 错误信息接口
 */
export interface ErrorInfo {
  type: AIErrorType;
  message: string;
  userMessage: string;
  canRetry: boolean;
  retryDelay?: number; // 重试延迟（毫秒）
}

/**
 * 错误类型到用户友好消息的映射
 */
const ERROR_MESSAGES: Record<AIErrorType, Omit<ErrorInfo, 'type'>> = {
  INVALID_API_KEY: {
    message: 'Invalid API key',
    userMessage: 'API Key 无效，请检查配置',
    canRetry: false,
  },
  RATE_LIMIT: {
    message: 'Rate limit exceeded',
    userMessage: '请求过于频繁，请稍后再试',
    canRetry: true,
    retryDelay: 60000, // 1 分钟后重试
  },
  NETWORK_ERROR: {
    message: 'Network error',
    userMessage: '网络连接失败，请检查网络',
    canRetry: true,
    retryDelay: 3000,
  },
  TIMEOUT: {
    message: 'Request timeout',
    userMessage: '请求超时，请重试',
    canRetry: true,
    retryDelay: 1000,
  },
  INVALID_RESPONSE: {
    message: 'Invalid response from AI',
    userMessage: 'AI 返回了无效的响应',
    canRetry: true,
    retryDelay: 1000,
  },
  CANCELLED: {
    message: 'Generation cancelled',
    userMessage: '生成已取消',
    canRetry: false,
  },
  UNKNOWN: {
    message: 'Unknown error',
    userMessage: '发生未知错误，请重试',
    canRetry: true,
    retryDelay: 1000,
  },
};

/**
 * 获取错误信息
 */
export function getErrorInfo(type: AIErrorType): ErrorInfo {
  const info = ERROR_MESSAGES[type];
  return {
    type,
    ...info,
  };
}

/**
 * 从错误消息推断错误类型
 */
export function inferErrorType(error: unknown): AIErrorType {
  if (error instanceof Error) {
    const message = error.message.toLowerCase();
    
    if (message.includes('api key') || message.includes('unauthorized') || message.includes('401')) {
      return 'INVALID_API_KEY';
    }
    if (message.includes('rate') || message.includes('quota') || message.includes('429')) {
      return 'RATE_LIMIT';
    }
    if (message.includes('network') || message.includes('fetch') || message.includes('connection')) {
      return 'NETWORK_ERROR';
    }
    if (message.includes('timeout') || message.includes('timed out')) {
      return 'TIMEOUT';
    }
    if (message.includes('cancel') || message.includes('abort')) {
      return 'CANCELLED';
    }
    if (message.includes('invalid') || message.includes('response')) {
      return 'INVALID_RESPONSE';
    }
  }
  
  return 'UNKNOWN';
}

/**
 * 获取用户友好的错误消息
 * 确保返回的消息是非空的、用户友好的（不包含原始错误码或堆栈跟踪）
 */
export function getUserFriendlyMessage(error: unknown): string {
  // 如果是字符串，检查是否已经是用户友好的消息
  if (typeof error === 'string') {
    // 检查是否是已知的用户友好消息
    const knownMessages = Object.values(ERROR_MESSAGES).map(e => e.userMessage);
    if (knownMessages.includes(error)) {
      return error;
    }
    // 如果包含技术细节，返回通用消息
    if (error.includes('Error:') || error.includes('at ') || /\d{3}/.test(error)) {
      return ERROR_MESSAGES.UNKNOWN.userMessage;
    }
    return error || ERROR_MESSAGES.UNKNOWN.userMessage;
  }
  
  // 推断错误类型并返回对应的用户友好消息
  const errorType = inferErrorType(error);
  return ERROR_MESSAGES[errorType].userMessage;
}

/**
 * 检查错误消息是否是用户友好的
 * 用户友好的消息应该：
 * 1. 非空
 * 2. 不包含原始错误码（如 401, 500）
 * 3. 不包含堆栈跟踪
 * 4. 不包含技术术语（如 "Error:", "at ", "undefined"）
 */
export function isUserFriendlyMessage(message: string): boolean {
  if (!message || message.trim() === '') {
    return false;
  }
  
  // 检查是否包含技术细节
  const technicalPatterns = [
    /Error:/i,
    /at\s+\w+/,  // 堆栈跟踪
    /\b\d{3}\b/, // HTTP 状态码
    /undefined/i,
    /null/i,
    /exception/i,
    /stack/i,
    /trace/i,
  ];
  
  for (const pattern of technicalPatterns) {
    if (pattern.test(message)) {
      return false;
    }
  }
  
  return true;
}

/**
 * 重试配置
 */
export interface RetryConfig {
  maxRetries: number;
  baseDelay: number;
  maxDelay: number;
}

const DEFAULT_RETRY_CONFIG: RetryConfig = {
  maxRetries: 3,
  baseDelay: 1000,
  maxDelay: 30000,
};

/**
 * 计算重试延迟（指数退避）
 */
export function calculateRetryDelay(
  attempt: number,
  config: RetryConfig = DEFAULT_RETRY_CONFIG
): number {
  const delay = config.baseDelay * Math.pow(2, attempt);
  return Math.min(delay, config.maxDelay);
}

/**
 * 带重试的异步操作执行器
 */
export async function withRetry<T>(
  operation: () => Promise<T>,
  config: RetryConfig = DEFAULT_RETRY_CONFIG,
  onRetry?: (attempt: number, error: unknown) => void
): Promise<T> {
  let lastError: unknown;
  
  for (let attempt = 0; attempt <= config.maxRetries; attempt++) {
    try {
      return await operation();
    } catch (error) {
      lastError = error;
      
      // 检查是否可以重试
      const errorType = inferErrorType(error);
      const errorInfo = getErrorInfo(errorType);
      
      if (!errorInfo.canRetry || attempt >= config.maxRetries) {
        throw error;
      }
      
      // 计算延迟
      const delay = errorInfo.retryDelay || calculateRetryDelay(attempt, config);
      
      // 通知重试
      if (onRetry) {
        onRetry(attempt + 1, error);
      }
      
      // 等待后重试
      await new Promise(resolve => setTimeout(resolve, delay));
    }
  }
  
  throw lastError;
}
