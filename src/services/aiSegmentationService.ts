/**
 * AI Segmentation Service
 * 负责调用 AI 视觉模型进行图像分割
 * 
 * Requirements: 1.1, 1.2, 1.4, 3.1, 3.2, 6.1, 6.2, 6.3, 6.4
 */

import { GoogleGenerativeAI } from '@google/generative-ai';
import OpenAI from 'openai';
import type { APIConfig } from '../types/api';
import type {
  SegmentationResult,
  SegmentationRegion,
  AISegmentationConfig,
  Point,
  Polygon,
} from '../types/segmentation';
import type { BoundingBox } from '../types/image';
import {
  isValidPolygon,
  clampCoordinates,
  normalizeCoordinates,
  rectangleToBoundingBox,
} from './coordinateUtils';

// 生成唯一 ID
const generateId = () => `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;

/**
 * 默认 AI 分割配置
 */
export const DEFAULT_AI_SEGMENTATION_CONFIG: AISegmentationConfig = {
  enabled: true,
  timeout: 30000, // 30 秒
  maxImageSize: 4 * 1024 * 1024, // 4MB
  usePolygon: true,
};

/**
 * AI 分割服务类
 */
export class AISegmentationService {
  private config: AISegmentationConfig;
  private apiConfig: APIConfig;

  constructor(apiConfig: APIConfig, config?: Partial<AISegmentationConfig>) {
    this.apiConfig = apiConfig;
    this.config = { ...DEFAULT_AI_SEGMENTATION_CONFIG, ...config };
  }

  /**
   * 构建分割 prompt
   * @param imageWidth 图片宽度
   * @param imageHeight 图片高度
   * @returns 结构化 prompt
   */
  buildPrompt(imageWidth: number, imageHeight: number): string {
    return `你是一个精确的图像分析专家。请分析这张表情包合集图片，找出每个独立表情包的精确边界。

**重要：这是一张 ${imageWidth} x ${imageHeight} 像素的图片**

**你的任务：**
1. 找出图片中所有独立的表情包（通常是卡通形象 + 配文）
2. 每个表情包应该包含完整的图案和对应的文字
3. 返回每个表情包的精确矩形边界坐标

