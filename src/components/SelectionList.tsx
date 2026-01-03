/**
 * SelectionList 组件
 * 选区列表组件，显示所有选区的缩略图和操作
 * 
 * Requirements:
 * - 4.1: 显示所有创建的选区列表，带缩略图预览
 * - 4.2: 点击选区时高亮并聚焦该选区
 * - 4.3: 为每个选区提供删除按钮
 */

import { useCallback, useMemo } from 'react';
import type { SelectionRegion } from '../types/selection';

/** 组件属性 */
export interface SelectionListProps {
  /** 选区列表 */
  selections: SelectionRegion[];
  /** 活动选区 ID */
  activeSelectionId: string | null;
  /** 图片元素（用于生成缩略图） */
  image: HTMLImageElement | null;
  /** 选区点击回调 */
  onSelectionClick: (id: string) => void;
  /** 删除回调 */
  onDelete: (id: string) => void;
}

/** 缩略图尺寸 */
const THUMBNAIL_SIZE = 64;

/** 模块级缩略图缓存 */
const thumbnailCache = new Map<string, string>();

/**
 * 生成选区的缓存键
 */
function getCacheKey(selection: SelectionRegion): string {
  return `${selection.id}_${selection.boundingBox.x}_${selection.boundingBox.y}_${selection.boundingBox.width}_${selection.boundingBox.height}`;
}

/**
 * 生成选区缩略图
 * @param image 源图片
 * @param selection 选区
 * @returns 缩略图 data URL
 */
function generateThumbnail(
  image: HTMLImageElement,
  selection: SelectionRegion
): string {
  const { boundingBox } = selection;
  
  // 创建临时 canvas
  const canvas = document.createElement('canvas');
  const ctx = canvas.getContext('2d');
  if (!ctx) {
    return '';
  }

  // 设置缩略图尺寸
  canvas.width = THUMBNAIL_SIZE;
  canvas.height = THUMBNAIL_SIZE;

  // 计算缩放比例，保持宽高比
  const scale = Math.min(
    THUMBNAIL_SIZE / boundingBox.width,
    THUMBNAIL_SIZE / boundingBox.height
  );
  const scaledWidth = boundingBox.width * scale;
  const scaledHeight = boundingBox.height * scale;

  // 居中绘制
  const offsetX = (THUMBNAIL_SIZE - scaledWidth) / 2;
  const offsetY = (THUMBNAIL_SIZE - scaledHeight) / 2;

  // 填充透明背景（棋盘格）
  ctx.fillStyle = '#f0f0f0';
  ctx.fillRect(0, 0, THUMBNAIL_SIZE, THUMBNAIL_SIZE);
  
  // 绘制棋盘格背景
  const gridSize = 8;
  ctx.fillStyle = '#d0d0d0';
  for (let y = 0; y < THUMBNAIL_SIZE; y += gridSize) {
    for (let x = 0; x < THUMBNAIL_SIZE; x += gridSize) {
      if ((x / gridSize + y / gridSize) % 2 === 0) {
        ctx.fillRect(x, y, gridSize, gridSize);
      }
    }
  }

  // 绘制选区内容
  ctx.drawImage(
    image,
    boundingBox.x,
    boundingBox.y,
    boundingBox.width,
    boundingBox.height,
    offsetX,
    offsetY,
    scaledWidth,
    scaledHeight
  );

  // 如果是多边形选区，应用遮罩
  if (selection.type === 'polygon' && selection.polygon) {
    applyPolygonMask(ctx, selection, offsetX, offsetY, scale);
  }

  return canvas.toDataURL('image/png');
}

/**
 * 应用多边形遮罩到缩略图
 */
