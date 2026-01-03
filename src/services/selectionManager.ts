/**
 * 选区管理器
 * 负责创建、更新、删除选区以及管理操作历史
 */

import type {
  SelectionRegion,
  SelectionAction,
  SelectionActionType,
  Point,
  Polygon,
  BoundingBox,
} from '../types/selection';
import {
  calculatePolygonBoundingBox,
  clampToImageBounds,
  isPolygonSelfIntersecting,
} from '../utils/geometry';

/**
 * 生成唯一的选区 ID
 * 使用时间戳 + 随机数确保唯一性
 */
export function generateSelectionId(): string {
  const timestamp = Date.now().toString(36);
  const random = Math.random().toString(36).substring(2, 8);
  return `sel_${timestamp}_${random}`;
}

/**
 * 创建矩形选区
 * @param startPoint 起始点（拖拽起点）
 * @param endPoint 结束点（拖拽终点）
 * @param imageWidth 图片宽度
 * @param imageHeight 图片高度
 * @returns 选区对象，如果无效则返回 null
 */
export function createRectangleSelection(
  startPoint: Point,
  endPoint: Point,
  imageWidth: number,
  imageHeight: number
): SelectionRegion | null {
  // 计算边界框，处理任意方向的拖拽
  const minX = Math.min(startPoint.x, endPoint.x);
  const minY = Math.min(startPoint.y, endPoint.y);
  const maxX = Math.max(startPoint.x, endPoint.x);
  const maxY = Math.max(startPoint.y, endPoint.y);

  const boundingBox: BoundingBox = {
    x: minX,
    y: minY,
    width: maxX - minX,
    height: maxY - minY,
  };

  // 限制在图片边界内
  const clampedBox = clampToImageBounds(boundingBox, imageWidth, imageHeight);

  // 验证选区有效性（必须有正的宽高）
  if (clampedBox.width <= 0 || clampedBox.height <= 0) {
    return null;
  }

  return {
    id: generateSelectionId(),
    type: 'rectangle',
    boundingBox: clampedBox,
    createdAt: Date.now(),
    isSelected: false,
  };
}

/**
 * 创建多边形选区
 * @param vertices 多边形顶点数组
 * @param imageWidth 图片宽度
 * @param imageHeight 图片高度
 * @returns 选区对象，如果无效则返回 null
 */
export function createPolygonSelection(
  vertices: Point[],
  imageWidth: number,
  imageHeight: number
): SelectionRegion | null {
  // 验证顶点数量（至少 3 个顶点）
  if (vertices.length < 3) {
    return null;
  }

  // 限制顶点在图片边界内
  const clampedVertices = vertices.map((v) => ({
    x: Math.max(0, Math.min(v.x, imageWidth)),
    y: Math.max(0, Math.min(v.y, imageHeight)),
  }));

  const polygon: Polygon = { vertices: clampedVertices };

  // 检查自相交
  if (isPolygonSelfIntersecting(polygon)) {
    return null;
  }

  // 计算边界框
  const boundingBox = calculatePolygonBoundingBox(polygon);

  // 验证边界框有效性
  if (boundingBox.width <= 0 || boundingBox.height <= 0) {
    return null;
  }

  return {
    id: generateSelectionId(),
    type: 'polygon',
    boundingBox,
    polygon,
    createdAt: Date.now(),
    isSelected: false,
  };
}

/**
 * 更新选区位置（移动）
 * @param selection 原选区
 * @param deltaX X 轴移动量
 * @param deltaY Y 轴移动量
 * @param imageWidth 图片宽度
 * @param imageHeight 图片高度
 * @returns 更新后的选区
 */
export function updateSelectionPosition(
  selection: SelectionRegion,
  deltaX: number,
  deltaY: number,
  imageWidth: number,
  imageHeight: number
): SelectionRegion {
  // 计算新位置
  let newX = selection.boundingBox.x + deltaX;
  let newY = selection.boundingBox.y + deltaY;

  // 限制在图片边界内
  newX = Math.max(0, Math.min(newX, imageWidth - selection.boundingBox.width));
  newY = Math.max(0, Math.min(newY, imageHeight - selection.boundingBox.height));

  // 计算实际移动量
  const actualDeltaX = newX - selection.boundingBox.x;
  const actualDeltaY = newY - selection.boundingBox.y;

  const newBoundingBox: BoundingBox = {
    ...selection.boundingBox,
    x: newX,
    y: newY,
  };

  // 如果是多边形，同时移动所有顶点
  let newPolygon: Polygon | undefined;
  if (selection.polygon) {
    newPolygon = {
      vertices: selection.polygon.vertices.map((v) => ({
        x: v.x + actualDeltaX,
        y: v.y + actualDeltaY,
      })),
    };
  }

  return {
    ...selection,
    boundingBox: newBoundingBox,
    polygon: newPolygon,
  };
}

