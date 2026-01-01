/**
 * Polygon Cropper Service
 * 负责使用多边形轮廓裁剪图片
 */

import type { Point, Polygon, SegmentationRegion } from '../types/segmentation';
import type { BoundingBox, ExtractedEmoji } from '../types/image';
import { imageDataToBlob, imageDataToPreviewUrl } from './imageSplitter';

// 生成唯一 ID
const generateId = () => `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;

/**
 * 计算多边形的边界框
 * @param polygon 多边形对象
 * @returns 包含所有顶点的最小边界框
 */
export function calculatePolygonBoundingBox(polygon: Polygon): BoundingBox {
  if (!polygon.vertices || polygon.vertices.length === 0) {
    return { x: 0, y: 0, width: 0, height: 0 };
  }

  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;

  for (const vertex of polygon.vertices) {
    minX = Math.min(minX, vertex.x);
    minY = Math.min(minY, vertex.y);
    maxX = Math.max(maxX, vertex.x);
    maxY = Math.max(maxY, vertex.y);
  }

  return {
    x: minX,
    y: minY,
    width: maxX - minX,
    height: maxY - minY,
  };
}

/**
 * 判断多边形是否为凸多边形
 * 使用叉积法：遍历所有相邻边，检查叉积符号是否一致
 * @param polygon 多边形对象
 * @returns 是否为凸多边形
 */
export function isConvexPolygon(polygon: Polygon): boolean {
  const vertices = polygon.vertices;
  if (!vertices || vertices.length < 3) {
    return false;
  }

  const n = vertices.length;
  let sign: number | null = null;

  for (let i = 0; i < n; i++) {
    const p1 = vertices[i];
    const p2 = vertices[(i + 1) % n];
    const p3 = vertices[(i + 2) % n];

    // 计算向量 p1->p2 和 p2->p3 的叉积
    const dx1 = p2.x - p1.x;
    const dy1 = p2.y - p1.y;
    const dx2 = p3.x - p2.x;
    const dy2 = p3.y - p2.y;

    const crossProduct = dx1 * dy2 - dy1 * dx2;

    // 跳过共线的点（叉积为0）
    if (crossProduct === 0) {
      continue;
    }

    const currentSign = crossProduct > 0 ? 1 : -1;

    if (sign === null) {
      sign = currentSign;
    } else if (sign !== currentSign) {
      // 叉积符号不一致，说明是凹多边形
      return false;
    }
  }

  return true;
}

/**
 * 判断点是否在多边形内部
 * 使用射线法（Ray Casting Algorithm）
 * @param point 待检测的点
 * @param polygon 多边形
 * @returns 点是否在多边形内部
 */
export function isPointInPolygon(point: Point, polygon: Polygon): boolean {
  const vertices = polygon.vertices;
  if (!vertices || vertices.length < 3) {
    return false;
  }

  let inside = false;
  const n = vertices.length;

  for (let i = 0, j = n - 1; i < n; j = i++) {
    const xi = vertices[i].x;
    const yi = vertices[i].y;
    const xj = vertices[j].x;
    const yj = vertices[j].y;

    // 检查射线是否与边相交
    const intersect =
      yi > point.y !== yj > point.y &&
      point.x < ((xj - xi) * (point.y - yi)) / (yj - yi) + xi;

    if (intersect) {
      inside = !inside;
    }
  }

  return inside;
}

/**
 * 使用多边形裁剪图片
 * @param imageData 原始图片数据
 * @param region 分割区域
 * @param padding 边距（默认为0）
 * @returns 裁剪后的图片数据，多边形外部为透明
 */
export function cropWithPolygon(
  imageData: ImageData,
  region: SegmentationRegion,
  padding: number = 0
): ImageData {
  const { boundingBox, polygon, type } = region;

  // 计算裁剪区域（考虑 padding）
  const cropX = Math.max(0, Math.floor(boundingBox.x - padding));
  const cropY = Math.max(0, Math.floor(boundingBox.y - padding));
  const cropWidth = Math.min(
    imageData.width - cropX,
    Math.ceil(boundingBox.width + padding * 2)
  );
  const cropHeight = Math.min(
    imageData.height - cropY,
    Math.ceil(boundingBox.height + padding * 2)
  );

  // 创建结果 ImageData
  const canvas = document.createElement('canvas');
  canvas.width = cropWidth;
  canvas.height = cropHeight;
  const ctx = canvas.getContext('2d')!;
  const resultImageData = ctx.createImageData(cropWidth, cropHeight);

  // 如果是矩形类型或没有多边形数据，直接复制像素
  if (type === 'rectangle' || !polygon) {
    for (let cy = 0; cy < cropHeight; cy++) {
      for (let cx = 0; cx < cropWidth; cx++) {
        const srcX = cropX + cx;
        const srcY = cropY + cy;

        if (srcX >= 0 && srcX < imageData.width && srcY >= 0 && srcY < imageData.height) {
          const srcIndex = (srcY * imageData.width + srcX) * 4;
          const dstIndex = (cy * cropWidth + cx) * 4;

          resultImageData.data[dstIndex] = imageData.data[srcIndex];
          resultImageData.data[dstIndex + 1] = imageData.data[srcIndex + 1];
          resultImageData.data[dstIndex + 2] = imageData.data[srcIndex + 2];
          resultImageData.data[dstIndex + 3] = imageData.data[srcIndex + 3];
        }
      }
    }
    return resultImageData;
  }

  // 将多边形坐标转换为相对于裁剪区域的坐标
  const localPolygon: Polygon = {
    vertices: polygon.vertices.map((v) => ({
      x: v.x - cropX,
      y: v.y - cropY,
    })),
  };

  // 遍历每个像素，检查是否在多边形内
  for (let cy = 0; cy < cropHeight; cy++) {
    for (let cx = 0; cx < cropWidth; cx++) {
      const srcX = cropX + cx;
      const srcY = cropY + cy;
      const dstIndex = (cy * cropWidth + cx) * 4;

      // 检查点是否在多边形内
      const point: Point = { x: cx + 0.5, y: cy + 0.5 }; // 使用像素中心点
      const isInside = isPointInPolygon(point, localPolygon);

      if (isInside && srcX >= 0 && srcX < imageData.width && srcY >= 0 && srcY < imageData.height) {
        const srcIndex = (srcY * imageData.width + srcX) * 4;
        resultImageData.data[dstIndex] = imageData.data[srcIndex];
        resultImageData.data[dstIndex + 1] = imageData.data[srcIndex + 1];
        resultImageData.data[dstIndex + 2] = imageData.data[srcIndex + 2];
        resultImageData.data[dstIndex + 3] = imageData.data[srcIndex + 3];
      } else {
        // 多边形外部设为透明
        resultImageData.data[dstIndex] = 0;
        resultImageData.data[dstIndex + 1] = 0;
        resultImageData.data[dstIndex + 2] = 0;
        resultImageData.data[dstIndex + 3] = 0;
      }
    }
  }

  return resultImageData;
}


/**
 * 批量提取表情（支持多边形）
 * @param imageData 原始图片数据
 * @param regions 分割区域列表
 * @param options 提取选项
 * @returns 提取的表情列表
 */
export async function extractEmojisFromRegions(
  imageData: ImageData,
  regions: SegmentationRegion[],
  options: {
    padding?: number;
  } = {}
): Promise<ExtractedEmoji[]> {
  const { padding = 5 } = options;
  const emojis: ExtractedEmoji[] = [];

  for (const region of regions) {
    try {
      // 使用多边形裁剪
      const croppedImageData = cropWithPolygon(imageData, region, padding);

      // 转换为 Blob 和预览 URL
      const blob = await imageDataToBlob(croppedImageData);
      const preview = imageDataToPreviewUrl(croppedImageData);

      emojis.push({
        id: generateId(),
        blob,
        preview,
        boundingBox: region.boundingBox,
      });
    } catch (error) {
      console.error(`[PolygonCropper] Failed to extract region ${region.id}:`, error);
    }
  }

  return emojis;
}
