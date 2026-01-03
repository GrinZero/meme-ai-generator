/**
 * 手动框选切割相关类型定义
 */

import type { BoundingBox } from './image';
import type { Point, Polygon } from './segmentation';

/**
 * 选区类型
 */
export type SelectionType = 'rectangle' | 'polygon';

/**
 * 选区绘制模式
 */
export type SelectionMode = 'rectangle' | 'polygon' | 'select';

/**
 * 选区区域
 */
export interface SelectionRegion {
  /** 唯一标识 */
  id: string;
  /** 选区类型 */
  type: SelectionType;
  /** 边界框（始终存在，用于快速定位和矩形选区） */
  boundingBox: BoundingBox;
  /** 多边形顶点（仅多边形类型） */
  polygon?: Polygon;
  /** 创建时间戳 */
  createdAt: number;
  /** 是否被选中 */
  isSelected?: boolean;
}

/**
 * 选区操作类型
 */
export type SelectionActionType = 'add' | 'remove' | 'modify' | 'clear';

/**
 * 选区操作历史记录
 */
export interface SelectionAction {
  /** 操作类型 */
  type: SelectionActionType;
  /** 操作前的选区状态（用于撤销） */
  previousState: SelectionRegion[];
  /** 操作后的选区状态 */
  newState: SelectionRegion[];
  /** 操作时间戳 */
  timestamp: number;
}

/**
 * 选区 Store 状态
 */
export interface SelectionState {
  /** 所有选区 */
  selections: SelectionRegion[];
  /** 当前活动选区 ID */
  activeSelectionId: string | null;
  /** 当前绘制模式 */
  mode: SelectionMode;
  /** 操作历史（用于撤销） */
  history: SelectionAction[];
  /** 历史指针 */
  historyIndex: number;
}

/**
 * 提取配置选项
 */
export interface ExtractionOptions {
  /** 是否移除背景 */
  removeBackground: boolean;
  /** 背景移除容差 */
  backgroundTolerance: number;
  /** 输出尺寸 */
  outputSize: number;
  /** 是否使用高质量缩放 */
  highQualityResize: boolean;
}

/**
 * 默认提取配置
 */
export const DEFAULT_EXTRACTION_OPTIONS: ExtractionOptions = {
  removeBackground: true,
  backgroundTolerance: 30,
  outputSize: 240,
  highQualityResize: true,
};

// Re-export types for convenience
export type { Point, Polygon, BoundingBox };
