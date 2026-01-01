/**
 * AI 图像分割相关类型定义
 */

import type { BoundingBox } from './image';

/**
 * 多边形顶点
 */
export interface Point {
  x: number;
  y: number;
}

/**
 * 多边形轮廓
 */
export interface Polygon {
  /** 顶点数组，按顺时针或逆时针顺序 */
  vertices: Point[];
}

/**
 * 分割区域（支持矩形和多边形）
 */
export interface SegmentationRegion {
  /** 区域 ID */
  id: string;
  /** 区域类型 */
  type: 'rectangle' | 'polygon';
  /** 矩形边界框（始终存在，用于快速定位） */
  boundingBox: BoundingBox;
  /** 多边形轮廓（仅当 type 为 polygon 时存在） */
  polygon?: Polygon;
  /** AI 识别的置信度 (0-1) */
  confidence?: number;
  /** AI 识别的标签（如 "emoji", "sticker", "text"） */
  label?: string;
}

/**
 * AI 分割结果
 */
export interface SegmentationResult {
  /** 是否成功 */
  success: boolean;
  /** 识别到的区域列表 */
  regions: SegmentationRegion[];
  /** 使用的检测方法 */
  method: 'ai' | 'fallback';
  /** 错误信息（如果失败） */
  error?: string;
  /** 原始 AI 响应（用于调试） */
  rawResponse?: string;
}

/**
 * AI 分割配置
 */
export interface AISegmentationConfig {
  /** 是否启用 AI 分割 */
  enabled: boolean;
  /** 超时时间（毫秒） */
  timeout: number;
  /** 最大图片大小（字节），超过则压缩 */
  maxImageSize: number;
  /** 是否返回多边形轮廓（否则只返回矩形） */
  usePolygon: boolean;
}

/**
 * 手动切割算法配置
 */
export interface ManualSplitConfig {
  /** 颜色容差 (0-255)，用于判断像素是否为背景色 */
  tolerance: number;
  /** 最小区域面积（像素数），过滤噪点 */
  minArea: number;
  /** 最小边界框尺寸（像素），过滤太小的区域 */
  minSize: number;
  /** 合并距离百分比 (0-10)，相邻区域合并阈值，基于图片短边的百分比 */
  mergeDistancePercent: number;
}
