/**
 * 图片上传组件
 * 支持拖拽上传、文件选择、图片预览和删除功能
 */

import { useCallback, useRef, useState } from 'react';
import type { UploadedImage, ImageType } from '../types/image';
import { validateUploadFiles, SUPPORTED_EXTENSIONS } from '../services/imageValidation';

interface ImageUploaderProps {
  type: ImageType;
  maxCount: number;
  images: UploadedImage[];
  onUpload: (files: File[]) => void;
  onRemove: (id: string) => void;
  title: string;
  /** 紧凑模式，减少内边距和间距 */
  compact?: boolean;
}

export function ImageUploader({
  type,
  maxCount,
  images,
  onUpload,
  onRemove,
  title,
  compact = false,
}: ImageUploaderProps) {
  const [isDragging, setIsDragging] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const remainingSlots = maxCount - images.length;

  // 处理文件上传
  const handleFiles = useCallback(
    (files: FileList | File[]) => {
      setError(null);
      const fileArray = Array.from(files);
      
      const result = validateUploadFiles(fileArray, images.length, maxCount);
      
      if (result.error) {
        setError(result.error);
      }

      if (result.validFiles.length > 0) {
        onUpload(result.validFiles);
      }
    },
    [images.length, maxCount, onUpload]
  );

  // 拖拽事件处理
  const handleDragEnter = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(true);
  }, []);

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

      const { files } = e.dataTransfer;
      if (files && files.length > 0) {
        handleFiles(files);
      }
    },
    [handleFiles]
  );

  // 点击选择文件
  const handleClick = () => {
    fileInputRef.current?.click();
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { files } = e.target;
    if (files && files.length > 0) {
      handleFiles(files);
    }
    // 重置 input 以允许重复选择同一文件
    e.target.value = '';
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-medium text-white/70">
          {title}
        </h3>
        <span className="text-xs text-white/40">
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
          transition-colors duration-200
          ${compact ? 'p-3' : 'p-4'}
          ${isDragging
            ? 'border-[#646cff] bg-[#646cff]/10'
            : 'border-white/[0.12] hover:border-white/[0.2] hover:bg-white/[0.02]'
          }
          ${remainingSlots <= 0 ? 'opacity-50 cursor-not-allowed' : ''}
        `}
      >
        <input
          ref={fileInputRef}
          type="file"
          accept={SUPPORTED_EXTENSIONS.join(',')}
          multiple
          onChange={handleFileChange}
          className="hidden"
          disabled={remainingSlots <= 0}
        />
        
        <div className="space-y-1">
          <svg
            className={`mx-auto text-white/30 ${compact ? 'h-6 w-6' : 'h-8 w-8'}`}
            stroke="currentColor"
            fill="none"
            viewBox="0 0 48 48"
          >
            <path
              d="M28 8H12a4 4 0 00-4 4v20m32-12v8m0 0v8a4 4 0 01-4 4H12a4 4 0 01-4-4v-4m32-4l-3.172-3.172a4 4 0 00-5.656 0L28 28M8 32l9.172-9.172a4 4 0 015.656 0L28 28m0 0l4 4m4-24h8m-4-4v8m-12 4h.02"
              strokeWidth={2}
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
          <p className={`text-white/60 ${compact ? 'text-xs' : 'text-sm'}`}>
            {remainingSlots > 0
              ? (compact ? '拖拽或点击上传' : '拖拽图片到此处，或点击选择')
              : '已达到最大数量限制'}
          </p>
          {!compact && (
            <p className="text-xs text-white/30">
              支持 PNG, JPG, JPEG, WebP
            </p>
          )}
        </div>
      </div>

      {/* 错误提示 */}
      {error && (
        <p className="text-sm text-rose-400" role="alert">
          {error}
        </p>
      )}

      {/* 图片预览网格 */}
      {images.length > 0 && (
        <div className="grid grid-cols-3 gap-2">
          {images.map((image) => (
            <div
              key={image.id}
              className="relative group aspect-square rounded-lg overflow-hidden bg-[#1a1a1a] border border-white/[0.08]"
            >
              <img
                src={image.preview}
                alt={`上传的${type === 'material' ? '素材' : '基准'}图`}
                className="w-full h-full object-cover"
              />
              {/* 删除按钮 */}
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  onRemove(image.id);
                }}
                className="
                  absolute top-1 right-1 p-1 rounded-full
                  bg-rose-500/80 text-white opacity-0 group-hover:opacity-100
                  transition-opacity duration-200
                  hover:bg-rose-500 focus:opacity-100 focus:outline-none
                "
                aria-label="删除图片"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
