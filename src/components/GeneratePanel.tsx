/**
 * GeneratePanel - 生成控制组件
 * 
 * 功能：
 * - 生成按钮
 * - 加载状态指示器
 * - 取消按钮
 * - 生成结果预览
 * - 错误提示和重试
 * 
 * Requirements: 5.2, 5.3, 5.4, 5.5
 */

import { useState, useCallback, useEffect } from 'react';
import { useAppStore } from '../store/useAppStore';
import { generateImage, cancelGeneration } from '../services/aiService';
import { buildFullPrompt, isPromptConfigValid } from '../services/promptBuilder';
import { isConfigComplete } from '../services/configValidation';

export function GeneratePanel() {
  const {
    apiConfig,
    languagePreference,
    userPrompt,
    materialImages,
    referenceImages,
    isGenerating,
    generatedImage,
    setIsGenerating,
    setGeneratedImage,
  } = useAppStore();

  const [error, setError] = useState<string | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);

  // 当 generatedImage 变化时更新预览 URL
  useEffect(() => {
    if (generatedImage) {
      const url = URL.createObjectURL(generatedImage);
      setPreviewUrl(url);
      return () => URL.revokeObjectURL(url);
    } else {
      setPreviewUrl(null);
    }
  }, [generatedImage]);

  // 检查是否可以生成
  const canGenerate = useCallback(() => {
    // 检查 API 配置
    if (!isConfigComplete(apiConfig.apiKey, apiConfig.baseUrl)) {
      return { canGenerate: false, reason: '请先完成 API 配置' };
    }

    // 检查是否有图片
    const allImages = [...materialImages, ...referenceImages];
    if (allImages.length === 0) {
      return { canGenerate: false, reason: '请至少上传一张图片' };
    }

    // 检查提示词
    if (!isPromptConfigValid({ languagePreference, userPrompt })) {
      return { canGenerate: false, reason: '请输入提示词' };
    }

    return { canGenerate: true, reason: null };
  }, [apiConfig, materialImages, referenceImages, languagePreference, userPrompt]);

  const generateStatus = canGenerate();

  // 生成处理
  const handleGenerate = useCallback(async () => {
    if (!generateStatus.canGenerate || isGenerating) return;

    setError(null);
    setIsGenerating(true);

    try {
      // 构建完整提示词
      const fullPrompt = buildFullPrompt({ languagePreference, userPrompt });
      
      // 合并所有图片
      const allImages = [...materialImages, ...referenceImages];

      // 调用 AI 生成
      const result = await generateImage(apiConfig, fullPrompt, allImages);

      if (result.success && result.imageBlob) {
        setGeneratedImage(result.imageBlob);
        setError(null);
      } else {
        setError(result.error || '生成失败，请重试');
        setGeneratedImage(null);
      }
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : '发生未知错误';
      setError(errorMessage);
      setGeneratedImage(null);
    } finally {
      setIsGenerating(false);
    }
  }, [
    generateStatus.canGenerate,
    isGenerating,
    apiConfig,
    languagePreference,
    userPrompt,
    materialImages,
    referenceImages,
    setIsGenerating,
    setGeneratedImage,
  ]);

  // 取消生成
  const handleCancel = useCallback(() => {
    cancelGeneration();
    setIsGenerating(false);
    setError('生成已取消');
  }, [setIsGenerating]);

  // 重试
  const handleRetry = useCallback(() => {
    setError(null);
    handleGenerate();
  }, [handleGenerate]);

  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md p-6">
      <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
        生成表情包
      </h2>

      {/* 生成按钮区域 */}
      <div className="mb-4">
        {isGenerating ? (
          <div className="space-y-3">
            {/* 加载状态指示器 */}
            <div className="flex items-center justify-center py-4">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500"></div>
              <span className="ml-3 text-gray-600 dark:text-gray-400">
                正在生成中...
              </span>
            </div>
            
            {/* 取消按钮 */}
            <button
              onClick={handleCancel}
              className="w-full px-4 py-2 text-red-600 dark:text-red-400 
                         border border-red-300 dark:border-red-600 rounded-md
                         hover:bg-red-50 dark:hover:bg-red-900/20
                         transition-colors duration-150"
            >
              取消生成
            </button>
          </div>
        ) : (
          <button
            onClick={handleGenerate}
            disabled={!generateStatus.canGenerate}
            className={`w-full px-4 py-3 rounded-md font-medium transition-colors duration-150
              ${generateStatus.canGenerate
                ? 'bg-blue-500 hover:bg-blue-600 text-white'
                : 'bg-gray-300 dark:bg-gray-600 text-gray-500 dark:text-gray-400 cursor-not-allowed'
              }`}
          >
            {generateStatus.canGenerate ? '开始生成' : generateStatus.reason}
          </button>
        )}
      </div>

      {/* 错误提示 */}
      {error && (
        <div className="mb-4 p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-md">
          <div className="flex items-start">
            <svg
              className="w-5 h-5 text-red-500 mt-0.5 mr-2 flex-shrink-0"
              fill="currentColor"
              viewBox="0 0 20 20"
            >
              <path
                fillRule="evenodd"
                d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z"
                clipRule="evenodd"
              />
            </svg>
            <div className="flex-1">
              <p className="text-sm text-red-700 dark:text-red-300">{error}</p>
              <button
                onClick={handleRetry}
                className="mt-2 text-sm text-red-600 dark:text-red-400 hover:underline"
              >
                点击重试
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 生成结果预览 */}
      {previewUrl && (
        <div className="mt-4">
          <h3 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
            生成结果
          </h3>
          <div className="relative rounded-lg overflow-hidden border border-gray-200 dark:border-gray-700">
            <img
              src={previewUrl}
              alt="生成的表情包"
              className="w-full h-auto"
            />
          </div>
          <p className="mt-2 text-xs text-gray-500 dark:text-gray-400">
            点击下方按钮进行分割提取单个表情
          </p>
        </div>
      )}

      {/* 空状态提示 */}
      {!previewUrl && !isGenerating && !error && (
        <div className="text-center py-8 text-gray-400 dark:text-gray-500">
          <svg
            className="w-12 h-12 mx-auto mb-3"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={1.5}
              d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"
            />
          </svg>
          <p className="text-sm">生成的表情包将显示在这里</p>
        </div>
      )}
    </div>
  );
}
