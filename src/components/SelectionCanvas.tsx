/**
 * SelectionCanvas 组件
 * 交互式画布组件，用于在图片上绘制和编辑选区
 * 
 * Requirements:
 * - 1.1: 显示图片和交互式覆盖层
 * - 1.2: 保持原始图片宽高比
 * - 1.3: 支持缩放和平移操作
 * - 2.1-2.5: 矩形选区绘制和编辑
 * - 3.1-3.6: 多边形选区绘制和编辑
 * - 8.1-8.5: 键盘快捷键支持
 */

import { useCallback, useEffect, useRef, useState, useMemo } from 'react';
import type { SelectionRegion, SelectionMode, Point, BoundingBox, Polygon } from '../types/selection';
import {
  canvasToImageCoords,
  imageToCanvasCoords,
  boundingBoxImageToCanvas,
  polygonImageToCanvas,
  isPolygonSelfIntersecting,
  type CanvasTransform,
} from '../utils/geometry';
import {
  createRectangleSelection,
  createPolygonSelection,
  updateSelectionPosition,
  updateSelectionSize,
  movePolygonVertex,
  insertPolygonVertex,
} from '../services/selectionManager';

/** 选区手柄类型 */
type HandleType = 
  | 'nw' | 'n' | 'ne' 
  | 'w' | 'e' 
  | 'sw' | 's' | 'se'
  | 'move'
  | 'vertex'
  | 'edge';

/** 拖拽状态 */
interface DragState {
  type: 'draw' | 'move' | 'resize' | 'vertex' | 'pan';
  startPoint: Point;
  currentPoint: Point;
  selectionId?: string;
  handleType?: HandleType;
  vertexIndex?: number;
  edgeIndex?: number;
}

/** 多边形绘制状态 */
interface PolygonDrawState {
  vertices: Point[];
  isComplete: boolean;
}

/** 组件属性 */
export interface SelectionCanvasProps {
  /** 图片元素 */
  image: HTMLImageElement;
  /** 当前选区列表 */
  selections: SelectionRegion[];
  /** 当前绘制模式 */
  mode: SelectionMode;
  /** 当前活动选区 ID */
  activeSelectionId: string | null;
  /** 选区变更回调 */
  onSelectionsChange: (selections: SelectionRegion[]) => void;
  /** 活动选区变更回调 */
  onActiveSelectionChange: (id: string | null) => void;
  /** 模式变更回调 */
  onModeChange?: (mode: SelectionMode) => void;
  /** 撤销回调 */
  onUndo?: () => void;
  /** 删除选区回调 */
  onDeleteSelection?: (id: string) => void;
}

/** 手柄大小 */
const HANDLE_SIZE = 8;
/** 顶点大小 */
const VERTEX_SIZE = 8;
/** 边缘点击检测距离 */
const EDGE_HIT_DISTANCE = 8;
/** 闭合多边形的距离阈值 */
const CLOSE_POLYGON_DISTANCE = 15;
/** 最小缩放级别 */
const MIN_ZOOM = 0.1;
/** 最大缩放级别 */
const MAX_ZOOM = 5;
/** 缩放步进 */
const ZOOM_STEP = 0.1;

/**
 * 计算适应容器的初始缩放和偏移
 */
function calculateFitTransform(
  imageWidth: number,
  imageHeight: number,
  containerWidth: number,
  containerHeight: number
): CanvasTransform {
  const scaleX = containerWidth / imageWidth;
  const scaleY = containerHeight / imageHeight;
  const zoom = Math.min(scaleX, scaleY, 1); // 不超过原始大小
  
  const scaledWidth = imageWidth * zoom;
  const scaledHeight = imageHeight * zoom;
  
  return {
    zoom,
    offsetX: (containerWidth - scaledWidth) / 2,
    offsetY: (containerHeight - scaledHeight) / 2,
  };
}

/**
 * 计算点到线段的距离
 */
