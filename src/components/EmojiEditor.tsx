/**
 * EmojiEditor - 表情编辑器组件
 * 
 * 功能：
 * - 显示选中的表情大图
 * - 编辑提示词输入框
 * - 重新生成按钮
 * - 预览新生成的表情，让用户确认是否替换或追加
 * - 下载单个表情
 */

import { useCallback, useState } from 'react';
import type { ExtractedEmoji } from '../types/image';
import { useAppStore } from '../store/useAppStore';
import { regenerateEmoji, downloadSingleEmoji } from '../services';
import { DEFAULT_STANDARD_SIZE } from '../services/downloadService';

interface EmojiEditorProps {
  emoji: ExtractedEmoji;
  emojiIndex: number;
  onClose: () => void;
}

type ConfirmAction = 'replace' | 'append';

export function EmojiEditor({ emoji, emojiIndex, onClose }: EmojiEditorProps) {
  const {
    apiConfig,
    languagePreference,
    materialImages,
    referenceImages,
    editPrompt,
    isRegenerating,
    setEditPrompt,
    setIsRegenerating,
    replaceEmoji,
    appendEmojis,
  } = useAppStore();

  const [error, setError] = useState<string | null>(null);
  const [pendingEmoji, setPendingEmoji] = useState<ExtractedEmoji | null>(null);
  // 是否标准化尺寸（默认开启）
  const [standardizeSize, setStandardizeSize] = useState(true);

  // 处理重新生成
  const handleRegenerate = useCallback(async () => {
    if (!editPrompt.trim() || isRegenerating) return;

    setError(null);
    setIsRegenerating(true);
    setPendingEmoji(null);

    try {
      const result = await regenerateEmoji({
        apiConfig,
        languagePreference,
        editPrompt,
        materialImages,
        referenceImages,
        currentEmoji: emoji,
      });

      if (result.success && result.emoji) {
        // 不直接替换，而是显示预览让用户确认
        setPendingEmoji(result.emoji);
        setError(null);
      } else {
        setError(result.error || '重新生成失败，请重试');
      }
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : '发生未知错误';
      setError(errorMessage);
    } finally {
      setIsRegenerating(false);
    }
  }, [
    editPrompt,
    isRegenerating,
    apiConfig,
    languagePreference,
    materialImages,
    referenceImages,
    emoji,
    setIsRegenerating,
  ]);

  // 确认操作：替换或追加
  const handleConfirm = useCallback((action: ConfirmAction) => {
    if (pendingEmoji) {
      if (action === 'replace') {
        replaceEmoji(emoji.id, pendingEmoji);
      } else {
        appendEmojis([pendingEmoji]);
      }
      setPendingEmoji(null);
      setEditPrompt('');
    }
  }, [pendingEmoji, emoji.id, replaceEmoji, appendEmojis, setEditPrompt]);

  // 取消，保留原表情
  const handleCancelReplace = useCallback(() => {
    setPendingEmoji(null);
  }, []);

  // 处理下载
  const handleDownload = useCallback(async () => {
    await downloadSingleEmoji(emoji, emojiIndex, {
      standardize: standardizeSize,
      size: DEFAULT_STANDARD_SIZE,
    });
  }, [emoji, emojiIndex, standardizeSize]);

  // 显示的表情（有待确认的就显示待确认的）
  const displayEmoji = pendingEmoji || emoji;

  return (
    <div className="bg-[#0A0E1A]/80 backdrop-blur-xl rounded-xl border border-cyan-500/30 shadow-[0_0_30px_rgba(0,255,255,0.1)] p-6">
      {/* 头部 */}
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-lg font-semibold text-cyan-300 uppercase tracking-wider">
          {pendingEmoji ? '确认新表情' : '编辑表情'}
        </h2>
        <button
          onClick={onClose}
          className="p-1 text-slate-400 hover:text-cyan-300 transition-colors"
          aria-label="关闭编辑器"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>

      {/* 表情预览 */}
      <div className="mb-4">
        {pendingEmoji ? (
          // 对比显示：原图 vs 新图
          <div className="flex gap-4 justify-center">
            <div className="text-center">
              <p className="text-xs text-slate-500 mb-2">原表情</p>
              <div className="w-24 h-24 rounded-lg overflow-hidden bg-checkered border border-cyan-500/20">
                <img src={emoji.preview} alt="原表情" className="w-full h-full object-contain" />
              </div>
            </div>
            <div className="flex items-center text-cyan-500/50">
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7l5 5m0 0l-5 5m5-5H6" />
              </svg>
            </div>
            <div className="text-center">
              <p className="text-xs text-emerald-400 mb-2">新表情</p>
              <div className="w-24 h-24 rounded-lg overflow-hidden bg-checkered border-2 border-emerald-500 shadow-[0_0_15px_rgba(0,255,136,0.3)]">
                <img src={pendingEmoji.preview} alt="新表情" className="w-full h-full object-contain" />
              </div>
            </div>
          </div>
        ) : (
          <div
            className="relative mx-auto w-32 h-32 sm:w-48 sm:h-48 rounded-lg overflow-hidden
              bg-checkered border border-cyan-500/30"
          >
            <img src={displayEmoji.preview} alt="选中的表情" className="w-full h-full object-contain" />
          </div>
        )}
      </div>

      {/* 待确认状态的操作按钮 */}
      {pendingEmoji ? (
        <div className="space-y-3">
          <button
            onClick={() => handleConfirm('replace')}
            className="w-full px-4 py-2 rounded-md font-medium bg-gradient-to-r from-emerald-500 to-cyan-500 hover:from-emerald-400 hover:to-cyan-400 text-slate-900 transition-all flex items-center justify-center gap-2 shadow-[0_0_15px_rgba(0,255,136,0.3)]"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
            </svg>
            替换原表情
          </button>
          <button
            onClick={() => handleConfirm('append')}
            className="w-full px-4 py-2 rounded-md font-medium bg-gradient-to-r from-cyan-500 to-blue-500 hover:from-cyan-400 hover:to-blue-400 text-slate-900 transition-all flex items-center justify-center gap-2 shadow-[0_0_15px_rgba(0,255,255,0.3)]"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
            </svg>
            追加为新表情
          </button>
          <button
            onClick={handleCancelReplace}
            className="w-full px-4 py-2 rounded-md font-medium border border-cyan-500/30 
                       text-cyan-300 hover:bg-cyan-500/10 transition-all"
          >
            取消
          </button>
        </div>
      ) : (
        <>
          {/* 编辑提示词输入 */}
          <div className="mb-4">
            <label htmlFor="edit-prompt" className="block text-sm font-medium text-cyan-300 mb-2">
              重新生成提示词
            </label>
            <textarea
              id="edit-prompt"
              value={editPrompt}
              onChange={(e) => setEditPrompt(e.target.value)}
              placeholder="输入新的提示词来重新生成这个表情..."
              rows={3}
              disabled={isRegenerating}
              className="w-full px-3 py-2 border border-cyan-500/30 
                         rounded-md shadow-sm placeholder-slate-500
                         focus:outline-none focus:ring-2 focus:ring-cyan-500/50 focus:border-cyan-400
                         bg-[#0F1629]/80 text-cyan-50
                         disabled:bg-slate-800 disabled:cursor-not-allowed
                         resize-none transition-all"
            />
            <p className="mt-1 text-xs text-slate-500">
              提示：描述你想要的表情风格或内容变化
            </p>
          </div>

          {/* 错误提示 */}
          {error && (
            <div className="mb-4 p-3 bg-red-500/10 border border-red-500/30 rounded-md">
              <p className="text-sm text-red-400">{error}</p>
            </div>
          )}

          {/* 操作按钮 */}
          <div className="space-y-3">
            {isRegenerating ? (
              <div className="flex items-center justify-center py-3">
                <div className="w-5 h-5 border-2 border-cyan-500/30 border-t-cyan-400 rounded-full animate-spin"></div>
                <span className="ml-2 text-sm text-cyan-300">正在重新生成...</span>
              </div>
            ) : (
              <button
                onClick={handleRegenerate}
                disabled={!editPrompt.trim()}
                className={`w-full px-4 py-2 rounded-md font-medium transition-all duration-150
                  ${editPrompt.trim()
                    ? 'bg-gradient-to-r from-cyan-500 to-blue-500 hover:from-cyan-400 hover:to-blue-400 text-slate-900 shadow-[0_0_15px_rgba(0,255,255,0.3)]'
                    : 'bg-slate-800 text-slate-500 cursor-not-allowed border border-slate-700'
                  }`}
              >
                重新生成
              </button>
            )}

            {/* 下载选项 */}
            <div className="p-3 bg-[#0F1629]/60 border border-cyan-500/20 rounded-lg space-y-3">
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={standardizeSize}
                  onChange={(e) => setStandardizeSize(e.target.checked)}
                  className="w-4 h-4 text-cyan-500 rounded focus:ring-cyan-500 accent-cyan-500 bg-slate-800 border-cyan-500/30"
                />
                <span className="text-xs text-cyan-200">
                  标准化尺寸 ({DEFAULT_STANDARD_SIZE}×{DEFAULT_STANDARD_SIZE})
                </span>
              </label>
              
              <button
                onClick={handleDownload}
                disabled={isRegenerating}
                className="w-full px-4 py-2 text-cyan-400 
                           border border-cyan-500/30 rounded-md
                           hover:bg-cyan-500/10 hover:border-cyan-400/50
                           disabled:opacity-50 disabled:cursor-not-allowed
                           transition-all duration-150"
              >
                <span className="flex items-center justify-center">
                  <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                  </svg>
                  下载表情
                </span>
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
