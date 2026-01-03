/**
 * 几何工具函数
 * 用于手动框选切割功能的几何计算
 */

import type { Point, Polygon, BoundingBox } from '../types/selection';

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
 * 判断两条线段是否相交
 * @param p1 线段1起点
 * @param p2 线段1终点
 * @param p3 线段2起点
 * @param p4 线段2终点
 * @returns 是否相交
 */
export function doEdgesIntersect(
  p1: Point,
  p2: Point,
  p3: Point,
  p4: Point
): boolean {
  // 计算方向
  const d1 = direction(p3, p4, p1);
  const d2 = direction(p3, p4, p2);
  const d3 = direction(p1, p2, p3);
  const d4 = direction(p1, p2, p4);

  // 检查一般情况的相交
  if (((d1 > 0 && d2 < 0) || (d1 < 0 && d2 > 0)) &&
      ((d3 > 0 && d4 < 0) || (d3 < 0 && d4 > 0))) {
    return true;
  }

  // 检查共线情况
  if (d1 === 0 && onSegment(p3, p4, p1)) return true;
  if (d2 === 0 && onSegment(p3, p4, p2)) return true;
  if (d3 === 0 && onSegment(p1, p2, p3)) return true;
  if (d4 === 0 && onSegment(p1, p2, p4)) return true;

  return false;
}

/**
 * 计算叉积方向
 */
function direction(p1: Point, p2: Point, p3: Point): number {
  return (p3.x - p1.x) * (p2.y - p1.y) - (p2.x - p1.x) * (p3.y - p1.y);
}

/**
 * 检查点是否在线段上（假设三点共线）
 */
function onSegment(p1: Point, p2: Point, p: Point): boolean {
  return (
    Math.min(p1.x, p2.x) <= p.x &&
    p.x <= Math.max(p1.x, p2.x) &&
    Math.min(p1.y, p2.y) <= p.y &&
    p.y <= Math.max(p1.y, p2.y)
  );
}

/**
 * 判断多边形是否自相交
 * @param polygon 多边形
 * @returns 是否自相交
 */
export function isPolygonSelfIntersecting(polygon: Polygon): boolean {
  const vertices = polygon.vertices;
  if (!vertices || vertices.length < 4) {
    // 三角形不可能自相交
    return false;
  }

  const n = vertices.length;

  // 检查所有非相邻边对
  for (let i = 0; i < n; i++) {
    const p1 = vertices[i];
    const p2 = vertices[(i + 1) % n];

    // 从 i+2 开始检查，跳过相邻边
    for (let j = i + 2; j < n; j++) {
      // 跳过首尾相邻的边
      if (i === 0 && j === n - 1) continue;

      const p3 = vertices[j];
      const p4 = vertices[(j + 1) % n];

      if (doEdgesIntersect(p1, p2, p3, p4)) {
        return true;
      }
    }
  }

  return false;
}

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
 * 将边界框限制在图片边界内
 * @param boundingBox 原始边界框
 * @param imageWidth 图片宽度
 * @param imageHeight 图片高度
 * @returns 限制后的边界框
 */
export function clampToImageBounds(
  boundingBox: BoundingBox,
  imageWidth: number,
  imageHeight: number
): BoundingBox {
  const x = Math.max(0, Math.min(boundingBox.x, imageWidth));
  const y = Math.max(0, Math.min(boundingBox.y, imageHeight));
  
  // 计算限制后的右下角坐标
  const right = Math.max(x, Math.min(boundingBox.x + boundingBox.width, imageWidth));
  const bottom = Math.max(y, Math.min(boundingBox.y + boundingBox.height, imageHeight));

  return {
    x,
    y,
    width: right - x,
    height: bottom - y,
  };
}

/**
 * 画布坐标变换参数
 */
export interface CanvasTransform {
  /** 缩放级别 */
  zoom: number;
  /** X 轴偏移 */
  offsetX: number;
  /** Y 轴偏移 */
  offsetY: number;
}

/**
 * 将画布坐标转换为图片坐标
 * @param canvasPoint 画布上的点
 * @param transform 变换参数
 * @returns 图片坐标系中的点
 */
export function canvasToImageCoords(
  canvasPoint: Point,
  transform: CanvasTransform
): Point {
  return {
    x: (canvasPoint.x - transform.offsetX) / transform.zoom,
    y: (canvasPoint.y - transform.offsetY) / transform.zoom,
  };
}

/**
 * 将图片坐标转换为画布坐标
 * @param imagePoint 图片上的点
 * @param transform 变换参数
 * @returns 画布坐标系中的点
 */
export function imageToCanvasCoords(
  imagePoint: Point,
  transform: CanvasTransform
): Point {
  return {
    x: imagePoint.x * transform.zoom + transform.offsetX,
    y: imagePoint.y * transform.zoom + transform.offsetY,
  };
}

/**
 * 将多边形从画布坐标转换为图片坐标
 * @param polygon 画布坐标系中的多边形
 * @param transform 变换参数
 * @returns 图片坐标系中的多边形
 */
export function polygonCanvasToImage(
  polygon: Polygon,
  transform: CanvasTransform
): Polygon {
  return {
    vertices: polygon.vertices.map((v) => canvasToImageCoords(v, transform)),
  };
}

/**
 * 将多边形从图片坐标转换为画布坐标
 * @param polygon 图片坐标系中的多边形
 * @param transform 变换参数
 * @returns 画布坐标系中的多边形
 */
export function polygonImageToCanvas(
  polygon: Polygon,
  transform: CanvasTransform
): Polygon {
  return {
    vertices: polygon.vertices.map((v) => imageToCanvasCoords(v, transform)),
  };
}

/**
 * 将边界框从画布坐标转换为图片坐标
 * @param boundingBox 画布坐标系中的边界框
 * @param transform 变换参数
 * @returns 图片坐标系中的边界框
 */
export function boundingBoxCanvasToImage(
  boundingBox: BoundingBox,
  transform: CanvasTransform
): BoundingBox {
  const topLeft = canvasToImageCoords(
    { x: boundingBox.x, y: boundingBox.y },
    transform
  );
  return {
    x: topLeft.x,
    y: topLeft.y,
    width: boundingBox.width / transform.zoom,
    height: boundingBox.height / transform.zoom,
  };
}

/**
 * 将边界框从图片坐标转换为画布坐标
 * @param boundingBox 图片坐标系中的边界框
 * @param transform 变换参数
 * @returns 画布坐标系中的边界框
 */
export function boundingBoxImageToCanvas(
  boundingBox: BoundingBox,
  transform: CanvasTransform
): BoundingBox {
  const topLeft = imageToCanvasCoords(
    { x: boundingBox.x, y: boundingBox.y },
    transform
  );
  return {
    x: topLeft.x,
    y: topLeft.y,
    width: boundingBox.width * transform.zoom,
    height: boundingBox.height * transform.zoom,
  };
}
