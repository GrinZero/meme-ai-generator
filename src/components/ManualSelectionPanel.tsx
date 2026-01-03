/**
 * ManualSelectionPanel 主组件
 * 整合 SelectionCanvas、SelectionToolPanel、SelectionList，实现手动框选切割功能
 * 
 * Requirements:
 * - 1.1: 显示图片和交互式覆盖层
 * - 1.4: 图片加载时显示视觉引导
 * - 5.1, 5.5: 批量提取选区
 * - 10.1, 10.3: 将结果添加到 extractedEmojis store
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import { SelectionCanvas } from './SelectionCanvas';
import { SelectionToolPanel } from './SelectionToolPanel';
import { SelectionList } from './SelectionList';
import { useSelectionStore } from '../store/useSelectionStore';
import { useAppStore } from '../store/useAppStore';
import { extractFromSelection } from '../services/regionExtractor';
import { normalizeEmoji } from '../services/emojiNormalizer';
import type { SelectionRegion } from '../types/selection';
import type { ExtractedEmoji } from '../types/image';

/** 组件属性 */
export interface ManualSelectionPanelProps {
  /** 要处理的图片文件 */
  imageFile: File;
  /** 提取完成回调 */
  onExtractComplete?: (emojis: ExtractedEmoji[]) => void;
  /** 取消回调 */
  onCancel?: () => void;
}

/** 提取状态 */
interface ExtractionState {
  isExtracting: boolean;
  progress: number;
  successMessage: string | null;
  errorMessage: string | null;
}

/**
 * 从 File 加载 HTMLImageElement
 */
function loadImageFromFile(file: File): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    
    img.onload = () => {
      resolve(img);
    };
    
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error('Failed to load image'));
    };
    
    img.src = url;
  });
}

/**
 * 从 HTMLImageElement 获取 ImageData
 */
function getImageData(image: HTMLImageElement): ImageData {
  const canvas = document.createElement('canvas');
  canvas.width = image.width;
  canvas.height = image.height;
  
  const ctx = canvas.getContext('2d');
  if (!ctx) {
    throw new Error('Failed to get canvas context');
  }
  
  ctx.drawImage(image, 0, 0);
  return ctx.getImageData(0, 0, image.width, image.height);
}

/**
 * ManualSelectionPanel 组件
 */
