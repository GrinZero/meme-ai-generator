/**
 * 微信表情平台标准化主面板组件
 * 
 * 功能：
 * - 整合所有子组件（图片上传、提示词编辑、预览、下载）
 * - 实现工作流布局
 * - 实现从表情包模块导入功能
 * - 支持赞赏图生成选项
 * - 支持图片选择和单独处理
 * 
 * Requirements: 2.1, 2.2, 4.1, 4.2, 4.3, 4.4, 4.7, 4.9, 4.10, 7.1-7.4
 */

import { useCallback, useEffect, useMemo } from 'react';
import { useAppStore } from '../store/useAppStore';
import { useWeChatStandardizationStore } from '../store/useWeChatStandardizationStore';
import { StandardizationImageUploader } from './StandardizationImageUploader';
import { StandardizationPromptEditor } from './StandardizationPromptEditor';
import {
  generateAll,
  cancelGeneration,
} from '../services/wechatStandardizationService';
import type { WeChatStandardizationPanelProps, ProcessingStatus, ProcessedImage, StandardizationResult } from '../types/wechatStandardization';
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
  // 获取 API 配置和提取的表情
  const { apiConfig, extractedEmojis } = useAppStore();

  // 获取标准化 Store 状态和方法
  const {
    sourceImages,
    prompts,
    status,
    enabledTypes,
    addSourceImages,
    removeSourceImage,
    importFromEmojis,
    setPrompt,
    resetPrompt,
    setAppreciationPrompt,
    resetAppreciationPrompt,
    toggleEnabledType,
    reset,
    updateResult,
  } = useWeChatStandardizationStore();

  // 内部状态更新方法（直接操作 store）
  const setStatus = useCallback((newStatus: ProcessingStatus) => {
    useWeChatStandardizationStore.setState({ status: newStatus });
  }, []);

  const setResult = useCallback((newResult: StandardizationResult | null) => {
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
    type: 'p1' | 'p2' | 'p3' | 'appreciationGuide' | 'appreciationThanks',
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

  // 单张图片生成回调
  const handleImageGenerated = useCallback((image: ProcessedImage) => {
    updateResult({ [image.type]: image });
  }, [updateResult]);

  // 开始生成所有图片
  const handleStartGeneration = useCallback(async () => {
    if (!canGenerate) return;

    // 找到第一个启用的类型作为初始状态显示
    const firstEnabledType = (Object.entries(enabledTypes).find(([, enabled]) => enabled)?.[0] || 'p1') as 'p1' | 'p2' | 'p3' | 'appreciationGuide' | 'appreciationThanks';
    
    setStatus({ stage: 'generating', type: firstEnabledType, progress: 0 });
    setResult(null);

    try {
      const generationResult = await generateAll(
        sourceImages,
        prompts,
        apiConfig,
        handleProgress,
        enabledTypes,
        handleImageGenerated
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
  }, [canGenerate, sourceImages, prompts, apiConfig, enabledTypes, handleProgress, setStatus, setResult, handleImageGenerated]);

  // 取消生成
  const handleCancel = useCallback(() => {
    cancelGeneration();
    setStatus({ stage: 'idle' });
  }, [setStatus]);

  // 重置面板
  const handleReset = useCallback(() => {
    reset();
  }, [reset]);

  // 获取当前进度文本
  const getProgressText = useCallback(() => {
    if (status.stage === 'generating' && 'type' in status) {
      const typeLabels: Record<string, string> = {
        p1: 'P1 横幅',
        p2: 'P2 封面',
        p3: 'P3 图标',
        appreciationGuide: 'P4 赞赏引导图',
        appreciationThanks: 'P5 赞赏致谢图',
      };
      return `正在生成 ${typeLabels[status.type] || status.type}...`;
    }
    return '处理中...';
  }, [status]);

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
          {/* 左侧：图片上传和表情选择 */}
          <div className="space-y-6">
            <StandardizationImageUploader
              images={sourceImages}
              onUpload={addSourceImages}
              onDelete={removeSourceImage}
              disabled={isProcessing}
            />

            {/* 提取的表情快捷选择 */}
            {extractedEmojis.length > 0 && (
              <div className="bg-[#1a1a1a]/30 rounded-lg p-4 border border-white/[0.05]">
                <div className="flex items-center justify-between mb-3">
                  <h3 className="text-sm font-medium text-white/70">从提取的表情添加</h3>
                  <span className="text-xs text-white/30">共 {extractedEmojis.length} 个</span>
                </div>
                <div className="grid grid-cols-5 sm:grid-cols-6 gap-2 max-h-32 overflow-y-auto custom-scrollbar pr-1">
                  {extractedEmojis.map((emoji) => (
                    <button
                      key={emoji.id}
                      onClick={() => importFromEmojis([emoji])}
                      disabled={isProcessing}
                      className="relative aspect-square rounded-md overflow-hidden border border-white/[0.05] hover:border-[#07c160] hover:ring-1 hover:ring-[#07c160] transition-all group"
                      title="点击添加到素材"
                    >
                      <img
                        src={emoji.preview}
                        alt={`Emoji ${emoji.id}`}
                        className="w-full h-full object-contain bg-[#1a1a1a]"
                      />
                      <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity">
                        <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                        </svg>
                      </div>
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* 提示词编辑 */}
          <StandardizationPromptEditor
            prompts={prompts}
            enabledTypes={enabledTypes}
            onPromptChange={(type, value) => {
              if (type === 'appreciationGuide' || type === 'appreciationThanks') {
                setAppreciationPrompt(type, value);
              } else {
                setPrompt(type, value);
              }
            }}
            onReset={(type) => {
              if (type === 'appreciationGuide' || type === 'appreciationThanks') {
                resetAppreciationPrompt(type);
              } else {
                resetPrompt(type);
              }
            }}
            onToggleType={toggleEnabledType}
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
                  {getProgressText()}
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

        {/* 错误状态 */}
        {status.stage === 'error' && (
          <div 
            className="flex items-start gap-2 p-3 rounded-lg bg-rose-500/10 border border-rose-500/20"
            role="alert"
          >
            <svg 
              className="w-4 h-4 text-rose-400 flex-shrink-0 mt-0.5" 
              fill="none" 
              stroke="currentColor" 
              viewBox="0 0 24 24"
            >
              <path 
                strokeLinecap="round" 
                strokeLinejoin="round" 
                strokeWidth={2} 
                d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" 
              />
            </svg>
            <p className="text-sm text-rose-400 flex-1">{status.message}</p>
          </div>
        )}
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
