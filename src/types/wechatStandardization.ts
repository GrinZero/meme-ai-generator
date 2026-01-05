/**
 * 微信表情平台标准化相关类型定义
 */

import type { APIConfig } from './api';
import type { ExtractedEmoji } from './image';

/**
 * 用户上传的源图片
 */
export interface SourceImage {
  id: string;
  file: File;
  preview: string;  // base64 或 object URL
  uploadedAt: number;
}

/**
 * 处理后的标准化图片
 */
export interface ProcessedImage {
  id: string;
  type: 'banner' | 'cover' | 'icon';
  blob: Blob;
  preview: string;
  width: number;
  height: number;
  sizeKB: number;
  format: 'png' | 'jpeg';
  hasTransparency: boolean;
}

/**
 * 三种类型的提示词配置
 */
export interface StandardizationPrompts {
  p1: string;  // 横幅提示词
  p2: string;  // 封面提示词
  p3: string;  // 图标提示词
}

/**
 * 标准化处理结果
 */
export interface StandardizationResult {
  banner: ProcessedImage | null;
  cover: ProcessedImage | null;
  icon: ProcessedImage | null;
  errors: StandardizationError[];
}

/**
 * 处理状态
 */
export type ProcessingStatus =
  | { stage: 'idle' }
  | { stage: 'uploading'; progress: number }
  | { stage: 'generating'; type: 'p1' | 'p2' | 'p3'; progress: number }
  | { stage: 'processing'; type: 'p1' | 'p2' | 'p3' }
  | { stage: 'completed' }
  | { stage: 'error'; message: string };

/**
 * 标准化错误类型
 */
export type StandardizationErrorType =
  | 'INVALID_FILE_FORMAT'       // 不支持的文件格式
  | 'FILE_TOO_LARGE'            // 文件过大
  | 'UPLOAD_LIMIT_EXCEEDED'     // 超过上传数量限制
  | 'AI_GENERATION_FAILED'      // AI 生成失败
  | 'IMAGE_PROCESSING_FAILED'   // 图像处理失败
  | 'BACKGROUND_REMOVAL_FAILED' // 背景移除失败
  | 'COMPRESSION_FAILED'        // 压缩失败
  | 'DOWNLOAD_FAILED';          // 下载失败

/**
 * 标准化错误
 */
export interface StandardizationError {
  type: StandardizationErrorType;
  message: string;
  details?: unknown;
}

/**
 * 图片尺寸调整选项
 */
export interface ResizeOptions {
  /** 是否保持宽高比 */
  maintainAspectRatio?: boolean;
  /** 裁剪策略 */
  cropStrategy?: 'center' | 'smart';
  /** 输出格式 */
  format?: 'png' | 'jpeg';
  /** JPEG 质量 (0-1) */
  quality?: number;
}

/**
 * Zustand Store 状态
 */
export interface WeChatStandardizationState {
  // 源图片
  sourceImages: SourceImage[];

  // 提示词
  prompts: StandardizationPrompts;

  // 处理结果
  result: StandardizationResult | null;

  // 处理状态
  status: ProcessingStatus;

  // Actions - 源图片管理
  addSourceImages: (files: File[]) => void;
  removeSourceImage: (id: string) => void;
  clearSourceImages: () => void;
  importFromEmojis: (emojis: ExtractedEmoji[]) => void;

  // Actions - 提示词管理
  setPrompt: (type: 'p1' | 'p2' | 'p3', value: string) => void;
  resetPrompt: (type: 'p1' | 'p2' | 'p3') => void;
  resetAllPrompts: () => void;

  // Actions - 生成流程控制
  startGeneration: (apiConfig: APIConfig) => Promise<void>;
  regenerate: (type: 'p1' | 'p2' | 'p3', apiConfig: APIConfig) => Promise<void>;
  cancelGeneration: () => void;

  // Actions - 重置
  reset: () => void;
}

/**
 * 标准化服务接口
 */
export interface StandardizationService {
  /** 生成 P1 横幅 */
  generateBanner(
    sourceImages: SourceImage[],
    prompt: string,
    apiConfig: APIConfig
  ): Promise<ProcessedImage>;

  /** 生成 P2 封面 */
  generateCover(
    sourceImages: SourceImage[],
    prompt: string,
    apiConfig: APIConfig
  ): Promise<ProcessedImage>;

  /** 生成 P3 图标 */
  generateIcon(
    sourceImages: SourceImage[],
    prompt: string,
    apiConfig: APIConfig
  ): Promise<ProcessedImage>;

  /** 批量生成所有类型 */
  generateAll(
    sourceImages: SourceImage[],
    prompts: StandardizationPrompts,
    apiConfig: APIConfig
  ): Promise<StandardizationResult>;
}

/**
 * 图像处理服务接口
 */
export interface WeChatImageProcessorInterface {
  /** 处理为 P1 横幅规格 */
  processToBanner(imageBlob: Blob): Promise<ProcessedImage>;

  /** 处理为 P2 封面规格 */
  processToCover(imageBlob: Blob): Promise<ProcessedImage>;

  /** 处理为 P3 图标规格 */
  processToIcon(imageBlob: Blob): Promise<ProcessedImage>;

  /** 调整图片尺寸（保持比例，居中裁剪） */
  resizeImage(
    imageBlob: Blob,
    targetWidth: number,
    targetHeight: number,
    options?: ResizeOptions
  ): Promise<Blob>;

  /** 压缩图片至指定大小 */
  compressImage(
    imageBlob: Blob,
    maxSizeKB: number,
    format: 'png' | 'jpeg'
  ): Promise<Blob>;
}

/**
 * UI 组件 Props 类型
 */

export interface WeChatStandardizationPanelProps {
  /** 从表情包生成模块导入的图片（可选） */
  importedEmojis?: ExtractedEmoji[];
  /** 关闭面板回调 */
  onClose?: () => void;
}

export interface StandardizationImageUploaderProps {
  /** 已上传的图片列表 */
  images: SourceImage[];
  /** 上传回调 */
  onUpload: (files: File[]) => void;
  /** 删除回调 */
  onDelete: (id: string) => void;
  /** 最大上传数量 */
  maxCount?: number;
  /** 是否禁用 */
  disabled?: boolean;
}

export interface StandardizationPromptEditorProps {
  /** P1 提示词 */
  p1Prompt: string;
  /** P2 提示词 */
  p2Prompt: string;
  /** P3 提示词 */
  p3Prompt: string;
  /** 提示词变更回调 */
  onPromptChange: (type: 'p1' | 'p2' | 'p3', value: string) => void;
  /** 重置回调 */
  onReset: (type: 'p1' | 'p2' | 'p3') => void;
}

export interface StandardizationPreviewPanelProps {
  /** P1 横幅预览 */
  p1Preview: ProcessedImage | null;
  /** P2 封面预览 */
  p2Preview: ProcessedImage | null;
  /** P3 图标预览 */
  p3Preview: ProcessedImage | null;
  /** 处理状态 */
  status: ProcessingStatus;
  /** 重新生成回调 */
  onRegenerate: (type: 'p1' | 'p2' | 'p3') => void;
}

export interface StandardizationDownloadPanelProps {
  /** P1 横幅 */
  banner: ProcessedImage | null;
  /** P2 封面 */
  cover: ProcessedImage | null;
  /** P3 图标 */
  icon: ProcessedImage | null;
  /** 单张下载回调 */
  onDownloadSingle: (type: 'banner' | 'cover' | 'icon') => void;
  /** 批量下载回调 */
  onDownloadAll: () => void;
  /** 是否禁用 */
  disabled?: boolean;
}