function pointToSegmentDistance(point: Point, p1: Point, p2: Point): number {
  const dx = p2.x - p1.x;
  const dy = p2.y - p1.y;
  const lengthSquared = dx * dx + dy * dy;
  
  if (lengthSquared === 0) {
    return Math.sqrt((point.x - p1.x) ** 2 + (point.y - p1.y) ** 2);
  }
  
  let t = ((point.x - p1.x) * dx + (point.y - p1.y) * dy) / lengthSquared;
  t = Math.max(0, Math.min(1, t));
  
  const projX = p1.x + t * dx;
  const projY = p1.y + t * dy;
  
  return Math.sqrt((point.x - projX) ** 2 + (point.y - projY) ** 2);
}

/**
 * 检测点击位置的手柄类型
 */
function detectHandle(
  point: Point,
  selection: SelectionRegion,
  transform: CanvasTransform
): { type: HandleType; vertexIndex?: number; edgeIndex?: number } | null {
  const canvasBox = boundingBoxImageToCanvas(selection.boundingBox, transform);
  
  // 对于多边形，先检测顶点
  if (selection.type === 'polygon' && selection.polygon) {
    const canvasPolygon = polygonImageToCanvas(selection.polygon, transform);
    
    // 检测顶点
    for (let i = 0; i < canvasPolygon.vertices.length; i++) {
      const v = canvasPolygon.vertices[i];
      const dist = Math.sqrt((point.x - v.x) ** 2 + (point.y - v.y) ** 2);
      if (dist <= VERTEX_SIZE) {
        return { type: 'vertex', vertexIndex: i };
      }
    }
    
    // 检测边
    for (let i = 0; i < canvasPolygon.vertices.length; i++) {
      const p1 = canvasPolygon.vertices[i];
      const p2 = canvasPolygon.vertices[(i + 1) % canvasPolygon.vertices.length];
      const dist = pointToSegmentDistance(point, p1, p2);
      if (dist <= EDGE_HIT_DISTANCE) {
        return { type: 'edge', edgeIndex: i };
      }
    }
  }
  
  // 矩形手柄检测
  const handles: { type: HandleType; x: number; y: number }[] = [
    { type: 'nw', x: canvasBox.x, y: canvasBox.y },
    { type: 'n', x: canvasBox.x + canvasBox.width / 2, y: canvasBox.y },
    { type: 'ne', x: canvasBox.x + canvasBox.width, y: canvasBox.y },
    { type: 'w', x: canvasBox.x, y: canvasBox.y + canvasBox.height / 2 },
    { type: 'e', x: canvasBox.x + canvasBox.width, y: canvasBox.y + canvasBox.height / 2 },
    { type: 'sw', x: canvasBox.x, y: canvasBox.y + canvasBox.height },
    { type: 's', x: canvasBox.x + canvasBox.width / 2, y: canvasBox.y + canvasBox.height },
    { type: 'se', x: canvasBox.x + canvasBox.width, y: canvasBox.y + canvasBox.height },
  ];
  
  for (const handle of handles) {
    const dist = Math.sqrt((point.x - handle.x) ** 2 + (point.y - handle.y) ** 2);
    if (dist <= HANDLE_SIZE) {
      return { type: handle.type };
    }
  }
  
  // 检测是否在选区内部（移动）
  if (
    point.x >= canvasBox.x &&
    point.x <= canvasBox.x + canvasBox.width &&
    point.y >= canvasBox.y &&
    point.y <= canvasBox.y + canvasBox.height
  ) {
    return { type: 'move' };
  }
  
  return null;
}

/**
 * 根据手柄类型获取光标样式
 */
function getCursorForHandle(handleType: HandleType | null): string {
  if (!handleType) return 'crosshair';
  
  switch (handleType) {
    case 'nw':
    case 'se':
      return 'nwse-resize';
    case 'ne':
    case 'sw':
      return 'nesw-resize';
    case 'n':
    case 's':
      return 'ns-resize';
    case 'e':
    case 'w':
      return 'ew-resize';
    case 'move':
      return 'move';
    case 'vertex':
      return 'pointer';
    case 'edge':
      return 'copy';
    default:
      return 'crosshair';
  }
}

