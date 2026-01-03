/**
 * 区域提取器
 * 负责从原图中提取选区内容，支持矩形和多边形选区
 * 
 * Requirements: 5.1, 5.2, 5.3, 5.4, 5.5
 */

import type { SelectionRegion, BoundingBox, Polygon } from '../types/selection';
import type { ExtractedEmoji } from '../types/image';
import {
  cropImage,
  imageDataToBlob,
  imageDataToPreviewUrl,
  detectBackgroundColor,
  removeBackgroundFloodFill,
} from './imageSplitter';
import { cropWithPolygon } from './polygonCropper';
import type { SegmentationRegion } from '../types/segmentation';

// 生成唯一 ID
const generateId = () => `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;

/**
 * 区域提取选项
 */
export interface RegionExtractionOptions {
  /** 是否移除背景 */
  removeBackground?: boolean;
  /** 背景移除容差 */
  backgroundTolerance?: number;
  /** 裁剪边距 */
  padding?: number;
}

const DEFAULT_EXTRACTION_OPTIONS: Required<RegionExtractionOptions> = {
  removeBackground: true,
  backgroundTolerance: 30,
  padding: 0,
};

/**
 * 提取矩形区域
 * 
 * @param imageData 原始图片数据
 * @param boundingBox 矩形边界框
 * @param options 提取选项
 * @returns 提取的图片数据
 * 
 * Requirements: 5.1
 */
export function extractRectangleRegion(
  imageData: ImageData,
  boundingBox: BoundingBox,
  options: RegionExtractionOptions = {}
): ImageData {
  const { padding } = { ...DEFAULT_EXTRACTION_OPTIONS, ...options };
  
  // 使用现有的 cropImage 函数裁剪矩形区域
  return cropImage(imageData, boundingBox, padding);
}

/**
 * 提取多边形区域
 * 使用多边形遮罩，多边形外部像素设为透明
 * 
 * @param imageData 原始图片数据
 * @param polygon 多边形
 * @param boundingBox 边界框
 * @param options 提取选项
 * @returns 提取的图片数据，多边形外部为透明
 * 
 * Requirements: 5.2
 */
export function extractPolygonRegion(
  imageData: ImageData,
  polygon: Polygon,
  boundingBox: BoundingBox,
  options: RegionExtractionOptions = {}
): ImageData {
  const { padding } = { ...DEFAULT_EXTRACTION_OPTIONS, ...options };
  
  // 构造 SegmentationRegion 以复用 cropWithPolygon
  const region: SegmentationRegion = {
    id: 'temp',
    type: 'polygon',
    boundingBox,
    polygon,
  };
  
  // 使用现有的 cropWithPolygon 函数提取多边形区域
  return cropWithPolygon(imageData, region, padding);
}

/**
 * 对提取的区域进行背景移除
 * 使用 flood-fill 算法从边缘移除背景，保护主体内部的相似颜色
 * 
 * @param imageData 提取的图片数据
 * @param tolerance 背景移除容差
 * @returns 移除背景后的图片数据
 * 
 * Requirements: 5.3, 5.4
 */
export function removeRegionBackground(
  imageData: ImageData,
  tolerance: number = 30
): ImageData {
  // 检测背景色
  const backgroundColor = detectBackgroundColor(imageData, { tolerance });
  
  // 使用 flood-fill 从边缘移除背景
  return removeBackgroundFloodFill(imageData, backgroundColor, tolerance);
}

/**
 * 从选区提取内容
 * 完整流程：裁剪 -> 可选背景移除
 * 
 * @param imageData 原始图片数据
 * @param selection 选区
 * @param options 提取选项
 * @returns 提取的图片数据
 * 
 * Requirements: 5.1, 5.2, 5.3, 5.4
 */
export function extractFromSelection(
  imageData: ImageData,
  selection: SelectionRegion,
  options: RegionExtractionOptions = {}
): ImageData {
  const opts = { ...DEFAULT_EXTRACTION_OPTIONS, ...options };
  
  let extractedData: ImageData;
  
  // 根据选区类型提取
  if (selection.type === 'polygon' && selection.polygon) {
    extractedData = extractPolygonRegion(
      imageData,
      selection.polygon,
      selection.boundingBox,
      opts
    );
  } else {
    extractedData = extractRectangleRegion(
      imageData,
      selection.boundingBox,
      opts
    );
  }
  
  // 可选：移除背景
  if (opts.removeBackground) {
    try {
      extractedData = removeRegionBackground(extractedData, opts.backgroundTolerance);
    } catch (error) {
      // 背景移除失败时返回原始裁剪图片
      console.warn('[RegionExtractor] Background removal failed, returning original cropped image:', error);
    }
  }
  
  return extractedData;
}

/**
 * 提取选区并转换为 ExtractedEmoji
 * 
 * @param imageData 原始图片数据
 * @param selection 选区
 * @param options 提取选项
 * @returns ExtractedEmoji 对象
 * 
 * Requirements: 5.1, 5.2, 5.3, 5.4, 5.5
 */
export async function extractSelectionToEmoji(
  imageData: ImageData,
  selection: SelectionRegion,
  options: RegionExtractionOptions = {}
): Promise<ExtractedEmoji> {
  // 提取区域
  const extractedData = extractFromSelection(imageData, selection, options);
  
  // 转换为 Blob 和预览 URL
  const blob = await imageDataToBlob(extractedData);
  const preview = imageDataToPreviewUrl(extractedData);
  
  return {
    id: generateId(),
    blob,
    preview,
    boundingBox: selection.boundingBox,
  };
}

/**
 * 批量提取多个选区
 * 
 * @param imageData 原始图片数据
 * @param selections 选区列表
 * @param options 提取选项
 * @returns ExtractedEmoji 数组
 * 
 * Requirements: 5.1, 5.5
 */
export async function extractAllSelections(
  imageData: ImageData,
  selections: SelectionRegion[],
  options: RegionExtractionOptions = {}
): Promise<ExtractedEmoji[]> {
  const emojis: ExtractedEmoji[] = [];
  
  for (const selection of selections) {
    try {
      const emoji = await extractSelectionToEmoji(imageData, selection, options);
      emojis.push(emoji);
    } catch (error) {
      console.error(`[RegionExtractor] Failed to extract selection ${selection.id}:`, error);
    }
  }
  
  return emojis;
}
