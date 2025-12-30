/**
 * Skeleton - 骨架屏加载组件
 * 
 * 用于在内容加载时显示占位符动画
 */

import { memo } from 'react';

interface SkeletonProps {
  /** 宽度 */
  width?: string | number;
  /** 高度 */
  height?: string | number;
  /** 圆角 */
  rounded?: 'none' | 'sm' | 'md' | 'lg' | 'full';
  /** 自定义类名 */
  className?: string;
  /** 是否显示动画 */
  animate?: boolean;
}

const roundedClasses = {
  none: 'rounded-none',
  sm: 'rounded-sm',
  md: 'rounded-md',
  lg: 'rounded-lg',
  full: 'rounded-full',
};

export const Skeleton = memo(function Skeleton({
  width,
  height,
  rounded = 'md',
  className = '',
  animate = true,
}: SkeletonProps) {
  const style: React.CSSProperties = {
    width: typeof width === 'number' ? `${width}px` : width,
    height: typeof height === 'number' ? `${height}px` : height,
  };

  return (
    <div
      className={`
        bg-gray-200 dark:bg-gray-700
        ${roundedClasses[rounded]}
        ${animate ? 'animate-pulse' : ''}
        ${className}
      `}
      style={style}
      aria-hidden="true"
    />
  );
});

/**
 * SkeletonText - 文本骨架屏
 */
interface SkeletonTextProps {
  /** 行数 */
  lines?: number;
  /** 最后一行宽度百分比 */
  lastLineWidth?: number;
  /** 自定义类名 */
  className?: string;
}

export const SkeletonText = memo(function SkeletonText({
  lines = 3,
  lastLineWidth = 60,
  className = '',
}: SkeletonTextProps) {
  return (
    <div className={`space-y-2 ${className}`}>
      {Array.from({ length: lines }).map((_, index) => (
        <Skeleton
          key={index}
          height={16}
          width={index === lines - 1 ? `${lastLineWidth}%` : '100%'}
          rounded="sm"
        />
      ))}
    </div>
  );
});

/**
 * SkeletonCard - 卡片骨架屏
 */
interface SkeletonCardProps {
  /** 是否显示图片占位 */
  showImage?: boolean;
  /** 图片高度 */
  imageHeight?: number;
  /** 自定义类名 */
  className?: string;
}

export const SkeletonCard = memo(function SkeletonCard({
  showImage = true,
  imageHeight = 160,
  className = '',
}: SkeletonCardProps) {
  return (
    <div
      className={`
        bg-white dark:bg-gray-800 rounded-lg shadow-md p-4 space-y-4
        ${className}
      `}
    >
      {showImage && (
        <Skeleton height={imageHeight} width="100%" rounded="md" />
      )}
      <SkeletonText lines={2} lastLineWidth={75} />
    </div>
  );
});

/**
 * SkeletonGrid - 网格骨架屏
 */
interface SkeletonGridProps {
  /** 项目数量 */
  count?: number;
  /** 列数 */
  columns?: number;
  /** 项目高度 */
  itemHeight?: number;
  /** 自定义类名 */
  className?: string;
}

export const SkeletonGrid = memo(function SkeletonGrid({
  count = 6,
  columns = 3,
  itemHeight = 80,
  className = '',
}: SkeletonGridProps) {
  return (
    <div
      className={`grid gap-3 ${className}`}
      style={{ gridTemplateColumns: `repeat(${columns}, 1fr)` }}
    >
      {Array.from({ length: count }).map((_, index) => (
        <Skeleton
          key={index}
          height={itemHeight}
          width="100%"
          rounded="lg"
        />
      ))}
    </div>
  );
});

/**
 * SkeletonConfigPanel - 配置面板骨架屏
 */
export const SkeletonConfigPanel = memo(function SkeletonConfigPanel() {
  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md p-6 space-y-4">
      <Skeleton height={24} width={100} rounded="sm" />
      
      {/* API Key */}
      <div className="space-y-2">
        <Skeleton height={16} width={60} rounded="sm" />
        <Skeleton height={40} width="100%" rounded="md" />
      </div>
      
      {/* Base URL */}
      <div className="space-y-2">
        <Skeleton height={16} width={80} rounded="sm" />
        <Skeleton height={40} width="100%" rounded="md" />
      </div>
      
      {/* API Style */}
      <div className="space-y-2">
        <Skeleton height={16} width={60} rounded="sm" />
        <div className="flex gap-4">
          <Skeleton height={20} width={80} rounded="sm" />
          <Skeleton height={20} width={80} rounded="sm" />
        </div>
      </div>
      
      {/* Model */}
      <div className="space-y-2">
        <Skeleton height={16} width={40} rounded="sm" />
        <Skeleton height={40} width="100%" rounded="md" />
      </div>
    </div>
  );
});

/**
 * SkeletonUploadPanel - 上传面板骨架屏
 */
export const SkeletonUploadPanel = memo(function SkeletonUploadPanel() {
  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md p-6 space-y-4">
      <Skeleton height={24} width={80} rounded="sm" />
      
      {/* Upload area */}
      <Skeleton height={100} width="100%" rounded="lg" />
      
      {/* Image grid */}
      <SkeletonGrid count={3} columns={3} itemHeight={60} />
    </div>
  );
});