export function ManualSelectionPanel({
  imageFile,
  onExtractComplete,
  onCancel,
}: ManualSelectionPanelProps) {
  // 图片状态
  const [image, setImage] = useState<HTMLImageElement | null>(null);
  const [imageData, setImageData] = useState<ImageData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  
  // 提取状态
  const [extractionState, setExtractionState] = useState<ExtractionState>({
    isExtracting: false,
    progress: 0,
    successMessage: null,
    errorMessage: null,
  });
  
  // 图片 URL 引用（用于清理）
  const imageUrlRef = useRef<string | null>(null);
  
  // Selection Store
  const {
    selections,
    activeSelectionId,
    mode,
    addSelection,
    removeSelection,
    updateSelection,
    setActiveSelection,
    setMode,
    undo,
    redo,
    clearAll,
    canUndo,
    canRedo,
    reset,
  } = useSelectionStore();
  
  // App Store - 用于添加提取的表情包
  const appendEmojis = useAppStore((state) => state.appendEmojis);

  // 加载图片
  useEffect(() => {
    let mounted = true;
    
    const loadImage = async () => {
      setIsLoading(true);
      setLoadError(null);
      
      try {
        const img = await loadImageFromFile(imageFile);
        
        if (!mounted) {
          // 组件已卸载，清理资源
          if (img.src) {
            URL.revokeObjectURL(img.src);
          }
          return;
        }
        
        // 保存 URL 引用以便清理
        imageUrlRef.current = img.src;
        
        // 获取 ImageData
        const data = getImageData(img);
        
        setImage(img);
        setImageData(data);
        setIsLoading(false);
      } catch (error) {
        if (mounted) {
          setLoadError(error instanceof Error ? error.message : '图片加载失败');
          setIsLoading(false);
        }
      }
    };
    
    loadImage();
    
    // 清理函数
    return () => {
      mounted = false;
      if (imageUrlRef.current) {
        URL.revokeObjectURL(imageUrlRef.current);
        imageUrlRef.current = null;
      }
    };
  }, [imageFile]);

  // 组件卸载时重置 selection store
  useEffect(() => {
    return () => {
      reset();
    };
  }, [reset]);

  // 处理选区变更
  const handleSelectionsChange = useCallback((newSelections: SelectionRegion[]) => {
    // 找出新增的选区
    const currentIds = new Set(selections.map(s => s.id));
    const newIds = new Set(newSelections.map(s => s.id));
    
    // 添加新选区
    for (const sel of newSelections) {
      if (!currentIds.has(sel.id)) {
        addSelection({
          type: sel.type,
          boundingBox: sel.boundingBox,
          polygon: sel.polygon,
          isSelected: sel.isSelected,
        });
      }
    }
    
    // 移除已删除的选区
    for (const sel of selections) {
      if (!newIds.has(sel.id)) {
        removeSelection(sel.id);
      }
    }
    
    // 更新已修改的选区
    for (const newSel of newSelections) {
      if (currentIds.has(newSel.id)) {
        const oldSel = selections.find(s => s.id === newSel.id);
        if (oldSel && JSON.stringify(oldSel) !== JSON.stringify(newSel)) {
          updateSelection(newSel.id, {
            boundingBox: newSel.boundingBox,
            polygon: newSel.polygon,
            isSelected: newSel.isSelected,
          });
        }
      }
    }
  }, [selections, addSelection, removeSelection, updateSelection]);

  // 处理删除选区
  const handleDeleteSelection = useCallback((id: string) => {
    removeSelection(id);
  }, [removeSelection]);

  // 清除消息
  const handleClearMessage = useCallback(() => {
    setExtractionState(prev => ({
      ...prev,
      successMessage: null,
      errorMessage: null,
    }));
  }, []);

  // 提取所有选区
  const handleExtract = useCallback(async () => {
    if (!imageData || selections.length === 0) return;
    
    setExtractionState({
      isExtracting: true,
      progress: 0,
      successMessage: null,
      errorMessage: null,
    });
    
    const extractedEmojis: ExtractedEmoji[] = [];
    const totalSelections = selections.length;
    let successCount = 0;
    let errorCount = 0;
    
    for (let i = 0; i < totalSelections; i++) {
      const selection = selections[i];
      
      try {
        // 提取选区
        const extractedData = extractFromSelection(imageData, selection, {
          removeBackground: true,
          backgroundTolerance: 30,
        });
        
        // 标准化为 240x240
        const emoji = await normalizeEmoji(extractedData, selection.boundingBox, {
          outputSize: 240,
          highQualityResize: true,
        });
        
        extractedEmojis.push(emoji);
        successCount++;
      } catch (error) {
        console.error(`[ManualSelectionPanel] Failed to extract selection ${selection.id}:`, error);
        errorCount++;
      }
      
      // 更新进度
      setExtractionState(prev => ({
        ...prev,
        progress: ((i + 1) / totalSelections) * 100,
      }));
    }
    
    // 添加到 app store
    if (extractedEmojis.length > 0) {
      appendEmojis(extractedEmojis);
    }
    
    // 设置结果消息
    let successMessage: string | null = null;
    let errorMessage: string | null = null;
    
    if (successCount > 0 && errorCount === 0) {
      successMessage = `成功提取 ${successCount} 个表情包`;
    } else if (successCount > 0 && errorCount > 0) {
      successMessage = `成功提取 ${successCount} 个表情包，${errorCount} 个失败`;
    } else if (errorCount > 0) {
      errorMessage = `提取失败：${errorCount} 个选区处理出错`;
    }
    
    setExtractionState({
      isExtracting: false,
      progress: 100,
      successMessage,
      errorMessage,
    });
    
    // 调用完成回调
    if (extractedEmojis.length > 0) {
      onExtractComplete?.(extractedEmojis);
    }
  }, [imageData, selections, appendEmojis, onExtractComplete]);

  // 渲染加载状态
  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-full min-h-[400px] bg-gray-50 dark:bg-gray-900 rounded-lg">
        <div className="text-center">
          <LoadingSpinner className="w-8 h-8 mx-auto mb-3 text-blue-500" />
          <p className="text-sm text-gray-500 dark:text-gray-400">正在加载图片...</p>
        </div>
      </div>
    );
  }

  // 渲染错误状态
  if (loadError || !image) {
    return (
      <div className="flex items-center justify-center h-full min-h-[400px] bg-gray-50 dark:bg-gray-900 rounded-lg">
        <div className="text-center">
          <ErrorIcon className="w-12 h-12 mx-auto mb-3 text-red-500" />
          <p className="text-sm text-red-600 dark:text-red-400 mb-4">
            {loadError || '图片加载失败'}
          </p>
          {onCancel && (
            <button
              onClick={onCancel}
              className="px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 bg-gray-100 dark:bg-gray-700 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors"
            >
              返回
            </button>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col lg:flex-row gap-4 h-full">
      {/* 左侧：画布区域 */}
      <div className="flex-1 min-w-0">
        <SelectionCanvas
          image={image}
          selections={selections}
          mode={mode}
          activeSelectionId={activeSelectionId}
          onSelectionsChange={handleSelectionsChange}
          onActiveSelectionChange={setActiveSelection}
          onModeChange={setMode}
          onUndo={undo}
          onDeleteSelection={handleDeleteSelection}
        />
      </div>
      
      {/* 右侧：工具面板和选区列表 */}
      <div className="w-full lg:w-72 flex flex-col gap-4">
        {/* 工具面板 */}
        <SelectionToolPanel
          mode={mode}
          selectionCount={selections.length}
          isExtracting={extractionState.isExtracting}
          canUndo={canUndo()}
          canRedo={canRedo()}
          onModeChange={setMode}
          onExtract={handleExtract}
          onClearAll={clearAll}
          onUndo={undo}
          onRedo={redo}
          extractionProgress={extractionState.progress}
          successMessage={extractionState.successMessage}
          errorMessage={extractionState.errorMessage}
          onClearMessage={handleClearMessage}
        />
        
        {/* 选区列表 */}
        <SelectionList
          selections={selections}
          activeSelectionId={activeSelectionId}
          image={image}
          onSelectionClick={setActiveSelection}
          onDelete={handleDeleteSelection}
        />
        
        {/* 取消按钮 */}
        {onCancel && (
          <button
            onClick={onCancel}
            disabled={extractionState.isExtracting}
            className="w-full py-2 px-4 text-sm font-medium text-gray-700 dark:text-gray-300 bg-gray-100 dark:bg-gray-700 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            取消
          </button>
        )}
      </div>
    </div>
  );
}

// SVG 图标组件
function LoadingSpinner({ className }: { className?: string }) {
  return (
    <svg
      className={`animate-spin ${className}`}
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

export default ManualSelectionPanel;
