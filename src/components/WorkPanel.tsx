/**
 * WorkPanel - 统一工作面板
 * 合并图片上传、提示词、生成和手动切割功能
 */

import { useState, useCallback, useEffect, useRef } from 'react';
import { useAppStore } from '../store/useAppStore';
import { generateImage, cancelGeneration } from '../services/aiService';
import { buildFullPrompt, isPromptConfigValid } from '../services/promptBuilder';
import { isConfigComplete } from '../services/configValidation';
import { extractAllEmojis, extractAllEmojisWithAI } from '../services/imageSplitter';
import { validateUploadFiles } from '../services/imageValidation';
import { MATERIAL_IMAGE_LIMIT, REFERENCE_IMAGE_LIMIT } from '../services/imageValidation';
import { ImageUploader } from './ImageUploader';

// 示例提示词
const EXAMPLE_PROMPTS = [
  '这是我的小猫咪，我希望表情包是 Q 版萌系的风格',
  '请生成一组可爱的表情包，包含开心、难过、生气、惊讶等情绪',
  '帮我生成一组搞笑的表情包，带有夸张的表情和动作',
];

type WorkMode = 'generate' | 'split';
type SplitAction = 'replace' | 'append';

export function WorkPanel() {
  const {
    apiConfig,
    languagePreference,
    userPrompt,
    setUserPrompt,
    materialImages,
    referenceImages,
    addMaterialImage,
    addReferenceImage,
    removeImage,
    isGenerating,
    generatedImage,
    setIsGenerating,
    setGeneratedImage,
    setExtractedEmojis,
    appendEmojis,
    extractedEmojis,
    aiSegmentationConfig,
    manualSplitConfig,
  } = useAppStore();

  const [mode, setMode] = useState<WorkMode>('generate');
  const [splitAction, setSplitAction] = useState<SplitAction>('replace');
  const [error, setError] = useState<string | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [isSplitting, setIsSplitting] = useState(false);
  const [splitMethod, setSplitMethod] = useState<'ai' | 'fallback' | null>(null);
  
  // 手动上传相关状态
  const [uploadedImage, setUploadedImage] = useState<File | null>(null);
  const [uploadPreviewUrl, setUploadPreviewUrl] = useState<string | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // 更新生成结果预览
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
    if (!isConfigComplete(apiConfig.apiKey, apiConfig.baseUrl)) {
      return { can: false, reason: '请先在设置中配置 API' };
    }
    const allImages = [...materialImages, ...referenceImages];
    if (allImages.length === 0) {
      return { can: false, reason: '请上传至少一张图片' };
    }
    if (!isPromptConfigValid({ languagePreference, userPrompt })) {
      return { can: false, reason: '请输入提示词' };
    }
    return { can: true, reason: null };
  }, [apiConfig, materialImages, referenceImages, languagePreference, userPrompt]);

  const generateStatus = canGenerate();

  // 生成处理
  const handleGenerate = useCallback(async () => {
    if (!generateStatus.can || isGenerating) return;
    setError(null);
    setIsGenerating(true);

    try {
      const fullPrompt = buildFullPrompt({ languagePreference, userPrompt });
      const allImages = [...materialImages, ...referenceImages];
      const result = await generateImage(apiConfig, fullPrompt, allImages);

      if (result.success && result.imageBlob) {
        setGeneratedImage(result.imageBlob);
      } else {
        setError(result.error || '生成失败');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : '发生未知错误');
    } finally {
      setIsGenerating(false);
    }
  }, [generateStatus.can, isGenerating, apiConfig, languagePreference, userPrompt, materialImages, referenceImages, setIsGenerating, setGeneratedImage]);

  // 取消生成
  const handleCancel = useCallback(() => {
    cancelGeneration();
    setIsGenerating(false);
    setError('生成已取消');
  }, [setIsGenerating]);

  // 分割生成的图片
  const handleSplitGenerated = useCallback(async () => {
    if (!generatedImage) return;
    setIsSplitting(true);
    setError(null);
    setSplitMethod(null);

    try {
      let emojis;
      let method: 'ai' | 'fallback' = 'fallback';

      if (aiSegmentationConfig.enabled) {
        const result = await extractAllEmojisWithAI(generatedImage, {
          apiConfig,
          aiConfig: aiSegmentationConfig,
          padding: 5,
          debug: true,
          fallbackOptions: {
            tolerance: manualSplitConfig.tolerance,
            minArea: manualSplitConfig.minArea,
            minSize: manualSplitConfig.minSize,
            removeBackground: true,
          },
        });
        emojis = result.emojis;
        method = result.method;
      } else {
        emojis = await extractAllEmojis(generatedImage, {
          mode: 'auto',
          tolerance: manualSplitConfig.tolerance,
          minArea: manualSplitConfig.minArea,
          minSize: manualSplitConfig.minSize,
          mergeDistancePercent: manualSplitConfig.mergeDistancePercent,
          debug: true,
        });
      }

      setSplitMethod(method);
      if (emojis.length === 0) {
        setError('未能检测到表情包');
      } else {
        if (splitAction === 'append') {
          appendEmojis(emojis);
        } else {
          setExtractedEmojis(emojis);
        }
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : '分割失败');
    } finally {
      setIsSplitting(false);
    }
  }, [generatedImage, apiConfig, aiSegmentationConfig, manualSplitConfig, setExtractedEmojis, appendEmojis, splitAction]);

  // 手动上传处理
  const handleFiles = useCallback((files: FileList | File[]) => {
    setError(null);
    const result = validateUploadFiles(Array.from(files), 0, 1);
    if (result.error) {
      setError(result.error);
      return;
    }
    if (result.validFiles.length > 0) {
      const file = result.validFiles[0];
      setUploadedImage(file);
      const url = URL.createObjectURL(file);
      setUploadPreviewUrl(url);
    }
  }, []);

  const handleDragEnter = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
  }, []);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
    if (e.dataTransfer.files?.length > 0) {
      handleFiles(e.dataTransfer.files);
    }
  }, [handleFiles]);

  const handleClearUpload = () => {
    if (uploadPreviewUrl) URL.revokeObjectURL(uploadPreviewUrl);
    setUploadedImage(null);
    setUploadPreviewUrl(null);
    setError(null);
  };

  // 分割上传的图片
  const handleSplitUploaded = useCallback(async () => {
    if (!uploadedImage) return;
    setIsSplitting(true);
    setError(null);
    setSplitMethod(null);

    try {
      let emojis;
      let method: 'ai' | 'fallback' = 'fallback';

      if (aiSegmentationConfig.enabled && apiConfig.apiKey) {
        const result = await extractAllEmojisWithAI(uploadedImage, {
          apiConfig,
          aiConfig: aiSegmentationConfig,
          padding: 5,
          debug: true,
          fallbackOptions: {
            tolerance: manualSplitConfig.tolerance,
            minArea: manualSplitConfig.minArea,
            minSize: manualSplitConfig.minSize,
            removeBackground: false,
          },
        });
        emojis = result.emojis;
        method = result.didFallback ? 'fallback' : 'ai';
      } else {
        emojis = await extractAllEmojis(uploadedImage, {
          mode: 'auto',
          tolerance: manualSplitConfig.tolerance,
          minArea: manualSplitConfig.minArea,
          minSize: manualSplitConfig.minSize,
          mergeDistancePercent: manualSplitConfig.mergeDistancePercent,
          debug: true,
        });
      }

      setSplitMethod(method);
      if (emojis.length === 0) {
        setError('未能检测到表情包');
      } else {
        if (splitAction === 'append') {
          appendEmojis(emojis);
        } else {
          setExtractedEmojis(emojis);
        }
        // 切割成功后保留图片，不清理
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : '分割失败');
    } finally {
      setIsSplitting(false);
    }
  }, [uploadedImage, apiConfig, aiSegmentationConfig, manualSplitConfig, setExtractedEmojis, appendEmojis, splitAction]);

  const handleMaterialUpload = (files: File[]) => files.forEach(addMaterialImage);
  const handleReferenceUpload = (files: File[]) => files.forEach(addReferenceImage);

  return (
    <div className="bg-white dark:bg-gray-800 rounded-xl shadow-lg overflow-hidden">
      {/* 模式切换标签 */}
      <div className="flex border-b border-gray-200 dark:border-gray-700">
        <button
          onClick={() => setMode('generate')}
          className={`flex-1 py-3 px-4 text-sm font-medium transition-colors relative ${
            mode === 'generate'
              ? 'text-blue-600 dark:text-blue-400'
              : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300'
          }`}
        >
          <span className="flex items-center justify-center gap-2">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
            </svg>
            AI 生成
          </span>
          {mode === 'generate' && (
            <span className="absolute bottom-0 left-0 right-0 h-0.5 bg-blue-500" />
          )}
        </button>
        <button
          onClick={() => setMode('split')}
          className={`flex-1 py-3 px-4 text-sm font-medium transition-colors relative ${
            mode === 'split'
              ? 'text-blue-600 dark:text-blue-400'
              : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300'
          }`}
        >
          <span className="flex items-center justify-center gap-2">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 5a1 1 0 011-1h14a1 1 0 011 1v2a1 1 0 01-1 1H5a1 1 0 01-1-1V5zM4 13a1 1 0 011-1h6a1 1 0 011 1v6a1 1 0 01-1 1H5a1 1 0 01-1-1v-6zM16 13a1 1 0 011-1h2a1 1 0 011 1v6a1 1 0 01-1 1h-2a1 1 0 01-1-1v-6z" />
            </svg>
            上传切割
          </span>
          {mode === 'split' && (
            <span className="absolute bottom-0 left-0 right-0 h-0.5 bg-blue-500" />
          )}
        </button>
      </div>

      <div className="p-4 sm:p-6">
        {mode === 'generate' ? (
          /* AI 生成模式 */
          <div className="space-y-4">
            {/* 图片上传区域 */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <ImageUploader
                type="material"
                maxCount={MATERIAL_IMAGE_LIMIT}
                images={materialImages}
                onUpload={handleMaterialUpload}
                onRemove={(id) => removeImage(id, 'material')}
                title={`素材图 (${materialImages.length}/${MATERIAL_IMAGE_LIMIT})`}
                compact
              />
              <ImageUploader
                type="reference"
                maxCount={REFERENCE_IMAGE_LIMIT}
                images={referenceImages}
                onUpload={handleReferenceUpload}
                onRemove={(id) => removeImage(id, 'reference')}
                title={`基准图 (${referenceImages.length}/${REFERENCE_IMAGE_LIMIT})`}
                compact
              />
            </div>

            {/* 提示词输入 */}
            <div>
              <textarea
                value={userPrompt}
                onChange={(e) => setUserPrompt(e.target.value)}
                placeholder="描述你想要的表情包风格、内容、情绪..."
                className="w-full h-24 px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-lg 
                           bg-white dark:bg-gray-700 text-gray-900 dark:text-white
                           placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
              />
              {/* 示例提示词 */}
              <div className="flex flex-wrap gap-2 mt-2">
                {EXAMPLE_PROMPTS.map((example, i) => (
                  <button
                    key={i}
                    onClick={() => setUserPrompt(example)}
                    className="text-xs px-2 py-1 bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-400 
                               rounded hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors truncate max-w-[200px]"
                  >
                    {example}
                  </button>
                ))}
              </div>
            </div>

            {/* 生成按钮 */}
            {isGenerating ? (
              <div className="space-y-2">
                <div className="flex items-center justify-center py-3">
                  <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-500" />
                  <span className="ml-3 text-sm text-gray-600 dark:text-gray-400">正在生成...</span>
                </div>
                <button
                  onClick={handleCancel}
                  className="w-full py-2 text-sm text-red-600 border border-red-300 rounded-lg hover:bg-red-50 dark:hover:bg-red-900/20"
                >
                  取消
                </button>
              </div>
            ) : (
              <button
                onClick={handleGenerate}
                disabled={!generateStatus.can}
                className={`w-full py-3 rounded-lg font-medium transition-all ${
                  generateStatus.can
                    ? 'bg-gradient-to-r from-blue-500 to-purple-600 hover:from-blue-600 hover:to-purple-700 text-white shadow-md hover:shadow-lg'
                    : 'bg-gray-200 dark:bg-gray-700 text-gray-400 cursor-not-allowed'
                }`}
              >
                {generateStatus.can ? '开始生成' : generateStatus.reason}
              </button>
            )}

            {/* 生成结果预览 */}
            {previewUrl && (
              <div className="mt-4">
                {/* 切割操作区 - 放在图片上方 */}
                <div className="mb-3 p-3 bg-gray-50 dark:bg-gray-700/50 rounded-lg space-y-3">
                  {/* 替换/插入选项 - 仅当已有表情时显示 */}
                  {extractedEmojis.length > 0 && (
                    <div className="flex items-center gap-4">
                      <span className="text-xs text-gray-500 dark:text-gray-400">分割后：</span>
                      <label className="flex items-center gap-1.5 cursor-pointer">
                        <input
                          type="radio"
                          name="splitAction"
                          checked={splitAction === 'replace'}
                          onChange={() => setSplitAction('replace')}
                          className="w-3.5 h-3.5 text-blue-600"
                        />
                        <span className="text-xs text-gray-700 dark:text-gray-300">替换</span>
                      </label>
                      <label className="flex items-center gap-1.5 cursor-pointer">
                        <input
                          type="radio"
                          name="splitAction"
                          checked={splitAction === 'append'}
                          onChange={() => setSplitAction('append')}
                          className="w-3.5 h-3.5 text-blue-600"
                        />
                        <span className="text-xs text-gray-700 dark:text-gray-300">追加</span>
                      </label>
                    </div>
                  )}

                  <button
                    onClick={handleSplitGenerated}
                    disabled={isSplitting}
                    className={`w-full py-2.5 rounded-lg font-medium transition-all ${
                      isSplitting
                        ? 'bg-gray-400 cursor-not-allowed'
                        : 'bg-gradient-to-r from-green-500 to-teal-600 hover:from-green-600 hover:to-teal-700 text-white'
                    }`}
                  >
                    {isSplitting ? (
                      <span className="flex items-center justify-center gap-2">
                        <span className="animate-spin rounded-full h-4 w-4 border-b-2 border-white" />
                        分割中...
                      </span>
                    ) : (
                      <span className="flex items-center justify-center gap-2">
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 5a1 1 0 011-1h14a1 1 0 011 1v2a1 1 0 01-1 1H5a1 1 0 01-1-1V5zM4 13a1 1 0 011-1h6a1 1 0 011 1v6a1 1 0 01-1 1H5a1 1 0 01-1-1v-6zM16 13a1 1 0 011-1h2a1 1 0 011 1v6a1 1 0 01-1 1h-2a1 1 0 01-1-1v-6z" />
                        </svg>
                        {aiSegmentationConfig.enabled ? 'AI 智能分割' : '分割提取表情'}
                      </span>
                    )}
                  </button>
                </div>

                {/* 图片预览 */}
                <div className="relative rounded-lg overflow-hidden border border-gray-200 dark:border-gray-700">
                  <img src={previewUrl} alt="生成结果" className="w-full h-auto" />
                </div>
              </div>
            )}
          </div>
        ) : (
          /* 上传切割模式 */
          <div className="space-y-4">
            {!uploadedImage ? (
              <div
                onDragEnter={handleDragEnter}
                onDragLeave={handleDragLeave}
                onDragOver={handleDragOver}
                onDrop={handleDrop}
                onClick={() => fileInputRef.current?.click()}
                className={`
                  border-2 border-dashed rounded-lg p-8 text-center cursor-pointer transition-colors
                  ${isDragging
                    ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20'
                    : 'border-gray-300 dark:border-gray-600 hover:border-blue-400'
                  }
                `}
              >
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".png,.jpg,.jpeg,.webp"
                  onChange={(e) => e.target.files && handleFiles(e.target.files)}
                  className="hidden"
                />
                <svg className="mx-auto h-12 w-12 text-gray-400" stroke="currentColor" fill="none" viewBox="0 0 48 48">
                  <path d="M28 8H12a4 4 0 00-4 4v20m32-12v8m0 0v8a4 4 0 01-4 4H12a4 4 0 01-4-4v-4m32-4l-3.172-3.172a4 4 0 00-5.656 0L28 28M8 32l9.172-9.172a4 4 0 015.656 0L28 28m0 0l4 4m4-24h8m-4-4v8m-12 4h.02" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
                </svg>
                <p className="mt-2 text-sm text-gray-600 dark:text-gray-400">拖拽图片到此处，或点击选择</p>
                <p className="text-xs text-gray-400 mt-1">支持 PNG, JPG, JPEG, WebP</p>
              </div>
            ) : (
              <div className="space-y-4">
                {/* 切割操作区 - 放在图片上方 */}
                <div className="p-3 bg-gray-50 dark:bg-gray-700/50 rounded-lg space-y-3">
                  {/* 替换/插入选项 - 仅当已有表情时显示 */}
                  {extractedEmojis.length > 0 && (
                    <div className="flex items-center gap-4">
                      <span className="text-xs text-gray-500 dark:text-gray-400">分割后：</span>
                      <label className="flex items-center gap-1.5 cursor-pointer">
                        <input
                          type="radio"
                          name="splitActionUpload"
                          checked={splitAction === 'replace'}
                          onChange={() => setSplitAction('replace')}
                          className="w-3.5 h-3.5 text-blue-600"
                        />
                        <span className="text-xs text-gray-700 dark:text-gray-300">替换</span>
                      </label>
                      <label className="flex items-center gap-1.5 cursor-pointer">
                        <input
                          type="radio"
                          name="splitActionUpload"
                          checked={splitAction === 'append'}
                          onChange={() => setSplitAction('append')}
                          className="w-3.5 h-3.5 text-blue-600"
                        />
                        <span className="text-xs text-gray-700 dark:text-gray-300">追加</span>
                      </label>
                    </div>
                  )}

                  <button
                    onClick={handleSplitUploaded}
                    disabled={isSplitting}
                    className={`w-full py-2.5 rounded-lg font-medium transition-all ${
                      isSplitting
                        ? 'bg-gray-400 cursor-not-allowed'
                        : 'bg-gradient-to-r from-green-500 to-teal-600 hover:from-green-600 hover:to-teal-700 text-white shadow-md'
                    }`}
                  >
                    {isSplitting ? (
                      <span className="flex items-center justify-center gap-2">
                        <span className="animate-spin rounded-full h-4 w-4 border-b-2 border-white" />
                        分割中...
                      </span>
                    ) : (
                      <span className="flex items-center justify-center gap-2">
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 5a1 1 0 011-1h14a1 1 0 011 1v2a1 1 0 01-1 1H5a1 1 0 01-1-1V5zM4 13a1 1 0 011-1h6a1 1 0 011 1v6a1 1 0 01-1 1H5a1 1 0 01-1-1v-6zM16 13a1 1 0 011-1h2a1 1 0 011 1v6a1 1 0 01-1 1h-2a1 1 0 01-1-1v-6z" />
                        </svg>
                        开始切割
                      </span>
                    )}
                  </button>
                </div>

                {/* 图片预览 */}
                <div className="relative rounded-lg overflow-hidden bg-gray-100 dark:bg-gray-700">
                  <img src={uploadPreviewUrl!} alt="待切割图片" className="w-full h-auto" />
                  <button
                    onClick={handleClearUpload}
                    className="absolute top-2 right-2 p-2 rounded-full bg-red-500 text-white hover:bg-red-600"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                </div>
              </div>
            )}
            
            <p className="text-xs text-center text-gray-500 dark:text-gray-400">
              上传已有的表情包图片进行切割提取
            </p>
          </div>
        )}

        {/* 错误提示 */}
        {error && (
          <div className="mt-4 p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg">
            <p className="text-sm text-red-600 dark:text-red-400">{error}</p>
          </div>
        )}

        {/* 分割方法提示 */}
        {splitMethod && (
          <p className="mt-2 text-xs text-center text-gray-500 dark:text-gray-400">
            {splitMethod === 'ai' ? '✨ 使用 AI 智能分割' : '📐 使用传统算法分割'}
          </p>
        )}
      </div>
    </div>
  );
}
