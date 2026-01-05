/**
 * Image Splitter Service
 * 负责将生成的大图分割成单个表情包
 */

import type { BoundingBox, ExtractedEmoji } from '../types/image';
import type { APIConfig } from '../types/api';
import type { AISegmentationConfig, SegmentationResult } from '../types/segmentation';
import { AISegmentationService, DEFAULT_AI_SEGMENTATION_CONFIG } from './aiSegmentationService';
import { extractEmojisFromRegions } from './polygonCropper';

// 生成唯一 ID
const generateId = () => `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;

/**
 * RGBA 颜色类型
 */
export interface RGBAColor {
  r: number;
  g: number;
  b: number;
  a: number;
}

/**
 * 背景检测配置
 */
export interface BackgroundDetectionConfig {
  /** 颜色容差 (0-255)，默认 30 */
  tolerance: number;
  /** 采样点数量，默认 4 (四角) */
  samplePoints?: number;
}

const DEFAULT_TOLERANCE = 30;

/**
 * 从 ImageData 获取指定位置的像素颜色
 */
export function getPixelColor(imageData: ImageData, x: number, y: number): RGBAColor {
  const index = (y * imageData.width + x) * 4;
  return {
    r: imageData.data[index],
    g: imageData.data[index + 1],
    b: imageData.data[index + 2],
    a: imageData.data[index + 3],
  };
}

/**
 * 计算两个颜色之间的欧几里得距离
 */
export function colorDistance(c1: RGBAColor, c2: RGBAColor): number {
  return Math.sqrt(
    Math.pow(c1.r - c2.r, 2) +
    Math.pow(c1.g - c2.g, 2) +
    Math.pow(c1.b - c2.b, 2)
  );
}

/**
 * 判断两个颜色是否相似（在容差范围内）
 */
export function colorsAreSimilar(c1: RGBAColor, c2: RGBAColor, tolerance: number): boolean {
  return colorDistance(c1, c2) <= tolerance;
}

/**
 * 采样图片四角像素，检测背景色
 * 策略：采样四角像素，找出出现最多的颜色作为背景色
 */
export function detectBackgroundColor(
  imageData: ImageData,
  config: Partial<BackgroundDetectionConfig> = {}
): RGBAColor {
  const { tolerance = DEFAULT_TOLERANCE } = config;
  const { width, height } = imageData;
  
  // 采样四角像素（稍微向内偏移以避免边缘问题）
  const offset = Math.min(5, Math.floor(Math.min(width, height) / 10));
  const samplePositions = [
    { x: offset, y: offset },                           // 左上
    { x: width - 1 - offset, y: offset },               // 右上
    { x: offset, y: height - 1 - offset },              // 左下
    { x: width - 1 - offset, y: height - 1 - offset },  // 右下
  ];
  
  const sampledColors: RGBAColor[] = samplePositions.map(pos => 
    getPixelColor(imageData, pos.x, pos.y)
  );
  
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
 * 连通区域检测配置
 */
export interface RegionDetectionConfig {
  /** 背景色容差 */
  tolerance: number;
  /** 最小区域面积（像素数），过滤噪点 */
  minArea: number;
  /** 最小边界框尺寸（像素），过滤太小的区域 */
  minSize: number;
}

const DEFAULT_REGION_CONFIG: RegionDetectionConfig = {
  tolerance: DEFAULT_TOLERANCE,
  minArea: 100,
  minSize: 10,
};

/**
 * 创建二值化掩码
 * 非背景色像素标记为 true，背景色像素标记为 false
 */
export function createBinaryMask(
  imageData: ImageData,
  backgroundColor: RGBAColor,
  tolerance: number
): boolean[][] {
  const { width, height, data } = imageData;
  const mask: boolean[][] = [];
  
  for (let y = 0; y < height; y++) {
    mask[y] = [];
    for (let x = 0; x < width; x++) {
      const index = (y * width + x) * 4;
      const pixelColor: RGBAColor = {
        r: data[index],
        g: data[index + 1],
        b: data[index + 2],
        a: data[index + 3],
      };
      // 非背景色像素标记为 true
      mask[y][x] = !colorsAreSimilar(pixelColor, backgroundColor, tolerance);
    }
  }
  
  return mask;
}

/**
 * 使用 Flood Fill 算法标记连通区域
 * 返回标签矩阵，每个像素的值表示其所属区域的标签（0 表示背景）
 */
export function labelConnectedRegions(mask: boolean[][]): {
  labels: number[][];
  regionCount: number;
} {
  const height = mask.length;
  const width = mask[0]?.length ?? 0;
  const labels: number[][] = Array.from({ length: height }, () => 
    Array(width).fill(0)
  );
  
  let currentLabel = 0;
  
  // 4-连通方向
  const directions = [
    { dx: 0, dy: -1 },  // 上
    { dx: 0, dy: 1 },   // 下
    { dx: -1, dy: 0 },  // 左
    { dx: 1, dy: 0 },   // 右
  ];
  
  // BFS Flood Fill
  function floodFill(startX: number, startY: number, label: number): void {
    const queue: { x: number; y: number }[] = [{ x: startX, y: startY }];
    labels[startY][startX] = label;
    
    while (queue.length > 0) {
      const { x, y } = queue.shift()!;
      
      for (const { dx, dy } of directions) {
        const nx = x + dx;
        const ny = y + dy;
        
        if (
          nx >= 0 && nx < width &&
          ny >= 0 && ny < height &&
          mask[ny][nx] &&
          labels[ny][nx] === 0
        ) {
          labels[ny][nx] = label;
          queue.push({ x: nx, y: ny });
        }
      }
    }
  }
  
  // 遍历所有像素，对未标记的非背景像素进行 Flood Fill
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      if (mask[y][x] && labels[y][x] === 0) {
        currentLabel++;
        floodFill(x, y, currentLabel);
      }
    }
  }
  
  return { labels, regionCount: currentLabel };
}

/**
 * 从标签矩阵中提取每个区域的边界框
 */
export function extractBoundingBoxes(
  labels: number[][],
  regionCount: number,
  config: Partial<RegionDetectionConfig> = {}
): BoundingBox[] {
  const { minArea = DEFAULT_REGION_CONFIG.minArea, minSize = DEFAULT_REGION_CONFIG.minSize } = config;
  const height = labels.length;
  const width = labels[0]?.length ?? 0;
  
  // 初始化每个区域的边界
  const regions: Map<number, {
    minX: number;
    maxX: number;
    minY: number;
    maxY: number;
    area: number;
  }> = new Map();
  
  for (let label = 1; label <= regionCount; label++) {
    regions.set(label, {
      minX: width,
      maxX: 0,
      minY: height,
      maxY: 0,
      area: 0,
    });
  }
  
  // 遍历标签矩阵，更新每个区域的边界
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const label = labels[y][x];
      if (label > 0) {
        const region = regions.get(label)!;
        region.minX = Math.min(region.minX, x);
        region.maxX = Math.max(region.maxX, x);
        region.minY = Math.min(region.minY, y);
        region.maxY = Math.max(region.maxY, y);
        region.area++;
      }
    }
  }
  
  // 转换为 BoundingBox 数组，过滤掉太小的区域
  const boundingBoxes: BoundingBox[] = [];
  
  for (const [, region] of regions) {
    const boxWidth = region.maxX - region.minX + 1;
    const boxHeight = region.maxY - region.minY + 1;
    
    // 过滤太小的区域
    if (region.area >= minArea && boxWidth >= minSize && boxHeight >= minSize) {
      boundingBoxes.push({
        x: region.minX,
        y: region.minY,
        width: boxWidth,
        height: boxHeight,
      });
    }
  }
  
  // 按位置排序（从上到下，从左到右）
  boundingBoxes.sort((a, b) => {
    const rowDiff = Math.floor(a.y / 50) - Math.floor(b.y / 50);
    if (rowDiff !== 0) return rowDiff;
    return a.x - b.x;
  });
  
  return boundingBoxes;
}

/**
 * 计算两个边界框之间的最小距离
 */
export function boundingBoxDistance(a: BoundingBox, b: BoundingBox): number {
  // 计算水平和垂直方向的间隙
  const horizontalGap = Math.max(0, Math.max(a.x, b.x) - Math.min(a.x + a.width, b.x + b.width));
  const verticalGap = Math.max(0, Math.max(a.y, b.y) - Math.min(a.y + a.height, b.y + b.height));
  
  // 如果有重叠，距离为 0
  if (horizontalGap === 0 && verticalGap === 0) return 0;
  
  return Math.sqrt(horizontalGap * horizontalGap + verticalGap * verticalGap);
}

/**
 * 合并两个边界框
 */
export function mergeBoundingBoxes(a: BoundingBox, b: BoundingBox): BoundingBox {
  const minX = Math.min(a.x, b.x);
  const minY = Math.min(a.y, b.y);
  const maxX = Math.max(a.x + a.width, b.x + b.width);
  const maxY = Math.max(a.y + a.height, b.y + b.height);
  
  return {
    x: minX,
    y: minY,
    width: maxX - minX,
    height: maxY - minY,
  };
}

/**
 * 合并距离较近的边界框（处理文字游离问题）
 * 使用 Union-Find 算法进行聚类
 */
export function mergeNearbyBoundingBoxes(
  boxes: BoundingBox[],
  mergeDistance: number
): BoundingBox[] {
  if (boxes.length <= 1) return boxes;
  
  // Union-Find 数据结构
  const parent: number[] = boxes.map((_, i) => i);
  
  function find(x: number): number {
    if (parent[x] !== x) {
      parent[x] = find(parent[x]);
    }
    return parent[x];
  }
  
  function union(x: number, y: number): void {
    const px = find(x);
    const py = find(y);
    if (px !== py) {
      parent[px] = py;
    }
  }
  
  // 检查所有边界框对，合并距离较近的
  for (let i = 0; i < boxes.length; i++) {
    for (let j = i + 1; j < boxes.length; j++) {
      if (boundingBoxDistance(boxes[i], boxes[j]) <= mergeDistance) {
        union(i, j);
      }
    }
  }
  
  // 按组合并边界框
  const groups: Map<number, BoundingBox[]> = new Map();
  for (let i = 0; i < boxes.length; i++) {
    const root = find(i);
    if (!groups.has(root)) {
      groups.set(root, []);
    }
    groups.get(root)!.push(boxes[i]);
  }
  
  // 合并每组的边界框
  const mergedBoxes: BoundingBox[] = [];
  for (const group of groups.values()) {
    let merged = group[0];
    for (let i = 1; i < group.length; i++) {
      merged = mergeBoundingBoxes(merged, group[i]);
    }
    mergedBoxes.push(merged);
  }
  
  return mergedBoxes;
}

/**
 * 检测图片中的表情区域
 * 完整流程：背景检测 -> 二值化 -> 连通区域标记 -> 边界框提取 -> 合并邻近区域
 */
export function detectEmojis(
  imageData: ImageData,
  config: Partial<RegionDetectionConfig & { mergeDistance?: number; mergeDistancePercent?: number; debug?: boolean }> = {}
): BoundingBox[] {
  const { tolerance = DEFAULT_TOLERANCE, debug = false, mergeDistancePercent = 2 } = config;
  // 使用百分比计算合并距离，如果提供了 mergeDistance 则优先使用
  const defaultMergeDistance = Math.min(imageData.width, imageData.height) * (mergeDistancePercent / 100);
  const { mergeDistance = defaultMergeDistance } = config;
  
  if (debug) {
    console.log(`[detectEmojis] Image size: ${imageData.width}x${imageData.height}`);
    console.log(`[detectEmojis] Merge distance: ${mergeDistance.toFixed(1)}px`);
  }
  
  // 1. 检测背景色
  const backgroundColor = detectBackgroundColor(imageData, { tolerance });
  
  if (debug) {
    console.log(`[detectEmojis] Background color:`, backgroundColor);
  }
  
  // 2. 创建二值化掩码
  const mask = createBinaryMask(imageData, backgroundColor, tolerance);
  
  // 3. 标记连通区域
  const { labels, regionCount } = labelConnectedRegions(mask);
  
  if (debug) {
    console.log(`[detectEmojis] Found ${regionCount} connected regions`);
  }
  
  // 4. 提取边界框
  const boxes = extractBoundingBoxes(labels, regionCount, config);
  
  if (debug) {
    console.log(`[detectEmojis] After filtering: ${boxes.length} boxes`);
  }
  
  // 5. 合并邻近区域（处理文字游离）
  const mergedBoxes = mergeNearbyBoundingBoxes(boxes, mergeDistance);
  
  if (debug) {
    console.log(`[detectEmojis] After merging: ${mergedBoxes.length} boxes`);
  }
  
  // 重新排序
  mergedBoxes.sort((a, b) => {
    const rowDiff = Math.floor(a.y / 50) - Math.floor(b.y / 50);
    if (rowDiff !== 0) return rowDiff;
    return a.x - b.x;
  });
  
  return mergedBoxes;
}


/**
 * 网格切割配置
 */
export interface GridSplitConfig {
  /** 行数 */
  rows: number;
  /** 列数 */
  cols: number;
  /** 是否自动检测网格（基于间隙检测） */
  autoDetect?: boolean;
}

/**
 * 按网格均分切割图片
 * 适用于规整排列的表情包图片
 */
export function splitByGrid(
  imageData: ImageData,
  config: GridSplitConfig
): BoundingBox[] {
  const { rows, cols } = config;
  const { width, height } = imageData;
  
  const cellWidth = Math.floor(width / cols);
  const cellHeight = Math.floor(height / rows);
  
  const boxes: BoundingBox[] = [];
  
  for (let row = 0; row < rows; row++) {
    for (let col = 0; col < cols; col++) {
      boxes.push({
        x: col * cellWidth,
        y: row * cellHeight,
        width: cellWidth,
        height: cellHeight,
      });
    }
  }
  
  return boxes;
}

/**
 * 网格检测结果
 */
export interface GridDetectionResult {
  rows: number;
  cols: number;
  confidence: number; // 0-1 之间，表示检测置信度
  rowSeparators: number[]; // 行分隔线位置
  colSeparators: number[]; // 列分隔线位置
}

/**
 * 检测图片中的网格线（基于行/列像素相似度）
 * 返回推测的行数、列数和置信度
 */
export function detectGrid(
  imageData: ImageData,
  config: { 
    tolerance?: number; 
    minCells?: number; 
    maxCells?: number;
    minConfidence?: number; // 最小置信度阈值
  } = {}
): GridDetectionResult | null {
  const { 
    tolerance = 30, 
    minCells = 2, 
    maxCells = 6,
    minConfidence = 0.7, // 默认要求 70% 置信度
  } = config;
  const { width, height } = imageData;
  
  // 检测背景色
  const backgroundColor = detectBackgroundColor(imageData, { tolerance });
  
  // 计算每行的背景色像素比例
  function getRowBackgroundRatio(y: number): number {
    let bgCount = 0;
    for (let x = 0; x < width; x++) {
      const color = getPixelColor(imageData, x, y);
      if (colorsAreSimilar(color, backgroundColor, tolerance)) {
        bgCount++;
      }
    }
    return bgCount / width;
  }
  
  // 计算每列的背景色像素比例
  function getColBackgroundRatio(x: number): number {
    let bgCount = 0;
    for (let y = 0; y < height; y++) {
      const color = getPixelColor(imageData, x, y);
      if (colorsAreSimilar(color, backgroundColor, tolerance)) {
        bgCount++;
      }
    }
    return bgCount / height;
  }
  
  // 找到背景比例高的行（可能是分隔线）
  const rowRatios: number[] = [];
  for (let y = 0; y < height; y++) {
    rowRatios.push(getRowBackgroundRatio(y));
  }
  
  const colRatios: number[] = [];
  for (let x = 0; x < width; x++) {
    colRatios.push(getColBackgroundRatio(x));
  }
  
  // 找分隔区域（连续的高背景比例区域）
  function findSeparators(
    ratios: number[], 
    threshold: number = 0.9,
    minWidth: number = 3 // 最小分隔线宽度
  ): { positions: number[]; avgRatio: number } {
    const separators: number[] = [];
    const separatorRatios: number[] = [];
    let inSeparator = false;
    let separatorStart = 0;
    
    for (let i = 0; i < ratios.length; i++) {
      if (ratios[i] >= threshold) {
        if (!inSeparator) {
          inSeparator = true;
          separatorStart = i;
        }
      } else {
        if (inSeparator) {
          const separatorWidth = i - separatorStart;
          // 只记录足够宽的分隔线
          if (separatorWidth >= minWidth) {
            const midPoint = Math.floor((separatorStart + i) / 2);
            separators.push(midPoint);
            // 计算这段分隔线的平均比例
            const avgRatio = ratios.slice(separatorStart, i).reduce((a, b) => a + b, 0) / separatorWidth;
            separatorRatios.push(avgRatio);
          }
          inSeparator = false;
        }
      }
    }
    
    const avgRatio = separatorRatios.length > 0 
      ? separatorRatios.reduce((a, b) => a + b, 0) / separatorRatios.length 
      : 0;
    
    return { positions: separators, avgRatio };
  }
  
  // 验证网格是否均匀分布
  function validateGridUniformity(
    separators: number[], 
    totalLength: number
  ): number {
    if (separators.length === 0) return 1;
    
    // 计算每个单元格的大小
    const cellSizes: number[] = [];
    let prevPos = 0;
    for (const sep of separators) {
      cellSizes.push(sep - prevPos);
      prevPos = sep;
    }
    cellSizes.push(totalLength - prevPos);
    
    // 计算单元格大小的标准差
    const avgSize = cellSizes.reduce((a, b) => a + b, 0) / cellSizes.length;
    const variance = cellSizes.reduce((sum, size) => sum + Math.pow(size - avgSize, 2), 0) / cellSizes.length;
    const stdDev = Math.sqrt(variance);
    
    // 变异系数（标准差/平均值），越小越均匀
    const cv = stdDev / avgSize;
    
    // 转换为置信度分数（0-1），cv < 0.1 为完全均匀
    return Math.max(0, 1 - cv * 5);
  }
  
  let bestResult: GridDetectionResult | null = null;
  let bestScore = 0;
  
  // 尝试不同的阈值找到最佳分隔
  for (const threshold of [0.98, 0.95, 0.92, 0.9, 0.85]) {
    const rowResult = findSeparators(rowRatios, threshold);
    const colResult = findSeparators(colRatios, threshold);
    
    const rows = rowResult.positions.length + 1;
    const cols = colResult.positions.length + 1;
    
    if (rows >= minCells && rows <= maxCells && cols >= minCells && cols <= maxCells) {
      // 计算置信度
      const rowUniformity = validateGridUniformity(rowResult.positions, height);
      const colUniformity = validateGridUniformity(colResult.positions, width);
      const avgSeparatorRatio = (rowResult.avgRatio + colResult.avgRatio) / 2;
      
      // 综合置信度：分隔线清晰度 * 均匀度
      const confidence = avgSeparatorRatio * 0.4 + rowUniformity * 0.3 + colUniformity * 0.3;
      
      if (confidence > bestScore) {
        bestScore = confidence;
        bestResult = {
          rows,
          cols,
          confidence,
          rowSeparators: rowResult.positions,
          colSeparators: colResult.positions,
        };
      }
    }
  }
  
  // 只返回置信度足够高的结果
  if (bestResult && bestResult.confidence >= minConfidence) {
    return bestResult;
  }
  
  return null;
}

/**
 * 从 HTMLImageElement 获取 ImageData
 */
export function getImageDataFromImage(image: HTMLImageElement): ImageData {
  const canvas = document.createElement('canvas');
  canvas.width = image.naturalWidth || image.width;
  canvas.height = image.naturalHeight || image.height;
  const ctx = canvas.getContext('2d')!;
  ctx.drawImage(image, 0, 0);
  return ctx.getImageData(0, 0, canvas.width, canvas.height);
}

/**
 * 从 Blob 加载图片
 */
export function loadImageFromBlob(blob: Blob): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      URL.revokeObjectURL(img.src);
      resolve(img);
    };
    img.onerror = () => {
      URL.revokeObjectURL(img.src);
      reject(new Error('Failed to load image'));
    };
    img.src = URL.createObjectURL(blob);
  });
}

/**
 * 根据边界框裁剪图片
 */
export function cropImage(
  imageData: ImageData,
  boundingBox: BoundingBox,
  padding: number = 5
): ImageData {
  // 对坐标取整，确保像素索引正确
  const x = Math.round(boundingBox.x);
  const y = Math.round(boundingBox.y);
  const width = Math.round(boundingBox.width);
  const height = Math.round(boundingBox.height);
  
  // 添加 padding，但不超出图片边界
  const cropX = Math.max(0, x - padding);
  const cropY = Math.max(0, y - padding);
  const cropWidth = Math.min(imageData.width - cropX, width + padding * 2);
  const cropHeight = Math.min(imageData.height - cropY, height + padding * 2);
  
  console.log('[cropImage] Input imageData:', imageData.width, 'x', imageData.height, 'data length:', imageData.data.length);
  console.log('[cropImage] Crop area:', { cropX, cropY, cropWidth, cropHeight });
  
  // 检查源图片是否有数据
  let srcOpaqueCount = 0;
  for (let i = 0; i < Math.min(1000, imageData.width * imageData.height); i++) {
    if (imageData.data[i * 4 + 3] > 0) srcOpaqueCount++;
  }
  console.log('[cropImage] Source image sample opaque pixels (first 1000):', srcOpaqueCount);
  
  // 使用 canvas 创建真正的 ImageData 实例
  const canvas = document.createElement('canvas');
  canvas.width = cropWidth;
  canvas.height = cropHeight;
  const ctx = canvas.getContext('2d')!;
  const croppedImageData = ctx.createImageData(cropWidth, cropHeight);
  
  for (let cy = 0; cy < cropHeight; cy++) {
    for (let cx = 0; cx < cropWidth; cx++) {
      const srcX = cropX + cx;
      const srcY = cropY + cy;
      const srcIndex = (srcY * imageData.width + srcX) * 4;
      const dstIndex = (cy * cropWidth + cx) * 4;
      
      croppedImageData.data[dstIndex] = imageData.data[srcIndex];
      croppedImageData.data[dstIndex + 1] = imageData.data[srcIndex + 1];
      croppedImageData.data[dstIndex + 2] = imageData.data[srcIndex + 2];
      croppedImageData.data[dstIndex + 3] = imageData.data[srcIndex + 3];
    }
  }
  
  return croppedImageData;
}

/**
 * 将 ImageData 转换为 Blob
 */
export function imageDataToBlob(imageData: ImageData): Promise<Blob> {
  return new Promise((resolve, reject) => {
    const canvas = document.createElement('canvas');
    canvas.width = imageData.width;
    canvas.height = imageData.height;
    const ctx = canvas.getContext('2d')!;
    ctx.putImageData(imageData, 0, 0);
    canvas.toBlob((blob) => {
      if (blob) {
        resolve(blob);
      } else {
        reject(new Error('Failed to convert ImageData to Blob'));
      }
    }, 'image/png');
  });
}

/**
 * 将 ImageData 转换为 base64 预览 URL
 */
export function imageDataToPreviewUrl(imageData: ImageData): string {
  const canvas = document.createElement('canvas');
  canvas.width = imageData.width;
  canvas.height = imageData.height;
  const ctx = canvas.getContext('2d')!;
  ctx.putImageData(imageData, 0, 0);
  return canvas.toDataURL('image/png');
}

/**
 * 使用 @imgly/background-removal 移除背景
 * 返回带透明背景的 Blob
 */
export async function removeBackground(imageBlob: Blob): Promise<Blob> {
  // 动态导入以支持代码分割
  const { removeBackground: imglyRemoveBackground } = await import('@imgly/background-removal');
  
  const result = await imglyRemoveBackground(imageBlob, {
    output: {
      format: 'image/png',
      quality: 1,
    },
  });
  
  return result;
}

/**
 * 简单的背景移除（基于颜色容差）
 * 用于快速预览或当 @imgly/background-removal 不可用时
 * 
 * 注意：这个方法会把所有与背景色相似的像素都变透明，
 * 如果主体颜色与背景相似，可能会出现问题。
 * 推荐使用 removeBackgroundFloodFill 代替。
 */
export function removeBackgroundSimple(
  imageData: ImageData,
  backgroundColor: RGBAColor,
  tolerance: number = 30
): ImageData {
  const { width, height, data } = imageData;
  
  // 使用 canvas 创建真正的 ImageData 实例
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d')!;
  const resultImageData = ctx.createImageData(width, height);
  
  // 复制原始数据
  resultImageData.data.set(data);
  
  for (let i = 0; i < width * height; i++) {
    const index = i * 4;
    const pixelColor: RGBAColor = {
      r: data[index],
      g: data[index + 1],
      b: data[index + 2],
      a: data[index + 3],
    };
    
    if (colorsAreSimilar(pixelColor, backgroundColor, tolerance)) {
      // 设置为透明
      resultImageData.data[index + 3] = 0;
    }
  }
  
  return resultImageData;
}

/**
 * 使用 Flood Fill 从边缘移除背景
 * 只移除与边缘相连的背景色区域，保护主体内部的相似颜色
 * 
 * @param featherEdge - 是否对边缘进行羽化处理，移除渐变过渡色
 * @param fillEnclosed - 是否填充被包围的背景区域（如文字和主体之间的空隙）
 */
export function removeBackgroundFloodFill(
  imageData: ImageData,
  backgroundColor: RGBAColor,
  tolerance: number = 30,
  featherEdge: boolean = true,
  fillEnclosed: boolean = true
): ImageData {
  const { width, height, data } = imageData;
  
  // 创建结果 ImageData
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d')!;
  const resultImageData = ctx.createImageData(width, height);
  resultImageData.data.set(data);
  
  // 创建访问标记数组
  const visited = new Uint8Array(width * height);
  // 标记哪些像素被移除了
  const removed = new Uint8Array(width * height);
  
  // 获取像素颜色
  const getPixelColorAt = (x: number, y: number): RGBAColor => {
    const index = (y * width + x) * 4;
    return {
      r: data[index],
      g: data[index + 1],
      b: data[index + 2],
      a: data[index + 3],
    };
  };
  
  // 检查像素是否为背景色（忽略已经透明的像素）
  const isBackgroundPixel = (x: number, y: number): boolean => {
    if (x < 0 || x >= width || y < 0 || y >= height) return false;
    const color = getPixelColorAt(x, y);
    // 已经透明的像素不算背景，不参与扩散
    if (color.a < 128) return false;
    return colorsAreSimilar(color, backgroundColor, tolerance);
  };
  
  // 4-连通方向
  const directions = [
    { dx: 0, dy: -1 },  // 上
    { dx: 0, dy: 1 },   // 下
    { dx: -1, dy: 0 },  // 左
    { dx: 1, dy: 0 },   // 右
  ];
  
  // BFS Flood Fill 函数
  const floodFillFrom = (startPoints: { x: number; y: number }[]) => {
    const queue = [...startPoints];
    
    for (const { x, y } of startPoints) {
      const idx = y * width + x;
      if (!visited[idx]) {
        visited[idx] = 1;
      }
    }
    
    while (queue.length > 0) {
      const { x, y } = queue.shift()!;
      const arrayIdx = y * width + x;
      
      // 将当前像素设为透明
      const pixelIndex = arrayIdx * 4;
      resultImageData.data[pixelIndex + 3] = 0;
      removed[arrayIdx] = 1;
      
      // 检查相邻像素
      for (const { dx, dy } of directions) {
        const nx = x + dx;
        const ny = y + dy;
        
        if (nx >= 0 && nx < width && ny >= 0 && ny < height) {
          const nIdx = ny * width + nx;
          if (!visited[nIdx] && isBackgroundPixel(nx, ny)) {
            visited[nIdx] = 1;
            queue.push({ x: nx, y: ny });
          }
        }
      }
    }
  };
  
  // 第一步：从边缘开始填充
  const edgePoints: { x: number; y: number }[] = [];
  
  for (let x = 0; x < width; x++) {
    if (isBackgroundPixel(x, 0)) edgePoints.push({ x, y: 0 });
    if (isBackgroundPixel(x, height - 1)) edgePoints.push({ x, y: height - 1 });
  }
  
  for (let y = 0; y < height; y++) {
    if (isBackgroundPixel(0, y)) edgePoints.push({ x: 0, y });
    if (isBackgroundPixel(width - 1, y)) edgePoints.push({ x: width - 1, y });
  }
  
  floodFillFrom(edgePoints);
  
  // 第二步：填充被包围的背景区域
  // 策略：扫描所有未访问的背景色像素，如果它们形成的区域面积较大且主要是背景色，则移除
  if (fillEnclosed) {
    const minEnclosedArea = Math.min(width, height) * 5; // 最小面积阈值
    
    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        const idx = y * width + x;
        if (!visited[idx] && isBackgroundPixel(x, y)) {
          // 找到一个未访问的背景色像素，检查这个区域
          const regionPixels: { x: number; y: number }[] = [];
          const regionQueue: { x: number; y: number }[] = [{ x, y }];
          const regionVisited = new Set<number>();
          regionVisited.add(idx);
          
          while (regionQueue.length > 0) {
            const { x: cx, y: cy } = regionQueue.shift()!;
            regionPixels.push({ x: cx, y: cy });
            
            for (const { dx, dy } of directions) {
              const nx = cx + dx;
              const ny = cy + dy;
              if (nx >= 0 && nx < width && ny >= 0 && ny < height) {
                const nIdx = ny * width + nx;
                if (!visited[nIdx] && !regionVisited.has(nIdx) && isBackgroundPixel(nx, ny)) {
                  regionVisited.add(nIdx);
                  regionQueue.push({ x: nx, y: ny });
                }
              }
            }
          }
          
          // 如果区域面积足够大，认为是被包围的背景，移除它
          if (regionPixels.length >= minEnclosedArea) {
            for (const { x: px, y: py } of regionPixels) {
              const pIdx = py * width + px;
              visited[pIdx] = 1;
              removed[pIdx] = 1;
              const pixelIndex = pIdx * 4;
              resultImageData.data[pixelIndex + 3] = 0;
            }
          } else {
            // 标记为已访问但不移除（可能是主体内部的小区域）
            for (const { x: px, y: py } of regionPixels) {
              visited[py * width + px] = 1;
            }
          }
        }
      }
    }
  }
  
  // 边缘羽化：处理被移除区域边缘的渐变过渡色
  if (featherEdge) {
    const featherTolerance = tolerance * 2;
    const edgePixels: { x: number; y: number }[] = [];
    
    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        const idx = y * width + x;
        if (removed[idx]) continue;
        
        let adjacentToRemoved = false;
        for (const { dx, dy } of directions) {
          const nx = x + dx;
          const ny = y + dy;
          if (nx >= 0 && nx < width && ny >= 0 && ny < height) {
            if (removed[ny * width + nx]) {
              adjacentToRemoved = true;
              break;
            }
          }
        }
        
        if (adjacentToRemoved) {
          const pixelColor = getPixelColorAt(x, y);
          if (colorsAreSimilar(pixelColor, backgroundColor, featherTolerance)) {
            edgePixels.push({ x, y });
          }
        }
      }
    }
    
    const maxFeatherRounds = 3;
    for (let round = 0; round < maxFeatherRounds && edgePixels.length > 0; round++) {
      const nextEdgePixels: { x: number; y: number }[] = [];
      
      for (const { x, y } of edgePixels) {
        const idx = y * width + x;
        if (removed[idx]) continue;
        
        const pixelIndex = idx * 4;
        resultImageData.data[pixelIndex + 3] = 0;
        removed[idx] = 1;
        
        for (const { dx, dy } of directions) {
          const nx = x + dx;
          const ny = y + dy;
          if (nx >= 0 && nx < width && ny >= 0 && ny < height) {
            const nIdx = ny * width + nx;
            if (!removed[nIdx]) {
              const nPixelColor = getPixelColorAt(nx, ny);
              if (colorsAreSimilar(nPixelColor, backgroundColor, featherTolerance)) {
                nextEdgePixels.push({ x: nx, y: ny });
              }
            }
          }
        }
      }
      
      edgePixels.length = 0;
      edgePixels.push(...nextEdgePixels);
    }
  }
  
  return resultImageData;
}

/**
 * 提取单个表情
 * 完整流程：裁剪 -> 背景移除 -> 输出透明 PNG
 */
export async function extractEmoji(
  imageData: ImageData,
  boundingBox: BoundingBox,
  options: {
    /** 是否使用 AI 背景移除（不推荐用于表情包） */
    useAdvancedRemoval?: boolean;
    tolerance?: number;
    padding?: number;
    /** 是否移除背景（设为 false 则保留原图） */
    removeBackground?: boolean;
  } = {}
): Promise<ExtractedEmoji> {
  const { 
    useAdvancedRemoval = false, // 默认不使用 AI 移除
    tolerance = 30,
    padding = 5,
    removeBackground: shouldRemoveBackground = true,
  } = options;
  
  // 1. 裁剪图片
  const croppedImageData = cropImage(imageData, boundingBox, padding);
  
  let finalImageData: ImageData;
  let blob: Blob;
  
  if (!shouldRemoveBackground) {
    // 不移除背景，直接使用裁剪后的图片
    finalImageData = croppedImageData;
    blob = await imageDataToBlob(finalImageData);
  } else if (useAdvancedRemoval) {
    // 使用 AI 背景移除（不推荐）
    try {
      const croppedBlob = await imageDataToBlob(croppedImageData);
      blob = await removeBackground(croppedBlob);
      
      const img = await loadImageFromBlob(blob);
      finalImageData = getImageDataFromImage(img);
    } catch (error) {
      console.warn('Advanced background removal failed, falling back to flood fill:', error);
      const backgroundColor = detectBackgroundColor(croppedImageData, { tolerance });
      finalImageData = removeBackgroundFloodFill(croppedImageData, backgroundColor, tolerance);
      blob = await imageDataToBlob(finalImageData);
    }
  } else {
    // 使用 Flood Fill 背景移除（推荐用于表情包）
    // 只移除与边缘相连的背景，保护主体内部的相似颜色
    const backgroundColor = detectBackgroundColor(croppedImageData, { tolerance });
    finalImageData = removeBackgroundFloodFill(croppedImageData, backgroundColor, tolerance);
    blob = await imageDataToBlob(finalImageData);
  }
  
  // 3. 生成预览 URL
  const preview = imageDataToPreviewUrl(finalImageData);
  
  return {
    id: generateId(),
    blob,
    preview,
    boundingBox,
  };
}

/**
 * 从生成的大图中提取所有表情
 * 支持两种模式：
 * 1. 自动检测模式（auto，默认）：优先使用连通区域检测，在高置信度时才使用网格检测
 * 2. 网格模式（grid）：强制按指定行列数均分切割
 */
export async function extractAllEmojis(
  image: HTMLImageElement | Blob,
  options: {
    /** 切割模式：'auto' 自动检测（默认） | 'grid' 强制网格切割 */
    mode?: 'auto' | 'grid';
    /** 网格行数（grid 模式必填） */
    rows?: number;
    /** 网格列数（grid 模式必填） */
    cols?: number;
    /** 是否尝试网格检测（auto 模式下有效） */
    tryGridDetection?: boolean;
    /** 网格检测最小置信度（0-1） */
    gridConfidence?: number;
    /** 是否使用 AI 背景移除（不推荐用于表情包） */
    useAdvancedRemoval?: boolean;
    tolerance?: number;
    minArea?: number;
    minSize?: number;
    /** 合并距离百分比 (0-10)，基于图片短边的百分比 */
    mergeDistancePercent?: number;
    padding?: number;
    /** 调试模式：输出详细信息 */
    debug?: boolean;
    /** 是否移除背景 */
    removeBackground?: boolean;
  } = {}
): Promise<ExtractedEmoji[]> {
  const {
    mode = 'auto',
    rows,
    cols,
    tryGridDetection = false, // 默认关闭网格检测
    gridConfidence = 0.85,
    useAdvancedRemoval = false, // 默认使用简单背景移除
    tolerance = 30,
    minArea = 100,
    minSize = 10,
    mergeDistancePercent = 2,
    padding = 0,
    debug = false,
    removeBackground = true,
  } = options;
  
  // 获取 ImageData
  let imageData: ImageData;
  if (image instanceof Blob) {
    const img = await loadImageFromBlob(image);
    imageData = getImageDataFromImage(img);
  } else {
    imageData = getImageDataFromImage(image);
  }
  
  let boundingBoxes: BoundingBox[];
  let detectionMethod = 'unknown';
  
  if (mode === 'grid' && rows && cols) {
    // 强制使用指定的网格切割
    boundingBoxes = splitByGrid(imageData, { rows, cols });
    detectionMethod = 'forced-grid';
    if (debug) {
      console.log(`[ImageSplitter] Using forced grid: ${rows}x${cols}`);
    }
  } else {
    // 自动检测模式：默认使用连通区域，可选网格检测
    let gridResult: GridDetectionResult | null = null;
    
    if (tryGridDetection) {
      // 尝试网格检测
      gridResult = detectGrid(imageData, { 
        tolerance,
        minConfidence: gridConfidence,
      });
      
      if (debug && gridResult) {
        console.log(
          `[ImageSplitter] Grid detected: ${gridResult.rows}x${gridResult.cols} ` +
          `(confidence: ${(gridResult.confidence * 100).toFixed(1)}%)`
        );
      }
    }
    
    // 进行连通区域检测
    const connectedBoxes = detectEmojis(imageData, { tolerance, minArea, minSize, mergeDistancePercent });
    
    if (debug) {
      console.log(`[ImageSplitter] Connected components found: ${connectedBoxes.length} regions`);
    }
    
    // 决策：只在网格检测置信度足够高且结果合理时使用网格
    if (gridResult && gridResult.confidence >= gridConfidence) {
      const gridBoxes = splitByGrid(imageData, {
        rows: gridResult.rows,
        cols: gridResult.cols,
      });
      
      // 验证：网格数量应该接近连通区域数量
      const countDiff = Math.abs(gridBoxes.length - connectedBoxes.length);
      const countRatio = countDiff / Math.max(gridBoxes.length, connectedBoxes.length);
      
      if (debug) {
        console.log(
          `[ImageSplitter] Grid vs Connected: ${gridBoxes.length} vs ${connectedBoxes.length} ` +
          `(diff ratio: ${(countRatio * 100).toFixed(1)}%)`
        );
      }
      
      // 如果数量差异小于 20%，使用网格；否则使用连通区域
      if (countRatio < 0.2) {
        boundingBoxes = gridBoxes;
        detectionMethod = 'grid';
        if (debug) {
          console.log(`[ImageSplitter] ✓ Using grid detection`);
        }
      } else {
        boundingBoxes = connectedBoxes;
        detectionMethod = 'connected-components';
        if (debug) {
          console.log(`[ImageSplitter] ✗ Grid rejected, using connected components`);
        }
      }
    } else {
      // 使用连通区域检测
      boundingBoxes = connectedBoxes;
      detectionMethod = 'connected-components';
      if (debug) {
        console.log(`[ImageSplitter] Using connected components (grid detection ${tryGridDetection ? 'failed' : 'disabled'})`);
      }
    }
  }
  
  if (debug) {
    console.log(`[ImageSplitter] Final bounding boxes:`, boundingBoxes);
  }
  
  // 提取每个表情
  const emojis: ExtractedEmoji[] = [];
  for (let i = 0; i < boundingBoxes.length; i++) {
    const box = boundingBoxes[i];
    try {
      const emoji = await extractEmoji(imageData, box, {
        useAdvancedRemoval,
        tolerance,
        padding,
        removeBackground,
      });
      emojis.push(emoji);
      
      if (debug) {
        console.log(`[ImageSplitter] Extracted emoji ${i + 1}/${boundingBoxes.length}`);
      }
    } catch (error) {
      console.error(`[ImageSplitter] Failed to extract emoji ${i + 1}:`, error);
    }
  }
  
  console.log(`[ImageSplitter] ✓ Extracted ${emojis.length} emojis using ${detectionMethod}`);
  
  return emojis;
}


/**
 * AI 分割提取选项
 */
export interface AIExtractionOptions {
  /** API 配置 */
  apiConfig: APIConfig;
  /** AI 分割配置 */
  aiConfig?: Partial<AISegmentationConfig>;
  /** 裁剪边距 */
  padding?: number;
  /** 调试模式 */
  debug?: boolean;
  /** 回退选项（AI 失败时使用） */
  fallbackOptions?: {
    tolerance?: number;
    minArea?: number;
    minSize?: number;
    removeBackground?: boolean;
  };
}

/**
 * AI 分割提取结果
 */
export interface AIExtractionResult {
  /** 提取的表情列表 */
  emojis: ExtractedEmoji[];
  /** 使用的检测方法 */
  method: 'ai' | 'fallback';
  /** 错误信息（如果有） */
  error?: string;
  /** 是否发生了回退 */
  didFallback: boolean;
}

/**
 * 使用 AI 分割从图片中提取所有表情
 * 支持回退机制：AI 分割失败时自动回退到传统连通区域检测
 * 
 * Requirements: 5.1, 5.2, 5.3
 * 
 * @param image 图片（HTMLImageElement 或 Blob）
 * @param options AI 分割选项
 * @returns 提取结果，包含表情列表和使用的方法
 */
export async function extractAllEmojisWithAI(
  image: HTMLImageElement | Blob,
  options: AIExtractionOptions
): Promise<AIExtractionResult> {
  const {
    apiConfig,
    aiConfig,
    padding = 5,
    debug = false,
    fallbackOptions = {},
  } = options;

  const {
    tolerance = 30,
    minArea = 100,
    minSize = 10,
    removeBackground = true,
  } = fallbackOptions;

  // 获取图片 Blob
  let imageBlob: Blob;
  let imageData: ImageData;

  if (image instanceof Blob) {
    imageBlob = image;
    const img = await loadImageFromBlob(image);
    imageData = getImageDataFromImage(img);
  } else {
    imageData = getImageDataFromImage(image);
    // 将 HTMLImageElement 转换为 Blob
    const canvas = document.createElement('canvas');
    canvas.width = image.naturalWidth || image.width;
    canvas.height = image.naturalHeight || image.height;
    const ctx = canvas.getContext('2d')!;
    ctx.drawImage(image, 0, 0);
    imageBlob = await new Promise<Blob>((resolve, reject) => {
      canvas.toBlob((blob) => {
        if (blob) resolve(blob);
        else reject(new Error('Failed to convert image to Blob'));
      }, 'image/png');
    });
  }

  // 尝试 AI 分割
  const mergedAiConfig: AISegmentationConfig = {
    ...DEFAULT_AI_SEGMENTATION_CONFIG,
    ...aiConfig,
  };

  if (debug) {
    console.log('[extractAllEmojisWithAI] Starting AI segmentation...');
    console.log('[extractAllEmojisWithAI] AI config:', mergedAiConfig);
  }

  const aiService = new AISegmentationService(apiConfig, mergedAiConfig);
  let segmentationResult: SegmentationResult;

  try {
    segmentationResult = await aiService.segment(imageBlob);
  } catch (error) {
    // 捕获意外错误
    const errorMessage = error instanceof Error ? error.message : String(error);
    if (debug) {
      console.error('[extractAllEmojisWithAI] AI segmentation threw error:', errorMessage);
    }
    segmentationResult = {
      success: false,
      regions: [],
      method: 'ai',
      error: errorMessage,
    };
  }

  // 检查 AI 分割是否成功
  if (segmentationResult.success && segmentationResult.regions.length > 0) {
    if (debug) {
      console.log(`[extractAllEmojisWithAI] AI segmentation successful: ${segmentationResult.regions.length} regions`);
    }

    // 使用多边形裁剪提取表情
    const emojis = await extractEmojisFromRegions(imageData, segmentationResult.regions, {
      padding,
    });

    return {
      emojis,
      method: 'ai',
      didFallback: false,
    };
  }

  // AI 分割失败，回退到传统算法
  const fallbackReason = segmentationResult.error || 'AI 分割未返回有效结果';
  
  if (debug) {
    console.log(`[extractAllEmojisWithAI] AI segmentation failed: ${fallbackReason}`);
    console.log('[extractAllEmojisWithAI] Falling back to connected-component detection...');
  }

  // 使用传统的连通区域检测
  const emojis = await extractAllEmojis(image, {
    mode: 'auto',
    tolerance,
    minArea,
    minSize,
    padding,
    removeBackground,
    debug,
  });

  return {
    emojis,
    method: 'fallback',
    error: fallbackReason,
    didFallback: true,
  };
}
