/**
 * API 配置面板组件
 * 提供 API Key、Base URL、API 风格和模型选择的配置界面
 */

import { useAppStore } from '../store/useAppStore';
import { validateAPIConfig } from '../services/configValidation';
import type { APIStyle } from '../types/api';

// 预设模型列表
const GEMINI_MODELS = [
  'gemini-2.0-flash-exp',
  'gemini-1.5-pro',
  'gemini-1.5-flash',
];

const OPENAI_MODELS = [
  'gpt-4o',
  'gpt-4o-mini',
  'gpt-4-turbo',
  'dall-e-3',
];

export function ConfigPanel() {
  const { apiConfig, setAPIConfig, languagePreference, setLanguagePreference } = useAppStore();

  const validationResult = validateAPIConfig(apiConfig.apiKey, apiConfig.baseUrl);
  const validationErrors = validationResult.errors;
  const models = apiConfig.style === 'gemini' ? GEMINI_MODELS : OPENAI_MODELS;

  const handleStyleChange = (style: APIStyle) => {
    setAPIConfig({ 
      style,
      model: style === 'gemini' ? GEMINI_MODELS[0] : OPENAI_MODELS[0],
    });
  };

  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md p-6 space-y-4">
      <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
        API 配置
      </h2>

      {/* API Key 输入框 */}
      <div>
        <label 
          htmlFor="apiKey" 
          className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1"
        >
          API Key
        </label>
        <input
          type="password"
          id="apiKey"
          value={apiConfig.apiKey}
          onChange={(e) => setAPIConfig({ apiKey: e.target.value })}
          placeholder="输入你的 API Key"
          className={`w-full px-3 py-2 border rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:text-white ${
            validationErrors.apiKey 
              ? 'border-red-500 focus:ring-red-500' 
              : 'border-gray-300 dark:border-gray-600'
          }`}
        />
        {validationErrors.apiKey && (
          <p className="mt-1 text-sm text-red-500">{validationErrors.apiKey}</p>
        )}
      </div>

      {/* Base URL 输入框 */}
      <div>
        <label 
          htmlFor="baseUrl" 
          className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1"
        >
          Base URL <span className="text-gray-400">(可选)</span>
        </label>
        <input
          type="text"
          id="baseUrl"
          value={apiConfig.baseUrl}
          onChange={(e) => setAPIConfig({ baseUrl: e.target.value })}
          placeholder="自定义 API 端点 URL"
          className={`w-full px-3 py-2 border rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:text-white ${
            validationErrors.baseUrl 
              ? 'border-red-500 focus:ring-red-500' 
              : 'border-gray-300 dark:border-gray-600'
          }`}
        />
        {validationErrors.baseUrl && (
          <p className="mt-1 text-sm text-red-500">{validationErrors.baseUrl}</p>
        )}
      </div>

      {/* API 风格选择 */}
      <div>
        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
          API 风格
        </label>
        <div className="flex flex-wrap gap-3 sm:gap-4">
          <label className="flex items-center cursor-pointer min-w-fit">
            <input
              type="radio"
              name="apiStyle"
              value="gemini"
              checked={apiConfig.style === 'gemini'}
              onChange={() => handleStyleChange('gemini')}
              className="mr-2 text-blue-600 focus:ring-blue-500"
            />
            <span className="text-gray-700 dark:text-gray-300">Gemini</span>
          </label>
          <label className="flex items-center cursor-pointer min-w-fit">
            <input
              type="radio"
              name="apiStyle"
              value="openai"
              checked={apiConfig.style === 'openai'}
              onChange={() => handleStyleChange('openai')}
              className="mr-2 text-blue-600 focus:ring-blue-500"
            />
            <span className="text-gray-700 dark:text-gray-300">OpenAI</span>
          </label>
        </div>
      </div>

      {/* 模型选择下拉框 */}
      <div>
        <label 
          htmlFor="model" 
          className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1"
        >
          模型
        </label>
        <select
          id="model"
          value={apiConfig.model || models[0]}
          onChange={(e) => setAPIConfig({ model: e.target.value })}
          className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:text-white"
        >
          {models.map((model) => (
            <option key={model} value={model}>
              {model}
            </option>
          ))}
        </select>
      </div>

      {/* 语言偏好设置 */}
      <div className="pt-4 border-t border-gray-200 dark:border-gray-700">
        <label 
          htmlFor="languagePreference" 
          className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1"
        >
          语言偏好
        </label>
        <input
          type="text"
          id="languagePreference"
          value={languagePreference}
          onChange={(e) => setLanguagePreference(e.target.value)}
          placeholder="例如：配字必须是中文"
          className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:text-white"
        />
        <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
          设置生成表情包文字的语言偏好
        </p>
      </div>
    </div>
  );
}
