# Design Document: AI Image Segmentation

## Overview

本设计文档描述了使用 AI 视觉模型进行表情包图像分割的技术方案。该功能将替代现有的基于连通区域检测的算法，通过 AI 识别图像中的表情区域并返回精确的轮廓坐标（支持矩形和多边形）。

核心思路是：
1. 将图片发送给支持视觉理解的 AI 模型（Gemini、GPT-4o 等）
2. 通过结构化 prompt 让 AI 返回 JSON 格式的分割结果
3. 解析 AI 响应，提取轮廓坐标
4. 使用 Canvas API 根据轮廓裁剪图片

## Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                        User Interface                            │
│                    (GeneratePanel / EmojiGrid)                   │
└─────────────────────────────────────────────────────────────────┘
                                │
                                ▼
┌─────────────────────────────────────────────────────────────────┐
│                    AI Segmentation Service                       │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────────────────┐  │
│  │   Prompt    │  │   Response  │  │    Coordinate           │  │
│  │   Builder   │  │   Parser    │  │    Validator            │  │
│  └─────────────┘  └─────────────┘  └─────────────────────────┘  │
└─────────────────────────────────────────────────────────────────┘
                                │
                    ┌───────────┴───────────┐
                    ▼                       ▼
        ┌───────────────────┐   ┌───────────────────┐
        │   AI Service      │   │  Fallback:        │
        │   (Gemini/OpenAI) │   │  Connected Region │
        └───────────────────┘   └───────────────────┘
                                │
                                ▼
┌─────────────────────────────────────────────────────────────────┐
│                    Polygon Cropper Service                       │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────────────────┐  │
│  │  Bounding   │  │   Canvas    │  │    Clipping             │  │
│  │  Box Calc   │  │   Creator   │  │    Mask                 │  │
│  └─────────────┘  └─────────────┘  └─────────────────────────┘  │
└─────────────────────────────────────────────────────────────────┘
```

## Components and Interfaces

### 1. 数据类型定义

```typescript
// src/types/segmentation.ts

/**
 * 多边形顶点
 */
export interface Point {
  x: number;
  y: number;
}

/**
 * 多边形轮廓
 */
export interface Polygon {
  /** 顶点数组，按顺时针或逆时针顺序 */
  vertices: Point[];
}

/**
 * 分割区域（支持矩形和多边形）
 */
export interface SegmentationRegion {
  /** 区域 ID */
  id: string;
  /** 区域类型 */
  type: 'rectangle' | 'polygon';
  /** 矩形边界框（始终存在，用于快速定位） */
  boundingBox: BoundingBox;
  /** 多边形轮廓（仅当 type 为 polygon 时存在） */
  polygon?: Polygon;
  /** AI 识别的置信度 (0-1) */
  confidence?: number;
  /** AI 识别的标签（如 "emoji", "sticker", "text"） */
  label?: string;
}

/**
 * AI 分割结果
 */
export interface SegmentationResult {
  /** 是否成功 */
  success: boolean;
  /** 识别到的区域列表 */
  regions: SegmentationRegion[];
  /** 使用的检测方法 */
  method: 'ai' | 'fallback';
  /** 错误信息（如果失败） */
  error?: string;
  /** 原始 AI 响应（用于调试） */
  rawResponse?: string;
}

/**
 * AI 分割配置
 */
export interface AISegmentationConfig {
  /** 是否启用 AI 分割 */
  enabled: boolean;
  /** 超时时间（毫秒） */
  timeout: number;
  /** 最大图片大小（字节），超过则压缩 */
  maxImageSize: number;
  /** 是否返回多边形轮廓（否则只返回矩形） */
  usePolygon: boolean;
}
```

### 2. AI 分割服务

```typescript
// src/services/aiSegmentationService.ts

import type { APIConfig } from '../types/api';
import type { SegmentationResult, AISegmentationConfig } from '../types/segmentation';

/**
 * AI 分割服务
 * 负责调用 AI 视觉模型进行图像分割
 */
export class AISegmentationService {
  private config: AISegmentationConfig;
  private apiConfig: APIConfig;

  constructor(apiConfig: APIConfig, config?: Partial<AISegmentationConfig>);

  /**
   * 对图片进行 AI 分割
   * @param imageBlob 图片 Blob
   * @returns 分割结果
   */
  async segment(imageBlob: Blob): Promise<SegmentationResult>;

