/**
 * 手动上传图片切割面板
 * 允许用户上传已有的图片进行切割，方便调试和处理
 */

import { useCallback, useRef, useState } from 'react';
import { extractAllEmojis } from '../services/imageSplitter';
import { validateUploadFiles } from '../services/imageValidation';
import { useAppStore } from '../store/useAppStore';

export function ManualSplitPanel() {
  const { setExtractedEmojis } = useAppStore();
  const [uploadedImage, setUploadedImage] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [isSplitting, setIsSplitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // 处理文件上传
  const handleFiles = useCallback((files: FileList | File[]) => {
    setError(null);
    const fileArray = Array.from(files);
    
    const result = validateUploadFiles(fileArray, 0, 1);
    
    if (result.error) {
      setError(result.error);
      return;
    }

    if (result.validFiles.length > 0) {
      const file = result.validFiles[0];
      setUploadedImage(file);
      
      // 创建预览
      const url = URL.createObjectURL(file);
      setPreviewUrl(url);
    }
  }, []);

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

  const handleClick = () => {
    fileInputRef.current?.click();
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { files } = e.target;
    if (files && files.length > 0) {
      handleFiles(files);
    }
    e.target.value = '';
  };

  // 清除上传的图片
  const handleClear = () => {
    if (previewUrl) {
      URL.revokeObjectURL(previewUrl);
    }
    setUploadedImage(null);
    setPreviewUrl(null);
    setError(null);
  };

  // 执行切割
  const handleSplit = useCallback(async () => {
    if (!uploadedImage) return;

    setIsSplitting(true);
    setError(null);

    try {
      const emojis = await extractAllEmojis(uploadedImage, {
        mode: 'auto',
        tryGridDetection: false,
        useAdvancedRemoval: false, // 使用简单背景移除
        tolerance: 30,
        minArea: 100,
        minSize: 10,
        debug: true,
      });

      if (emojis.length === 0) {
        setError('未能检测到表情包，请确保图片背景为纯色');
      } else {
        setExtractedEmojis(emojis);
        // 切割成功后清除上传的图片
        if (previewUrl) {
          URL.revokeObjectURL(previewUrl);
        }
        setUploadedImage(null);
        setPreviewUrl(null);
      }
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : '分割失败';
      setError(errorMessage);
    } finally {
      setIsSplitting(false);
    }
  }, [uploadedImage, previewUrl, setExtractedEmojis]);

  return (
    <div className="card">
      <h2 className="section-title">
        <svg className="section-icon" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
        </svg>
        手动上传切割
      </h2>
      <p className="section-description text-sm text-gray-400 mb-3">
        上传已有的表情包图片进行切割，方便调试和处理
      </p>

      {/* 上传区域 */}
      {!uploadedImage ? (
        <div
          onDragEnter={handleDragEnter}
          onDragLeave={handleDragLeave}
          onDragOver={handleDragOver}
          onDrop={handleDrop}
          onClick={handleClick}
          className={`
            relative border-2 border-dashed rounded-lg p-8 text-center cursor-pointer
            transition-colors duration-200
            ${isDragging
              ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20'
              : 'border-gray-300 dark:border-gray-600 hover:border-blue-400 dark:hover:border-blue-500'
            }
          `}
        >
          <input
            ref={fileInputRef}
            type="file"
            accept=".png,.jpg,.jpeg,.webp"
            onChange={handleFileChange}
            className="hidden"
          />
          
          <div className="space-y-2">
            <svg
              className="mx-auto h-12 w-12 text-gray-400"
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
            <p className="text-sm text-gray-600 dark:text-gray-400">
              拖拽图片到此处，或点击选择
            </p>
            <p className="text-xs text-gray-400 dark:text-gray-500">
              支持 PNG, JPG, JPEG, WebP
            </p>
          </div>
        </div>
      ) : (
        <div className="space-y-4">
          {/* 图片预览 */}
          <div className="relative rounded-lg overflow-hidden bg-gray-100 dark:bg-gray-700">
            <img
              src={previewUrl!}
              alt="待切割的图片"
              className="w-full h-auto"
            />
            <button
              onClick={handleClear}
              className="
                absolute top-2 right-2 p-2 rounded-full
                bg-red-500 text-white
                hover:bg-red-600 focus:outline-none focus:ring-2 focus:ring-red-500
              "
              aria-label="清除图片"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>

          {/* 切割按钮 */}
          <button
            onClick={handleSplit}
            disabled={isSplitting}
            className={`
              w-full py-3 px-4 rounded-lg font-medium
              transition-all duration-200
              flex items-center justify-center gap-2
              ${isSplitting
                ? 'bg-gray-400 cursor-not-allowed'
                : 'bg-gradient-to-r from-blue-500 to-purple-600 hover:from-blue-600 hover:to-purple-700 text-white shadow-lg hover:shadow-xl'
              }
            `}
          >
            {isSplitting ? (
              <>
                <span className="spinner" />
                正在分割...
              </>
            ) : (
              <>
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 5a1 1 0 011-1h14a1 1 0 011 1v2a1 1 0 01-1 1H5a1 1 0 01-1-1V5zM4 13a1 1 0 011-1h6a1 1 0 011 1v6a1 1 0 01-1 1H5a1 1 0 01-1-1v-6zM16 13a1 1 0 011-1h2a1 1 0 011 1v6a1 1 0 01-1 1h-2a1 1 0 01-1-1v-6z" />
                </svg>
                开始切割
              </>
            )}
          </button>
        </div>
      )}

      {/* 错误提示 */}
      {error && (
        <div className="mt-4 p-3 rounded-lg bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800">
          <p className="text-sm text-red-600 dark:text-red-400">{error}</p>
        </div>
      )}
    </div>
  );
}
