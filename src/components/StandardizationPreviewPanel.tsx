/**
 * 微信表情标准化预览面板组件
 * 
 * 功能：
 * - P1/P2/P3 预览卡片
 * - 棋盘格透明背景展示
 * - 重新生成按钮
 * - 处理状态指示器
 * 
 * Requirements: 3.5, 3.7, 5.6, 6.1, 6.2
 */

import { useCallback, useMemo } from 'react';
import type { StandardizationPreviewPanelProps, ProcessedImage, ProcessingStatus } from '../types/wechatStandardization';
import { WECHAT_SPECS } from '../services/wechatConstants';

/**
 * 预览卡片配置
 */
const PREVIEW_CONFIGS = [
  {
    type: 'p1' as const,
    label: 'P1 详情页横幅',
    spec: WECHAT_SPECS.BANNER,
    icon: (
      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
      </svg>
    ),
  },
  {
    type: 'p2' as const,
    label: 'P2 表情封面图',
    spec: WECHAT_SPECS.COVER,
    icon: (
      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M14.828 14.828a4 4 0 01-5.656 0M9 10h.01M15 10h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
      </svg>
    ),
  },
  {
    type: 'p3' as const,
    label: 'P3 聊天页图标',
    spec: WECHAT_SPECS.ICON,
    icon: (
      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M5.121 17.804A13.937 13.937 0 0112 16c2.5 0 4.847.655 6.879 1.804M15 10a3 3 0 11-6 0 3 3 0 016 0zm6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
      </svg>
    ),
  },
];

/**
 * 获取处理状态文本
 */
function getStatusText(status: ProcessingStatus, type: 'p1' | 'p2' | 'p3'): string | null {
  if (status.stage === 'generating' && status.type === type) {
    return `生成中 ${Math.round(status.progress)}%`;
  }
  if (status.stage === 'processing' && status.type === type) {
    return '处理中...';
  }
  return null;
}

/**
 * 检查指定类型是否正在处理
 */