/**
 * 更新选区大小（调整尺寸）
 * @param selection 原选区
 * @param newBoundingBox 新的边界框
 * @param imageWidth 图片宽度
 * @param imageHeight 图片高度
 * @returns 更新后的选区，如果无效则返回 null
 */
export function updateSelectionSize(
  selection: SelectionRegion,
  newBoundingBox: BoundingBox,
  imageWidth: number,
  imageHeight: number
): SelectionRegion | null {
  // 限制在图片边界内
  const clampedBox = clampToImageBounds(newBoundingBox, imageWidth, imageHeight);

  // 验证有效性
  if (clampedBox.width <= 0 || clampedBox.height <= 0) {
    return null;
  }

  // 对于矩形选区，直接更新边界框
  if (selection.type === 'rectangle') {
    return {
      ...selection,
      boundingBox: clampedBox,
    };
  }

  // 对于多边形选区，按比例缩放顶点
  if (selection.polygon) {
    const oldBox = selection.boundingBox;
    const scaleX = clampedBox.width / oldBox.width;
    const scaleY = clampedBox.height / oldBox.height;

    const newVertices = selection.polygon.vertices.map((v) => ({
      x: clampedBox.x + (v.x - oldBox.x) * scaleX,
      y: clampedBox.y + (v.y - oldBox.y) * scaleY,
    }));

    const newPolygon: Polygon = { vertices: newVertices };

    // 检查缩放后是否自相交
    if (isPolygonSelfIntersecting(newPolygon)) {
      return null;
    }

    return {
      ...selection,
      boundingBox: clampedBox,
      polygon: newPolygon,
    };
  }

  return {
    ...selection,
    boundingBox: clampedBox,
  };
}


/**
 * 移动多边形的单个顶点
 * @param selection 原选区（必须是多边形类型）
 * @param vertexIndex 要移动的顶点索引
 * @param newPosition 新位置
 * @param imageWidth 图片宽度
 * @param imageHeight 图片高度
 * @returns 更新后的选区，如果无效则返回 null
 */
export function movePolygonVertex(
  selection: SelectionRegion,
  vertexIndex: number,
  newPosition: Point,
  imageWidth: number,
  imageHeight: number
): SelectionRegion | null {
  // 验证是多边形类型
  if (selection.type !== 'polygon' || !selection.polygon) {
    return null;
  }

  const vertices = selection.polygon.vertices;

  // 验证顶点索引有效
  if (vertexIndex < 0 || vertexIndex >= vertices.length) {
    return null;
  }

  // 限制新位置在图片边界内
  const clampedPosition: Point = {
    x: Math.max(0, Math.min(newPosition.x, imageWidth)),
    y: Math.max(0, Math.min(newPosition.y, imageHeight)),
  };

  // 创建新的顶点数组
  const newVertices = vertices.map((v, i) =>
    i === vertexIndex ? clampedPosition : { ...v }
  );

  const newPolygon: Polygon = { vertices: newVertices };

  // 检查是否自相交
  if (isPolygonSelfIntersecting(newPolygon)) {
    return null;
  }

  // 重新计算边界框
  const newBoundingBox = calculatePolygonBoundingBox(newPolygon);

  return {
    ...selection,
    boundingBox: newBoundingBox,
    polygon: newPolygon,
  };
}

/**
 * 在多边形边上插入新顶点
 * @param selection 原选区（必须是多边形类型）
 * @param edgeIndex 边的索引（边连接 vertices[edgeIndex] 和 vertices[edgeIndex+1]）
 * @param insertPosition 插入位置
 * @param imageWidth 图片宽度
 * @param imageHeight 图片高度
 * @returns 更新后的选区，如果无效则返回 null
 */