  /**
   * 构建分割 prompt
   * @param imageWidth 图片宽度
   * @param imageHeight 图片高度
   * @returns 结构化 prompt
   */
  buildPrompt(imageWidth: number, imageHeight: number): string;

  /**
   * 解析 AI 响应
   * @param response AI 返回的文本
   * @param imageWidth 图片宽度
   * @param imageHeight 图片高度
   * @returns 解析后的分割结果
   */
  parseResponse(
    response: string,
    imageWidth: number,
    imageHeight: number
  ): SegmentationRegion[];

  /**
   * 压缩图片（如果超过大小限制）
   * @param imageBlob 原始图片
   * @returns 压缩后的图片
   */
  async compressImage(imageBlob: Blob): Promise<Blob>;
}
```

### 3. 多边形裁剪服务

```typescript
// src/services/polygonCropper.ts

import type { Point, Polygon, SegmentationRegion } from '../types/segmentation';
import type { BoundingBox, ExtractedEmoji } from '../types/image';

/**
 * 计算多边形的边界框
 */
export function calculatePolygonBoundingBox(polygon: Polygon): BoundingBox;

/**
 * 判断多边形是否为凸多边形
 */
export function isConvexPolygon(polygon: Polygon): boolean;

/**
 * 使用多边形裁剪图片
 * @param imageData 原始图片数据
 * @param region 分割区域
 * @param padding 边距
 * @returns 裁剪后的图片数据
 */
export function cropWithPolygon(
  imageData: ImageData,
  region: SegmentationRegion,
  padding?: number
): ImageData;

/**
 * 批量提取表情（支持多边形）
 * @param imageData 原始图片数据
 * @param regions 分割区域列表
 * @returns 提取的表情列表
 */
export async function extractEmojisFromRegions(
  imageData: ImageData,
  regions: SegmentationRegion[]
): Promise<ExtractedEmoji[]>;
```

### 4. 坐标验证和转换

```typescript
// src/services/coordinateUtils.ts

import type { Point, Polygon, SegmentationRegion } from '../types/segmentation';
import type { BoundingBox } from '../types/image';

/**
 * 验证多边形是否有效（至少 3 个顶点）
 */
export function isValidPolygon(polygon: Polygon): boolean;

/**
 * 将坐标限制在图片边界内
 */
export function clampCoordinates(
  point: Point,
  imageWidth: number,
  imageHeight: number
): Point;

/**
 * 将百分比坐标转换为像素坐标
 */
export function normalizeCoordinates(
  point: Point,
  imageWidth: number,
  imageHeight: number,
  isPercentage: boolean
): Point;

/**
 * 将矩形坐标转换为 BoundingBox
 */
export function rectangleToBoundingBox(
  topLeft: Point,
  bottomRight: Point
): BoundingBox;

/**
 * 将 BoundingBox 转换为多边形
 */
export function boundingBoxToPolygon(box: BoundingBox): Polygon;
```

## Data Models

### AI 请求/响应格式

**请求 Prompt 示例：**
```
Analyze this image and identify all distinct emoji/sticker regions.

Return a JSON object with the following structure:
{
  "regions": [
    {
      "type": "polygon",
      "vertices": [
        {"x": 10, "y": 20},
        {"x": 100, "y": 20},
        {"x": 100, "y": 120},
        {"x": 10, "y": 120}
      ],
      "label": "emoji",
      "confidence": 0.95
    }
  ]
}

