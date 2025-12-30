/**
 * EmojiEditor - 表情编辑器组件
 * 
 * 功能：
 * - 显示选中的表情大图
 * - 编辑提示词输入框
 * - 重新生成按钮
 * - 下载单个表情
 * 
 * Requirements: 7.1, 7.2, 7.3, 7.4, 7.5
 */

import { useCallback, useState } from 'react';
import type { ExtractedEmoji } from '../types/image';
import { useAppStore } from '../store/useAppStore';
import { regenerateEmoji, downloadSingleEmoji } from '../services';

interface EmojiEditorProps {
  /** 选中的表情 */
  emoji: ExtractedEmoji;
  /** 表情索引（用于下载文件名） */
  emojiIndex: number;
  /** 关闭编辑器回调 */
  onClose: () => void;
}

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
  } = useAppStore();

  const [error, setError] = useState<string | null>(null);

  // 处理重新生成
  const handleRegenerate = useCallback(async () => {
    if (!editPrompt.trim() || isRegenerating) return;

    setError(null);
    setIsRegenerating(true);

    try {
      const result = await regenerateEmoji({
        apiConfig,
        languagePreference,
        editPrompt,
        materialImages,
        referenceImages,
      });

      if (result.success && result.emoji) {
        replaceEmoji(emoji.id, result.emoji);
        setEditPrompt('');
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
    emoji.id,
    setIsRegenerating,
    replaceEmoji,
    setEditPrompt,
  ]);

  // 处理下载
  const handleDownload = useCallback(async () => {
    await downloadSingleEmoji(emoji, emojiIndex);
  }, [emoji, emojiIndex]);

  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md p-6">
      {/* 头部 */}
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
          编辑表情
        </h2>
        <button
          onClick={onClose}
          className="p-1 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition-colors"
          aria-label="关闭编辑器"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>

      {/* 表情预览 */}
      <div className="mb-4">
        <div
          className="relative mx-auto w-32 h-32 sm:w-48 sm:h-48 rounded-lg overflow-hidden
            bg-[url('data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMjAiIGhlaWdodD0iMjAiIHhtbG5zPSJodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2ZyI+PGRlZnM+PHBhdHRlcm4gaWQ9ImdyaWQiIHdpZHRoPSIyMCIgaGVpZ2h0PSIyMCIgcGF0dGVyblVuaXRzPSJ1c2VyU3BhY2VPblVzZSI+PHJlY3Qgd2lkdGg9IjEwIiBoZWlnaHQ9IjEwIiBmaWxsPSIjZjBmMGYwIi8+PHJlY3QgeD0iMTAiIHk9IjEwIiB3aWR0aD0iMTAiIGhlaWdodD0iMTAiIGZpbGw9IiNmMGYwZjAiLz48L3BhdHRlcm4+PC9kZWZzPjxyZWN0IHdpZHRoPSIxMDAlIiBoZWlnaHQ9IjEwMCUiIGZpbGw9InVybCgjZ3JpZCkiLz48L3N2Zz4=')]
            border border-gray-200 dark:border-gray-700"
        >
          <img
            src={emoji.preview}
            alt="选中的表情"
            className="w-full h-full object-contain"
          />
        </div>
      </div>

      {/* 编辑提示词输入 */}
      <div className="mb-4">
        <label
          htmlFor="edit-prompt"
          className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2"
        >
          重新生成提示词
        </label>
        <textarea
          id="edit-prompt"
          value={editPrompt}
          onChange={(e) => setEditPrompt(e.target.value)}
          placeholder="输入新的提示词来重新生成这个表情..."
          rows={3}
          disabled={isRegenerating}
          className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 
                     rounded-md shadow-sm placeholder-gray-400
                     focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500
                     dark:bg-gray-700 dark:text-white
                     disabled:bg-gray-100 dark:disabled:bg-gray-800 disabled:cursor-not-allowed
                     resize-none"
        />
        <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
          提示：描述你想要的表情风格或内容变化
        </p>
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
            <p className="text-sm text-red-700 dark:text-red-300">{error}</p>
          </div>
        </div>
      )}

      {/* 操作按钮 */}
      <div className="space-y-3">
        {/* 重新生成按钮 */}
        {isRegenerating ? (
          <div className="space-y-2">
            <div className="flex items-center justify-center py-3">
              <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-blue-500"></div>
              <span className="ml-2 text-sm text-gray-600 dark:text-gray-400">
                正在重新生成...
              </span>
            </div>
          </div>
        ) : (
          <button
            onClick={handleRegenerate}
            disabled={!editPrompt.trim()}
            className={`w-full px-4 py-2 rounded-md font-medium transition-colors duration-150
              ${editPrompt.trim()
                ? 'bg-blue-500 hover:bg-blue-600 text-white'
                : 'bg-gray-300 dark:bg-gray-600 text-gray-500 dark:text-gray-400 cursor-not-allowed'
              }`}
          >
            重新生成
          </button>
        )}

        {/* 下载按钮 */}
        <button
          onClick={handleDownload}
          disabled={isRegenerating}
          className="w-full px-4 py-2 text-blue-600 dark:text-blue-400 
                     border border-blue-300 dark:border-blue-600 rounded-md
                     hover:bg-blue-50 dark:hover:bg-blue-900/20
                     disabled:opacity-50 disabled:cursor-not-allowed
                     transition-colors duration-150"
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
  );
}