/**
 * 计算调整大小后的边界框（纯函数，移到组件外部）
 */
function calculateResizedBox(
  box: BoundingBox,
  handleType: HandleType,
  startPoint: Point,
  currentPoint: Point
): BoundingBox {
  const dx = currentPoint.x - startPoint.x;
  const dy = currentPoint.y - startPoint.y;
  
  let { x, y, width, height } = box;
  
  switch (handleType) {
    case 'nw':
      x += dx;
      y += dy;
      width -= dx;
      height -= dy;
      break;
    case 'n':
      y += dy;
      height -= dy;
      break;
    case 'ne':
      y += dy;
      width += dx;
      height -= dy;
      break;
    case 'w':
      x += dx;
      width -= dx;
      break;
    case 'e':
      width += dx;
      break;
    case 'sw':
      x += dx;
      width -= dx;
      height += dy;
      break;
    case 's':
      height += dy;
      break;
    case 'se':
      width += dx;
      height += dy;
      break;
  }
  
  // 确保宽高为正
  if (width < 0) {
    x += width;
    width = -width;
  }
  if (height < 0) {
    y += height;
    height = -height;
  }
  
  return { x, y, width, height };
}

/**
 * SelectionCanvas 组件
 */
export function SelectionCanvas({
  image,
  selections,
  mode,
  activeSelectionId,
  onSelectionsChange,
  onActiveSelectionChange,
  onModeChange,
  onUndo,
  onDeleteSelection,
}: SelectionCanvasProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  
  // 变换状态
  const [transform, setTransform] = useState<CanvasTransform>({
    zoom: 1,
    offsetX: 0,
    offsetY: 0,
  });
  
  // 拖拽状态
  const [dragState, setDragState] = useState<DragState | null>(null);
  
  // 多边形绘制状态
  const [polygonDraw, setPolygonDraw] = useState<PolygonDrawState | null>(null);
  
  // 鼠标位置（用于预览线）
  const [mousePos, setMousePos] = useState<Point | null>(null);
  
  // 自相交警告
  const [selfIntersectWarning, setSelfIntersectWarning] = useState(false);
  
  // 容器尺寸
  const [containerSize, setContainerSize] = useState({ width: 0, height: 0 });

  // 初始化变换
  useEffect(() => {
    if (!containerRef.current) return;
    
    const updateSize = () => {
      const rect = containerRef.current!.getBoundingClientRect();
      setContainerSize({ width: rect.width, height: rect.height });
      
      const newTransform = calculateFitTransform(
        image.width,
        image.height,
        rect.width,
        rect.height
      );
      setTransform(newTransform);
    };
    
    updateSize();
    
    const resizeObserver = new ResizeObserver(updateSize);
    resizeObserver.observe(containerRef.current);
    
    return () => resizeObserver.disconnect();
  }, [image]);

  // 获取画布上的鼠标位置
  const getCanvasPoint = useCallback((e: React.MouseEvent | MouseEvent): Point => {
    if (!canvasRef.current) return { x: 0, y: 0 };
    const rect = canvasRef.current.getBoundingClientRect();
    return {
      x: e.clientX - rect.left,
      y: e.clientY - rect.top,
    };
  }, []);

  // 获取图片坐标
  const getImagePoint = useCallback((canvasPoint: Point): Point => {
    return canvasToImageCoords(canvasPoint, transform);
  }, [transform]);

  // 处理缩放
  const handleWheel = useCallback((e: React.WheelEvent) => {
    e.preventDefault();
    
    const canvasPoint = getCanvasPoint(e);
    const imagePoint = getImagePoint(canvasPoint);
    
    const delta = e.deltaY > 0 ? -ZOOM_STEP : ZOOM_STEP;
    const newZoom = Math.max(MIN_ZOOM, Math.min(MAX_ZOOM, transform.zoom + delta));
    
    // 以鼠标位置为中心缩放
    const newOffsetX = canvasPoint.x - imagePoint.x * newZoom;
    const newOffsetY = canvasPoint.y - imagePoint.y * newZoom;
    
    setTransform({
      zoom: newZoom,
      offsetX: newOffsetX,
      offsetY: newOffsetY,
    });
  }, [transform, getCanvasPoint, getImagePoint]);

  // 完成多边形绘制（移到 handleMouseDown 之前）
  const completePolygon = useCallback(() => {
    if (!polygonDraw || polygonDraw.vertices.length < 3) return;
    
    const newSelection = createPolygonSelection(
      polygonDraw.vertices,
      image.width,
      image.height
    );
    
    if (newSelection) {
      onSelectionsChange([...selections, newSelection]);
      onActiveSelectionChange(newSelection.id);
    }
    
    setPolygonDraw(null);
    setSelfIntersectWarning(false);
  }, [polygonDraw, image, selections, onSelectionsChange, onActiveSelectionChange]);

  // 处理鼠标按下
  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    if (e.button === 1 || (e.button === 0 && e.altKey)) {
      // 中键或 Alt+左键：开始平移
      const canvasPoint = getCanvasPoint(e);
      setDragState({
        type: 'pan',
        startPoint: canvasPoint,
        currentPoint: canvasPoint,
      });
      return;
    }
    
    if (e.button !== 0) return;
    
    const canvasPoint = getCanvasPoint(e);
    const imagePoint = getImagePoint(canvasPoint);
    
    // 检测是否点击了现有选区的手柄
    if (activeSelectionId) {
      const activeSelection = selections.find(s => s.id === activeSelectionId);
      if (activeSelection) {
        const handle = detectHandle(canvasPoint, activeSelection, transform);
        if (handle) {
          if (handle.type === 'move') {
            setDragState({
              type: 'move',
              startPoint: imagePoint,
              currentPoint: imagePoint,
              selectionId: activeSelectionId,
            });
          } else if (handle.type === 'vertex' && handle.vertexIndex !== undefined) {
            setDragState({
              type: 'vertex',
              startPoint: imagePoint,
              currentPoint: imagePoint,
              selectionId: activeSelectionId,
              vertexIndex: handle.vertexIndex,
            });
          } else if (handle.type === 'edge' && handle.edgeIndex !== undefined) {
            // 在边上插入新顶点
            const updated = insertPolygonVertex(
              activeSelection,
              handle.edgeIndex,
              imagePoint,
              image.width,
              image.height
            );
            if (updated) {
              const newSelections = selections.map(s =>
                s.id === activeSelectionId ? { ...updated, id: s.id, createdAt: s.createdAt } : s
              );
              onSelectionsChange(newSelections);
              // 开始拖拽新插入的顶点
              setDragState({
                type: 'vertex',
                startPoint: imagePoint,
                currentPoint: imagePoint,
                selectionId: activeSelectionId,
                vertexIndex: handle.edgeIndex + 1,
              });
            }
          } else {
            setDragState({
              type: 'resize',
              startPoint: imagePoint,
              currentPoint: imagePoint,
              selectionId: activeSelectionId,
              handleType: handle.type,
            });
          }
          return;
        }
      }
    }

    // 检测是否点击了其他选区
    for (const selection of selections) {
      const canvasBox = boundingBoxImageToCanvas(selection.boundingBox, transform);
      if (
        canvasPoint.x >= canvasBox.x &&
        canvasPoint.x <= canvasBox.x + canvasBox.width &&
        canvasPoint.y >= canvasBox.y &&
        canvasPoint.y <= canvasBox.y + canvasBox.height
      ) {
        onActiveSelectionChange(selection.id);
        setDragState({
          type: 'move',
          startPoint: imagePoint,
          currentPoint: imagePoint,
          selectionId: selection.id,
        });
        return;
      }
    }
    
    // 开始绘制新选区
    if (mode === 'rectangle') {
      setDragState({
        type: 'draw',
        startPoint: imagePoint,
        currentPoint: imagePoint,
      });
      onActiveSelectionChange(null);
    } else if (mode === 'polygon') {
      if (!polygonDraw) {
        // 开始新的多边形
        setPolygonDraw({
          vertices: [imagePoint],
          isComplete: false,
        });
        onActiveSelectionChange(null);
      } else {
        // 检查是否接近起点（闭合多边形）
        const startVertex = polygonDraw.vertices[0];
        const canvasStart = imageToCanvasCoords(startVertex, transform);
        const dist = Math.sqrt(
          (canvasPoint.x - canvasStart.x) ** 2 + (canvasPoint.y - canvasStart.y) ** 2
        );
        
        if (dist <= CLOSE_POLYGON_DISTANCE && polygonDraw.vertices.length >= 3) {
          // 闭合多边形
          completePolygon();
        } else {
          // 添加新顶点
          const newVertices = [...polygonDraw.vertices, imagePoint];
          
          // 检查自相交
          if (newVertices.length >= 4) {
            const testPolygon: Polygon = { vertices: newVertices };
            if (isPolygonSelfIntersecting(testPolygon)) {
              setSelfIntersectWarning(true);
              setTimeout(() => setSelfIntersectWarning(false), 2000);
              return;
            }
          }
          
          setPolygonDraw({
            vertices: newVertices,
            isComplete: false,
          });
        }
      }
    }
  }, [
    mode, activeSelectionId, selections, transform, polygonDraw,
    getCanvasPoint, getImagePoint, image, onSelectionsChange, onActiveSelectionChange, completePolygon
  ]);

  // 处理双击（闭合多边形）
  const handleDoubleClick = useCallback(() => {
    if (mode === 'polygon' && polygonDraw && polygonDraw.vertices.length >= 3) {
      completePolygon();
    }
  }, [mode, polygonDraw, completePolygon]);

  // 处理鼠标移动
  const handleMouseMove = useCallback((e: React.MouseEvent) => {
    const canvasPoint = getCanvasPoint(e);
    const imagePoint = getImagePoint(canvasPoint);
    
    setMousePos(canvasPoint);
    
    if (!dragState) return;
    
    if (dragState.type === 'pan') {
      const dx = canvasPoint.x - dragState.startPoint.x;
      const dy = canvasPoint.y - dragState.startPoint.y;
      setTransform(prev => ({
        ...prev,
        offsetX: prev.offsetX + dx,
        offsetY: prev.offsetY + dy,
      }));
      setDragState({
        ...dragState,
        startPoint: canvasPoint,
      });
      return;
    }
    
    setDragState({
      ...dragState,
      currentPoint: imagePoint,
    });
    
    // 实时更新选区
    if (dragState.type === 'move' && dragState.selectionId) {
      const selection = selections.find(s => s.id === dragState.selectionId);
      if (selection) {
        const dx = imagePoint.x - dragState.startPoint.x;
        const dy = imagePoint.y - dragState.startPoint.y;
        const updated = updateSelectionPosition(selection, dx, dy, image.width, image.height);
        const newSelections = selections.map(s =>
          s.id === dragState.selectionId ? updated : s
        );
        onSelectionsChange(newSelections);
        setDragState({
          ...dragState,
          startPoint: imagePoint,
        });
      }
    } else if (dragState.type === 'vertex' && dragState.selectionId && dragState.vertexIndex !== undefined) {
      const selection = selections.find(s => s.id === dragState.selectionId);
      if (selection) {
        const updated = movePolygonVertex(
          selection,
          dragState.vertexIndex,
          imagePoint,
          image.width,
          image.height
        );
        if (updated) {
          const newSelections = selections.map(s =>
            s.id === dragState.selectionId ? { ...updated, id: s.id, createdAt: s.createdAt } : s
          );
          onSelectionsChange(newSelections);
        }
      }
    } else if (dragState.type === 'resize' && dragState.selectionId && dragState.handleType) {
      const selection = selections.find(s => s.id === dragState.selectionId);
      if (selection) {
        const newBox = calculateResizedBox(
          selection.boundingBox,
          dragState.handleType,
          dragState.startPoint,
          imagePoint
        );
        const updated = updateSelectionSize(selection, newBox, image.width, image.height);
        if (updated) {
          const newSelections = selections.map(s =>
            s.id === dragState.selectionId ? { ...updated, id: s.id, createdAt: s.createdAt } : s
          );
          onSelectionsChange(newSelections);
        }
      }
    }
  }, [dragState, selections, image, getCanvasPoint, getImagePoint, onSelectionsChange]);

  // 处理鼠标释放
  const handleMouseUp = useCallback(() => {
    if (!dragState) return;
    
    if (dragState.type === 'draw') {
      // 完成矩形绘制
      const newSelection = createRectangleSelection(
        dragState.startPoint,
        dragState.currentPoint,
        image.width,
        image.height
      );
      
      if (newSelection) {
        onSelectionsChange([...selections, newSelection]);
        onActiveSelectionChange(newSelection.id);
      }
    }
    
    setDragState(null);
  }, [dragState, image, selections, onSelectionsChange, onActiveSelectionChange]);

  // 处理键盘事件
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // 忽略输入框中的按键
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) {
        return;
      }
      
      switch (e.key.toLowerCase()) {
        case 'r':
          onModeChange?.('rectangle');
          break;
        case 'p':
          onModeChange?.('polygon');
          break;
        case 'escape':
          // 取消当前绘制
          if (polygonDraw) {
            setPolygonDraw(null);
            setSelfIntersectWarning(false);
          }
          if (dragState?.type === 'draw') {
            setDragState(null);
          }
          break;
        case 'delete':
        case 'backspace':
          if (activeSelectionId) {
            onDeleteSelection?.(activeSelectionId);
          }
          break;
        case 'z':
          if (e.ctrlKey || e.metaKey) {
            e.preventDefault();
            onUndo?.();
          }
          break;
      }
    };
    
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [mode, activeSelectionId, polygonDraw, dragState, onModeChange, onUndo, onDeleteSelection]);

  // 计算光标样式
  const cursor = useMemo(() => {
    if (dragState?.type === 'pan') return 'grabbing';
    
    if (activeSelectionId && mousePos) {
      const activeSelection = selections.find(s => s.id === activeSelectionId);
      if (activeSelection) {
        const handle = detectHandle(mousePos, activeSelection, transform);
        if (handle) {
          return getCursorForHandle(handle.type);
        }
      }
    }
    
    if (mode === 'polygon') return 'crosshair';
    if (mode === 'rectangle') return 'crosshair';
    return 'default';
  }, [dragState, activeSelectionId, mousePos, selections, transform, mode]);

  // 绘制画布
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    
    // 设置画布尺寸
    canvas.width = containerSize.width;
    canvas.height = containerSize.height;
    
    // 清空画布
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    
    // 绘制图片
    ctx.save();
    ctx.translate(transform.offsetX, transform.offsetY);
    ctx.scale(transform.zoom, transform.zoom);
    ctx.drawImage(image, 0, 0);
    ctx.restore();
    
    // 绘制选区
    for (const selection of selections) {
      const isActive = selection.id === activeSelectionId;
      drawSelection(ctx, selection, transform, isActive);
    }
    
    // 绘制正在绘制的矩形
    if (dragState?.type === 'draw') {
      const startCanvas = imageToCanvasCoords(dragState.startPoint, transform);
      const currentCanvas = imageToCanvasCoords(dragState.currentPoint, transform);
      
      ctx.strokeStyle = '#646cff';
      ctx.lineWidth = 2;
      ctx.setLineDash([5, 5]);
      ctx.fillStyle = 'rgba(100, 108, 255, 0.2)';
      
      const x = Math.min(startCanvas.x, currentCanvas.x);
      const y = Math.min(startCanvas.y, currentCanvas.y);
      const w = Math.abs(currentCanvas.x - startCanvas.x);
      const h = Math.abs(currentCanvas.y - startCanvas.y);
      
      ctx.fillRect(x, y, w, h);
      ctx.strokeRect(x, y, w, h);
      ctx.setLineDash([]);
      
      // 显示尺寸标签
      drawDimensionLabel(ctx, x, y, w, h, dragState.startPoint, dragState.currentPoint);
    }
    
    // 绘制正在绘制的多边形
    if (polygonDraw && polygonDraw.vertices.length > 0) {
      const canvasVertices = polygonDraw.vertices.map(v => imageToCanvasCoords(v, transform));
      
      ctx.strokeStyle = selfIntersectWarning ? '#ef4444' : '#646cff';
      ctx.lineWidth = 2;
      ctx.fillStyle = selfIntersectWarning ? 'rgba(239, 68, 68, 0.2)' : 'rgba(100, 108, 255, 0.2)';
      
      ctx.beginPath();
      ctx.moveTo(canvasVertices[0].x, canvasVertices[0].y);
      for (let i = 1; i < canvasVertices.length; i++) {
        ctx.lineTo(canvasVertices[i].x, canvasVertices[i].y);
      }
      
      // 绘制到鼠标位置的预览线
      if (mousePos) {
        ctx.setLineDash([5, 5]);
        ctx.lineTo(mousePos.x, mousePos.y);
        ctx.setLineDash([]);
      }
      
      ctx.stroke();
      
      // 绘制顶点
      for (const v of canvasVertices) {
        ctx.beginPath();
        ctx.arc(v.x, v.y, VERTEX_SIZE / 2, 0, Math.PI * 2);
        ctx.fillStyle = '#646cff';
        ctx.fill();
        ctx.strokeStyle = '#fff';
        ctx.lineWidth = 2;
        ctx.stroke();
      }
      
      // 高亮起点（如果接近）
      if (mousePos && canvasVertices.length >= 3) {
        const dist = Math.sqrt(
          (mousePos.x - canvasVertices[0].x) ** 2 + (mousePos.y - canvasVertices[0].y) ** 2
        );
        if (dist <= CLOSE_POLYGON_DISTANCE) {
          ctx.beginPath();
          ctx.arc(canvasVertices[0].x, canvasVertices[0].y, VERTEX_SIZE, 0, Math.PI * 2);
          ctx.strokeStyle = '#22c55e';
          ctx.lineWidth = 3;
          ctx.stroke();
        }
      }
    }
    
    // 显示自相交警告
    if (selfIntersectWarning) {
      ctx.fillStyle = 'rgba(239, 68, 68, 0.9)';
      ctx.font = '14px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('⚠️ 多边形不能自相交', canvas.width / 2, 30);
    }
  }, [
    containerSize, transform, image, selections, activeSelectionId,
    dragState, polygonDraw, mousePos, selfIntersectWarning
  ]);

  return (
    <div
      ref={containerRef}
      className="relative w-full h-full overflow-hidden bg-[#1a1a1a] rounded-lg"
      style={{ minHeight: '400px' }}
    >
      <canvas
        ref={canvasRef}
        className="absolute inset-0"
        style={{ cursor }}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseUp}
        onDoubleClick={handleDoubleClick}
        onWheel={handleWheel}
      />
      
      {/* 缩放指示器 */}
      <div className="absolute bottom-2 right-2 px-2 py-1 bg-black/50 rounded text-xs text-white/70">
        {Math.round(transform.zoom * 100)}%
      </div>
      
      {/* 模式指示器 */}
      <div className="absolute top-2 left-2 px-2 py-1 bg-black/50 rounded text-xs text-white/70">
        {mode === 'rectangle' ? '矩形模式 (R)' : mode === 'polygon' ? '多边形模式 (P)' : '选择模式'}
      </div>
      
      {/* 快捷键提示 */}
      <div className="absolute bottom-2 left-2 px-2 py-1 bg-black/50 rounded text-xs text-white/50">
        滚轮缩放 | Alt+拖拽平移 | Esc取消 | Del删除
      </div>
    </div>
  );
}

