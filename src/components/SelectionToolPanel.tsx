/**
 * SelectionToolPanel 组件
 * 工具面板组件，提供模式切换和操作按钮
 * 
 * Requirements:
 * - 7.1: 显示模式切换按钮（矩形/多边形）
 * - 7.2: 视觉指示当前活动模式
 * - 7.3: 提供"提取全部"按钮
 * - 7.4: 提供"撤销"按钮
 * - 7.5: 无选区时禁用"提取全部"和"清空"按钮
 * - 7.6: 显示当前选区数量
 * - 9.3: 提取时显示加载指示器
 * - 9.4: 提取成功时显示成功消息
 * - 9.5: 错误时显示错误消息
 */

import { useCallback, useEffect } from 'react';
import type { SelectionMode } from '../types/selection';

/** 组件属性 */
export interface SelectionToolPanelProps {
  /** 当前模式 */
  mode: SelectionMode;
  /** 选区数量 */
  selectionCount: number;
  /** 是否正在提取 */
  isExtracting: boolean;
  /** 是否可以撤销 */
  canUndo: boolean;
  /** 是否可以重做 */
  canRedo?: boolean;
  /** 是否移除背景 */
  removeBackground?: boolean;
  /** 模式变更回调 */
  onModeChange: (mode: SelectionMode) => void;
  /** 提取回调 */
  onExtract: () => void;
  /** 清空回调 */
  onClearAll: () => void;
  /** 撤销回调 */
  onUndo: () => void;
  /** 重做回调 */
  onRedo?: () => void;
  /** 移除背景变更回调 */
  onRemoveBackgroundChange?: (value: boolean) => void;
  /** 提取进度 (0-100) */
  extractionProgress?: number;
  /** 成功消息 */
  successMessage?: string | null;
  /** 错误消息 */
  errorMessage?: string | null;
  /** 清除消息回调 */
  onClearMessage?: () => void;
}

/** 消息自动消失时间 (ms) */
const MESSAGE_AUTO_DISMISS_TIME = 5000;

/**
 * SelectionToolPanel 组件
 */
