/**
 * 微信表情平台标准化主面板组件
 * 
 * 功能：
 * - 整合所有子组件（图片上传、提示词编辑、预览、下载）
 * - 实现工作流布局
 * - 实现从表情包模块导入功能
 * 
 * Requirements: 7.1-7.4
 */

import { useCallback, useEffect, useMemo } from 'react';
import { useAppStore } from '../store/useAppStore';
import { useWeChatStandardizationStore } from '../store/useWeChatStandardizationStore';
import { StandardizationImageUploader } from './StandardizationImageUploader';
import { StandardizationPromptEditor } from './StandardizationPromptEditor';
import { StandardizationPreviewPanel } from './StandardizationPreviewPanel';
import { StandardizationDownloadPanel } from './StandardizationDownloadPanel';
import {
  generateAll,
  generateBanner,
  generateCover,
  generateIcon,
  cancelGeneration,
} from '../services/wechatStandardizationService';
import {
  downloadProcessedImage,
  downloadStandardizationZip,
} from '../services/wechatFileService';
import type { WeChatStandardizationPanelProps, ProcessingStatus } from '../types/wechatStandardization';
import type { ExtractedEmoji } from '../types/image';

/**
 * 微信表情平台标准化主面板
 * 
 * @param importedEmojis - 从表情包生成模块导入的图片（可选）
 * @param onClose - 关闭面板回调
 */
