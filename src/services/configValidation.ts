/**
 * API 配置验证服务
 * 提供 API Key 和 Base URL 的验证逻辑
 */

export interface ConfigValidationErrors {
  apiKey?: string;
  baseUrl?: string;
}

export interface ValidationResult {
  isValid: boolean;
  errors: ConfigValidationErrors;
}

/**
 * 验证 API Key 是否有效
 * @param apiKey - API Key 字符串
 * @returns 错误消息，如果有效则返回 undefined
 */
export function validateApiKey(apiKey: string): string | undefined {
  if (!apiKey || apiKey.trim() === '') {
    return 'API Key 不能为空';
  }
  return undefined;
}

/**
 * 验证 Base URL 格式是否有效
 * @param baseUrl - Base URL 字符串
 * @returns 错误消息，如果有效则返回 undefined
 */
export function validateBaseUrl(baseUrl: string): string | undefined {
  // Base URL 是可选的，空值是有效的
  if (!baseUrl || baseUrl.trim() === '') {
    return undefined;
  }

  try {
    const url = new URL(baseUrl);
    // 确保是 http 或 https 协议
    if (url.protocol !== 'http:' && url.protocol !== 'https:') {
      return 'Base URL 必须使用 http 或 https 协议';
    }
    return undefined;
  } catch {
    return 'Base URL 格式无效，请输入有效的 URL';
  }
}

/**
 * 验证完整的 API 配置
 * @param apiKey - API Key 字符串
 * @param baseUrl - Base URL 字符串
 * @returns 验证结果，包含是否有效和错误信息
 */
export function validateAPIConfig(apiKey: string, baseUrl: string): ValidationResult {
  const errors: ConfigValidationErrors = {};

  const apiKeyError = validateApiKey(apiKey);
  if (apiKeyError) {
    errors.apiKey = apiKeyError;
  }

  const baseUrlError = validateBaseUrl(baseUrl);
  if (baseUrlError) {
    errors.baseUrl = baseUrlError;
  }

  return {
    isValid: Object.keys(errors).length === 0,
    errors,
  };
}

/**
 * 检查配置是否完整可用
 * @param apiKey - API Key 字符串
 * @param baseUrl - Base URL 字符串
 * @returns 配置是否完整可用
 */
export function isConfigComplete(apiKey: string, baseUrl: string): boolean {
  const result = validateAPIConfig(apiKey, baseUrl);
  return result.isValid;
}