export function SelectionToolPanel({
  mode,
  selectionCount,
  isExtracting,
  canUndo,
  canRedo = false,
  removeBackground = true,
  onModeChange,
  onExtract,
  onClearAll,
  onUndo,
  onRedo,
  onRemoveBackgroundChange,
  extractionProgress,
  successMessage,
  errorMessage,
  onClearMessage,
}: SelectionToolPanelProps) {
  // 消息自动消失
  useEffect(() => {
    if (successMessage || errorMessage) {
      const timer = setTimeout(() => {
        onClearMessage?.();
      }, MESSAGE_AUTO_DISMISS_TIME);
      return () => clearTimeout(timer);
    }
  }, [successMessage, errorMessage, onClearMessage]);

  // 手动关闭消息
  const handleDismissMessage = useCallback(() => {
    onClearMessage?.();
  }, [onClearMessage]);

  // 当前显示的消息
  const currentMessage = successMessage
    ? { type: 'success' as const, text: successMessage }
    : errorMessage
      ? { type: 'error' as const, text: errorMessage }
      : null;

  // 按钮禁用状态
  const hasSelections = selectionCount > 0;
  const isExtractDisabled = !hasSelections || isExtracting;
  const isClearDisabled = !hasSelections || isExtracting;

  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md p-4 space-y-4">
      {/* 标题和选区计数 */}
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-gray-900 dark:text-white">
          选区工具
        </h3>
        <span className="px-2 py-1 text-xs font-medium rounded-full bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300">
          {selectionCount} 个选区
        </span>
      </div>

      {/* 模式切换按钮 */}
      <div className="space-y-2">
        <label className="block text-xs font-medium text-gray-500 dark:text-gray-400">
          绘制模式
        </label>
        <div className="flex gap-2">
          <ModeButton
            active={mode === 'rectangle'}
            onClick={() => onModeChange('rectangle')}
            disabled={isExtracting}
            icon={<RectangleIcon />}
            label="矩形"
            shortcut="R"
          />
          <ModeButton
            active={mode === 'polygon'}
            onClick={() => onModeChange('polygon')}
            disabled={isExtracting}
            icon={<PolygonIcon />}
            label="多边形"
            shortcut="P"
          />
        </div>
      </div>

      {/* 移除背景选项 */}
      {onRemoveBackgroundChange && (
        <div className="flex items-center justify-between">
          <label className="text-sm text-gray-700 dark:text-gray-300">
            自动移除背景
          </label>
          <button
            onClick={() => onRemoveBackgroundChange(!removeBackground)}
            disabled={isExtracting}
            className={`
              relative inline-flex h-6 w-11 items-center rounded-full transition-colors
              ${isExtracting ? 'cursor-not-allowed opacity-50' : 'cursor-pointer'}
              ${removeBackground ? 'bg-blue-500' : 'bg-gray-300 dark:bg-gray-600'}
            `}
          >
            <span
              className={`
                inline-block h-4 w-4 transform rounded-full bg-white transition-transform
                ${removeBackground ? 'translate-x-6' : 'translate-x-1'}
              `}
            />
          </button>
        </div>
      )}

      {/* 操作按钮 */}
      <div className="space-y-2">
        <label className="block text-xs font-medium text-gray-500 dark:text-gray-400">
          操作
        </label>
        
        {/* 提取按钮 */}
        <button
          onClick={onExtract}
          disabled={isExtractDisabled}
          className={`
            w-full py-2.5 px-4 rounded-lg font-medium text-sm
            transition-all duration-200
            flex items-center justify-center gap-2
            ${isExtractDisabled
              ? 'bg-gray-200 dark:bg-gray-700 text-gray-400 dark:text-gray-500 cursor-not-allowed'
              : 'bg-gradient-to-r from-blue-500 to-purple-600 hover:from-blue-600 hover:to-purple-700 text-white shadow-md hover:shadow-lg'
            }
          `}
        >
          {isExtracting ? (
            <>
              <LoadingSpinner />
              <span>
                提取中...
                {extractionProgress !== undefined && ` ${Math.round(extractionProgress)}%`}
              </span>
            </>
          ) : (
            <>
              <ExtractIcon />
              <span>提取全部</span>
            </>
          )}
        </button>

        {/* 提取进度条 */}
        {isExtracting && extractionProgress !== undefined && (
          <div className="w-full h-1.5 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
            <div
              className="h-full bg-gradient-to-r from-blue-500 to-purple-600 transition-all duration-300"
              style={{ width: `${extractionProgress}%` }}
            />
          </div>
        )}

        {/* 撤销/重做和清空按钮 */}
        <div className="flex gap-2">
          <button
            onClick={onUndo}
            disabled={!canUndo || isExtracting}
            className={`
              flex-1 py-2 px-3 rounded-lg text-sm font-medium
              transition-colors duration-200
              flex items-center justify-center gap-1.5
              ${!canUndo || isExtracting
                ? 'bg-gray-100 dark:bg-gray-700 text-gray-400 dark:text-gray-500 cursor-not-allowed'
                : 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600'
              }
            `}
            title="撤销 (Ctrl+Z)"
          >
            <UndoIcon />
            <span>撤销</span>
          </button>

          {onRedo && (
            <button
              onClick={onRedo}
              disabled={!canRedo || isExtracting}
              className={`
                flex-1 py-2 px-3 rounded-lg text-sm font-medium
                transition-colors duration-200
                flex items-center justify-center gap-1.5
                ${!canRedo || isExtracting
                  ? 'bg-gray-100 dark:bg-gray-700 text-gray-400 dark:text-gray-500 cursor-not-allowed'
                  : 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600'
                }
              `}
              title="重做 (Ctrl+Shift+Z)"
            >
              <RedoIcon />
              <span>重做</span>
            </button>
          )}

          <button
            onClick={onClearAll}
            disabled={isClearDisabled}
            className={`
              flex-1 py-2 px-3 rounded-lg text-sm font-medium
              transition-colors duration-200
              flex items-center justify-center gap-1.5
              ${isClearDisabled
                ? 'bg-gray-100 dark:bg-gray-700 text-gray-400 dark:text-gray-500 cursor-not-allowed'
                : 'bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 hover:bg-red-100 dark:hover:bg-red-900/30'
              }
            `}
            title="清空所有选区"
          >
            <ClearIcon />
            <span>清空</span>
          </button>
        </div>
      </div>

      {/* 消息显示区域 */}
      {currentMessage && (
        <MessageBanner
          type={currentMessage.type}
          message={currentMessage.text}
          onDismiss={handleDismissMessage}
        />
      )}

      {/* 快捷键提示 */}
      <div className="pt-2 border-t border-gray-200 dark:border-gray-700">
        <p className="text-xs text-gray-400 dark:text-gray-500">
          快捷键: R 矩形 | P 多边形 | Del 删除 | Ctrl+Z 撤销
        </p>
      </div>
    </div>
  );
}

