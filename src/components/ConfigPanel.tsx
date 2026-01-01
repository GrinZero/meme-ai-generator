/**
 * API 配置面板组件
 * 提供 API Key、Base URL、API 风格和模型选择的配置界面
 */

import { useEffect, useRef, useCallback, useMemo, useState } from 'react';
import { useAppStore } from '../store/useAppStore';
import { validateAPIConfig } from '../services/configValidation';
import { clearCache } from '../services/modelListService';
import type { APIStyle, OpenAIGenerationMode } from '../types/api';

export function ConfigPanel() {
  const { 
    apiConfig, 
    setAPIConfig, 
    languagePreference, 
    setLanguagePreference,
    availableModels,
    isLoadingModels,
    modelListError,
    fetchModelList,
    aiSegmentationConfig,
    toggleAISegmentation,
    manualSplitConfig,
    setManualSplitConfig,
    resetManualSplitConfig,
  } = useAppStore();

  const [showAdvanced, setShowAdvanced] = useState(false);

  const validationResult = validateAPIConfig(apiConfig.apiKey, apiConfig.baseUrl);
  const validationErrors = validationResult.errors;
  
  // Use availableModels from store instead of hardcoded list
  const models = useMemo(() => 
    availableModels.length > 0 ? availableModels : [],
    [availableModels]
  );

  // Refs for debounce timers
  const apiKeyDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const baseUrlDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const prevApiKeyRef = useRef(apiConfig.apiKey);
  const prevBaseUrlRef = useRef(apiConfig.baseUrl);
  const prevStyleRef = useRef(apiConfig.style);

  // Fetch model list on mount and when config changes
  useEffect(() => {
    // Initial fetch
    fetchModelList();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Handle API Key change with debounce (500ms)
  useEffect(() => {
    if (prevApiKeyRef.current !== apiConfig.apiKey) {
      prevApiKeyRef.current = apiConfig.apiKey;
      
      if (apiKeyDebounceRef.current) {
        clearTimeout(apiKeyDebounceRef.current);
      }
      
      apiKeyDebounceRef.current = setTimeout(() => {
        fetchModelList();
      }, 500);
    }
    
    return () => {
      if (apiKeyDebounceRef.current) {
        clearTimeout(apiKeyDebounceRef.current);
      }
    };
  }, [apiConfig.apiKey, fetchModelList]);

  // Handle Base URL change with debounce (500ms)
  useEffect(() => {
    if (prevBaseUrlRef.current !== apiConfig.baseUrl) {
      prevBaseUrlRef.current = apiConfig.baseUrl;
      
      if (baseUrlDebounceRef.current) {
        clearTimeout(baseUrlDebounceRef.current);
      }
      
      baseUrlDebounceRef.current = setTimeout(() => {
        fetchModelList();
      }, 500);
    }
    
    return () => {
      if (baseUrlDebounceRef.current) {
        clearTimeout(baseUrlDebounceRef.current);
      }
    };
  }, [apiConfig.baseUrl, fetchModelList]);

  // Handle API style change (immediate fetch)
  useEffect(() => {
    if (prevStyleRef.current !== apiConfig.style) {
      prevStyleRef.current = apiConfig.style;
      fetchModelList();
    }
  }, [apiConfig.style, fetchModelList]);

  // Model selection preservation logic
  // Only auto-select when there's no error (user might be manually typing)
  useEffect(() => {
    if (!modelListError && models.length > 0) {
      const currentModelExists = models.some(m => m.id === apiConfig.model);
      if (!currentModelExists) {
        // Select first model if current selection doesn't exist
        setAPIConfig({ model: models[0].id });
      }
    }
  }, [models, apiConfig.model, setAPIConfig, modelListError]);

  // Handle manual refresh
  const handleRefresh = useCallback(() => {
    clearCache();
    fetchModelList();
  }, [fetchModelList]);

  const handleStyleChange = (style: APIStyle) => {
    // When style changes, model will be updated by the preservation logic
    // after fetchModelList completes
    setAPIConfig({ 
      style,
      model: '', // Clear model, will be set after fetch
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

      {/* OpenAI 生成模式选择 - 仅在选择 OpenAI 风格时显示 */}
      {apiConfig.style === 'openai' && (
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
            生成模式
          </label>
          <div className="flex flex-wrap gap-3 sm:gap-4">
            <label className="flex items-center cursor-pointer min-w-fit">
              <input
                type="radio"
                name="openaiGenerationMode"
                value="chat"
                checked={(apiConfig.openaiGenerationMode || 'chat') === 'chat'}
                onChange={() => setAPIConfig({ openaiGenerationMode: 'chat' as OpenAIGenerationMode })}
                className="mr-2 text-blue-600 focus:ring-blue-500"
              />
              <span className="text-gray-700 dark:text-gray-300">Chat</span>
            </label>
            <label className="flex items-center cursor-pointer min-w-fit">
              <input
                type="radio"
                name="openaiGenerationMode"
                value="images"
                checked={apiConfig.openaiGenerationMode === 'images'}
                onChange={() => setAPIConfig({ openaiGenerationMode: 'images' as OpenAIGenerationMode })}
                className="mr-2 text-blue-600 focus:ring-blue-500"
              />
              <span className="text-gray-700 dark:text-gray-300">Images</span>
            </label>
          </div>
          <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
            {apiConfig.openaiGenerationMode === 'images' 
              ? 'Images API 适用于 DALL-E 3 等专用图片生成模型'
              : 'Chat API 适用于 GPT-4o 等支持图片生成的聊天模型'}
          </p>
        </div>
      )}

      {/* 模型选择下拉框 / 手动输入 */}
      <div>
        <label 
          htmlFor="model" 
          className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1"
        >
          模型
        </label>
        <div className="flex items-center gap-2">
          {/* 当有错误时，显示手动输入框 */}
          {modelListError ? (
            <input
              type="text"
              id="model"
              value={apiConfig.model}
              onChange={(e) => setAPIConfig({ model: e.target.value })}
              placeholder="手动输入模型名称，如 gpt-4o"
              className="flex-1 min-w-0 px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:text-white text-sm"
            />
          ) : (
            <select
              id="model"
              value={apiConfig.model || (models.length > 0 ? models[0].id : '')}
              onChange={(e) => setAPIConfig({ model: e.target.value })}
              disabled={isLoadingModels}
              className={`flex-1 min-w-0 px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:text-white text-sm ${
                isLoadingModels ? 'opacity-50 cursor-not-allowed' : ''
              }`}
            >
              {isLoadingModels ? (
                <option value="">加载中...</option>
              ) : models.length > 0 ? (
                models.map((model) => (
                  <option key={model.id} value={model.id}>
                    {model.name}
                  </option>
                ))
              ) : (
                <option value="">无可用模型</option>
              )}
            </select>
          )}
          {/* 刷新按钮 */}
          <button
            type="button"
            onClick={handleRefresh}
            disabled={isLoadingModels}
            className={`flex-shrink-0 p-2 rounded-md border border-gray-300 dark:border-gray-600 hover:bg-gray-100 dark:hover:bg-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-500 ${
              isLoadingModels ? 'opacity-50 cursor-not-allowed' : ''
            }`}
            title="刷新模型列表"
          >
            <svg 
              className={`w-5 h-5 text-gray-600 dark:text-gray-300 ${isLoadingModels ? 'animate-spin' : ''}`}
              fill="none" 
              stroke="currentColor" 
              viewBox="0 0 24 24"
            >
              <path 
                strokeLinecap="round" 
                strokeLinejoin="round" 
                strokeWidth={2} 
                d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" 
              />
            </svg>
          </button>
        </div>
        {/* 错误提示 */}
        {modelListError && (
          <p className="mt-1 text-sm text-amber-600 dark:text-amber-400">
            {modelListError}，请手动输入模型名称或点击刷新重试
          </p>
        )}
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

      {/* AI 智能分割开关 */}
      <div className="pt-4 border-t border-gray-200 dark:border-gray-700">
        <div className="flex items-center justify-between">
          <div>
            <label className="text-sm font-medium text-gray-700 dark:text-gray-300">
              AI 智能分割（beta）
            </label>
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
              {aiSegmentationConfig.enabled
                ? '使用 AI 视觉模型识别表情区域'
                : '使用传统连通区域检测算法'}
            </p>
          </div>
          <button
            onClick={toggleAISegmentation}
            className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors duration-200 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 ${
              aiSegmentationConfig.enabled
                ? 'bg-blue-500'
                : 'bg-gray-300 dark:bg-gray-600'
            }`}
            role="switch"
            aria-checked={aiSegmentationConfig.enabled}
          >
            <span
              className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform duration-200 ${
                aiSegmentationConfig.enabled ? 'translate-x-6' : 'translate-x-1'
              }`}
            />
          </button>
        </div>
      </div>

      {/* 切割算法高级设置 */}
      <div className="pt-4 border-t border-gray-200 dark:border-gray-700">
        <button
          onClick={() => setShowAdvanced(!showAdvanced)}
          className="flex items-center justify-between w-full text-left"
        >
          <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
            切割算法参数
          </span>
          <svg
            className={`w-4 h-4 text-gray-500 transition-transform duration-200 ${showAdvanced ? 'rotate-180' : ''}`}
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
          </svg>
        </button>
        
        {showAdvanced && (
          <div className="mt-4 space-y-4">
            {/* 颜色容差 */}
            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="text-sm text-gray-600 dark:text-gray-400">
                  颜色容差
                </label>
                <span className="text-sm font-mono text-gray-500 dark:text-gray-400">
                  {manualSplitConfig.tolerance}
                </span>
              </div>
              <input
                type="range"
                min="5"
                max="100"
                value={manualSplitConfig.tolerance}
                onChange={(e) => setManualSplitConfig({ tolerance: Number(e.target.value) })}
                className="w-full h-2 bg-gray-200 dark:bg-gray-700 rounded-lg appearance-none cursor-pointer accent-blue-500"
              />
              <p className="mt-1 text-xs text-gray-400">
                判断像素是否为背景色的阈值，值越大越宽松
              </p>
            </div>

            {/* 最小区域面积 */}
            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="text-sm text-gray-600 dark:text-gray-400">
                  最小区域面积
                </label>
                <span className="text-sm font-mono text-gray-500 dark:text-gray-400">
                  {manualSplitConfig.minArea}px²
                </span>
              </div>
              <input
                type="range"
                min="10"
                max="500"
                step="10"
                value={manualSplitConfig.minArea}
                onChange={(e) => setManualSplitConfig({ minArea: Number(e.target.value) })}
                className="w-full h-2 bg-gray-200 dark:bg-gray-700 rounded-lg appearance-none cursor-pointer accent-blue-500"
              />
              <p className="mt-1 text-xs text-gray-400">
                过滤小于此面积的噪点区域
              </p>
            </div>

            {/* 最小边界尺寸 */}
            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="text-sm text-gray-600 dark:text-gray-400">
                  最小边界尺寸
                </label>
                <span className="text-sm font-mono text-gray-500 dark:text-gray-400">
                  {manualSplitConfig.minSize}px
                </span>
              </div>
              <input
                type="range"
                min="5"
                max="100"
                value={manualSplitConfig.minSize}
                onChange={(e) => setManualSplitConfig({ minSize: Number(e.target.value) })}
                className="w-full h-2 bg-gray-200 dark:bg-gray-700 rounded-lg appearance-none cursor-pointer accent-blue-500"
              />
              <p className="mt-1 text-xs text-gray-400">
                过滤宽或高小于此值的区域
              </p>
            </div>

            {/* 合并距离 */}
            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="text-sm text-gray-600 dark:text-gray-400">
                  合并距离
                </label>
                <span className="text-sm font-mono text-gray-500 dark:text-gray-400">
                  {manualSplitConfig.mergeDistancePercent}%
                </span>
              </div>
              <input
                type="range"
                min="0"
                max="10"
                step="0.5"
                value={manualSplitConfig.mergeDistancePercent}
                onChange={(e) => setManualSplitConfig({ mergeDistancePercent: Number(e.target.value) })}
                className="w-full h-2 bg-gray-200 dark:bg-gray-700 rounded-lg appearance-none cursor-pointer accent-blue-500"
              />
              <p className="mt-1 text-xs text-gray-400">
                相邻区域合并阈值，基于图片短边的百分比
              </p>
            </div>

            {/* 重置按钮 */}
            <button
              onClick={resetManualSplitConfig}
              className="w-full py-2 px-3 text-sm text-gray-600 dark:text-gray-400 border border-gray-300 dark:border-gray-600 rounded-md hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
            >
              恢复默认值
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
