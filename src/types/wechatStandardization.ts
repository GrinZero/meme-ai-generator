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
 * 图片类型
 */
export type WImageType = 'banner' | 'cover' | 'icon' | 'appreciationGuide' | 'appreciationThanks';

/**
 * 处理后的标准化图片
 */
export interface ProcessedImage {
  id: string;
  type: WImageType;
  blob: Blob;
  preview: string;
  width: number;
  height: number;
  sizeKB: number;
  format: 'png' | 'jpeg' | 'gif';
  hasTransparency: boolean;
  /** AI 生成的原始图片（未经过处理的） */
  originalBlob?: Blob;
  /** AI 生成的原始图片预览 URL */
  originalPreview?: string;
}

/**
 * 三种类型的提示词配置
 */
export interface StandardizationPrompts {
  p1: string;  // 横幅提示词
  p2: string;  // 封面提示词
  p3: string;  // 图标提示词
  appreciationGuide: string;  // 赞赏引导图提示词
  appreciationThanks: string; // 赞赏致谢图提示词
}

/**
 * 标准化处理结果
 */
export interface StandardizationResult {
  banner: ProcessedImage | null;
  cover: ProcessedImage | null;
  icon: ProcessedImage | null;
  appreciationGuide: ProcessedImage | null;  // 赞赏引导图
  appreciationThanks: ProcessedImage | null; // 赞赏致谢图
  errors: StandardizationError[];
}

/**
 * 处理状态
 */
export type ProcessingStatus =
  | { stage: 'idle' }
  | { stage: 'uploading'; progress: number }
  | { stage: 'generating'; type: 'p1' | 'p2' | 'p3' | 'appreciationGuide' | 'appreciationThanks'; progress: number }
  | { stage: 'processing'; type: 'p1' | 'p2' | 'p3' | 'appreciationGuide' | 'appreciationThanks' }
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
  | 'DOWNLOAD_FAILED'           // 下载失败
  | 'APPRECIATION_GENERATION_FAILED'  // 赞赏图生成失败
  | 'REPROCESS_FAILED';               // 重新处理失败

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
 * 切割算法参数
 */
export interface ProcessingParams {
  /** 容差值 */
  tolerance: number;
  /** 最小区域 */
  minArea: number;
  /** 最小尺寸 */
  minSize: number;
  /** 是否移除背景 */
  removeBackground?: boolean;
}


/**
 * 启用生成的图片类型
 */
export type EnabledTypes = {
  p1: boolean;
  p2: boolean;
  p3: boolean;
  appreciationGuide: boolean;
  appreciationThanks: boolean;
};

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

  // 启用生成的图片类型
  enabledTypes: EnabledTypes;

  // 图片选择和重新处理相关状态
  selectedImageType: WImageType | null;
  reprocessPrompt: string;
  reprocessParams: ProcessingParams;
  reprocessResult: ProcessedImage | null;

  // Actions - 源图片管理
  addSourceImages: (files: File[]) => void;
  removeSourceImage: (id: string) => void;
  clearSourceImages: () => void;
  importFromEmojis: (emojis: ExtractedEmoji[]) => void;

  // Actions - 提示词管理
  setPrompt: (type: 'p1' | 'p2' | 'p3', value: string) => void;
  resetPrompt: (type: 'p1' | 'p2' | 'p3') => void;
  resetAllPrompts: () => void;

  // Actions - 赞赏图提示词管理
  setAppreciationPrompt: (type: 'appreciationGuide' | 'appreciationThanks', value: string) => void;
  resetAppreciationPrompt: (type: 'appreciationGuide' | 'appreciationThanks') => void;

  // Actions - 启用类型管理
  toggleEnabledType: (type: keyof EnabledTypes) => void;
  setEnabledTypes: (types: EnabledTypes) => void;

  // Actions - 图片选择和重新处理
  setSelectedImageType: (type: WImageType | null) => void;
  setReprocessPrompt: (prompt: string) => void;
  setReprocessParams: (params: ProcessingParams) => void;
  regenerateSelected: (apiConfig: APIConfig) => Promise<void>;
  applyImageProcessing?: () => Promise<void>;
  updateResult: (partialResult: Partial<StandardizationResult>) => void;
  replaceWithReprocessed: () => void;
  cancelReprocess: () => void;

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
    apiConfig: APIConfig,
    onProgress?: (
      type: 'p1' | 'p2' | 'p3' | 'appreciationGuide' | 'appreciationThanks',
      stage: 'generating' | 'processing' | 'completed' | 'error',
      progress?: number,
      error?: string
    ) => void,
    enabledTypes?: EnabledTypes
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
  /** 提示词对象 */
  prompts: StandardizationPrompts;
  /** 启用的类型 */
  enabledTypes: EnabledTypes;
  /** 提示词变更回调 */
  onPromptChange: (type: 'p1' | 'p2' | 'p3' | 'appreciationGuide' | 'appreciationThanks', value: string) => void;
  /** 重置回调 */
  onReset: (type: 'p1' | 'p2' | 'p3' | 'appreciationGuide' | 'appreciationThanks') => void;
  /** 切换启用状态回调 */
  onToggleType: (type: keyof EnabledTypes) => void;
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
  /** P4 赞赏引导图 */
  appreciationGuide: ProcessedImage | null;
  /** P5 赞赏致谢图 */
  appreciationThanks: ProcessedImage | null;
  /** 单张下载回调 */
  onDownloadSingle: (type: 'banner' | 'cover' | 'icon' | 'appreciationGuide' | 'appreciationThanks') => void;
  /** 批量下载回调 */
  onDownloadAll: () => void;
  /** 是否禁用 */
  disabled?: boolean;
}