function applyPolygonMask(
  ctx: CanvasRenderingContext2D,
  selection: SelectionRegion,
  offsetX: number,
  offsetY: number,
  scale: number
): void {
  if (!selection.polygon) return;

  const { boundingBox, polygon } = selection;
  
  // 获取当前图像数据
  const imageData = ctx.getImageData(0, 0, THUMBNAIL_SIZE, THUMBNAIL_SIZE);
  const data = imageData.data;

  // 将多边形顶点转换为缩略图坐标
  const scaledVertices = polygon.vertices.map(v => ({
    x: (v.x - boundingBox.x) * scale + offsetX,
    y: (v.y - boundingBox.y) * scale + offsetY,
  }));

  // 遍历每个像素，检查是否在多边形内
  for (let y = 0; y < THUMBNAIL_SIZE; y++) {
    for (let x = 0; x < THUMBNAIL_SIZE; x++) {
      // 只处理绘制区域内的像素
      if (
        x >= offsetX &&
        x < offsetX + boundingBox.width * scale &&
        y >= offsetY &&
        y < offsetY + boundingBox.height * scale
      ) {
        if (!isPointInPolygon({ x, y }, scaledVertices)) {
          // 像素在多边形外，设置为透明
          const idx = (y * THUMBNAIL_SIZE + x) * 4;
          data[idx + 3] = 0; // alpha = 0
        }
      }
    }
  }

  ctx.putImageData(imageData, 0, 0);
}

/**
 * 点在多边形内判断（射线法）
 */
function isPointInPolygon(
  point: { x: number; y: number },
  vertices: { x: number; y: number }[]
): boolean {
  let inside = false;
  const n = vertices.length;

  for (let i = 0, j = n - 1; i < n; j = i++) {
    const xi = vertices[i].x;
    const yi = vertices[i].y;
    const xj = vertices[j].x;
    const yj = vertices[j].y;

    if (
      yi > point.y !== yj > point.y &&
      point.x < ((xj - xi) * (point.y - yi)) / (yj - yi) + xi
    ) {
      inside = !inside;
    }
  }

  return inside;
}

/**
 * SelectionList 组件
 */