**输出格式（严格遵守）：**
\`\`\`json
{
  "regions": [
    {
      "type": "rectangle",
      "topLeft": {"x": 0, "y": 0},
      "bottomRight": {"x": 100, "y": 150},
      "label": "emoji"
    }
  ]
}
\`\`\`

**坐标规则：**
- x 坐标范围：0 到 ${imageWidth}
- y 坐标范围：0 到 ${imageHeight}
- topLeft 是左上角坐标
- bottomRight 是右下角坐标
- 坐标必须是整数像素值

**识别要点：**
1. 每个表情包通常包含：一个卡通形象 + 下方的文字说明
2. 边界框要完整包含整个表情包（图案+文字），不要切掉任何部分
3. 边界框要紧贴内容，但留出少量边距（约5-10像素）
4. 如果图片是网格布局（如3x3），按行列顺序识别
5. 不要把多个表情包合并成一个区域

**常见错误（请避免）：**
- ❌ 边界框太小，切掉了表情包的一部分
- ❌ 边界框太大，包含了相邻的表情包
- ❌ 只识别了图案，没有包含下方的文字
- ❌ 坐标超出图片范围

请仔细分析图片，返回精确的 JSON 结果。`;
  }

  /**
   * 从文本中提取 JSON
   * @param text 可能包含 JSON 的文本
   * @returns 提取的 JSON 字符串或 null
   */
  extractJsonFromText(text: string): string | null {
    // 清理文本
    const cleanedText = text.trim();
    
    // 尝试直接解析
    try {
      JSON.parse(cleanedText);
      return cleanedText;
    } catch {
      // 继续尝试提取
    }

    // 尝试从 markdown 代码块中提取
    const codeBlockMatch = cleanedText.match(/```(?:json)?\s*([\s\S]*?)```/);
    if (codeBlockMatch) {
      const extracted = codeBlockMatch[1].trim();
      try {
        JSON.parse(extracted);
        return extracted;
      } catch {
        // 继续尝试其他方法
      }
    }

    // 尝试找到 JSON 对象（更宽松的匹配）
    const jsonMatch = cleanedText.match(/\{[\s\S]*?"regions"\s*:\s*\[[\s\S]*?\][\s\S]*?\}/);
    if (jsonMatch) {
      try {
        JSON.parse(jsonMatch[0]);
        return jsonMatch[0];
      } catch {
        // 尝试修复常见的 JSON 问题
        let fixed = jsonMatch[0]
          .replace(/,\s*}/g, '}')  // 移除尾随逗号
          .replace(/,\s*]/g, ']')  // 移除数组尾随逗号
          .replace(/'/g, '"');     // 单引号转双引号
        try {
          JSON.parse(fixed);
          return fixed;
        } catch {
          // 继续
        }
      }
    }

    // 最后尝试：找到任何看起来像 JSON 对象的内容
    const anyJsonMatch = cleanedText.match(/\{[\s\S]+\}/);
    if (anyJsonMatch) {
      try {
        JSON.parse(anyJsonMatch[0]);
        return anyJsonMatch[0];
      } catch {
        // 放弃
      }
    }

    return null;
  }

  /**
   * 解析 AI 响应
   * @param response AI 返回的文本
   * @param imageWidth 图片宽度
   * @param imageHeight 图片高度
   * @returns 解析后的分割区域列表
   */
  parseResponse(
    response: string,
    imageWidth: number,
    imageHeight: number
  ): SegmentationRegion[] {
    const jsonStr = this.extractJsonFromText(response);
    if (!jsonStr) {
      throw new Error('无法从 AI 响应中提取 JSON');
    }

    let parsed: { regions?: unknown[] };
    try {
      parsed = JSON.parse(jsonStr);
    } catch {
      throw new Error('JSON 解析失败');
    }

    if (!parsed.regions || !Array.isArray(parsed.regions)) {
      throw new Error('响应格式无效：缺少 regions 数组');
    }

    const regions: SegmentationRegion[] = [];

    for (const region of parsed.regions) {
      if (typeof region !== 'object' || region === null) continue;

      const r = region as Record<string, unknown>;
      const type = r.type as string;
      const label = (r.label as string) || 'emoji';
      const confidence = typeof r.confidence === 'number' ? r.confidence : undefined;

      let boundingBox: BoundingBox;
      let polygon: Polygon | undefined;

      if (type === 'polygon' && Array.isArray(r.vertices)) {
        // 处理多边形
        const vertices: Point[] = [];
        for (const v of r.vertices) {
          if (typeof v === 'object' && v !== null) {
            const vertex = v as Record<string, unknown>;
            if (typeof vertex.x === 'number' && typeof vertex.y === 'number') {
              // 智能检测坐标类型
              const isPercentage = this.detectPercentageCoordinates(
                vertex.x, vertex.y, imageWidth, imageHeight
              );
              
              let point: Point = { x: vertex.x, y: vertex.y };
              point = normalizeCoordinates(point, imageWidth, imageHeight, isPercentage);
              point = clampCoordinates(point, imageWidth, imageHeight);
              vertices.push(point);
            }
          }
        }

        polygon = { vertices };
        
        // 验证多边形有效性
        if (!isValidPolygon(polygon)) {
          continue; // 跳过无效多边形
        }

        // 计算边界框
        const xs = vertices.map(v => v.x);
        const ys = vertices.map(v => v.y);
        boundingBox = {
          x: Math.min(...xs),
          y: Math.min(...ys),
          width: Math.max(...xs) - Math.min(...xs),
          height: Math.max(...ys) - Math.min(...ys),
        };
      } else if (type === 'rectangle' || r.topLeft || r.bottomRight) {
        // 处理矩形
        const topLeft = r.topLeft as Record<string, unknown> | undefined;
        const bottomRight = r.bottomRight as Record<string, unknown> | undefined;

        if (!topLeft || !bottomRight) continue;
        if (typeof topLeft.x !== 'number' || typeof topLeft.y !== 'number') continue;
        if (typeof bottomRight.x !== 'number' || typeof bottomRight.y !== 'number') continue;

        // 智能检测坐标类型
        const isPercentage = this.detectPercentageCoordinates(
          Math.max(topLeft.x, bottomRight.x),
          Math.max(topLeft.y, bottomRight.y),
          imageWidth,
          imageHeight
        );

        let tl: Point = { x: topLeft.x, y: topLeft.y };
        let br: Point = { x: bottomRight.x, y: bottomRight.y };

        tl = normalizeCoordinates(tl, imageWidth, imageHeight, isPercentage);
        br = normalizeCoordinates(br, imageWidth, imageHeight, isPercentage);
        tl = clampCoordinates(tl, imageWidth, imageHeight);
        br = clampCoordinates(br, imageWidth, imageHeight);

        // 确保 topLeft 在 bottomRight 的左上方
        const minX = Math.min(tl.x, br.x);
        const minY = Math.min(tl.y, br.y);
        const maxX = Math.max(tl.x, br.x);
        const maxY = Math.max(tl.y, br.y);

        boundingBox = rectangleToBoundingBox(
          { x: minX, y: minY },
          { x: maxX, y: maxY }
        );
      } else {
        continue; // 跳过未知类型
      }

      // 验证并修正边界框
      const validatedBox = this.validateAndFixBoundingBox(boundingBox, imageWidth, imageHeight);
      if (!validatedBox) {
        continue;
      }

      regions.push({
        id: generateId(),
        type: polygon ? 'polygon' : 'rectangle',
        boundingBox: validatedBox,
        polygon,
        confidence,
        label,
      });
    }

    return regions;
  }

  /**
   * 智能检测坐标是否为百分比格式
   * @param x X 坐标
   * @param y Y 坐标
   * @param imageWidth 图片宽度
   * @param imageHeight 图片高度
   * @returns 是否为百分比坐标
   */
  private detectPercentageCoordinates(
    x: number,
    y: number,
    imageWidth: number,
    imageHeight: number
  ): boolean {
    // 如果所有坐标都在 0-1 范围内，可能是归一化坐标
    if (x >= 0 && x <= 1 && y >= 0 && y <= 1) {
      return true;
    }
    
    // 如果坐标都在 0-100 范围内，且图片尺寸大于 500，很可能是百分比
    if (x >= 0 && x <= 100 && y >= 0 && y <= 100) {
      if (imageWidth > 500 && imageHeight > 500) {
        // 如果坐标看起来像百分比（整数或5的倍数）
        const xIsRound = Number.isInteger(x) || x % 5 === 0;
        const yIsRound = Number.isInteger(y) || y % 5 === 0;
        if (xIsRound && yIsRound) {
          return true;
        }
      }
    }
    
    // 如果坐标超过 100，肯定是像素值
    return false;
  }

  /**
   * 验证并修正区域边界
   * @param boundingBox 边界框
   * @param imageWidth 图片宽度
   * @param imageHeight 图片高度
   * @returns 修正后的边界框，如果无效则返回 null
   */
  private validateAndFixBoundingBox(
    boundingBox: BoundingBox,
    imageWidth: number,
    imageHeight: number
  ): BoundingBox | null {
    let { x, y, width, height } = boundingBox;

    // 确保坐标在有效范围内
    x = Math.max(0, Math.min(x, imageWidth - 1));
    y = Math.max(0, Math.min(y, imageHeight - 1));

    // 确保宽高有效（至少 10 像素）
    width = Math.max(10, Math.min(width, imageWidth - x));
    height = Math.max(10, Math.min(height, imageHeight - y));

    // 如果区域太小（小于 10x10），无效
    if (width < 10 || height < 10) {
      return null;
    }

    return { x, y, width, height };
  }

  /**
   * 压缩图片（如果超过大小限制）
   * @param imageBlob 原始图片
   * @returns 压缩后的图片
   */
  async compressImage(imageBlob: Blob): Promise<Blob> {
    if (imageBlob.size <= this.config.maxImageSize) {
      return imageBlob;
    }

    // 加载图片
    const img = await this.loadImage(imageBlob);
    
    // 计算压缩比例
    const ratio = Math.sqrt(this.config.maxImageSize / imageBlob.size);
    const newWidth = Math.floor(img.width * ratio);
    const newHeight = Math.floor(img.height * ratio);

    // 创建 canvas 进行压缩
    const canvas = document.createElement('canvas');
    canvas.width = newWidth;
    canvas.height = newHeight;
    const ctx = canvas.getContext('2d')!;
    ctx.drawImage(img, 0, 0, newWidth, newHeight);

    // 尝试不同的质量级别直到满足大小要求
    let quality = 0.9;
    let compressedBlob: Blob;

    do {
      compressedBlob = await new Promise<Blob>((resolve, reject) => {
        canvas.toBlob(
          (blob) => {
            if (blob) resolve(blob);
            else reject(new Error('压缩失败'));
          },
          'image/jpeg',
          quality
        );
      });
      quality -= 0.1;
    } while (compressedBlob.size > this.config.maxImageSize && quality > 0.1);

    return compressedBlob;
  }

  /**
   * 加载图片
   */
  private loadImage(blob: Blob): Promise<HTMLImageElement> {
    return new Promise((resolve, reject) => {
      const img = new Image();
      img.onload = () => {
        URL.revokeObjectURL(img.src);
        resolve(img);
      };
      img.onerror = () => {
        URL.revokeObjectURL(img.src);
        reject(new Error('图片加载失败'));
      };
      img.src = URL.createObjectURL(blob);
    });
  }

  /**
   * 将 Blob 转换为 base64
   */
  private async blobToBase64(blob: Blob): Promise<string> {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => {
        const result = reader.result as string;
        const base64 = result.split(',')[1];
        resolve(base64);
      };
      reader.onerror = reject;
      reader.readAsDataURL(blob);
    });
  }

  /**
   * 获取图片尺寸
   */
  private async getImageDimensions(blob: Blob): Promise<{ width: number; height: number }> {
    const img = await this.loadImage(blob);
    return { width: img.width, height: img.height };
  }

  /**
   * 对图片进行 AI 分割
   * @param imageBlob 图片 Blob
   * @returns 分割结果
   */
  async segment(imageBlob: Blob): Promise<SegmentationResult> {
    try {
      // 1. 压缩图片（如果需要）
      const processedBlob = await this.compressImage(imageBlob);
      
      // 2. 获取图片尺寸
      const { width, height } = await this.getImageDimensions(processedBlob);
      
      // 3. 构建 prompt
      const prompt = this.buildPrompt(width, height);
      
      // 4. 调用 AI API
      let responseText: string;
      
      if (this.apiConfig.style === 'gemini') {
        responseText = await this.callGeminiAPI(processedBlob, prompt);
      } else {
        responseText = await this.callOpenAIAPI(processedBlob, prompt);
      }
      
      // 5. 解析响应
      const regions = this.parseResponse(responseText, width, height);
      
      return {
        success: true,
        regions,
        method: 'ai',
        rawResponse: responseText,
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      
      // 分类错误类型
      let friendlyMessage = errorMessage;
      if (errorMessage.includes('API key') || errorMessage.includes('401')) {
        friendlyMessage = 'API Key 无效，请检查配置';
      } else if (errorMessage.includes('quota') || errorMessage.includes('rate') || errorMessage.includes('429')) {
        friendlyMessage = '请求过于频繁，请稍后再试';
      } else if (errorMessage.includes('network') || errorMessage.includes('fetch') || errorMessage.includes('Failed to fetch')) {
        friendlyMessage = '网络连接失败，请检查网络';
      } else if (errorMessage.includes('timeout') || errorMessage.includes('Timeout')) {
        friendlyMessage = '请求超时，请重试';
      }
      
      return {
        success: false,
        regions: [],
        method: 'ai',
        error: friendlyMessage,
      };
    }
  }

  /**
   * 调用 Gemini API
   */
  private async callGeminiAPI(imageBlob: Blob, prompt: string): Promise<string> {
    const genAI = new GoogleGenerativeAI(this.apiConfig.apiKey);
    const modelName = this.apiConfig.model || 'gemini-2.0-flash-exp';
    const requestOptions = this.apiConfig.baseUrl ? { baseUrl: this.apiConfig.baseUrl } : undefined;
    
    const model = genAI.getGenerativeModel({ model: modelName }, requestOptions);
    
    const base64 = await this.blobToBase64(imageBlob);
    const mimeType = imageBlob.type || 'image/png';
    
    const result = await model.generateContent([
      prompt,
      {
        inlineData: {
          data: base64,
          mimeType,
        },
      },
    ]);
    
    const response = result.response;
    const text = response.text();
    
    if (!text) {
      throw new Error('AI 未返回有效响应');
    }
    
    return text;
  }

  /**
   * 调用 OpenAI API
   */
  private async callOpenAIAPI(imageBlob: Blob, prompt: string): Promise<string> {
    const client = new OpenAI({
      apiKey: this.apiConfig.apiKey,
      baseURL: this.apiConfig.baseUrl || 'https://api.openai.com/v1',
      dangerouslyAllowBrowser: true,
    });
    
    const base64 = await this.blobToBase64(imageBlob);
    const mimeType = imageBlob.type || 'image/png';
    const dataUrl = `data:${mimeType};base64,${base64}`;
    
    const response = await client.chat.completions.create({
      model: this.apiConfig.model || 'gpt-4o',
      messages: [
        {
          role: 'user',
          content: [
            { type: 'text', text: prompt },
            {
              type: 'image_url',
              image_url: { url: dataUrl },
            },
          ],
        },
      ],
      max_tokens: 4096,
    });
    
    const text = response.choices[0]?.message?.content;
    
    if (!text) {
      throw new Error('AI 未返回有效响应');
    }
    
    return text;
  }
}

/**
 * 创建 AI 分割服务实例
 */
export function createAISegmentationService(
  apiConfig: APIConfig,
  config?: Partial<AISegmentationConfig>
): AISegmentationService {
  return new AISegmentationService(apiConfig, config);
}