/** 模式按钮组件 */
interface ModeButtonProps {
  active: boolean;
  onClick: () => void;
  disabled: boolean;
  icon: React.ReactNode;
  label: string;
  shortcut: string;
}

function ModeButton({ active, onClick, disabled, icon, label, shortcut }: ModeButtonProps) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className={`
        flex-1 py-2 px-3 rounded-lg text-sm font-medium
        transition-all duration-200
        flex items-center justify-center gap-2
        ${disabled
          ? 'bg-gray-100 dark:bg-gray-700 text-gray-400 dark:text-gray-500 cursor-not-allowed'
          : active
            ? 'bg-blue-500 text-white shadow-md'
            : 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600'
        }
      `}
    >
      {icon}
      <span>{label}</span>
      <span className={`text-xs ${active ? 'text-blue-200' : 'text-gray-400'}`}>
        ({shortcut})
      </span>
    </button>
  );
}

/** 消息横幅组件 */
interface MessageBannerProps {
  type: 'success' | 'error';
  message: string;
  onDismiss: () => void;
}

function MessageBanner({ type, message, onDismiss }: MessageBannerProps) {
  const isSuccess = type === 'success';
  
  return (
    <div
      className={`
        p-3 rounded-lg flex items-start gap-2
        ${isSuccess
          ? 'bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800'
          : 'bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800'
        }
      `}
    >
      {isSuccess ? (
        <SuccessIcon className="w-5 h-5 text-green-500 flex-shrink-0 mt-0.5" />
      ) : (
        <ErrorIcon className="w-5 h-5 text-red-500 flex-shrink-0 mt-0.5" />
      )}
      <p
        className={`
          flex-1 text-sm
          ${isSuccess ? 'text-green-700 dark:text-green-300' : 'text-red-700 dark:text-red-300'}
        `}
      >
        {message}
      </p>
      <button
        onClick={onDismiss}
        className={`
          p-1 rounded hover:bg-black/5 dark:hover:bg-white/5
          ${isSuccess ? 'text-green-500' : 'text-red-500'}
        `}
      >
        <CloseIcon className="w-4 h-4" />
      </button>
    </div>
  );
}

/** 加载动画组件 */
function LoadingSpinner() {
  return (
    <svg
      className="animate-spin h-4 w-4"
      xmlns="http://www.w3.org/2000/svg"
      fill="none"
      viewBox="0 0 24 24"
    >
      <circle
        className="opacity-25"
        cx="12"
        cy="12"
        r="10"
        stroke="currentColor"
        strokeWidth="4"
      />
      <path
        className="opacity-75"
        fill="currentColor"
        d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
      />
    </svg>
  );
}

// SVG 图标组件
function RectangleIcon() {
  return (
    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <rect x="3" y="3" width="18" height="18" rx="2" strokeWidth="2" />
    </svg>
  );
}

function PolygonIcon() {
  return (
    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="2"
        d="M12 2l8 6v8l-8 6-8-6V8l8-6z"
      />
    </svg>
  );
}

function ExtractIcon() {
  return (
    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="2"
        d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4"
      />
    </svg>
  );
}

function UndoIcon() {
  return (
    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="2"
        d="M3 10h10a5 5 0 015 5v2M3 10l4-4m-4 4l4 4"
      />
    </svg>
  );
}

function RedoIcon() {
  return (
    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="2"
        d="M21 10H11a5 5 0 00-5 5v2m15-7l-4-4m4 4l-4 4"
      />
    </svg>
  );
}

function ClearIcon() {
  return (
    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="2"
        d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
      />
    </svg>
  );
}

function SuccessIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="currentColor" viewBox="0 0 20 20">
      <path
        fillRule="evenodd"
        d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z"
        clipRule="evenodd"
      />
    </svg>
  );
}

function ErrorIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="currentColor" viewBox="0 0 20 20">
      <path
        fillRule="evenodd"
        d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z"
        clipRule="evenodd"
      />
    </svg>
  );
}

function CloseIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="2"
        d="M6 18L18 6M6 6l12 12"
      />
    </svg>
  );
}

export default SelectionToolPanel;
