/**
 * Image Splitter Service
 * 负责将生成的大图分割成单个表情包
 */

import type { BoundingBox, ExtractedEmoji } from '../types/image';

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
 * 检测图片中的表情区域
 * 完整流程：背景检测 -> 二值化 -> 连通区域标记 -> 边界框提取
 */
export function detectEmojis(
  imageData: ImageData,
  config: Partial<RegionDetectionConfig> = {}
): BoundingBox[] {
  const { tolerance = DEFAULT_TOLERANCE } = config;
  
  // 1. 检测背景色
  const backgroundColor = detectBackgroundColor(imageData, { tolerance });
  
  // 2. 创建二值化掩码
  const mask = createBinaryMask(imageData, backgroundColor, tolerance);
  
  // 3. 标记连通区域
  const { labels, regionCount } = labelConnectedRegions(mask);
  
  // 4. 提取边界框
  return extractBoundingBoxes(labels, regionCount, config);
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
  const { x, y, width, height } = boundingBox;
  
  // 添加 padding，但不超出图片边界
  const cropX = Math.max(0, x - padding);
  const cropY = Math.max(0, y - padding);
  const cropWidth = Math.min(imageData.width - cropX, width + padding * 2);
  const cropHeight = Math.min(imageData.height - cropY, height + padding * 2);
  
  const croppedData = new Uint8ClampedArray(cropWidth * cropHeight * 4);
  
  for (let cy = 0; cy < cropHeight; cy++) {
    for (let cx = 0; cx < cropWidth; cx++) {
      const srcX = cropX + cx;
      const srcY = cropY + cy;
      const srcIndex = (srcY * imageData.width + srcX) * 4;
      const dstIndex = (cy * cropWidth + cx) * 4;
      
      croppedData[dstIndex] = imageData.data[srcIndex];
      croppedData[dstIndex + 1] = imageData.data[srcIndex + 1];
      croppedData[dstIndex + 2] = imageData.data[srcIndex + 2];
      croppedData[dstIndex + 3] = imageData.data[srcIndex + 3];
    }
  }
  
  return {
    data: croppedData,
    width: cropWidth,
    height: cropHeight,
    colorSpace: 'srgb',
  } as ImageData;
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
 */
export function removeBackgroundSimple(
  imageData: ImageData,
  backgroundColor: RGBAColor,
  tolerance: number = 30
): ImageData {
  const { width, height, data } = imageData;
  const resultData = new Uint8ClampedArray(data);
  
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
      resultData[index + 3] = 0;
    }
  }
  
  return {
    data: resultData,
    width,
    height,
    colorSpace: 'srgb',
  } as ImageData;
}

/**
 * 提取单个表情
 * 完整流程：裁剪 -> 背景移除 -> 输出透明 PNG
 */
export async function extractEmoji(
  imageData: ImageData,
  boundingBox: BoundingBox,
  options: {
    useAdvancedRemoval?: boolean;
    tolerance?: number;
    padding?: number;
  } = {}
): Promise<ExtractedEmoji> {
  const { 
    useAdvancedRemoval = true, 
    tolerance = 30,
    padding = 5,
  } = options;
  
  // 1. 裁剪图片
  const croppedImageData = cropImage(imageData, boundingBox, padding);
  
  // 2. 检测背景色
  const backgroundColor = detectBackgroundColor(croppedImageData, { tolerance });
  
  let finalImageData: ImageData;
  let blob: Blob;
  
  if (useAdvancedRemoval) {
    try {
      // 使用高级背景移除
      const croppedBlob = await imageDataToBlob(croppedImageData);
      blob = await removeBackground(croppedBlob);
      
      // 从 blob 获取 ImageData
      const img = await loadImageFromBlob(blob);
      finalImageData = getImageDataFromImage(img);
    } catch (error) {
      console.warn('Advanced background removal failed, falling back to simple removal:', error);
      // 回退到简单背景移除
      finalImageData = removeBackgroundSimple(croppedImageData, backgroundColor, tolerance);
      blob = await imageDataToBlob(finalImageData);
    }
  } else {
    // 使用简单背景移除
    finalImageData = removeBackgroundSimple(croppedImageData, backgroundColor, tolerance);
    blob = await imageDataToBlob(finalImageData);
  }
  
  // 3. 生成预览 URL
  const preview = imageDataToPreviewUrl(finalImageData);
  
  return {
    id: generateId(),
    imageData: finalImageData,
    blob,
    preview,
    boundingBox,
  };
}

/**
 * 从生成的大图中提取所有表情
 */
export async function extractAllEmojis(
  image: HTMLImageElement | Blob,
  options: {
    useAdvancedRemoval?: boolean;
    tolerance?: number;
    minArea?: number;
    minSize?: number;
    padding?: number;
  } = {}
): Promise<ExtractedEmoji[]> {
  const {
    useAdvancedRemoval = true,
    tolerance = 30,
    minArea = 100,
    minSize = 10,
    padding = 5,
  } = options;
  
  // 获取 ImageData
  let imageData: ImageData;
  if (image instanceof Blob) {
    const img = await loadImageFromBlob(image);
    imageData = getImageDataFromImage(img);
  } else {
    imageData = getImageDataFromImage(image);
  }
  
  // 检测所有表情区域
  const boundingBoxes = detectEmojis(imageData, { tolerance, minArea, minSize });
  
  // 提取每个表情
  const emojis: ExtractedEmoji[] = [];
  for (const box of boundingBoxes) {
    try {
      const emoji = await extractEmoji(imageData, box, {
        useAdvancedRemoval,
        tolerance,
        padding,
      });
      emojis.push(emoji);
    } catch (error) {
      console.error('Failed to extract emoji:', error);
    }
  }
  
  return emojis;
}