export function insertPolygonVertex(
  selection: SelectionRegion,
  edgeIndex: number,
  insertPosition: Point,
  imageWidth: number,
  imageHeight: number
): SelectionRegion | null {
  // 验证是多边形类型
  if (selection.type !== 'polygon' || !selection.polygon) {
    return null;
  }

  const vertices = selection.polygon.vertices;

  // 验证边索引有效
  if (edgeIndex < 0 || edgeIndex >= vertices.length) {
    return null;
  }

  // 限制插入位置在图片边界内
  const clampedPosition: Point = {
    x: Math.max(0, Math.min(insertPosition.x, imageWidth)),
    y: Math.max(0, Math.min(insertPosition.y, imageHeight)),
  };

  // 在边的后一个顶点位置插入新顶点
  const insertIndex = edgeIndex + 1;
  const newVertices = [
    ...vertices.slice(0, insertIndex),
    clampedPosition,
    ...vertices.slice(insertIndex),
  ];

  const newPolygon: Polygon = { vertices: newVertices };

  // 检查是否自相交
  if (isPolygonSelfIntersecting(newPolygon)) {
    return null;
  }

  // 重新计算边界框
  const newBoundingBox = calculatePolygonBoundingBox(newPolygon);

  return {
    ...selection,
    boundingBox: newBoundingBox,
    polygon: newPolygon,
  };
}

/**
 * 检查多边形是否闭合（顶点数 >= 3）
 * @param vertices 顶点数组
 * @returns 是否闭合
 */
export function isPolygonClosed(vertices: Point[]): boolean {
  return vertices.length >= 3;
}

/**
 * 验证多边形是否有效（闭合且不自相交）
 * @param vertices 顶点数组
 * @returns 是否有效
 */
export function validatePolygon(vertices: Point[]): {
  valid: boolean;
  error?: 'not_closed' | 'self_intersecting';
} {
  if (!isPolygonClosed(vertices)) {
    return { valid: false, error: 'not_closed' };
  }

  const polygon: Polygon = { vertices };
  if (isPolygonSelfIntersecting(polygon)) {
    return { valid: false, error: 'self_intersecting' };
  }

  return { valid: true };
}


/**
 * 选区历史管理类
 * 用于实现撤销/重做功能
 */
export class SelectionHistory {
  private history: SelectionAction[] = [];
  private currentIndex: number = -1;
  private maxHistorySize: number;

  constructor(maxHistorySize: number = 50) {
    this.maxHistorySize = maxHistorySize;
  }

  /**
   * 记录一个操作
   * @param type 操作类型
   * @param previousState 操作前的状态
   * @param newState 操作后的状态
   */
  pushAction(
    type: SelectionActionType,
    previousState: SelectionRegion[],
    newState: SelectionRegion[]
  ): void {
    // 如果当前不在历史末尾，删除后面的历史
    if (this.currentIndex < this.history.length - 1) {
      this.history = this.history.slice(0, this.currentIndex + 1);
    }

    const action: SelectionAction = {
      type,
      previousState: this.cloneSelections(previousState),
      newState: this.cloneSelections(newState),
      timestamp: Date.now(),
    };

    this.history.push(action);
    this.currentIndex = this.history.length - 1;

    // 限制历史大小
    if (this.history.length > this.maxHistorySize) {
      this.history.shift();
      this.currentIndex--;
    }
  }

  /**
   * 撤销操作
   * @returns 撤销后的状态，如果无法撤销则返回 null
   */
  undo(): SelectionRegion[] | null {
    if (!this.canUndo()) {
      return null;
    }

    const action = this.history[this.currentIndex];
    this.currentIndex--;

    return this.cloneSelections(action.previousState);
  }

  /**
   * 重做操作
   * @returns 重做后的状态，如果无法重做则返回 null
   */
  redo(): SelectionRegion[] | null {
    if (!this.canRedo()) {
      return null;
    }

    this.currentIndex++;
    const action = this.history[this.currentIndex];

    return this.cloneSelections(action.newState);
  }

  /**
   * 是否可以撤销
   */
  canUndo(): boolean {
    return this.currentIndex >= 0;
  }

  /**
   * 是否可以重做
   */
  canRedo(): boolean {
    return this.currentIndex < this.history.length - 1;
  }

  /**
   * 清空历史
   */
  clear(): void {
    this.history = [];
    this.currentIndex = -1;
  }

  /**
   * 获取当前历史长度
   */
  getHistoryLength(): number {
    return this.history.length;
  }

  /**
   * 获取当前索引
   */
  getCurrentIndex(): number {
    return this.currentIndex;
  }

  /**
   * 深拷贝选区数组
   */
  private cloneSelections(selections: SelectionRegion[]): SelectionRegion[] {
    return selections.map((s) => ({
      ...s,
      boundingBox: { ...s.boundingBox },
      polygon: s.polygon
        ? { vertices: s.polygon.vertices.map((v) => ({ ...v })) }
        : undefined,
    }));
  }
}

/**
 * 创建选区历史管理器实例
 */
export function createSelectionHistory(maxSize?: number): SelectionHistory {
  return new SelectionHistory(maxSize);
}
