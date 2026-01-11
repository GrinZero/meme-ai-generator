/**
 * 单独处理面板组件
 * 
 * 功能：
 * - 提示词编辑区
 * - 切割参数配置（容差、最小区域、最小尺寸）
 * - 显示原图和新图对比
 * - 重新生成、替换、取消按钮
 * 
 * Requirements: 4.4, 4.5, 4.7, 4.8, 4.9, 4.10, 4.11, 4.12
 */

import { useCallback } from 'react';
import type { ProcessedImage, WImageType, ProcessingParams } from '../types/wechatStandardization';
import { WECHAT_SPECS } from '../services/wechatConstants';

/**
 * ReprocessPanel 组件 Props
 */
export interface ReprocessPanelProps {
  /** 选中的图片类型 */
  selectedType: WImageType;
  /** 原始图片 */
  originalImage: ProcessedImage;
  /** 新生成的图片（用于对比） */
  newImage: ProcessedImage | null;
  /** 当前提示词 */
  prompt: string;
  /** 提示词变更回调 */
  onPromptChange: (value: string) => void;
  /** 切割参数 */
  processingParams: ProcessingParams;
  /** 参数变更回调 */
  onParamsChange: (params: ProcessingParams) => void;
  /** 重新生成回调 */
  onRegenerate: () => void;
  /** 仅处理图片回调 */
  onProcessImage: () => void;
  /** 替换回调 */
  onReplace: () => void;
  /** 取消回调 */
  onCancel: () => void;
  /** 是否正在处理 */
  isProcessing: boolean;
}

/**
 * 获取图片类型的显示名称
 */
function getTypeDisplayName(type: WImageType): string {
  switch (type) {
    case 'banner':
      return 'P1 详情页横幅';
    case 'cover':
      return 'P2 表情封面图';
    case 'icon':
      return 'P3 聊天页图标';
    case 'appreciationGuide':
      return 'P4 赞赏引导图';
    case 'appreciationThanks':
      return 'P5 赞赏致谢图';
  }
}

/**
 * 获取图片类型的规格
 */
function getTypeSpec(type: WImageType) {
  switch (type) {
    case 'banner':
      return WECHAT_SPECS.BANNER;
    case 'cover':
      return WECHAT_SPECS.COVER;
    case 'icon':
      return WECHAT_SPECS.ICON;
    case 'appreciationGuide':
      return WECHAT_SPECS.APPRECIATION_GUIDE;
    case 'appreciationThanks':
      return WECHAT_SPECS.APPRECIATION_THANKS;
  }
}

/**
 * 棋盘格背景样式（用于展示透明效果）
 */
const checkerboardStyle = {
  backgroundImage: `
    linear-gradient(45deg, #2a2a2a 25%, transparent 25%),
    linear-gradient(-45deg, #2a2a2a 25%, transparent 25%),
    linear-gradient(45deg, transparent 75%, #2a2a2a 75%),
    linear-gradient(-45deg, transparent 75%, #2a2a2a 75%)
  `,
  backgroundSize: '16px 16px',
  backgroundPosition: '0 0, 0 8px, 8px -8px, -8px 0px',
  backgroundColor: '#1a1a1a',
};

/**
 * 图片预览组件
 */
interface ImagePreviewProps {
  image: ProcessedImage | null;
  label: string;
  showCheckerboard: boolean;
  isLoading?: boolean;
}

function ImagePreview({ image, label, showCheckerboard, isLoading }: ImagePreviewProps) {
  return (
    <div className="flex-1 min-w-0">
      <div className="text-xs text-white/50 mb-2">{label}</div>
      <div 
        className="relative aspect-square rounded-lg overflow-hidden border border-white/[0.08]"
        style={showCheckerboard ? checkerboardStyle : { backgroundColor: '#0d0d0d' }}
      >
        {isLoading ? (
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="w-8 h-8 border-2 border-white/20 border-t-[#646cff] rounded-full animate-spin" />
          </div>
        ) : image ? (
          <img
            src={image.preview}
            alt={label}
            className="absolute inset-0 w-full h-full object-contain p-2"
          />
        ) : (
          <div className="absolute inset-0 flex items-center justify-center text-white/20">
            <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
            </svg>
          </div>
        )}
      </div>
      {image && (
        <div className="mt-1 text-[10px] text-white/30 text-center">
          {image.width}×{image.height} · {image.sizeKB.toFixed(1)}KB
        </div>
      )}
    </div>
  );
}

/**
 * 参数滑块组件
 */
