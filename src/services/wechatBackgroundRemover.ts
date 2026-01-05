/**
 * 微信表情平台背景移除服务
 * 负责为 P2 封面图和 P3 图标移除背景，输出透明 PNG
 * 
 * Requirements: 5.1, 5.2, 5.3
 */

import type { StandardizationError } from '../types/wechatStandardization';

/**
 * 背景移除选项
 */
export interface BackgroundRemovalOptions {
  /** 是否使用高级 AI 背景移除（默认 true） */
  useAdvancedRemoval?: boolean;
  /** 简单背景移除的颜色容差（0-255，默认 30） */
  tolerance?: number;
  /** 是否启用边缘羽化（默认 true） */
  featherEdge?: boolean;
}

/**
 * 背景移除结果
 */
export interface BackgroundRemovalResult {
  /** 处理后的图片 Blob（带透明通道的 PNG） */
  blob: Blob;
  /** 使用的方法 */
  method: 'advanced' | 'simple';
  /** 是否发生了回退 */
  didFallback: boolean;
  /** 错误信息（如果有） */
  error?: string;
}

/**
 * RGBA 颜色类型
 */
interface RGBAColor {
  r: number;
  g: number;
  b: number;
  a: number;
}

/**
 * 将 Blob 转换为 HTMLImageElement
 */