export function WeChatStandardizationPanel({
  importedEmojis,
  onClose,
}: WeChatStandardizationPanelProps) {
  // 获取 API 配置
  const { apiConfig } = useAppStore();

  // 获取标准化 Store 状态和方法
  const {
    sourceImages,
    prompts,
    result,
    status,
    addSourceImages,
    removeSourceImage,
    importFromEmojis,
    setPrompt,
    resetPrompt,
    reset,
  } = useWeChatStandardizationStore();

  // 内部状态更新方法（直接操作 store）
  const setStatus = useCallback((newStatus: ProcessingStatus) => {
    useWeChatStandardizationStore.setState({ status: newStatus });
  }, []);

  const setResult = useCallback((newResult: typeof result) => {
    useWeChatStandardizationStore.setState({ result: newResult });
  }, []);

  // 导入表情包（如果有）
  useEffect(() => {
    if (importedEmojis && importedEmojis.length > 0) {
      importFromEmojis(importedEmojis);
    }
  }, [importedEmojis, importFromEmojis]);

  // 检查是否可以开始生成
  const canGenerate = useMemo(() => {
    const hasImages = sourceImages.length > 0;
    const hasApiConfig = apiConfig.apiKey && apiConfig.baseUrl;
    const isIdle = status.stage === 'idle' || status.stage === 'completed' || status.stage === 'error';
    return hasImages && hasApiConfig && isIdle;
  }, [sourceImages.length, apiConfig.apiKey, apiConfig.baseUrl, status.stage]);

  // 检查是否正在处理
  const isProcessing = useMemo(() => {
    return status.stage === 'generating' || status.stage === 'processing';
  }, [status.stage]);

  // 生成状态提示
  const generateButtonText = useMemo(() => {
    if (!apiConfig.apiKey || !apiConfig.baseUrl) {
      return '请先配置 API';
    }
    if (sourceImages.length === 0) {
      return '请先上传图片';
    }
    if (isProcessing) {
      return '生成中...';
    }
    return '开始生成';
  }, [apiConfig.apiKey, apiConfig.baseUrl, sourceImages.length, isProcessing]);

  // 进度回调
  const handleProgress = useCallback((
    type: 'p1' | 'p2' | 'p3',
    stage: 'generating' | 'processing' | 'completed' | 'error',
    progress?: number,
    error?: string
  ) => {
    if (stage === 'error' && error) {
      setStatus({ stage: 'error', message: error });
    } else if (stage === 'generating') {
      setStatus({ stage: 'generating', type, progress: progress || 0 });
    } else if (stage === 'processing') {
      setStatus({ stage: 'processing', type });
    }
  }, [setStatus]);

  // 开始生成所有图片
  const handleStartGeneration = useCallback(async () => {
    if (!canGenerate) return;

    setStatus({ stage: 'generating', type: 'p1', progress: 0 });
    setResult(null);

    try {
      const generationResult = await generateAll(
        sourceImages,
        prompts,
        apiConfig,
        handleProgress
      );

      setResult(generationResult);

      if (generationResult.errors.length > 0) {
        // 有部分错误
        const errorMessages = generationResult.errors.map(e => e.message).join('; ');
        setStatus({ stage: 'error', message: errorMessages });
      } else {
        setStatus({ stage: 'completed' });
      }
    } catch (error) {
      setStatus({
        stage: 'error',
        message: error instanceof Error ? error.message : '生成失败',
      });
    }
  }, [canGenerate, sourceImages, prompts, apiConfig, handleProgress, setStatus, setResult]);

  // 重新生成单个类型
  const handleRegenerate = useCallback(async (type: 'p1' | 'p2' | 'p3') => {
    if (sourceImages.length === 0 || isProcessing) return;

    setStatus({ stage: 'generating', type, progress: 0 });

    try {
      let newImage;
      const prompt = prompts[type];

      switch (type) {
        case 'p1':
          newImage = await generateBanner(sourceImages, prompt, apiConfig, handleProgress);
          break;
        case 'p2':
          newImage = await generateCover(sourceImages, prompt, apiConfig, handleProgress);
          break;
        case 'p3':
          newImage = await generateIcon(sourceImages, prompt, apiConfig, handleProgress);
          break;
      }

      // 更新结果
      const currentResult = result || { banner: null, cover: null, icon: null, errors: [] };
      const updatedResult = { ...currentResult };

      switch (type) {
        case 'p1':
          updatedResult.banner = newImage;
          break;
        case 'p2':
          updatedResult.cover = newImage;
          break;
        case 'p3':
          updatedResult.icon = newImage;
          break;
      }

      setResult(updatedResult);
      setStatus({ stage: 'completed' });
    } catch (error) {
      setStatus({
        stage: 'error',
        message: error instanceof Error ? error.message : `重新生成 ${type.toUpperCase()} 失败`,
      });
    }
  }, [sourceImages, prompts, apiConfig, isProcessing, result, handleProgress, setStatus, setResult]);

  // 取消生成
  const handleCancel = useCallback(() => {
    cancelGeneration();
    setStatus({ stage: 'idle' });
  }, [setStatus]);

  // 下载单个图片
  const handleDownloadSingle = useCallback((type: 'banner' | 'cover' | 'icon') => {
    if (!result) return;

    const image = result[type];
    if (image) {
      downloadProcessedImage(image);
    }
  }, [result]);

  // 批量下载
  const handleDownloadAll = useCallback(async () => {
    if (!result) return;

    try {
      await downloadStandardizationZip({
        banner: result.banner,
        cover: result.cover,
        icon: result.icon,
      });
    } catch (error) {
      console.error('下载失败:', error);
    }
  }, [result]);

  // 重置面板
  const handleReset = useCallback(() => {
    reset();
  }, [reset]);

  return (
    <div className="bg-[#242424]/80 backdrop-blur-md rounded-xl border border-white/[0.08] overflow-hidden">
      {/* 头部 */}
      <div className="flex items-center justify-between p-4 border-b border-white/[0.08]">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-lg bg-gradient-to-br from-[#07c160]/20 to-[#07c160]/5">
            <svg className="w-5 h-5 text-[#07c160]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
            </svg>
          </div>
          <div>
            <h2 className="text-sm font-medium text-white/90">微信表情标准化</h2>
            <p className="text-xs text-white/40">生成符合微信表情平台规范的 P1/P2/P3 图片</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {/* 重置按钮 */}
          <button
            onClick={handleReset}
            className="p-2 rounded-lg text-white/40 hover:text-white/60 hover:bg-white/[0.05] transition-colors"
            title="重置"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
            </svg>
          </button>
          {/* 关闭按钮 */}
          {onClose && (
            <button
              onClick={onClose}
              className="p-2 rounded-lg text-white/40 hover:text-white/60 hover:bg-white/[0.05] transition-colors"
              title="关闭"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          )}
        </div>
      </div>

      {/* 主体内容 */}
      <div className="p-4 sm:p-6 space-y-6">
        {/* 第一行：图片上传和提示词编辑 */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* 图片上传 */}
          <StandardizationImageUploader
            images={sourceImages}
            onUpload={addSourceImages}
            onDelete={removeSourceImage}
            disabled={isProcessing}
          />

          {/* 提示词编辑 */}
          <StandardizationPromptEditor
            p1Prompt={prompts.p1}
            p2Prompt={prompts.p2}
            p3Prompt={prompts.p3}
            onPromptChange={setPrompt}
            onReset={resetPrompt}
          />
        </div>

        {/* 生成按钮 */}
        <div className="flex flex-col sm:flex-row gap-3">
          {isProcessing ? (
            <>
              <button
                disabled
                className="flex-1 py-3 rounded-lg font-medium bg-white/[0.05] text-white/30 cursor-not-allowed"
              >
                <span className="flex items-center justify-center gap-2">
                  <span className="w-4 h-4 border-2 border-white/20 border-t-[#07c160] rounded-full animate-spin" />
                  {status.stage === 'generating' && 'type' in status
                    ? `正在生成 ${status.type.toUpperCase()}...`
                    : '处理中...'}
                </span>
              </button>
              <button
                onClick={handleCancel}
                className="px-6 py-3 rounded-lg font-medium text-rose-400 border border-rose-500/30 hover:bg-rose-500/10 transition-colors"
              >
                取消
              </button>
            </>
          ) : (
            <button
              onClick={handleStartGeneration}
              disabled={!canGenerate}
              className={`flex-1 py-3 rounded-lg font-medium transition-all ${
                canGenerate
                  ? 'bg-gradient-to-r from-[#07c160] to-[#06ae56] hover:opacity-90 text-white'
                  : 'bg-white/[0.05] text-white/30 cursor-not-allowed'
              }`}
            >
              {generateButtonText}
            </button>
          )}
        </div>

        {/* 第二行：预览和下载 */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* 预览面板 */}
          <StandardizationPreviewPanel
            p1Preview={result?.banner || null}
            p2Preview={result?.cover || null}
            p3Preview={result?.icon || null}
            status={status}
            onRegenerate={handleRegenerate}
          />

          {/* 下载面板 */}
          <StandardizationDownloadPanel
            banner={result?.banner || null}
            cover={result?.cover || null}
            icon={result?.icon || null}
            onDownloadSingle={handleDownloadSingle}
            onDownloadAll={handleDownloadAll}
            disabled={isProcessing}
          />
        </div>
      </div>
    </div>
  );
}

/**
 * 从表情包生成模块导入的辅助组件
 * 用于在表情网格中显示"导入到标准化"按钮
 */
export interface ImportToStandardizationButtonProps {
  emojis: ExtractedEmoji[];
  onClick: (emojis: ExtractedEmoji[]) => void;
  disabled?: boolean;
}

export function ImportToStandardizationButton({
  emojis,
  onClick,
  disabled = false,
}: ImportToStandardizationButtonProps) {
  const handleClick = useCallback(() => {
    if (!disabled && emojis.length > 0) {
      onClick(emojis);
    }
  }, [emojis, onClick, disabled]);

  return (
    <button
      onClick={handleClick}
      disabled={disabled || emojis.length === 0}
      className={`
        flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium
        transition-all duration-200
        ${disabled || emojis.length === 0
          ? 'bg-white/[0.05] text-white/30 cursor-not-allowed'
          : 'bg-[#07c160]/20 text-[#07c160] hover:bg-[#07c160]/30 cursor-pointer'
        }
      `}
      title="导入到微信表情标准化"
    >
      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
      </svg>
      导入到标准化
    </button>
  );
}

export default WeChatStandardizationPanel;
