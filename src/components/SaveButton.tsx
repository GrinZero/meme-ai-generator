/**
 * SaveButton - AI 生成大图保存按钮组件
 * 
 * Requirements:
 * - 1.1: WHEN AI 生成完成且有生成结果 THEN THE Save_Button SHALL 显示在生成结果预览区域
 * - 1.2: WHEN 用户点击保存按钮 THEN THE System SHALL 将生成的原始大图下载到本地
 * - 1.3: THE Save_Button SHALL 使用清晰的图标和文字标识"保存原图"
 * - 1.4: WHEN 下载时 THEN THE System SHALL 使用有意义的文件名（如 emoji_generated_时间戳.png）
 * - 1.5: IF 生成结果不存在 THEN THE Save_Button SHALL 不显示或禁用
 */

import { useCallback } from 'react';
import { triggerDownload } from '../services/downloadService';

export interface SaveButtonProps {
  /** 要保存的图片 Blob */
  imageBlob: Blob | null;
  /** 文件名前缀 */
  filenamePrefix?: string;
  /** 是否禁用 */
  disabled?: boolean;
}

// 生成带时间戳的文件名（内部使用）
const generateTimestampFilename = (prefix: string = 'emoji_generated'): string => {
  const timestamp = Date.now();
  return `${prefix}_${timestamp}.png`;
};

/**
 * SaveButton 组件
 * 用于保存 AI 生成的原始大图
 */
export function SaveButton({ 
  imageBlob, 
  filenamePrefix = 'emoji_generated',
  disabled = false 
}: SaveButtonProps) {
  const handleSave = useCallback(() => {
    if (!imageBlob) return;
    
    const filename = generateTimestampFilename(filenamePrefix);
    triggerDownload(imageBlob, filename);
  }, [imageBlob, filenamePrefix]);

  // 当 imageBlob 为 null 时不渲染
  if (!imageBlob) {
    return null;
  }

  return (
    <button
      onClick={handleSave}
      disabled={disabled}
      className={`
        inline-flex items-center gap-2 px-3 py-2 text-sm font-medium rounded-lg
        transition-all
        ${disabled
          ? 'bg-white/[0.05] text-white/30 cursor-not-allowed'
          : 'bg-[#646cff]/20 text-[#646cff] border border-[#646cff]/30 hover:bg-[#646cff]/30 hover:border-[#646cff]/50'
        }
      `}
      title="保存原图"
    >
      <svg 
        className="w-4 h-4" 
        fill="none" 
        stroke="currentColor" 
        viewBox="0 0 24 24"
      >
        <path 
          strokeLinecap="round" 
          strokeLinejoin="round" 
          strokeWidth={2} 
          d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" 
        />
      </svg>
      保存原图
    </button>
  );
}