function isProcessing(status: ProcessingStatus, type: 'p1' | 'p2' | 'p3'): boolean {
  if (status.stage === 'generating' && status.type === type) return true;
  if (status.stage === 'processing' && status.type === type) return true;
  return false;
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
 * 单个预览卡片组件
 */
interface PreviewCardProps {
  type: 'p1' | 'p2' | 'p3';
  label: string;
  spec: typeof WECHAT_SPECS.BANNER | typeof WECHAT_SPECS.COVER | typeof WECHAT_SPECS.ICON;
  icon: React.ReactNode;
  image: ProcessedImage | null;
  status: ProcessingStatus;
  onRegenerate: () => void;
}

function PreviewCard({
  type,
  label,
  spec,
  icon,
  image,
  status,
  onRegenerate,
}: PreviewCardProps) {
  const processing = isProcessing(status, type);
  const statusText = getStatusText(status, type);
  const showCheckerboard = spec.requiresTransparency;

  // 计算预览区域的宽高比
  const aspectRatio = spec.width / spec.height;

  return (
    <div className="border border-white/[0.08] rounded-lg overflow-hidden bg-[#1a1a1a]/50">
      {/* 卡片头部 */}
      <div className="flex items-center justify-between p-3 border-b border-white/[0.08]">
        <div className="flex items-center gap-2">
          <span className="text-white/50">{icon}</span>
          <div>
            <span className="text-sm font-medium text-white/80">{label}</span>
            <span className="ml-2 text-xs text-white/30">
              {spec.width}×{spec.height}
            </span>
          </div>
        </div>
        
        {/* 状态标签 */}
        {image && !processing && (
          <span className="px-2 py-0.5 text-[10px] bg-emerald-500/20 text-emerald-400 rounded">
            已完成
          </span>
        )}
        {processing && (
          <span className="px-2 py-0.5 text-[10px] bg-[#646cff]/20 text-[#646cff] rounded animate-pulse">
            {statusText}
          </span>
        )}
      </div>

      {/* 预览区域 */}
      <div 
        className="relative"
        style={{ 
          paddingBottom: `${(1 / aspectRatio) * 100}%`,
        }}
      >
        <div 
          className="absolute inset-0 flex items-center justify-center"
          style={showCheckerboard ? checkerboardStyle : { backgroundColor: '#0d0d0d' }}
        >
          {/* 加载状态 */}
          {processing && (
            <div className="flex flex-col items-center gap-2">
              <div className="w-8 h-8 border-2 border-white/20 border-t-[#646cff] rounded-full animate-spin" />
              <span className="text-xs text-white/40">{statusText}</span>
            </div>
          )}

          {/* 图片预览 */}
          {image && !processing && (
            <img
              src={image.preview}
              alt={label}
              className="max-w-full max-h-full object-contain"
              style={{
                width: 'auto',
                height: 'auto',
                maxWidth: '100%',
                maxHeight: '100%',
              }}
            />
          )}

          {/* 空状态 */}
          {!image && !processing && (
            <div className="flex flex-col items-center gap-2 text-white/20">
              <svg className="w-10 h-10" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
              </svg>
              <span className="text-xs">等待生成</span>
            </div>
          )}
        </div>
      </div>

      {/* 卡片底部 - 信息和操作 */}
      <div className="p-3 border-t border-white/[0.08]">
        {image ? (
          <div className="flex items-center justify-between">
            {/* 文件信息 */}
            <div className="flex items-center gap-3 text-xs text-white/40">
              <span>{image.width}×{image.height}</span>
              <span>{image.sizeKB.toFixed(1)} KB</span>
              <span className="uppercase">{image.format}</span>
              {image.hasTransparency && (
                <span className="text-emerald-400/70">透明</span>
              )}
            </div>

            {/* 重新生成按钮 */}
            <button
              onClick={onRegenerate}
              disabled={processing || status.stage === 'generating' || status.stage === 'processing'}
              className={`
                flex items-center gap-1.5 px-2.5 py-1.5 text-xs rounded-md
                transition-all duration-200
                ${processing || status.stage === 'generating' || status.stage === 'processing'
                  ? 'text-white/20 cursor-not-allowed'
                  : 'text-white/60 hover:text-white/80 hover:bg-white/[0.05] cursor-pointer'
                }
              `}
              aria-label={`重新生成 ${label}`}
            >
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
                />
              </svg>
              重新生成
            </button>
          </div>
        ) : (
          <div className="text-xs text-white/30 text-center">
            {processing ? '正在生成...' : '点击"开始生成"按钮生成图片'}
          </div>
        )}
      </div>
    </div>
  );
}

/**
 * 微信表情标准化预览面板组件
 * 
 * @param p1Preview - P1 横幅预览
 * @param p2Preview - P2 封面预览
 * @param p3Preview - P3 图标预览
 * @param status - 处理状态
 * @param onRegenerate - 重新生成回调
 */
export function StandardizationPreviewPanel({
  p1Preview,
  p2Preview,
  p3Preview,
  status,
  onRegenerate,
}: StandardizationPreviewPanelProps) {
  const getPreviewByType = useCallback(
    (type: 'p1' | 'p2' | 'p3'): ProcessedImage | null => {
      switch (type) {
        case 'p1':
          return p1Preview;
        case 'p2':
          return p2Preview;
        case 'p3':
          return p3Preview;
      }
    },
    [p1Preview, p2Preview, p3Preview]
  );

  // 计算完成数量
  const completedCount = useMemo(() => {
    let count = 0;
    if (p1Preview) count++;
    if (p2Preview) count++;
    if (p3Preview) count++;
    return count;
  }, [p1Preview, p2Preview, p3Preview]);

  // 是否有任何处理中
  const isAnyProcessing = status.stage === 'generating' || status.stage === 'processing';

  // 是否全部完成
  const isAllCompleted = completedCount === 3;

  return (
    <div className="space-y-4">
      {/* 标题和状态 */}
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-medium text-white/70">生成预览</h3>
        <div className="flex items-center gap-2">
          {isAnyProcessing && (
            <span className="flex items-center gap-1.5 text-xs text-[#646cff]">
              <span className="w-2 h-2 bg-[#646cff] rounded-full animate-pulse" />
              处理中
            </span>
          )}
          {!isAnyProcessing && completedCount > 0 && (
            <span className={`text-xs ${isAllCompleted ? 'text-emerald-400' : 'text-white/40'}`}>
              {completedCount}/3 已完成
            </span>
          )}
        </div>
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

      {/* 预览卡片列表 */}
      <div className="space-y-3">
        {PREVIEW_CONFIGS.map((config) => (
          <PreviewCard
            key={config.type}
            type={config.type}
            label={config.label}
            spec={config.spec}
            icon={config.icon}
            image={getPreviewByType(config.type)}
            status={status}
            onRegenerate={() => onRegenerate(config.type)}
          />
        ))}
      </div>

      {/* 全部完成提示 */}
      {isAllCompleted && (
        <div className="flex items-center gap-2 p-3 rounded-lg bg-emerald-500/10 border border-emerald-500/20">
          <svg 
            className="w-4 h-4 text-emerald-400 flex-shrink-0" 
            fill="none" 
            stroke="currentColor" 
            viewBox="0 0 24 24"
          >
            <path 
              strokeLinecap="round" 
              strokeLinejoin="round" 
              strokeWidth={2} 
              d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" 
            />
          </svg>
          <p className="text-sm text-emerald-400">
            所有图片已生成完成，可以下载使用
          </p>
        </div>
      )}

      {/* 空状态提示 */}
      {completedCount === 0 && !isAnyProcessing && status.stage !== 'error' && (
        <p className="text-xs text-white/30 text-center">
          上传素材图片并点击"开始生成"按钮，系统将自动生成 P1、P2、P3 三种规格的图片
        </p>
      )}
    </div>
  );
}

export default StandardizationPreviewPanel;
