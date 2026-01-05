/**
 * WorkPanel - 统一工作面板
 * 合并图片上传、提示词、生成和手动切割功能
 * 
 * Requirements:
 * - 10.3: 手动框选提取完成后自动切换到表情网格视图
 * - 10.4: 用户可以使用所有现有的表情编辑功能
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
import { ManualSelectionPanel } from './ManualSelectionPanel';

// 示例提示词
const EXAMPLE_PROMPTS = [
  '这是我的小猫咪，希望你认真读取它的形象特点，结合图片中的实际形象，产出 Q 版萌系的表情包',
  '请生成一组可爱的表情包，包含开心、难过、生气、惊讶等情绪',
  '帮我生成一组搞笑的表情包，带有夸张的表情和动作',
];

type WorkMode = 'generate' | 'split';
type SplitMode = 'auto' | 'manual';
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
  const [splitMode, setSplitMode] = useState<SplitMode>('auto');
  const [splitAction, setSplitAction] = useState<SplitAction>('replace');
  const [error, setError] = useState<string | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [isSplitting, setIsSplitting] = useState(false);
  const [splitMethod, setSplitMethod] = useState<'ai' | 'fallback' | null>(null);
  
  // 手动上传相关状态
  const [uploadedImage, setUploadedImage] = useState<File | null>(null);
  const [uploadPreviewUrl, setUploadPreviewUrl] = useState<string | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [showManualSelection, setShowManualSelection] = useState(false);
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
    <div className="bg-[#242424]/80 backdrop-blur-md rounded-xl border border-white/[0.08] overflow-hidden">
      {/* 模式切换标签 */}
      <div className="flex border-b border-white/[0.08]">
        <button
          onClick={() => setMode('generate')}
          className={`flex-1 py-3 px-4 text-sm font-medium transition-colors relative ${
            mode === 'generate'
              ? 'text-white'
              : 'text-white/50 hover:text-white/70'
          }`}
        >
          <span className="flex items-center justify-center gap-2">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
            </svg>
            AI 生成
          </span>
          {mode === 'generate' && (
            <span className="absolute bottom-0 left-0 right-0 h-0.5 bg-gradient-to-r from-[#646cff] to-[#bd34fe]" />
          )}
        </button>
        <button
          onClick={() => setMode('split')}
          className={`flex-1 py-3 px-4 text-sm font-medium transition-colors relative ${
            mode === 'split'
              ? 'text-white'
              : 'text-white/50 hover:text-white/70'
          }`}
        >
          <span className="flex items-center justify-center gap-2">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 5a1 1 0 011-1h14a1 1 0 011 1v2a1 1 0 01-1 1H5a1 1 0 01-1-1V5zM4 13a1 1 0 011-1h6a1 1 0 011 1v6a1 1 0 01-1 1H5a1 1 0 01-1-1v-6zM16 13a1 1 0 011-1h2a1 1 0 011 1v6a1 1 0 01-1 1h-2a1 1 0 01-1-1v-6z" />
            </svg>
            上传切割
          </span>
          {mode === 'split' && (
            <span className="absolute bottom-0 left-0 right-0 h-0.5 bg-gradient-to-r from-[#646cff] to-[#bd34fe]" />
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
                className="w-full h-24 px-3 py-2 text-sm border border-white/[0.08] rounded-lg 
                           bg-white/[0.03] text-white/90
                           placeholder-white/30 focus:outline-none focus:ring-2 focus:ring-[#646cff]/50 
                           focus:border-[#646cff]/50 resize-none transition-colors"
              />
              {/* 示例提示词 */}
              <div className="flex flex-wrap gap-2 mt-2">
                {EXAMPLE_PROMPTS.map((example, i) => (
                  <button
                    key={i}
                    onClick={() => setUserPrompt(example)}
                    className="text-xs px-2 py-1 bg-white/[0.05] border border-white/[0.08] text-white/60 
                               rounded hover:bg-white/[0.08] hover:text-white/80 transition-colors truncate max-w-[200px]"
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
                  <div className="w-5 h-5 border-2 border-white/20 border-t-[#646cff] rounded-full animate-spin" />
                  <span className="ml-3 text-sm text-white/60">正在生成...</span>
                </div>
                <button
                  onClick={handleCancel}
                  className="w-full py-2 text-sm text-rose-400 border border-rose-500/30 rounded-lg hover:bg-rose-500/10 transition-colors"
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
                    ? 'bg-gradient-to-r from-[#646cff] to-[#bd34fe] hover:opacity-90 text-white'
                    : 'bg-white/[0.05] text-white/30 cursor-not-allowed'
                }`}
              >
                {generateStatus.can ? '开始生成' : generateStatus.reason}
              </button>
            )}

            {/* 生成结果预览 */}
            {previewUrl && (
              <div className="mt-4">
                {/* 切割操作区 - 放在图片上方 */}
                <div className="mb-3 p-3 bg-white/[0.03] border border-white/[0.08] rounded-lg space-y-3">
                  {/* 替换/插入选项 - 仅当已有表情时显示 */}
                  {extractedEmojis.length > 0 && (
                    <div className="flex items-center gap-4">
                      <span className="text-xs text-white/40">分割后：</span>
                      <label className="flex items-center gap-1.5 cursor-pointer">
                        <input
                          type="radio"
                          name="splitAction"
                          checked={splitAction === 'replace'}
                          onChange={() => setSplitAction('replace')}
                          className="w-3.5 h-3.5 accent-[#646cff]"
                        />
                        <span className="text-xs text-white/70">替换</span>
                      </label>
                      <label className="flex items-center gap-1.5 cursor-pointer">
                        <input
                          type="radio"
                          name="splitAction"
                          checked={splitAction === 'append'}
                          onChange={() => setSplitAction('append')}
                          className="w-3.5 h-3.5 accent-[#646cff]"
                        />
                        <span className="text-xs text-white/70">追加</span>
                      </label>
                    </div>
                  )}

                  <button
                    onClick={handleSplitGenerated}
                    disabled={isSplitting}
                    className={`w-full py-2.5 rounded-lg font-medium transition-all ${
                      isSplitting
                        ? 'bg-white/[0.05] cursor-not-allowed text-white/30'
                        : 'bg-emerald-500 hover:bg-emerald-400 text-white'
                    }`}
                  >
                    {isSplitting ? (
                      <span className="flex items-center justify-center gap-2">
                        <span className="w-4 h-4 border-2 border-white/20 border-t-white rounded-full animate-spin" />
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
                <div className="relative rounded-lg overflow-hidden border border-white/[0.08]">
                  <img src={previewUrl} alt="生成结果" className="w-full h-auto" />
                </div>
              </div>
            )}
          </div>
        ) : showManualSelection && uploadedImage ? (
          /* 手动框选模式 */
          <div className="space-y-4">
            <ManualSelectionPanel
              imageFile={uploadedImage}
              onExtractComplete={() => {
                // 提取完成后不关闭面板，允许用户继续提取
                // 用户可以通过取消按钮手动关闭
              }}
              onCancel={() => {
                setShowManualSelection(false);
              }}
            />
          </div>
        ) : (
          /* 上传切割模式 */
          <div className="space-y-4">
            {/* 切割模式切换 */}
            <div className="flex items-center gap-2 p-1 bg-white/[0.03] rounded-lg border border-white/[0.08]">
              <button
                onClick={() => setSplitMode('auto')}
                className={`flex-1 py-2 px-3 text-xs font-medium rounded-md transition-all ${
                  splitMode === 'auto'
                    ? 'bg-[#646cff]/20 text-[#646cff] border border-[#646cff]/30'
                    : 'text-white/50 hover:text-white/70 hover:bg-white/[0.05]'
                }`}
              >
                <span className="flex items-center justify-center gap-1.5">
                  <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
                  </svg>
                  自动切割
                </span>
              </button>
              <button
                onClick={() => setSplitMode('manual')}
                className={`flex-1 py-2 px-3 text-xs font-medium rounded-md transition-all ${
                  splitMode === 'manual'
                    ? 'bg-[#646cff]/20 text-[#646cff] border border-[#646cff]/30'
                    : 'text-white/50 hover:text-white/70 hover:bg-white/[0.05]'
                }`}
              >
                <span className="flex items-center justify-center gap-1.5">
                  <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
                  </svg>
                  手动框选
                </span>
              </button>
            </div>

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
                    ? 'border-[#646cff] bg-[#646cff]/10'
                    : 'border-white/[0.12] hover:border-white/[0.2] hover:bg-white/[0.02]'
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
                <svg className="mx-auto h-12 w-12 text-white/30" stroke="currentColor" fill="none" viewBox="0 0 48 48">
                  <path d="M28 8H12a4 4 0 00-4 4v20m32-12v8m0 0v8a4 4 0 01-4 4H12a4 4 0 01-4-4v-4m32-4l-3.172-3.172a4 4 0 00-5.656 0L28 28M8 32l9.172-9.172a4 4 0 015.656 0L28 28m0 0l4 4m4-24h8m-4-4v8m-12 4h.02" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
                </svg>
                <p className="mt-2 text-sm text-white/60">拖拽图片到此处，或点击选择</p>
                <p className="text-xs text-white/30 mt-1">支持 PNG, JPG, JPEG, WebP</p>
              </div>
            ) : splitMode === 'auto' ? (
              <div className="space-y-4">
                {/* 切割操作区 - 放在图片上方 */}
                <div className="p-3 bg-white/[0.03] border border-white/[0.08] rounded-lg space-y-3">
                  {/* 替换/插入选项 - 仅当已有表情时显示 */}
                  {extractedEmojis.length > 0 && (
                    <div className="flex items-center gap-4">
                      <span className="text-xs text-white/40">分割后：</span>
                      <label className="flex items-center gap-1.5 cursor-pointer">
                        <input
                          type="radio"
                          name="splitActionUpload"
                          checked={splitAction === 'replace'}
                          onChange={() => setSplitAction('replace')}
                          className="w-3.5 h-3.5 accent-[#646cff]"
                        />
                        <span className="text-xs text-white/70">替换</span>
                      </label>
                      <label className="flex items-center gap-1.5 cursor-pointer">
                        <input
                          type="radio"
                          name="splitActionUpload"
                          checked={splitAction === 'append'}
                          onChange={() => setSplitAction('append')}
                          className="w-3.5 h-3.5 accent-[#646cff]"
                        />
                        <span className="text-xs text-white/70">追加</span>
                      </label>
                    </div>
                  )}

                  <button
                    onClick={handleSplitUploaded}
                    disabled={isSplitting}
                    className={`w-full py-2.5 rounded-lg font-medium transition-all ${
                      isSplitting
                        ? 'bg-white/[0.05] cursor-not-allowed text-white/30'
                        : 'bg-emerald-500 hover:bg-emerald-400 text-white'
                    }`}
                  >
                    {isSplitting ? (
                      <span className="flex items-center justify-center gap-2">
                        <span className="w-4 h-4 border-2 border-white/20 border-t-white rounded-full animate-spin" />
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
                <div className="relative rounded-lg overflow-hidden bg-[#1a1a1a] border border-white/[0.08]">
                  <img src={uploadPreviewUrl!} alt="待切割图片" className="w-full h-auto" />
                  <button
                    onClick={handleClearUpload}
                    className="absolute top-2 right-2 p-2 rounded-full bg-rose-500/80 text-white hover:bg-rose-500 transition-colors"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                </div>
              </div>
            ) : (
              /* 手动框选模式 - 显示进入按钮 */
              <div className="space-y-4">
                {/* 图片预览 */}
                <div className="relative rounded-lg overflow-hidden bg-[#1a1a1a] border border-white/[0.08]">
                  <img src={uploadPreviewUrl!} alt="待切割图片" className="w-full h-auto" />
                  <button
                    onClick={handleClearUpload}
                    className="absolute top-2 right-2 p-2 rounded-full bg-rose-500/80 text-white hover:bg-rose-500 transition-colors"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                </div>

                {/* 进入手动框选按钮 */}
                <button
                  onClick={() => setShowManualSelection(true)}
                  className="w-full py-2.5 rounded-lg font-medium transition-all bg-[#646cff] hover:bg-[#5558dd] text-white"
                >
                  <span className="flex items-center justify-center gap-2">
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
                    </svg>
                    进入手动框选
                  </span>
                </button>
                <p className="text-xs text-center text-white/40">
                  在图片上绘制矩形或多边形选区，精确提取表情包
                </p>
              </div>
            )}
            
            {!uploadedImage && (
              <p className="text-xs text-center text-white/40">
                上传已有的表情包图片进行切割提取
              </p>
            )}
          </div>
        )}

        {/* 错误提示 */}
        {error && (
          <div className="mt-4 p-3 bg-rose-500/10 border border-rose-500/20 rounded-lg">
            <p className="text-sm text-rose-400">{error}</p>
          </div>
        )}

        {/* 分割方法提示 */}
        {splitMethod && (
          <p className="mt-2 text-xs text-center text-white/40">
            {splitMethod === 'ai' ? '✨ 使用 AI 智能分割' : '📐 使用传统算法分割'}
          </p>
        )}
      </div>
    </div>
  );
}
