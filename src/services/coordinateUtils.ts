/**
 * 坐标工具函数
 * 用于验证、转换和处理多边形和边界框坐标
 */

import type { Point, Polygon } from '../types/segmentation';
import type { BoundingBox } from '../types/image';

/**
 * 验证多边形是否有效（至少 3 个顶点）
 * @param polygon 多边形对象
 * @returns 是否有效
 */
export function isValidPolygon(polygon: Polygon): boolean {
  if (!polygon || !polygon.vertices || !Array.isArray(polygon.vertices)) {
    return false;
  }
  return polygon.vertices.length >= 3;
}

/**
 * 将坐标限制在图片边界内
 * @param point 原始坐标点
 * @param imageWidth 图片宽度
 * @param imageHeight 图片高度
 * @returns 限制后的坐标点
 */
export function clampCoordinates(
  point: Point,
  imageWidth: number,
  imageHeight: number
): Point {
  return {
    x: Math.max(0, Math.min(point.x, imageWidth - 1)),
    y: Math.max(0, Math.min(point.y, imageHeight - 1)),
  };
}

/**
 * 将百分比坐标转换为像素坐标
 * @param point 坐标点
 * @param imageWidth 图片宽度
 * @param imageHeight 图片高度
 * @param isPercentage 是否为百分比坐标
 * @returns 像素坐标
 */
export function normalizeCoordinates(
  point: Point,
  imageWidth: number,
  imageHeight: number,
  isPercentage: boolean
): Point {
  if (!isPercentage) {
    return { ...point };
  }
  return {
    x: (point.x / 100) * imageWidth,
    y: (point.y / 100) * imageHeight,
  };
}

/**
 * 将矩形坐标（左上角和右下角）转换为 BoundingBox
 * @param topLeft 左上角坐标
 * @param bottomRight 右下角坐标
 * @returns BoundingBox 对象
 */
export function rectangleToBoundingBox(
  topLeft: Point,
  bottomRight: Point
): BoundingBox {
  return {
    x: topLeft.x,
    y: topLeft.y,
    width: bottomRight.x - topLeft.x,
    height: bottomRight.y - topLeft.y,
  };
}

/**
 * 将 BoundingBox 转换为多边形（4个顶点的矩形）
 * @param box BoundingBox 对象
 * @returns 多边形对象
 */
export function boundingBoxToPolygon(box: BoundingBox): Polygon {
  return {
    vertices: [
      { x: box.x, y: box.y },                           // 左上
      { x: box.x + box.width, y: box.y },               // 右上
      { x: box.x + box.width, y: box.y + box.height },  // 右下
      { x: box.x, y: box.y + box.height },              // 左下
    ],
  };
}
