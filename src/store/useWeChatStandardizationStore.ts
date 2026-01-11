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
 * - 赞赏图生成开关
 * - 图片选择和重新处理
 * 
 * Requirements: 1.3-1.5, 2.1, 2.2, 2.5-2.8, 3.1, 4.3, 4.6, 4.9, 4.10, 7.3
 */

import { create } from 'zustand';
import type { ExtractedEmoji } from '../types/image';
import type { APIConfig } from '../types/api';
import type {
  SourceImage,
  StandardizationResult,
  ProcessingStatus,
  WeChatStandardizationState,
  WImageType,
  ProcessingParams,
  ProcessedImage,
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
 * 默认切割参数
 */
const DEFAULT_PROCESSING_PARAMS: ProcessingParams = {
  tolerance: 30,
  minArea: 100,
  minSize: 10,
  removeBackground: true,
};

/**
 * 初始状态
 */
const initialState = {
  sourceImages: [] as SourceImage[],
  prompts: { ...DEFAULT_PROMPTS },
  result: null as StandardizationResult | null,
  status: { stage: 'idle' } as ProcessingStatus,
  enabledTypes: {
    p1: true,
    p2: true,
    p3: true,
    appreciationGuide: false,
    appreciationThanks: false,
  },
  selectedImageType: null as WImageType | null,
  reprocessPrompt: '',
  reprocessParams: { ...DEFAULT_PROCESSING_PARAMS },
  reprocessResult: null as ProcessedImage | null,
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

    // ==================== 赞赏图提示词管理 ====================

    /**
     * 设置赞赏图提示词
     * 
     * Requirements: 2.7
     */
    setAppreciationPrompt: (type: 'appreciationGuide' | 'appreciationThanks', value: string) => {
      const { prompts } = get();
      set({
        prompts: {
          ...prompts,
          [type]: value,
        },
      });
    },

    /**
     * 重置赞赏图提示词为默认值
     * 
     * Requirements: 2.8
     */
    resetAppreciationPrompt: (type: 'appreciationGuide' | 'appreciationThanks') => {
      const { prompts } = get();
      set({
        prompts: {
          ...prompts,
          [type]: DEFAULT_PROMPTS[type],
        },
      });
    },

    // ==================== 启用类型管理 ====================

    /**
     * 切换指定类型的启用状态
     */
    toggleEnabledType: (type) => {
      const { enabledTypes } = get();
      set({
        enabledTypes: {
          ...enabledTypes,
          [type]: !enabledTypes[type],
        },
      });
    },

    /**
     * 批量设置启用类型
     */
    setEnabledTypes: (types) => {
      set({
        enabledTypes: types,
      });
    },

    // ==================== 图片选择和重新处理 ====================

    /**
     * 设置当前选中的图片类型
     * 
     * Requirements: 4.3
     */
    setSelectedImageType: (type: WImageType | null) => {
      const { result, prompts } = get();
      
      // 当选中图片时，初始化 reprocessPrompt 为对应类型的当前提示词
      let initialPrompt = '';
      if (type && result) {
        switch (type) {
          case 'banner':
            initialPrompt = prompts.p1;
            break;
          case 'cover':
            initialPrompt = prompts.p2;
            break;
          case 'icon':
            initialPrompt = prompts.p3;
            break;
          case 'appreciationGuide':
            initialPrompt = prompts.appreciationGuide;
            break;
          case 'appreciationThanks':
            initialPrompt = prompts.appreciationThanks;
            break;
        }
      }
      
      // 根据类型设置默认的 removeBackground
      const shouldRemoveBackground = type === 'cover' || type === 'icon';

      set({
        selectedImageType: type,
        reprocessPrompt: initialPrompt,
        reprocessResult: null, // 清除之前的重新处理结果
        reprocessParams: {
          ...DEFAULT_PROCESSING_PARAMS,
          removeBackground: shouldRemoveBackground,
        },
      });
    },

    /**
     * 设置重新处理的提示词
     * 
     * Requirements: 4.6
     */
    setReprocessPrompt: (prompt: string) => {
      set({
        reprocessPrompt: prompt,
      });
    },

    /**
     * 设置重新处理的参数
     */
    setReprocessParams: (params: ProcessingParams) => {
      set({
        reprocessParams: params,
      });
    },

    /**
     * 重新生成选中的图片
     * 
     * Requirements: 4.6
     */
    regenerateSelected: async (apiConfig: APIConfig) => {
      const { sourceImages, selectedImageType } = get();
      // apiConfig 将在实际生成逻辑实现时使用
      // void apiConfig;
      void apiConfig;

      if (!selectedImageType) {
        set({
          status: { stage: 'error', message: '请先选择要重新生成的图片' },
        });
        return;
      }

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
        // 映射 WImageType 到 ProcessingStatus 的 type
        const statusType = selectedImageType === 'banner' ? 'p1'
          : selectedImageType === 'cover' ? 'p2'
          : selectedImageType === 'icon' ? 'p3'
          : selectedImageType;

        // 设置生成状态
        set({
          status: { stage: 'generating', type: statusType, progress: 0 },
        });

        // TODO: 实际的重新生成逻辑将在后续任务中实现
        // 这里只是状态管理的框架
        
        // 模拟生成完成
        set({
          status: { stage: 'completed' },
          // reprocessResult 将在实际实现时设置
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
     * 更新部分结果（用于增量显示生成图片）
     */
    updateResult: (partialResult: Partial<StandardizationResult>) => {
      const { result } = get();
      set({
        result: result ? { ...result, ...partialResult } : {
          banner: null,
          cover: null,
          icon: null,
          appreciationGuide: null,
          appreciationThanks: null,
          errors: [],
          ...partialResult
        } as StandardizationResult,
      });
    },

    /**
     * 用重新生成的图片替换原有图片
     * 
     * Requirements: 4.9
     */
    replaceWithReprocessed: () => {
      const { result, selectedImageType, reprocessResult } = get();

      if (!result || !selectedImageType || !reprocessResult) {
        return;
      }

      // 根据选中的类型替换对应的图片
      const updatedResult: StandardizationResult = { ...result };
      
      switch (selectedImageType) {
        case 'banner':
          updatedResult.banner = reprocessResult;
          break;
        case 'cover':
          updatedResult.cover = reprocessResult;
          break;
        case 'icon':
          updatedResult.icon = reprocessResult;
          break;
        case 'appreciationGuide':
          updatedResult.appreciationGuide = reprocessResult;
          break;
        case 'appreciationThanks':
          updatedResult.appreciationThanks = reprocessResult;
          break;
      }

      set({
        result: updatedResult,
        reprocessResult: null,
        selectedImageType: null,
        reprocessPrompt: '',
      });
    },

    /**
     * 取消重新处理，保留原有图片
     * 
     * Requirements: 4.10
     */
    cancelReprocess: () => {
      set({
        reprocessResult: null,
        selectedImageType: null,
        reprocessPrompt: '',
        reprocessParams: { ...DEFAULT_PROCESSING_PARAMS },
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
