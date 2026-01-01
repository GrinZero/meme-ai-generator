/**
 * 表情包网格预览组件
 * 展示所有提取的表情，支持选择单个表情
 */

import { useCallback, useState } from 'react';
import type { ExtractedEmoji } from '../types/image';
import { downloadAllEmojis } from '../services';
import { DEFAULT_STANDARD_SIZE } from '../services/downloadService';

interface EmojiGridProps {
  /** 提取的表情列表 */
  emojis: ExtractedEmoji[];
  /** 当前选中的表情 ID */
  selectedId: string | null;
  /** 选择表情回调 */
  onSelect: (id: string | null) => void;
  /** 删除表情回调 */
  onDelete?: (id: string) => void;
  /** 是否正在加载 */
  isLoading?: boolean;
  /** 错误信息 */
  error?: string | null;
  /** 重试回调 */
  onRetry?: () => void;
}

export function EmojiGrid({
  emojis,
  selectedId,
  onSelect,
  onDelete,
  isLoading = false,
  error = null,
  onRetry,
}: EmojiGridProps) {
  const handleSelect = useCallback(
    (id: string) => {
      onSelect(selectedId === id ? null : id);
    },
    [selectedId, onSelect]
  );

  const handleDelete = useCallback(
    (e: React.MouseEvent, id: string) => {
      e.stopPropagation();
      onDelete?.(id);
    },
    [onDelete]
  );

  // 批量下载状态
  const [isDownloading, setIsDownloading] = useState(false);
  // 是否标准化尺寸（默认开启）
  const [standardizeSize, setStandardizeSize] = useState(true);

  // 处理批量下载
  const handleBatchDownload = useCallback(async () => {
    if (emojis.length === 0 || isDownloading) return;
    
    setIsDownloading(true);
    try {
      await downloadAllEmojis(emojis, 'emoji_pack', {
        standardize: standardizeSize,
        size: DEFAULT_STANDARD_SIZE,
      });
    } finally {
      setIsDownloading(false);
    }
  }, [emojis, isDownloading, standardizeSize]);

  // 加载状态
  if (isLoading) {
    return (
      <div className="space-y-3">
        <h3 className="text-sm font-medium text-white/90">
          提取的表情
        </h3>
        <div className="flex items-center justify-center p-8 bg-white/[0.03] border border-white/[0.08] rounded-lg">
          <div className="flex flex-col items-center space-y-3">
            <div className="w-8 h-8 border-2 border-white/20 border-t-[#646cff] rounded-full animate-spin"></div>
            <p className="text-sm text-white/50">
              正在分割表情包...
            </p>
          </div>
        </div>
      </div>
    );
  }

  // 错误状态
  if (error) {
    return (
      <div className="space-y-3">
        <h3 className="text-sm font-medium text-white/90">
          提取的表情
        </h3>
        <div className="flex flex-col items-center justify-center p-8 bg-rose-500/10 border border-rose-500/20 rounded-lg">
          <svg
            className="h-8 w-8 text-rose-400 mb-2"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
            />
          </svg>
          <p className="text-sm text-rose-400 text-center mb-3">
            {error}
          </p>
          {onRetry && (
            <button
              onClick={onRetry}
              className="px-4 py-2 text-sm font-medium text-white bg-rose-500 rounded-lg hover:bg-rose-400 transition-colors"
            >
              重试
            </button>
          )}
        </div>
      </div>
    );
  }

  // 空状态
  if (emojis.length === 0) {
    return (
      <div className="space-y-3">
        <h3 className="text-sm font-medium text-white/90">
          提取的表情
        </h3>
        <div className="flex items-center justify-center p-8 bg-white/[0.03] border border-white/[0.08] rounded-lg">
          <p className="text-sm text-white/40">
            暂无提取的表情
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-medium text-white/90">
          提取的表情
        </h3>
        <span className="text-xs text-white/40">
          共 {emojis.length} 个
        </span>
      </div>

      {/* 下载选项 */}
      <div className="flex flex-wrap items-center justify-between gap-2 p-3 bg-white/[0.03] border border-white/[0.08] rounded-lg">
        <label className="flex items-center gap-2 cursor-pointer">
          <input
            type="checkbox"
            checked={standardizeSize}
            onChange={(e) => setStandardizeSize(e.target.checked)}
            className="w-4 h-4 rounded accent-[#646cff]"
          />
          <span className="text-xs text-white/60">
            标准化尺寸 ({DEFAULT_STANDARD_SIZE}×{DEFAULT_STANDARD_SIZE})
          </span>
        </label>
        
        {/* 批量下载按钮 */}
        <button
          onClick={handleBatchDownload}
          disabled={isDownloading || emojis.length === 0}
          className="flex items-center px-3 py-1.5 text-xs font-medium text-white
                     bg-[#646cff] hover:bg-[#747bff] rounded-md
                     disabled:opacity-50 disabled:cursor-not-allowed
                     transition-colors"
          title="下载全部表情"
        >
          {isDownloading ? (
            <>
              <div className="w-3 h-3 border-2 border-white/30 border-t-white rounded-full animate-spin mr-1.5"></div>
              打包中...
            </>
          ) : (
            <>
              <svg className="w-3.5 h-3.5 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
              </svg>
              下载全部
            </>
          )}
        </button>
      </div>

      {/* 表情网格 */}
      <div className="grid grid-cols-2 xs:grid-cols-3 sm:grid-cols-4 lg:grid-cols-3 xl:grid-cols-4 gap-2 sm:gap-3">
        {emojis.map((emoji, index) => (
          <button
            key={emoji.id}
            onClick={() => handleSelect(emoji.id)}
            style={{ animationDelay: `${index * 50}ms` }}
            className={`
              relative aspect-square rounded-lg overflow-hidden stagger-item group cursor-pointer
              bg-[#1a1a1a] border transition-all duration-200
              focus:outline-none focus:ring-2 focus:ring-[#646cff]
              ${selectedId === emoji.id
                ? 'border-[#646cff] ring-2 ring-[#646cff]/50 scale-[1.02]'
                : 'border-white/[0.08] hover:border-white/[0.15] hover:scale-[1.02]'
              }
            `}
            aria-label={`选择表情 ${index + 1}`}
            aria-pressed={selectedId === emoji.id}
          >
            <img
              src={emoji.preview}
              alt={`表情 ${index + 1}`}
              className="w-full h-full object-contain"
            />
            
            {/* 选中指示器 */}
            {selectedId === emoji.id && (
              <div className="absolute top-1 right-1 p-1 rounded-full bg-[#646cff] text-white">
                <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
                  <path
                    fillRule="evenodd"
                    d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
                    clipRule="evenodd"
                  />
                </svg>
              </div>
            )}

            {/* 删除按钮 */}
            {onDelete && (
              <button
                onClick={(e) => handleDelete(e, emoji.id)}
                className="absolute top-1 left-1 p-1 rounded-full bg-rose-500/80 text-white 
                           opacity-0 group-hover:opacity-100 hover:bg-rose-500
                           transition-opacity duration-150"
                aria-label={`删除表情 ${index + 1}`}
              >
                <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            )}

            {/* 序号标签 */}
            <div className="absolute bottom-1 left-1 px-1.5 py-0.5 text-xs font-medium bg-black/60 text-white/80 rounded">
              {index + 1}
            </div>
          </button>
        ))}
      </div>

      {/* 提示信息 */}
      <p className="text-xs text-white/40 text-center">
        点击表情可选中进行编辑
      </p>
    </div>
  );
}