async function blobToImage(blob: Blob): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    const url = URL.createObjectURL(blob);
    
    img.onload = () => {
      URL.revokeObjectURL(url);
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
function getImageDataFromImage(image: HTMLImageElement): ImageData {
  const canvas = document.createElement('canvas');
  canvas.width = image.naturalWidth || image.width;
  canvas.height = image.naturalHeight || image.height;
  const ctx = canvas.getContext('2d')!;
  ctx.drawImage(image, 0, 0);
  return ctx.getImageData(0, 0, canvas.width, canvas.height);
}

/**
 * 将 ImageData 转换为 Blob
 */
function imageDataToBlob(imageData: ImageData): Promise<Blob> {
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
 * 计算两个颜色之间的欧几里得距离
 */
function colorDistance(c1: RGBAColor, c2: RGBAColor): number {
  return Math.sqrt(
    Math.pow(c1.r - c2.r, 2) +
    Math.pow(c1.g - c2.g, 2) +
    Math.pow(c1.b - c2.b, 2)
  );
}

/**
 * 判断两个颜色是否相似（在容差范围内）
 */
function colorsAreSimilar(c1: RGBAColor, c2: RGBAColor, tolerance: number): boolean {
  return colorDistance(c1, c2) <= tolerance;
}

/**
 * 采样图片四角像素，检测背景色
 */
function detectBackgroundColor(imageData: ImageData, tolerance: number = 30): RGBAColor {
  const { width, height, data } = imageData;
  
  const getPixelColor = (x: number, y: number): RGBAColor => {
    const index = (y * width + x) * 4;
    return {
      r: data[index],
      g: data[index + 1],
      b: data[index + 2],
      a: data[index + 3],
    };
  };
  
  // 采样四角像素（稍微向内偏移以避免边缘问题）
  const offset = Math.min(5, Math.floor(Math.min(width, height) / 10));
  const samplePositions = [
    { x: offset, y: offset },
    { x: width - 1 - offset, y: offset },
    { x: offset, y: height - 1 - offset },
    { x: width - 1 - offset, y: height - 1 - offset },
  ];
  
  const sampledColors = samplePositions.map(pos => getPixelColor(pos.x, pos.y));
  
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
  
  colorGroups.sort((a, b) => b.count - a.count);
  return colorGroups[0]?.color ?? { r: 255, g: 255, b: 255, a: 255 };
}


/**
 * 使用 Flood Fill 从边缘移除背景
 * 只移除与边缘相连的背景色区域，保护主体内部的相似颜色
 */
function removeBackgroundFloodFill(
  imageData: ImageData,
  backgroundColor: RGBAColor,
  tolerance: number = 30,
  featherEdge: boolean = true
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
  const removed = new Uint8Array(width * height);
  
  const getPixelColorAt = (x: number, y: number): RGBAColor => {
    const index = (y * width + x) * 4;
    return {
      r: data[index],
      g: data[index + 1],
      b: data[index + 2],
      a: data[index + 3],
    };
  };
  
  const isBackgroundPixel = (x: number, y: number): boolean => {
    if (x < 0 || x >= width || y < 0 || y >= height) return false;
    const color = getPixelColorAt(x, y);
    if (color.a < 128) return false;
    return colorsAreSimilar(color, backgroundColor, tolerance);
  };
  
  const directions = [
    { dx: 0, dy: -1 },
    { dx: 0, dy: 1 },
    { dx: -1, dy: 0 },
    { dx: 1, dy: 0 },
  ];
  
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
      
      const pixelIndex = arrayIdx * 4;
      resultImageData.data[pixelIndex + 3] = 0;
      removed[arrayIdx] = 1;
      
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
  
  // 从边缘开始填充
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
  
  // 边缘羽化处理
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
 * 使用 @imgly/background-removal 进行高级背景移除
 */
async function advancedBackgroundRemoval(imageBlob: Blob): Promise<Blob> {
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
 * 简单背景移除（基于 Flood Fill 算法）
 */
async function simpleBackgroundRemoval(
  imageBlob: Blob,
  options: { tolerance?: number; featherEdge?: boolean } = {}
): Promise<Blob> {
  const { tolerance = 30, featherEdge = true } = options;
  
  const img = await blobToImage(imageBlob);
  const imageData = getImageDataFromImage(img);
  const backgroundColor = detectBackgroundColor(imageData, tolerance);
  const resultImageData = removeBackgroundFloodFill(imageData, backgroundColor, tolerance, featherEdge);
  
  return imageDataToBlob(resultImageData);
}


/**
 * 移除背景（带回退机制）
 * 优先使用高级 AI 背景移除，失败时回退到简单算法
 * 
 * @param imageBlob 源图片 Blob
 * @param options 背景移除选项
 * @returns 背景移除结果
 */
export async function removeBackground(
  imageBlob: Blob,
  options: BackgroundRemovalOptions = {}
): Promise<BackgroundRemovalResult> {
  const {
    useAdvancedRemoval = true,
    tolerance = 30,
    featherEdge = true,
  } = options;
  
  if (useAdvancedRemoval) {
    try {
      const blob = await advancedBackgroundRemoval(imageBlob);
      return {
        blob,
        method: 'advanced',
        didFallback: false,
      };
    } catch (error) {
      console.warn('[wechatBackgroundRemover] Advanced removal failed, falling back to simple:', error);
      
      // 回退到简单背景移除
      const blob = await simpleBackgroundRemoval(imageBlob, { tolerance, featherEdge });
      return {
        blob,
        method: 'simple',
        didFallback: true,
        error: error instanceof Error ? error.message : String(error),
      };
    }
  }
  
  // 直接使用简单背景移除
  const blob = await simpleBackgroundRemoval(imageBlob, { tolerance, featherEdge });
  return {
    blob,
    method: 'simple',
    didFallback: false,
  };
}

/**
 * 为 P2 封面图移除背景
 * 输出带透明通道的 PNG 图片
 * 
 * Requirements: 5.1, 5.3
 * 
 * @param imageBlob 源图片 Blob
 * @param options 背景移除选项
 * @returns 背景移除结果
 */
export async function removeBackgroundForCover(
  imageBlob: Blob,
  options: BackgroundRemovalOptions = {}
): Promise<BackgroundRemovalResult> {
  return removeBackground(imageBlob, {
    useAdvancedRemoval: true,
    tolerance: 30,
    featherEdge: true,
    ...options,
  });
}

/**
 * 为 P3 图标移除背景
 * 输出带透明通道的 PNG 图片
 * 
 * Requirements: 5.2, 5.3
 * 
 * @param imageBlob 源图片 Blob
 * @param options 背景移除选项
 * @returns 背景移除结果
 */
export async function removeBackgroundForIcon(
  imageBlob: Blob,
  options: BackgroundRemovalOptions = {}
): Promise<BackgroundRemovalResult> {
  return removeBackground(imageBlob, {
    useAdvancedRemoval: true,
    tolerance: 30,
    featherEdge: true,
    ...options,
  });
}

/**
 * 检查图片是否包含透明像素
 * 用于验证背景移除是否成功
 * 
 * @param imageBlob 图片 Blob
 * @returns 是否包含透明像素
 */
export async function hasTransparentPixels(imageBlob: Blob): Promise<boolean> {
  const img = await blobToImage(imageBlob);
  const imageData = getImageDataFromImage(img);
  const { data } = imageData;
  
  // 检查是否有任何透明像素（alpha < 255）
  for (let i = 3; i < data.length; i += 4) {
    if (data[i] < 255) {
      return true;
    }
  }
  
  return false;
}

/**
 * 创建标准化错误对象
 */
export function createBackgroundRemovalError(
  message: string,
  details?: unknown
): StandardizationError {
  return {
    type: 'BACKGROUND_REMOVAL_FAILED',
    message,
    details,
  };
}

/**
 * 导出 WeChatBackgroundRemover 对象
 */
export const WeChatBackgroundRemover = {
  removeBackground,
  removeBackgroundForCover,
  removeBackgroundForIcon,
  hasTransparentPixels,
  createBackgroundRemovalError,
};

export default WeChatBackgroundRemover;
