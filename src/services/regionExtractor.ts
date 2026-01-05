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
  colorsAreSimilar,
  removeBackgroundFloodFill,
} from './imageSplitter';
import type { RGBAColor } from './imageSplitter';
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
  
  console.log('[extractRectangleRegion] boundingBox:', boundingBox);
  console.log('[extractRectangleRegion] imageData size:', imageData.width, 'x', imageData.height);
  console.log('[extractRectangleRegion] padding:', padding);
  
  // 使用现有的 cropImage 函数裁剪矩形区域
  const result = cropImage(imageData, boundingBox, padding);
  console.log('[extractRectangleRegion] result size:', result.width, 'x', result.height);
  
  // 检查结果是否全透明
  let opaquePixels = 0;
  for (let i = 0; i < result.width * result.height; i++) {
    if (result.data[i * 4 + 3] > 0) {
      opaquePixels++;
    }
  }
  console.log('[extractRectangleRegion] opaque pixels:', opaquePixels, '/', result.width * result.height);
  
  return result;
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
  // 使用增强的边缘采样来检测背景色
  const backgroundColor = detectBackgroundColorFromEdges(imageData, tolerance);
  
  console.log('[removeRegionBackground] Detected background color:', backgroundColor);
  console.log('[removeRegionBackground] Image size:', imageData.width, 'x', imageData.height);
  
  // 使用 flood-fill 从边缘移除背景
  // 对于手动框选的区域，关闭 fillEnclosed，因为用户可能框选了多个表情
  // 关闭 featherEdge 以避免过度移除边缘像素
  const result = removeBackgroundFloodFill(imageData, backgroundColor, tolerance, false, false);
  
  // 安全检查：如果移除了太多像素（超过 95%），说明可能出错了，返回原图
  const totalPixels = result.width * result.height;
  let transparentPixels = 0;
  for (let i = 0; i < totalPixels; i++) {
    if (result.data[i * 4 + 3] === 0) {
      transparentPixels++;
    }
  }
  
  const transparentRatio = transparentPixels / totalPixels;
  console.log('[removeRegionBackground] Transparent ratio:', (transparentRatio * 100).toFixed(1) + '%');
  
  if (transparentRatio > 0.95) {
    console.warn('[removeRegionBackground] Too many pixels removed, returning original image');
    return imageData;
  }
  
  return result;
}

/**
 * 从图片边缘采样检测背景色
 * 比四角采样更准确，适用于用户手动框选的区域
 * 忽略透明像素，只采样不透明的像素
 */
function detectBackgroundColorFromEdges(
  imageData: ImageData,
  tolerance: number
): RGBAColor {
  const { width, height, data } = imageData;
  
  // 从四条边缘采样
  const sampledColors: RGBAColor[] = [];
  const step = Math.max(1, Math.floor(Math.min(width, height) / 10));
  
  // 上边缘
  for (let x = 0; x < width; x += step) {
    const color = getPixelColorFromData(data, width, x, 0);
    if (color.a >= 128) sampledColors.push(color);
  }
  // 下边缘
  for (let x = 0; x < width; x += step) {
    const color = getPixelColorFromData(data, width, x, height - 1);
    if (color.a >= 128) sampledColors.push(color);
  }
  // 左边缘
  for (let y = 0; y < height; y += step) {
    const color = getPixelColorFromData(data, width, 0, y);
    if (color.a >= 128) sampledColors.push(color);
  }
  // 右边缘
  for (let y = 0; y < height; y += step) {
    const color = getPixelColorFromData(data, width, width - 1, y);
    if (color.a >= 128) sampledColors.push(color);
  }
  
  // 如果边缘全是透明的，返回白色作为默认背景
  if (sampledColors.length === 0) {
    console.log('[detectBackgroundColorFromEdges] All edge pixels are transparent, using white as default');
    return { r: 255, g: 255, b: 255, a: 255 };
  }
  
  // 统计相似颜色的出现次数
  const colorGroups: { color: RGBAColor; count: number }[] = [];
  
  for (const color of sampledColors) {
    let foundGroup = false;
    for (const group of colorGroups) {
      if (colorsAreSimilar(color, group.color, tolerance)) {
        group.count++;
        foundGroup = true;
        break;
      }
    }
    if (!foundGroup) {
      colorGroups.push({ color, count: 1 });
    }
  }
  
  // 返回出现次数最多的颜色
  colorGroups.sort((a, b) => b.count - a.count);
  return colorGroups[0]?.color ?? { r: 255, g: 255, b: 255, a: 255 };
}

/**
 * 从 ImageData 的 data 数组获取像素颜色
 */
function getPixelColorFromData(
  data: Uint8ClampedArray,
  width: number,
  x: number,
  y: number
): RGBAColor {
  const index = (y * width + x) * 4;
  return {
    r: data[index],
    g: data[index + 1],
    b: data[index + 2],
    a: data[index + 3],
  };
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