interface ParamSliderProps {
  label: string;
  value: number;
  min: number;
  max: number;
  step?: number;
  onChange: (value: number) => void;
  disabled?: boolean;
}

function ParamSlider({ label, value, min, max, step = 1, onChange, disabled }: ParamSliderProps) {
  return (
    <div className="space-y-1">
      <div className="flex items-center justify-between">
        <span className="text-xs text-white/50">{label}</span>
        <span className="text-xs text-white/70 font-mono">{value}</span>
      </div>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        disabled={disabled}
        className="w-full h-1.5 bg-white/10 rounded-full appearance-none cursor-pointer
          [&::-webkit-slider-thumb]:appearance-none
          [&::-webkit-slider-thumb]:w-3
          [&::-webkit-slider-thumb]:h-3
          [&::-webkit-slider-thumb]:rounded-full
          [&::-webkit-slider-thumb]:bg-[#646cff]
          [&::-webkit-slider-thumb]:cursor-pointer
          [&::-webkit-slider-thumb]:transition-transform
          [&::-webkit-slider-thumb]:hover:scale-110
          disabled:opacity-50 disabled:cursor-not-allowed"
      />
    </div>
  );
}

/**
 * 单独处理面板组件
 */
export function ReprocessPanel({
  selectedType,
  originalImage,
  newImage,
  prompt,
  onPromptChange,
  processingParams,
  onParamsChange,
  onRegenerate,
  onProcessImage,
  onReplace,
  onCancel,
  isProcessing,
}: ReprocessPanelProps) {
  const spec = getTypeSpec(selectedType);
  const displayName = getTypeDisplayName(selectedType);
  const showCheckerboard = spec.requiresTransparency;

  // 获取显示的图片
  const displayOriginalImage = originalImage.originalPreview ? {
    ...originalImage,
    preview: originalImage.originalPreview,
    blob: originalImage.originalBlob!,
    // 原始图片的尺寸和大小可能不同，这里暂时展示原图预览，尺寸信息可能不准，但主要是为了视觉对比
  } : originalImage;

  // 参数变更处理
  const handleToleranceChange = useCallback((value: number) => {
    onParamsChange({ ...processingParams, tolerance: value });
  }, [processingParams, onParamsChange]);

  const handleMinAreaChange = useCallback((value: number) => {
    onParamsChange({ ...processingParams, minArea: value });
  }, [processingParams, onParamsChange]);

  const handleMinSizeChange = useCallback((value: number) => {
    onParamsChange({ ...processingParams, minSize: value });
  }, [processingParams, onParamsChange]);

  const handleRemoveBackgroundChange = useCallback((checked: boolean) => {
    onParamsChange({ ...processingParams, removeBackground: checked });
  }, [processingParams, onParamsChange]);

  const handleDownloadNewImage = useCallback(() => {
    if (newImage) {
      const link = document.createElement('a');
      link.href = newImage.preview;
      link.download = `processed_${newImage.type}_${Date.now()}.${newImage.format}`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    }
  }, [newImage]);

  return (
    <div className="space-y-4 p-4 bg-[#1a1a1a]/50 rounded-lg border border-white/[0.08]">
      {/* 标题 */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <h3 className="text-sm font-medium text-white/80">单独处理</h3>
          <span className="px-2 py-0.5 text-[10px] bg-[#646cff]/20 text-[#646cff] rounded">
            {displayName}
          </span>
        </div>
        <span className="text-xs text-white/30">
          {spec.width}×{spec.height}
        </span>
      </div>

      {/* 图片对比区域 */}
      <div className="flex gap-4">
        <ImagePreview
          image={displayOriginalImage}
          label="原图"
          showCheckerboard={showCheckerboard}
        />
        <div className="flex items-center text-white/20">
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7l5 5m0 0l-5 5m5-5H6" />
          </svg>
        </div>
        <div className="flex-1 min-w-0 flex flex-col">
          <ImagePreview
            image={newImage}
            label="新图"
            showCheckerboard={showCheckerboard}
            isLoading={isProcessing}
          />
          {newImage && !isProcessing && (
            <button
              onClick={handleDownloadNewImage}
              className="mt-2 w-full py-1.5 text-xs font-medium text-white/70 hover:text-white bg-white/[0.05] hover:bg-white/[0.1] rounded transition-colors"
            >
              下载新图
            </button>
          )}
        </div>
      </div>

      {/* 提示词编辑区 */}
      <div className="space-y-2">
        <label className="text-xs text-white/50">提示词</label>
        <textarea
          value={prompt}
          onChange={(e) => onPromptChange(e.target.value)}
          disabled={isProcessing}
          rows={4}
          className="w-full px-3 py-2 text-sm text-white/80 bg-black/30 border border-white/[0.08] 
            rounded-lg resize-none focus:outline-none focus:border-[#646cff]/50
            disabled:opacity-50 disabled:cursor-not-allowed
            placeholder:text-white/20"
          placeholder="输入提示词..."
        />
      </div>

      {/* 切割参数配置 */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <span className="text-xs text-white/50">切割参数</span>
          <button
            type="button"
            onClick={() => onParamsChange({ tolerance: 30, minArea: 100, minSize: 10, removeBackground: true })}
            disabled={isProcessing}
            className="text-[10px] text-white/40 hover:text-white/60 transition-colors disabled:opacity-50"
          >
            重置默认
          </button>
        </div>
        
        {/* 是否抠图选项 */}
        <label className="flex items-center gap-2 cursor-pointer select-none">
          <input
            type="checkbox"
            checked={processingParams.removeBackground !== false} // 默认为 true
            onChange={(e) => handleRemoveBackgroundChange(e.target.checked)}
            disabled={isProcessing}
            className="w-4 h-4 rounded border-white/20 bg-white/5 text-[#646cff] focus:ring-[#646cff] focus:ring-offset-0 focus:ring-offset-transparent"
          />
          <span className="text-xs text-white/70">自动去除背景 (抠图)</span>
        </label>

        <div className="grid grid-cols-3 gap-4">
          <ParamSlider
            label="容差值"
            value={processingParams.tolerance}
            min={0}
            max={100}
            onChange={handleToleranceChange}
            disabled={isProcessing}
          />
          <ParamSlider
            label="最小区域"
            value={processingParams.minArea}
            min={10}
            max={500}
            step={10}
            onChange={handleMinAreaChange}
            disabled={isProcessing}
          />
          <ParamSlider
            label="最小尺寸"
            value={processingParams.minSize}
            min={1}
            max={50}
            onChange={handleMinSizeChange}
            disabled={isProcessing}
          />
        </div>
      </div>

      {/* 操作按钮 */}
      <div className="flex items-center gap-3 pt-2">
        <div className="flex-1 flex gap-2">
          {/* 重新生成按钮 */}
          <button
            type="button"
            onClick={onRegenerate}
            disabled={isProcessing}
            className={`
              flex-1 flex items-center justify-center gap-2 px-3 py-2.5 rounded-lg
              text-sm font-medium transition-all duration-200
              ${isProcessing
                ? 'bg-[#646cff]/50 text-white/50 cursor-not-allowed'
                : 'bg-[#646cff] text-white hover:bg-[#5558dd] cursor-pointer'
              }
            `}
            title="重新生成 AI 图片并应用参数"
          >
            {isProcessing ? (
              <>
                <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                生成中...
              </>
            ) : (
              <>
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                </svg>
                重新生成
              </>
            )}
          </button>

          {/* 仅处理图片按钮 */}
          <button
            type="button"
            onClick={onProcessImage}
            disabled={isProcessing}
            className={`
              flex-1 flex items-center justify-center gap-2 px-3 py-2.5 rounded-lg
              text-sm font-medium transition-all duration-200
              ${isProcessing
                ? 'bg-white/[0.05] text-white/30 cursor-not-allowed'
                : 'bg-white/[0.1] text-white hover:bg-white/[0.15] cursor-pointer'
              }
            `}
            title="基于原图重新应用切割参数，不重新生成 AI 图片"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6V4m0 2a2 2 0 100 4m0-4a2 2 0 110 4m-6 8a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4m6 6v10m6-2a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4" />
            </svg>
            图片处理
          </button>
        </div>

        {/* 替换按钮 - 仅在有新图时显示 */}
        {newImage && !isProcessing && (
          <button
            type="button"
            onClick={onReplace}
            className="flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg
              text-sm font-medium bg-emerald-500/20 text-emerald-400 
              hover:bg-emerald-500/30 transition-all duration-200 cursor-pointer"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
            </svg>
            替换
          </button>
        )}

        {/* 取消按钮 */}
        <button
          type="button"
          onClick={onCancel}
          disabled={isProcessing}
          className="flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg
            text-sm font-medium text-white/50 hover:text-white/70 hover:bg-white/[0.05]
            transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
        >
          取消
        </button>
      </div>

      {/* 提示信息 */}
      {newImage && !isProcessing && (
        <p className="text-xs text-white/40 text-center">
          点击"替换"使用新图片，或点击"取消"保留原图
        </p>
      )}
    </div>
  );
}

export default ReprocessPanel;