Rules:
1. Coordinates are in pixels (image size: {width}x{height})
2. Each region should contain exactly one emoji/sticker
3. Use polygon type for irregular shapes, rectangle for regular ones
4. Vertices should be in clockwise order
5. Include all visible emojis, even if they touch the border
6. Do not include background or decorative elements
```

**AI 响应示例：**
```json
{
  "regions": [
    {
      "type": "polygon",
      "vertices": [
        {"x": 50, "y": 30},
        {"x": 150, "y": 25},
        {"x": 160, "y": 140},
        {"x": 45, "y": 145}
      ],
      "label": "emoji",
      "confidence": 0.92
    },
    {
      "type": "rectangle",
      "topLeft": {"x": 200, "y": 30},
      "bottomRight": {"x": 350, "y": 180},
      "label": "sticker",
      "confidence": 0.88
    }
  ]
}
```

## Correctness Properties

*A property is a characteristic or behavior that should hold true across all valid executions of a system—essentially, a formal statement about what the system should do. Properties serve as the bridge between human-readable specifications and machine-verifiable correctness guarantees.*

### Property 1: Image Compression Threshold

*For any* image blob, if its size exceeds the configured maxImageSize threshold, the compressed result SHALL have a size less than or equal to maxImageSize.

**Validates: Requirements 1.4**

### Property 2: Polygon Vertex Validation

*For any* polygon returned by AI, if it has fewer than 3 vertices, the validation function SHALL reject it and exclude it from the results.

**Validates: Requirements 2.2**

### Property 3: Rectangle to BoundingBox Conversion

*For any* valid rectangle coordinates (topLeft, bottomRight), converting to BoundingBox and back SHALL produce equivalent coordinates.

**Validates: Requirements 2.3**

### Property 4: JSON Parsing Robustness

*For any* AI response string containing valid JSON (even if surrounded by other text), the parser SHALL successfully extract and parse the JSON content.

**Validates: Requirements 3.1, 3.2**

### Property 5: Coordinate Clamping

*For any* point with coordinates outside image bounds (negative or exceeding dimensions), clamping SHALL produce coordinates within [0, width) and [0, height).

**Validates: Requirements 3.3**

### Property 6: Coordinate Normalization

*For any* percentage-based coordinate (0-100), normalizing to pixels SHALL produce values in the range [0, imageDimension].

**Validates: Requirements 3.4**

### Property 7: Polygon Bounding Box Calculation

*For any* valid polygon, the calculated bounding box SHALL contain all vertices of the polygon.

**Validates: Requirements 4.1**

### Property 8: Polygon Clipping Transparency

*For any* pixel in the cropped image that lies outside the polygon boundary, its alpha channel SHALL be 0 (fully transparent).

**Validates: Requirements 4.2**

### Property 9: Fallback Behavior

*For any* AI segmentation failure (timeout, error, or invalid response), the system SHALL return results using the fallback method with method='fallback'.

**Validates: Requirements 5.1**

### Property 10: API Error Handling

*For any* API error (network failure, invalid key, rate limit), the service SHALL return a SegmentationResult with success=false and a descriptive error message.

**Validates: Requirements 1.3**

## Error Handling

| Error Type | Handling Strategy |
|------------|-------------------|
| API Timeout | 回退到传统算法，通知用户 |
| Invalid API Key | 返回错误，提示用户检查配置 |
| Rate Limit | 返回错误，建议稍后重试 |
| Malformed JSON | 尝试提取 JSON，失败则回退 |
| Invalid Coordinates | 自动修正（clamp/normalize） |
| Empty Response | 回退到传统算法 |
| Network Error | 回退到传统算法，通知用户 |

## Testing Strategy

### Unit Tests

1. **Prompt Builder Tests**
   - 验证 prompt 包含必要的 JSON schema
   - 验证 prompt 包含正确的图片尺寸
   - 验证 prompt 包含边缘情况处理说明

2. **Response Parser Tests**
   - 测试有效 JSON 解析
   - 测试从文本中提取 JSON
   - 测试坐标验证和修正

3. **Coordinate Utils Tests**
   - 测试多边形验证
   - 测试坐标 clamping
   - 测试百分比到像素转换

4. **Polygon Cropper Tests**
   - 测试边界框计算
   - 测试凸多边形检测
   - 测试裁剪结果透明度

### Property-Based Tests

使用 fast-check 库进行属性测试：

1. **Property 1**: 生成随机大小的图片，验证压缩行为
2. **Property 2**: 生成随机多边形，验证顶点数量验证
3. **Property 3**: 生成随机矩形，验证转换往返一致性
4. **Property 4**: 生成包含 JSON 的随机文本，验证提取能力
5. **Property 5**: 生成随机坐标，验证 clamping 结果
6. **Property 6**: 生成随机百分比，验证归一化结果
7. **Property 7**: 生成随机多边形，验证边界框包含性
8. **Property 8**: 生成随机多边形和点，验证裁剪透明度
9. **Property 9**: 模拟各种失败场景，验证回退行为
10. **Property 10**: 模拟各种 API 错误，验证错误处理

### Integration Tests

1. 端到端测试：上传图片 → AI 分割 → 裁剪 → 输出
2. 回退测试：模拟 AI 失败，验证回退到传统算法
3. 性能测试：测量 AI 分割 vs 传统算法的时间差异