export function SelectionList({
  selections,
  activeSelectionId,
  image,
  onSelectionClick,
  onDelete,
}: SelectionListProps) {
  // 使用 useMemo 计算缩略图
  const thumbnails = useMemo(() => {
    if (!image) return {};

    const result: Record<string, string> = {};

    for (const selection of selections) {
      const cacheKey = getCacheKey(selection);
      
      const cached = thumbnailCache.get(cacheKey);
      if (cached) {
        // 使用缓存
        result[selection.id] = cached;
      } else {
        // 生成新缩略图并缓存
        const thumbnail = generateThumbnail(image, selection);
        thumbnailCache.set(cacheKey, thumbnail);
        result[selection.id] = thumbnail;
      }
    }

    return result;
  }, [image, selections]);

  // 处理选区点击
  const handleSelectionClick = useCallback(
    (id: string) => {
      onSelectionClick(id);
    },
    [onSelectionClick]
  );

  // 处理删除点击
  const handleDeleteClick = useCallback(
    (e: React.MouseEvent, id: string) => {
      e.stopPropagation(); // 阻止冒泡到选区点击
      onDelete(id);
    },
    [onDelete]
  );

  // 格式化选区类型显示
  const formatSelectionType = (type: SelectionRegion['type']) => {
    return type === 'rectangle' ? '矩形' : '多边形';
  };

  // 格式化尺寸显示
  const formatSize = (selection: SelectionRegion) => {
    const { width, height } = selection.boundingBox;
    return `${Math.round(width)}×${Math.round(height)}`;
  };

  // 按创建时间排序（最新的在前）
  const sortedSelections = useMemo(() => {
    return [...selections].sort((a, b) => b.createdAt - a.createdAt);
  }, [selections]);

  if (selections.length === 0) {
    return (
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md p-4">
        <h3 className="text-sm font-semibold text-gray-900 dark:text-white mb-3">
          选区列表
        </h3>
        <div className="text-center py-8 text-gray-400 dark:text-gray-500">
          <EmptyIcon className="w-12 h-12 mx-auto mb-2 opacity-50" />
          <p className="text-sm">暂无选区</p>
          <p className="text-xs mt-1">在图片上绘制选区开始</p>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md p-4">
      <h3 className="text-sm font-semibold text-gray-900 dark:text-white mb-3">
        选区列表
      </h3>
      
      <div className="space-y-2 max-h-80 overflow-y-auto">
        {sortedSelections.map((selection, index) => {
          const isActive = selection.id === activeSelectionId;
          const thumbnail = thumbnails[selection.id];
          const displayIndex = selections.length - index;

          return (
            <SelectionItem
              key={selection.id}
              selection={selection}
              index={displayIndex}
              isActive={isActive}
              thumbnail={thumbnail}
              onClick={() => handleSelectionClick(selection.id)}
              onDelete={(e) => handleDeleteClick(e, selection.id)}
              formatType={formatSelectionType}
              formatSize={formatSize}
            />
          );
        })}
      </div>
    </div>
  );
}

/** 选区项组件属性 */
interface SelectionItemProps {
  selection: SelectionRegion;
  index: number;
  isActive: boolean;
  thumbnail: string | undefined;
  onClick: () => void;
  onDelete: (e: React.MouseEvent) => void;
  formatType: (type: SelectionRegion['type']) => string;
  formatSize: (selection: SelectionRegion) => string;
}

/** 选区项组件 */
function SelectionItem({
  selection,
  index,
  isActive,
  thumbnail,
  onClick,
  onDelete,
  formatType,
  formatSize,
}: SelectionItemProps) {
  return (
    <div
      onClick={onClick}
      className={`
        flex items-center gap-3 p-2 rounded-lg cursor-pointer
        transition-all duration-200
        ${isActive
          ? 'bg-blue-50 dark:bg-blue-900/30 border-2 border-blue-500'
          : 'bg-gray-50 dark:bg-gray-700/50 border-2 border-transparent hover:bg-gray-100 dark:hover:bg-gray-700'
        }
      `}
    >
      {/* 缩略图 */}
      <div
        className={`
          w-12 h-12 rounded-md overflow-hidden flex-shrink-0
          border ${isActive ? 'border-blue-400' : 'border-gray-200 dark:border-gray-600'}
        `}
      >
        {thumbnail ? (
          <img
            src={thumbnail}
            alt={`选区 ${index}`}
            className="w-full h-full object-contain"
          />
        ) : (
          <div className="w-full h-full bg-gray-200 dark:bg-gray-600 flex items-center justify-center">
            <LoadingSpinner className="w-4 h-4 text-gray-400" />
          </div>
        )}
      </div>

      {/* 选区信息 */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <span className={`
            text-sm font-medium
            ${isActive ? 'text-blue-700 dark:text-blue-300' : 'text-gray-900 dark:text-white'}
          `}>
            选区 {index}
          </span>
          <span className={`
            px-1.5 py-0.5 text-xs rounded
            ${selection.type === 'rectangle'
              ? 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400'
              : 'bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-400'
            }
          `}>
            {formatType(selection.type)}
          </span>
        </div>
        <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
          {formatSize(selection)}
        </p>
      </div>

      {/* 删除按钮 */}
      <button
        onClick={onDelete}
        className={`
          p-1.5 rounded-md transition-colors duration-200
          ${isActive
            ? 'text-blue-500 hover:bg-blue-100 dark:hover:bg-blue-900/50'
            : 'text-gray-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/30'
          }
        `}
        title="删除选区"
      >
        <DeleteIcon className="w-4 h-4" />
      </button>
    </div>
  );
}

// SVG 图标组件
function EmptyIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="1.5"
        d="M4 5a1 1 0 011-1h14a1 1 0 011 1v2a1 1 0 01-1 1H5a1 1 0 01-1-1V5zM4 13a1 1 0 011-1h6a1 1 0 011 1v6a1 1 0 01-1 1H5a1 1 0 01-1-1v-6zM16 13a1 1 0 011-1h2a1 1 0 011 1v6a1 1 0 01-1 1h-2a1 1 0 01-1-1v-6z"
      />
    </svg>
  );
}

function DeleteIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="2"
        d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
      />
    </svg>
  );
}

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

export default SelectionList;
