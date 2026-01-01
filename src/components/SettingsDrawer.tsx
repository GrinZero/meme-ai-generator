/**
 * 设置抽屉组件
 * 通过悬浮按钮触发的侧边抽屉，包含所有配置选项
 */

import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { useAppStore } from '../store/useAppStore';
import { validateAPIConfig } from '../services/configValidation';
import { clearCache } from '../services/modelListService';
import type { APIStyle, OpenAIGenerationMode } from '../types/api';

export function SettingsDrawer() {
  const [isOpen, setIsOpen] = useState(false);
  const [showAdvanced, setShowAdvanced] = useState(false);
  
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

  const validationResult = validateAPIConfig(apiConfig.apiKey, apiConfig.baseUrl);
  const validationErrors = validationResult.errors;
  
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

  useEffect(() => {
    fetchModelList();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (prevApiKeyRef.current !== apiConfig.apiKey) {
      prevApiKeyRef.current = apiConfig.apiKey;
      if (apiKeyDebounceRef.current) clearTimeout(apiKeyDebounceRef.current);
      apiKeyDebounceRef.current = setTimeout(() => fetchModelList(), 500);
    }
    return () => { if (apiKeyDebounceRef.current) clearTimeout(apiKeyDebounceRef.current); };
  }, [apiConfig.apiKey, fetchModelList]);

  useEffect(() => {
    if (prevBaseUrlRef.current !== apiConfig.baseUrl) {
      prevBaseUrlRef.current = apiConfig.baseUrl;
      if (baseUrlDebounceRef.current) clearTimeout(baseUrlDebounceRef.current);
      baseUrlDebounceRef.current = setTimeout(() => fetchModelList(), 500);
    }
    return () => { if (baseUrlDebounceRef.current) clearTimeout(baseUrlDebounceRef.current); };
  }, [apiConfig.baseUrl, fetchModelList]);

  useEffect(() => {
    if (prevStyleRef.current !== apiConfig.style) {
      prevStyleRef.current = apiConfig.style;
      fetchModelList();
    }
  }, [apiConfig.style, fetchModelList]);

  useEffect(() => {
    if (!modelListError && models.length > 0) {
      const currentModelExists = models.some(m => m.id === apiConfig.model);
      if (!currentModelExists) {
        setAPIConfig({ model: models[0].id });
      }
    }
  }, [models, apiConfig.model, setAPIConfig, modelListError]);

  const handleRefresh = useCallback(() => {
    clearCache();
    fetchModelList();
  }, [fetchModelList]);

  const handleStyleChange = (style: APIStyle) => {
    setAPIConfig({ style, model: '' });
  };

  // ESC 键关闭
  useEffect(() => {
    const handleEsc = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) setIsOpen(false);
    };
    window.addEventListener('keydown', handleEsc);
    return () => window.removeEventListener('keydown', handleEsc);
  }, [isOpen]);

  return (
    <>
      {/* 悬浮设置按钮 */}
      <button
        onClick={() => setIsOpen(true)}
        className="fixed left-0 top-1/2 -translate-y-1/2 z-[99]
                   bg-white dark:bg-gray-800 shadow-lg
                   rounded-r-lg p-3 pr-4
                   hover:bg-gray-50 dark:hover:bg-gray-700
                   transition-all duration-200
                   border border-l-0 border-gray-200 dark:border-gray-700
                   group"
        aria-label="打开设置"
      >
        <svg 
          className="w-5 h-5 text-gray-600 dark:text-gray-300 group-hover:rotate-45 transition-transform duration-300" 
          fill="none" 
          stroke="currentColor" 
          viewBox="0 0 24 24"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} 
            d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
        </svg>
      </button>

      {/* 遮罩层 */}
      {isOpen && (
        <div 
          className="fixed inset-0 bg-black/30 z-[100] transition-opacity"
          onClick={() => setIsOpen(false)}
        />
      )}

      {/* 抽屉面板 */}
      <div className={`
        fixed left-0 top-0 h-full w-80 max-w-[85vw] z-[101]
        bg-white dark:bg-gray-800 shadow-2xl
        transform transition-transform duration-300 ease-out
        ${isOpen ? 'translate-x-0' : '-translate-x-full'}
        overflow-y-auto
      `}>
        {/* 头部 */}
        <div className="sticky top-0 bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 p-4 flex items-center justify-between">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white">设置</h2>
          <button
            onClick={() => setIsOpen(false)}
            className="p-2 rounded-md hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
            aria-label="关闭设置"
          >
            <svg className="w-5 h-5 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* 内容区域 */}
        <div className="p-4 space-y-6">
          {/* API 配置 */}
          <section>
            <h3 className="text-sm font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-3">
              API 配置
            </h3>
            
            {/* API Key */}
            <div className="mb-3">
              <label htmlFor="apiKey" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                API Key
              </label>
              <input
                type="password"
                id="apiKey"
                value={apiConfig.apiKey}
                onChange={(e) => setAPIConfig({ apiKey: e.target.value })}
                placeholder="输入你的 API Key"
                className={`w-full px-3 py-2 text-sm border rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:text-white ${
                  validationErrors.apiKey ? 'border-red-500' : 'border-gray-300 dark:border-gray-600'
                }`}
              />
              {validationErrors.apiKey && (
                <p className="mt-1 text-xs text-red-500">{validationErrors.apiKey}</p>
              )}
            </div>

            {/* Base URL */}
            <div className="mb-3">
              <label htmlFor="baseUrl" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Base URL <span className="text-gray-400 text-xs">(可选)</span>
              </label>
              <input
                type="text"
                id="baseUrl"
                value={apiConfig.baseUrl}
                onChange={(e) => setAPIConfig({ baseUrl: e.target.value })}
                placeholder="自定义 API 端点"
                className={`w-full px-3 py-2 text-sm border rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:text-white ${
                  validationErrors.baseUrl ? 'border-red-500' : 'border-gray-300 dark:border-gray-600'
                }`}
              />
            </div>

            {/* API 风格 */}
            <div className="mb-3">
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">API 风格</label>
              <div className="flex gap-4">
                {(['gemini', 'openai'] as const).map((style) => (
                  <label key={style} className="flex items-center cursor-pointer">
                    <input
                      type="radio"
                      name="apiStyle"
                      value={style}
                      checked={apiConfig.style === style}
                      onChange={() => handleStyleChange(style)}
                      className="mr-2 text-blue-600"
                    />
                    <span className="text-sm text-gray-700 dark:text-gray-300 capitalize">{style === 'gemini' ? 'Gemini' : 'OpenAI'}</span>
                  </label>
                ))}
              </div>
            </div>

            {/* OpenAI 生成模式 */}
            {apiConfig.style === 'openai' && (
              <div className="mb-3">
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">生成模式</label>
                <div className="flex gap-4">
                  {(['chat', 'images'] as const).map((mode) => (
                    <label key={mode} className="flex items-center cursor-pointer">
                      <input
                        type="radio"
                        name="openaiMode"
                        value={mode}
                        checked={(apiConfig.openaiGenerationMode || 'chat') === mode}
                        onChange={() => setAPIConfig({ openaiGenerationMode: mode as OpenAIGenerationMode })}
                        className="mr-2 text-blue-600"
                      />
                      <span className="text-sm text-gray-700 dark:text-gray-300 capitalize">{mode === 'chat' ? 'Chat' : 'Images'}</span>
                    </label>
                  ))}
                </div>
              </div>
            )}

            {/* 模型选择 */}
            <div className="mb-3">
              <label htmlFor="model" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">模型</label>
              <div className="flex gap-2">
                {modelListError ? (
                  <input
                    type="text"
                    id="model"
                    value={apiConfig.model}
                    onChange={(e) => setAPIConfig({ model: e.target.value })}
                    placeholder="手动输入模型名称"
                    className="flex-1 px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-md dark:bg-gray-700 dark:text-white w-full"
                  />
                ) : (
                  <select
                    id="model"
                    value={apiConfig.model || (models.length > 0 ? models[0].id : '')}
                    onChange={(e) => setAPIConfig({ model: e.target.value })}
                    disabled={isLoadingModels}
                    className="flex-1 px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-md dark:bg-gray-700 dark:text-white w-full"
                  >
                    {isLoadingModels ? (
                      <option value="">加载中...</option>
                    ) : models.length > 0 ? (
                      models.map((model) => (
                        <option key={model.id} value={model.id}>{model.name}</option>
                      ))
                    ) : (
                      <option value="">无可用模型</option>
                    )}
                  </select>
                )}
                <button
                  onClick={handleRefresh}
                  disabled={isLoadingModels}
                  className="p-2 border border-gray-300 dark:border-gray-600 rounded-md hover:bg-gray-100 dark:hover:bg-gray-700"
                  title="刷新模型列表"
                >
                  <svg className={`w-4 h-4 text-gray-600 dark:text-gray-300 ${isLoadingModels ? 'animate-spin' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                  </svg>
                </button>
              </div>
            </div>
          </section>

          {/* 语言偏好 */}
          <section>
            <h3 className="text-sm font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-3">
              语言偏好
            </h3>
            <input
              type="text"
              value={languagePreference}
              onChange={(e) => setLanguagePreference(e.target.value)}
              placeholder="例如：配字必须是中文"
              className="w-full px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-md dark:bg-gray-700 dark:text-white"
            />
          </section>

          {/* AI 分割开关 */}
          <section>
            <h3 className="text-sm font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-3">
              分割设置
            </h3>
            <div className="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-700/50 rounded-lg">
              <div>
                <p className="text-sm font-medium text-gray-700 dark:text-gray-300">AI 智能分割</p>
                <p className="text-xs text-gray-500 dark:text-gray-400">
                  {aiSegmentationConfig.enabled ? '使用 AI 视觉模型' : '使用传统算法'}
                </p>
              </div>
              <button
                onClick={toggleAISegmentation}
                className={`relative w-11 h-6 rounded-full transition-colors ${
                  aiSegmentationConfig.enabled ? 'bg-blue-500' : 'bg-gray-300 dark:bg-gray-600'
                }`}
                role="switch"
                aria-checked={aiSegmentationConfig.enabled}
              >
                <span className={`absolute top-1 w-4 h-4 bg-white rounded-full transition-transform ${
                  aiSegmentationConfig.enabled ? 'left-6' : 'left-1'
                }`} />
              </button>
            </div>
          </section>

          {/* 切割算法参数 */}
          <section>
            <button
              onClick={() => setShowAdvanced(!showAdvanced)}
              className="flex items-center justify-between w-full text-left mb-3"
            >
              <h3 className="text-sm font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                切割算法参数
              </h3>
              <svg
                className={`w-4 h-4 text-gray-500 transition-transform ${showAdvanced ? 'rotate-180' : ''}`}
                fill="none" stroke="currentColor" viewBox="0 0 24 24"
              >
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
              </svg>
            </button>
            
            {showAdvanced && (
              <div className="space-y-4 p-3 bg-gray-50 dark:bg-gray-700/50 rounded-lg">
                {/* 颜色容差 */}
                <div>
                  <div className="flex justify-between items-center mb-1.5">
                    <label htmlFor="tolerance" className="text-xs text-gray-600 dark:text-gray-400">颜色容差</label>
                    <input
                      id="tolerance"
                      type="number"
                      min="5"
                      max="100"
                      value={manualSplitConfig.tolerance}
                      onChange={(e) => setManualSplitConfig({ tolerance: Math.min(100, Math.max(5, Number(e.target.value) || 5)) })}
                      className="w-16 px-2 py-0.5 text-xs text-right font-mono border border-gray-300 dark:border-gray-600 rounded dark:bg-gray-700 dark:text-white"
                    />
                  </div>
                  <input
                    type="range" min="5" max="100"
                    value={manualSplitConfig.tolerance}
                    onChange={(e) => setManualSplitConfig({ tolerance: Number(e.target.value) })}
                    className="w-full h-1.5 bg-gray-200 dark:bg-gray-600 rounded-lg appearance-none cursor-pointer accent-blue-500"
                  />
                  <p className="text-[10px] text-gray-400 mt-0.5">判断像素是否为背景色的阈值</p>
                </div>

                {/* 最小区域面积 */}
                <div>
                  <div className="flex justify-between items-center mb-1.5">
                    <label htmlFor="minArea" className="text-xs text-gray-600 dark:text-gray-400">最小区域面积</label>
                    <div className="flex items-center gap-1">
                      <input
                        id="minArea"
                        type="number"
                        min="10"
                        max="1000"
                        step="10"
                        value={manualSplitConfig.minArea}
                        onChange={(e) => setManualSplitConfig({ minArea: Math.min(1000, Math.max(10, Number(e.target.value) || 10)) })}
                        className="w-16 px-2 py-0.5 text-xs text-right font-mono border border-gray-300 dark:border-gray-600 rounded dark:bg-gray-700 dark:text-white"
                      />
                      <span className="text-[10px] text-gray-400">px²</span>
                    </div>
                  </div>
                  <input
                    type="range" min="10" max="500" step="10"
                    value={manualSplitConfig.minArea}
                    onChange={(e) => setManualSplitConfig({ minArea: Number(e.target.value) })}
                    className="w-full h-1.5 bg-gray-200 dark:bg-gray-600 rounded-lg appearance-none cursor-pointer accent-blue-500"
                  />
                  <p className="text-[10px] text-gray-400 mt-0.5">过滤小于此面积的噪点区域</p>
                </div>

                {/* 最小边界尺寸 */}
                <div>
                  <div className="flex justify-between items-center mb-1.5">
                    <label htmlFor="minSize" className="text-xs text-gray-600 dark:text-gray-400">最小边界尺寸</label>
                    <div className="flex items-center gap-1">
                      <input
                        id="minSize"
                        type="number"
                        min="5"
                        max="200"
                        value={manualSplitConfig.minSize}
                        onChange={(e) => setManualSplitConfig({ minSize: Math.min(200, Math.max(5, Number(e.target.value) || 5)) })}
                        className="w-16 px-2 py-0.5 text-xs text-right font-mono border border-gray-300 dark:border-gray-600 rounded dark:bg-gray-700 dark:text-white"
                      />
                      <span className="text-[10px] text-gray-400">px</span>
                    </div>
                  </div>
                  <input
                    type="range" min="5" max="100"
                    value={manualSplitConfig.minSize}
                    onChange={(e) => setManualSplitConfig({ minSize: Number(e.target.value) })}
                    className="w-full h-1.5 bg-gray-200 dark:bg-gray-600 rounded-lg appearance-none cursor-pointer accent-blue-500"
                  />
                  <p className="text-[10px] text-gray-400 mt-0.5">过滤宽或高小于此值的区域</p>
                </div>

                {/* 合并距离 */}
                <div>
                  <div className="flex justify-between items-center mb-1.5">
                    <label htmlFor="mergeDistance" className="text-xs text-gray-600 dark:text-gray-400">合并距离</label>
                    <div className="flex items-center gap-1">
                      <input
                        id="mergeDistance"
                        type="number"
                        min="0"
                        max="20"
                        step="0.5"
                        value={manualSplitConfig.mergeDistancePercent}
                        onChange={(e) => setManualSplitConfig({ mergeDistancePercent: Math.min(20, Math.max(0, Number(e.target.value) || 0)) })}
                        className="w-16 px-2 py-0.5 text-xs text-right font-mono border border-gray-300 dark:border-gray-600 rounded dark:bg-gray-700 dark:text-white"
                      />
                      <span className="text-[10px] text-gray-400">%</span>
                    </div>
                  </div>
                  <input
                    type="range" min="0" max="10" step="0.5"
                    value={manualSplitConfig.mergeDistancePercent}
                    onChange={(e) => setManualSplitConfig({ mergeDistancePercent: Number(e.target.value) })}
                    className="w-full h-1.5 bg-gray-200 dark:bg-gray-600 rounded-lg appearance-none cursor-pointer accent-blue-500"
                  />
                  <p className="text-[10px] text-gray-400 mt-0.5">相邻区域合并阈值，基于图片短边的百分比</p>
                </div>

                <button
                  onClick={resetManualSplitConfig}
                  className="w-full py-1.5 text-xs text-gray-600 dark:text-gray-400 border border-gray-300 dark:border-gray-600 rounded hover:bg-gray-100 dark:hover:bg-gray-600 transition-colors"
                >
                  恢复默认值
                </button>
              </div>
            )}
          </section>
        </div>
      </div>
    </>
  );
}