/**
 * 绘制选区
 */
function drawSelection(
  ctx: CanvasRenderingContext2D,
  selection: SelectionRegion,
  transform: CanvasTransform,
  isActive: boolean
) {
  const canvasBox = boundingBoxImageToCanvas(selection.boundingBox, transform);
  
  // 设置样式
  ctx.strokeStyle = isActive ? '#646cff' : '#888';
  ctx.lineWidth = isActive ? 2 : 1;
  ctx.fillStyle = isActive ? 'rgba(100, 108, 255, 0.15)' : 'rgba(136, 136, 136, 0.1)';
  
  if (selection.type === 'polygon' && selection.polygon) {
    const canvasPolygon = polygonImageToCanvas(selection.polygon, transform);
    
    // 绘制多边形
    ctx.beginPath();
    ctx.moveTo(canvasPolygon.vertices[0].x, canvasPolygon.vertices[0].y);
    for (let i = 1; i < canvasPolygon.vertices.length; i++) {
      ctx.lineTo(canvasPolygon.vertices[i].x, canvasPolygon.vertices[i].y);
    }
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
    
    // 绘制顶点（仅活动选区）
    if (isActive) {
      for (const v of canvasPolygon.vertices) {
        ctx.beginPath();
        ctx.arc(v.x, v.y, VERTEX_SIZE / 2, 0, Math.PI * 2);
        ctx.fillStyle = '#646cff';
        ctx.fill();
        ctx.strokeStyle = '#fff';
        ctx.lineWidth = 2;
        ctx.stroke();
      }
    }
  } else {
    // 绘制矩形
    ctx.fillRect(canvasBox.x, canvasBox.y, canvasBox.width, canvasBox.height);
    ctx.strokeRect(canvasBox.x, canvasBox.y, canvasBox.width, canvasBox.height);
    
    // 绘制调整手柄（仅活动选区）
    if (isActive) {
      drawResizeHandles(ctx, canvasBox);
    }
  }
}

