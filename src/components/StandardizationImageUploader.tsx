/**
 * 微信表情标准化图片上传组件
 * 
 * 功能：
 * - 拖拽上传区域
 * - 点击上传功能
 * - 图片预览列表
 * - 删除功能
 * - 数量限制提示
 * 
 * Requirements: 1.1-1.7
 */

import { useCallback, useRef, useState } from 'react';
import type { StandardizationImageUploaderProps } from '../types/wechatStandardization';
import { SUPPORTED_IMAGE_FORMATS, UPLOAD_LIMITS } from '../services/wechatConstants';
import { validateImageFormat } from '../services/wechatFileService';

/**
 * 微信表情标准化图片上传组件
 * 
 * @param images - 已上传的图片列表
 * @param onUpload - 上传回调
 * @param onDelete - 删除回调
 * @param maxCount - 最大上传数量，默认 20
 * @param disabled - 是否禁用
 */
export function StandardizationImageUploader({
  images,
  onUpload,
  onDelete,
  maxCount = UPLOAD_LIMITS.MAX_IMAGE_COUNT,
  disabled = false,
}: StandardizationImageUploaderProps) {
  const [isDragging, setIsDragging] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const remainingSlots = maxCount - images.length;
  const isAtLimit = remainingSlots <= 0;

  /**
   * 处理文件上传
   * 验证文件格式并过滤无效文件
   */
  const handleFiles = useCallback(
    (files: FileList | File[]) => {
      setError(null);
      const fileArray = Array.from(files);

      if (fileArray.length === 0) {
        return;
      }

      // 检查是否已达到上传限制
      if (isAtLimit) {
        setError(`已达到最大上传数量限制 (${maxCount} 张)`);
        return;
      }

      // 验证并过滤文件
      const validFiles: File[] = [];
      const invalidFiles: string[] = [];

      for (const file of fileArray) {
        const validation = validateImageFormat(file);
        if (validation.valid) {
          validFiles.push(file);
        } else {
          invalidFiles.push(file.name);
        }
      }

      // 限制上传数量
      const filesToUpload = validFiles.slice(0, remainingSlots);
      const skippedCount = validFiles.length - filesToUpload.length;

      // 构建错误消息
      const errorMessages: string[] = [];
      
      if (invalidFiles.length > 0) {
        errorMessages.push(
          `${invalidFiles.length} 个文件格式不支持: ${invalidFiles.slice(0, 3).join(', ')}${invalidFiles.length > 3 ? '...' : ''}`
        );
      }
      
      if (skippedCount > 0) {
        errorMessages.push(
          `${skippedCount} 个文件因超出数量限制被跳过`
        );
      }

      if (errorMessages.length > 0) {
        setError(errorMessages.join('；'));
      }

      if (filesToUpload.length > 0) {
        onUpload(filesToUpload);
      }
    },
    [isAtLimit, maxCount, remainingSlots, onUpload]
  );

  // 拖拽事件处理
  const handleDragEnter = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (!disabled && !isAtLimit) {
      setIsDragging(true);
    }
  }, [disabled, isAtLimit]);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
  }, []);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
  }, []);

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      e.stopPropagation();
      setIsDragging(false);

      if (disabled || isAtLimit) {
        return;
      }

      const { files } = e.dataTransfer;
      if (files && files.length > 0) {
        handleFiles(files);
      }
    },
    [disabled, isAtLimit, handleFiles]
  );

  // 点击选择文件
  const handleClick = () => {
    if (!disabled && !isAtLimit) {
      fileInputRef.current?.click();
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { files } = e.target;
    if (files && files.length > 0) {
      handleFiles(files);
    }
    // 重置 input 以允许重复选择同一文件
    e.target.value = '';
  };

  // 清除错误
  const clearError = () => {
    setError(null);
  };

  return (
    <div className="space-y-4">
      {/* 标题和计数 */}
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-medium text-white/70">
          素材图片
        </h3>
        <span className={`text-xs ${isAtLimit ? 'text-amber-400' : 'text-white/40'}`}>
          {images.length} / {maxCount}
        </span>
      </div>

      {/* 拖拽上传区域 */}
      <div
        onDragEnter={handleDragEnter}
        onDragLeave={handleDragLeave}
        onDragOver={handleDragOver}
        onDrop={handleDrop}
        onClick={handleClick}
        className={`
          relative border-2 border-dashed rounded-lg text-center cursor-pointer
          transition-all duration-200 p-6
          ${isDragging
            ? 'border-[#646cff] bg-[#646cff]/10 scale-[1.02]'
            : 'border-white/[0.12] hover:border-white/[0.2] hover:bg-white/[0.02]'
          }
          ${(disabled || isAtLimit) ? 'opacity-50 cursor-not-allowed' : ''}
        `}
        role="button"
        tabIndex={disabled || isAtLimit ? -1 : 0}
        aria-label="上传图片"
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            handleClick();
          }
        }}
      >
        <input
          ref={fileInputRef}
          type="file"
          accept={SUPPORTED_IMAGE_FORMATS.ACCEPT}
          multiple
          onChange={handleFileChange}
          className="hidden"
          disabled={disabled || isAtLimit}
          aria-hidden="true"
        />

        <div className="space-y-2">
          {/* 上传图标 */}
          <svg
            className="mx-auto h-10 w-10 text-white/30"
            stroke="currentColor"
            fill="none"
            viewBox="0 0 48 48"
            aria-hidden="true"
          >
            <path
              d="M28 8H12a4 4 0 00-4 4v20m32-12v8m0 0v8a4 4 0 01-4 4H12a4 4 0 01-4-4v-4m32-4l-3.172-3.172a4 4 0 00-5.656 0L28 28M8 32l9.172-9.172a4 4 0 015.656 0L28 28m0 0l4 4m4-24h8m-4-4v8m-12 4h.02"
              strokeWidth={2}
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>

          {/* 提示文字 */}
          <div>
            <p className="text-sm text-white/60">
              {isAtLimit
                ? '已达到最大数量限制'
                : isDragging
                  ? '释放以上传图片'
                  : '拖拽图片到此处，或点击选择'}
            </p>
            <p className="text-xs text-white/30 mt-1">
              支持 PNG, JPG, JPEG, WebP，最多 {maxCount} 张
            </p>
          </div>
        </div>
      </div>

      {/* 错误提示 */}
      {error && (
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
          <p className="text-sm text-rose-400 flex-1">{error}</p>
          <button
            onClick={(e) => {
              e.stopPropagation();
              clearError();
            }}
            className="text-rose-400 hover:text-rose-300 transition-colors"
            aria-label="关闭错误提示"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
      )}

      {/* 图片预览网格 */}
      {images.length > 0 && (
        <div className="grid grid-cols-4 sm:grid-cols-5 md:grid-cols-6 gap-2">
          {images.map((image, index) => (
            <div
              key={image.id}
              className="relative group aspect-square rounded-lg overflow-hidden bg-[#1a1a1a] border border-white/[0.08] stagger-item"
              style={{ animationDelay: `${Math.min(index * 30, 300)}ms` }}
            >
              <img
                src={image.preview}
                alt={`素材图片 ${index + 1}`}
                className="w-full h-full object-cover"
                loading="lazy"
              />
              
              {/* 悬停遮罩 */}
              <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity duration-200" />
              
              {/* 删除按钮 */}
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  onDelete(image.id);
                }}
                className="
                  absolute top-1 right-1 p-1.5 rounded-full
                  bg-rose-500/90 text-white opacity-0 group-hover:opacity-100
                  transition-all duration-200 transform scale-90 group-hover:scale-100
                  hover:bg-rose-500 focus:opacity-100 focus:outline-none
                  focus:ring-2 focus:ring-rose-400 focus:ring-offset-1 focus:ring-offset-transparent
                "
                aria-label={`删除图片 ${index + 1}`}
                disabled={disabled}
              >
                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>

              {/* 序号标签 */}
              <span className="absolute bottom-1 left-1 px-1.5 py-0.5 text-[10px] font-medium text-white/80 bg-black/50 rounded">
                {index + 1}
              </span>
            </div>
          ))}
        </div>
      )}

      {/* 数量限制提示 */}
      {isAtLimit && images.length > 0 && (
        <p className="text-xs text-amber-400/80 text-center">
          已达到最大上传数量 ({maxCount} 张)，请删除部分图片后再上传
        </p>
      )}

      {/* 空状态提示 */}
      {images.length === 0 && !error && (
        <p className="text-xs text-white/30 text-center">
          上传表情包素材图片，系统将基于这些素材生成微信表情平台所需的标准图片
        </p>
      )}
    </div>
  );
}

export default StandardizationImageUploader;
