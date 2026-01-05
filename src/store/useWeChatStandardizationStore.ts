/**
 * WeChat Sticker Standardization Store
 * 
 * 微信表情平台标准化状态管理
 * 
 * 功能：
 * - 源图片管理（添加、删除、清空、导入）
 * - 提示词管理（设置、重置）
 * - 处理状态管理
 * - 生成流程控制
 * 
 * Requirements: 1.3-1.5, 2.5-2.6, 3.1, 7.3
 */

import { create } from 'zustand';
import type { ExtractedEmoji } from '../types/image';
import type { APIConfig } from '../types/api';
import type {
  SourceImage,
  StandardizationResult,
  ProcessingStatus,
  WeChatStandardizationState,
} from '../types/wechatStandardization';
import {
  DEFAULT_PROMPTS,
  UPLOAD_LIMITS,
} from '../services/wechatConstants';
import { validateImageFormat } from '../services/wechatFileService';

/**
 * 生成唯一 ID
 */
const generateId = (): string => 
  `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;

/**
 * 初始状态
 */
const initialState = {
  sourceImages: [] as SourceImage[],
  prompts: { ...DEFAULT_PROMPTS },
  result: null as StandardizationResult | null,
  status: { stage: 'idle' } as ProcessingStatus,
};

/**
 * 用于取消生成的 AbortController
 */
let abortController: AbortController | null = null;

/**
 * WeChat 标准化 Store
 */
export const useWeChatStandardizationStore = create<WeChatStandardizationState>()(
  (set, get) => ({
    // 初始状态
    ...initialState,

    // ==================== 源图片管理 ====================

    /**
     * 添加源图片
     * 
     * - 验证文件格式（PNG, JPG, JPEG, WebP）
     * - 限制最大数量为 20 张
     * 
     * Requirements: 1.2, 1.3, 1.6, 1.7
     */
    addSourceImages: (files: File[]) => {
      const { sourceImages } = get();
      const currentCount = sourceImages.length;
      const remainingSlots = UPLOAD_LIMITS.MAX_IMAGE_COUNT - currentCount;

      if (remainingSlots <= 0) {
        // 已达到上传限制
        return;
      }

      // 过滤有效文件并限制数量
      const validFiles = files
        .filter((file) => {
          const validation = validateImageFormat(file);
          return validation.valid;
        })
        .slice(0, remainingSlots);

      if (validFiles.length === 0) {
        return;
      }

      // 创建新的 SourceImage 对象
      const newImages: SourceImage[] = validFiles.map((file) => ({
        id: generateId(),
        file,
        preview: URL.createObjectURL(file),
        uploadedAt: Date.now(),
      }));

      set({
        sourceImages: [...sourceImages, ...newImages],
      });
    },

    /**
     * 删除单张源图片
     * 
     * Requirements: 1.5
     */
    removeSourceImage: (id: string) => {
      const { sourceImages } = get();
      const imageToRemove = sourceImages.find((img) => img.id === id);

      if (imageToRemove) {
        // 释放 object URL
        URL.revokeObjectURL(imageToRemove.preview);
      }

      set({
        sourceImages: sourceImages.filter((img) => img.id !== id),
      });
    },

    /**
     * 清空所有源图片
     */
    clearSourceImages: () => {
      const { sourceImages } = get();

      // 释放所有 object URLs
      sourceImages.forEach((img) => {
        URL.revokeObjectURL(img.preview);
      });

      set({
        sourceImages: [],
      });
    },

    /**
     * 从表情包生成模块导入图片
     * 
     * Requirements: 7.3
     */
    importFromEmojis: (emojis: ExtractedEmoji[]) => {
      const { sourceImages } = get();
      const currentCount = sourceImages.length;
      const remainingSlots = UPLOAD_LIMITS.MAX_IMAGE_COUNT - currentCount;

      if (remainingSlots <= 0) {
        return;
      }

      // 限制导入数量
      const emojisToImport = emojis.slice(0, remainingSlots);

      // 将 ExtractedEmoji 转换为 SourceImage
      const newImages: SourceImage[] = emojisToImport.map((emoji) => ({
        id: generateId(),
        file: new File([emoji.blob], `emoji_${emoji.id}.png`, { type: 'image/png' }),
        preview: emoji.preview,
        uploadedAt: Date.now(),
      }));

      set({
        sourceImages: [...sourceImages, ...newImages],
      });
    },

    // ==================== 提示词管理 ====================

    /**
     * 设置指定类型的提示词
     * 
     * Requirements: 2.5
     */
    setPrompt: (type: 'p1' | 'p2' | 'p3', value: string) => {
      const { prompts } = get();
      set({
        prompts: {
          ...prompts,
          [type]: value,
        },
      });
    },

    /**
     * 重置指定类型的提示词为默认值
     * 
     * Requirements: 2.6
     */
    resetPrompt: (type: 'p1' | 'p2' | 'p3') => {
      const { prompts } = get();
      set({
        prompts: {
          ...prompts,
          [type]: DEFAULT_PROMPTS[type],
        },
      });
    },

    /**
     * 重置所有提示词为默认值
     */
    resetAllPrompts: () => {
      set({
        prompts: { ...DEFAULT_PROMPTS },
      });
    },

    // ==================== 生成流程控制 ====================

    /**
     * 开始生成流程
     * 
     * Requirements: 3.1
     * 
     * @param apiConfig - API 配置（将在 Task 9 中使用）
     */
    startGeneration: async (apiConfig: APIConfig) => {
      const { sourceImages } = get();
      // apiConfig 将在 Task 9 实现实际生成逻辑时使用
      void apiConfig;

      // 检查是否有源图片
      if (sourceImages.length === 0) {
        set({
          status: { stage: 'error', message: '请先上传至少一张图片' },
        });
        return;
      }

      // 创建新的 AbortController
      abortController = new AbortController();

      try {
        // 设置生成状态
        set({
          status: { stage: 'generating', type: 'p1', progress: 0 },
          result: null,
        });

        // TODO: 实际的生成逻辑将在 Task 9 中实现
        // 这里只是状态管理的框架
        
        // 模拟生成完成
        set({
          status: { stage: 'completed' },
        });
      } catch (error) {
        if (error instanceof Error && error.name === 'AbortError') {
          // 用户取消了生成
          set({
            status: { stage: 'idle' },
          });
        } else {
          set({
            status: {
              stage: 'error',
              message: error instanceof Error ? error.message : '生成失败',
            },
          });
        }
      }
    },

    /**
     * 重新生成指定类型的图片
     * 
     * @param type - 要重新生成的图片类型
     * @param apiConfig - API 配置（将在 Task 9 中使用）
     */
    regenerate: async (type: 'p1' | 'p2' | 'p3', apiConfig: APIConfig) => {
      const { sourceImages } = get();
      // apiConfig 将在 Task 9 实现实际生成逻辑时使用
      void apiConfig;

      // 检查是否有源图片
      if (sourceImages.length === 0) {
        set({
          status: { stage: 'error', message: '请先上传至少一张图片' },
        });
        return;
      }

      // 创建新的 AbortController
      abortController = new AbortController();

      try {
        // 设置生成状态
        set({
          status: { stage: 'generating', type, progress: 0 },
        });

        // TODO: 实际的重新生成逻辑将在 Task 9 中实现
        
        // 模拟生成完成
        set({
          status: { stage: 'completed' },
        });
      } catch (error) {
        if (error instanceof Error && error.name === 'AbortError') {
          // 用户取消了生成
          set({
            status: { stage: 'idle' },
          });
        } else {
          set({
            status: {
              stage: 'error',
              message: error instanceof Error ? error.message : '重新生成失败',
            },
          });
        }
      }
    },

    /**
     * 取消生成
     */
    cancelGeneration: () => {
      if (abortController) {
        abortController.abort();
        abortController = null;
      }
      set({
        status: { stage: 'idle' },
      });
    },

    // ==================== 重置 ====================

    /**
     * 重置所有状态
     */
    reset: () => {
      const { sourceImages } = get();

      // 释放所有 object URLs
      sourceImages.forEach((img) => {
        URL.revokeObjectURL(img.preview);
      });

      // 取消正在进行的生成
      if (abortController) {
        abortController.abort();
        abortController = null;
      }

      set({
        ...initialState,
        prompts: { ...DEFAULT_PROMPTS },
      });
    },
  })
);

/**
 * 获取当前源图片数量
 */
export const getSourceImageCount = (): number => {
  return useWeChatStandardizationStore.getState().sourceImages.length;
};

/**
 * 检查是否可以添加更多图片
 */
export const canAddMoreImages = (): boolean => {
  return getSourceImageCount() < UPLOAD_LIMITS.MAX_IMAGE_COUNT;
};

/**
 * 获取剩余可上传数量
 */
export const getRemainingUploadSlots = (): number => {
  return UPLOAD_LIMITS.MAX_IMAGE_COUNT - getSourceImageCount();
};