/**
 * 绘制调整手柄
 */
function drawResizeHandles(ctx: CanvasRenderingContext2D, box: BoundingBox) {
  const handles = [
    { x: box.x, y: box.y },
    { x: box.x + box.width / 2, y: box.y },
    { x: box.x + box.width, y: box.y },
    { x: box.x, y: box.y + box.height / 2 },
    { x: box.x + box.width, y: box.y + box.height / 2 },
    { x: box.x, y: box.y + box.height },
    { x: box.x + box.width / 2, y: box.y + box.height },
    { x: box.x + box.width, y: box.y + box.height },
  ];
  
  for (const handle of handles) {
    ctx.fillStyle = '#fff';
    ctx.strokeStyle = '#646cff';
    ctx.lineWidth = 2;
    ctx.fillRect(
      handle.x - HANDLE_SIZE / 2,
      handle.y - HANDLE_SIZE / 2,
      HANDLE_SIZE,
      HANDLE_SIZE
    );
    ctx.strokeRect(
      handle.x - HANDLE_SIZE / 2,
      handle.y - HANDLE_SIZE / 2,
      HANDLE_SIZE,
      HANDLE_SIZE
    );
  }
}

/**
 * 绘制尺寸标签
 */
function drawDimensionLabel(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  _h: number,
  startPoint: Point,
  endPoint: Point
) {
  // 计算实际图片尺寸
  const imgWidth = Math.abs(Math.round(endPoint.x - startPoint.x));
  const imgHeight = Math.abs(Math.round(endPoint.y - startPoint.y));
  
  const label = `${imgWidth} × ${imgHeight}`;
  
  ctx.font = '12px sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'bottom';
  
  const labelX = x + w / 2;
  const labelY = y - 5;
  
  // 背景
  const metrics = ctx.measureText(label);
  const padding = 4;
  ctx.fillStyle = 'rgba(0, 0, 0, 0.7)';
  ctx.fillRect(
    labelX - metrics.width / 2 - padding,
    labelY - 14 - padding,
    metrics.width + padding * 2,
    14 + padding
  );
  
  // 文字
  ctx.fillStyle = '#fff';
  ctx.fillText(label, labelX, labelY);
}

export default SelectionCanvas;
