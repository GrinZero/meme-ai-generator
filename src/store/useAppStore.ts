/**
 * Zustand Store - 应用状态管理
 */

import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import type { APIConfig, APIStyle } from '../types/api';
import type { UploadedImage, ExtractedEmoji, ImageType } from '../types/image';
import type { AISegmentationConfig, ManualSplitConfig } from '../types/segmentation';
import { STORAGE_KEY } from '../types/store';
import { MATERIAL_IMAGE_LIMIT, REFERENCE_IMAGE_LIMIT } from '../services/imageValidation';
import { fetchModels, getDefaultModels, type ModelInfo } from '../services/modelListService';

// 默认 AI 分割配置
const defaultAISegmentationConfig: AISegmentationConfig = {
  enabled: false,
  timeout: 30000,
  maxImageSize: 4 * 1024 * 1024, // 4MB
  usePolygon: true,
};

// 默认手动切割配置
const defaultManualSplitConfig: ManualSplitConfig = {
  tolerance: 30,
  minArea: 100,
  minSize: 10,
  mergeDistancePercent: 2,
};

// 生成唯一 ID
const generateId = () => `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;

// 默认 API 配置
const defaultAPIConfig: APIConfig = {
  apiKey: '',
  baseUrl: '',
  style: 'gemini' as APIStyle,
  model: '',
};

interface AppState {
  // API Config
  apiConfig: APIConfig;
  setAPIConfig: (config: Partial<APIConfig>) => void;
  
  // Language Preference
  languagePreference: string;
  setLanguagePreference: (pref: string) => void;
  
  // Model List (Requirements: 1.1, 1.2, 1.3, 1.4)
  availableModels: ModelInfo[];
  isLoadingModels: boolean;
  modelListError: string | null;
  setAvailableModels: (models: ModelInfo[]) => void;
  setIsLoadingModels: (loading: boolean) => void;
  setModelListError: (error: string | null) => void;
  fetchModelList: () => Promise<void>;
  
  // AI Segmentation Config (Requirements: 5.3)
  aiSegmentationConfig: AISegmentationConfig;
  setAISegmentationConfig: (config: Partial<AISegmentationConfig>) => void;
  toggleAISegmentation: () => void;
  
  // Manual Split Config
  manualSplitConfig: ManualSplitConfig;
  setManualSplitConfig: (config: Partial<ManualSplitConfig>) => void;
  resetManualSplitConfig: () => void;
  
  // Images
  materialImages: UploadedImage[];
  referenceImages: UploadedImage[];
  addMaterialImage: (file: File) => void;
  addReferenceImage: (file: File) => void;
  removeImage: (id: string, type: ImageType) => void;
  
  // Prompt
  userPrompt: string;
  setUserPrompt: (prompt: string) => void;
  
  // Generation
  isGenerating: boolean;
  generatedImage: Blob | null;
  extractedEmojis: ExtractedEmoji[];
  setIsGenerating: (isGenerating: boolean) => void;
  setGeneratedImage: (image: Blob | null) => void;
  setExtractedEmojis: (emojis: ExtractedEmoji[]) => void;
  
  // Editor
  selectedEmojiId: string | null;
  editPrompt: string;
  isRegenerating: boolean;
  selectEmoji: (id: string | null) => void;
  setEditPrompt: (prompt: string) => void;
  setIsRegenerating: (isRegenerating: boolean) => void;
  replaceEmoji: (id: string, newEmoji: ExtractedEmoji) => void;
  deleteEmoji: (id: string) => void;
  appendEmojis: (emojis: ExtractedEmoji[]) => void;
}

// 需要持久化的状态字段
type PersistedFields = Pick<AppState, 'apiConfig' | 'languagePreference' | 'aiSegmentationConfig' | 'manualSplitConfig'>;

export const useAppStore = create<AppState>()(
  persist(
    (set, get) => ({
      // API Config
      apiConfig: defaultAPIConfig,
      setAPIConfig: (config) =>
        set((state) => ({
          apiConfig: { ...state.apiConfig, ...config },
        })),

      // Language Preference
      languagePreference: '',
      setLanguagePreference: (pref) => set({ languagePreference: pref }),

      // Model List (Requirements: 1.1, 1.2, 1.3, 1.4)
      availableModels: [],
      isLoadingModels: false,
      modelListError: null,
      setAvailableModels: (models) => set({ availableModels: models }),
      setIsLoadingModels: (loading) => set({ isLoadingModels: loading }),
      setModelListError: (error) => set({ modelListError: error }),
      fetchModelList: async () => {
        const { apiConfig } = get();
        
        // If no API Key, use default models (Requirement 4.5)
        if (!apiConfig.apiKey) {
          set({ 
            availableModels: getDefaultModels(apiConfig.style),
            modelListError: null,
            isLoadingModels: false,
          });
          return;
        }

        // Set loading state (Requirement 1.2)
        set({ isLoadingModels: true, modelListError: null });

        try {
          const result = await fetchModels(apiConfig);
          
          if (result.success && result.models) {
            // Success: update available models (Requirement 1.3)
            set({ 
              availableModels: result.models,
              modelListError: null,
            });
          } else {
            // Failure: fall back to default models (Requirement 1.4)
            set({ 
              availableModels: getDefaultModels(apiConfig.style),
              modelListError: result.error || '获取模型列表失败',
            });
          }
        } catch {
          // Error: fall back to default models (Requirement 1.4)
          set({ 
            availableModels: getDefaultModels(apiConfig.style),
            modelListError: '获取模型列表失败',
          });
        } finally {
          set({ isLoadingModels: false });
        }
      },

      // AI Segmentation Config (Requirements: 5.3)
      aiSegmentationConfig: defaultAISegmentationConfig,
      setAISegmentationConfig: (config) =>
        set((state) => ({
          aiSegmentationConfig: { ...state.aiSegmentationConfig, ...config },
        })),
      toggleAISegmentation: () =>
        set((state) => ({
          aiSegmentationConfig: {
            ...state.aiSegmentationConfig,
            enabled: !state.aiSegmentationConfig.enabled,
          },
        })),

      // Manual Split Config
      manualSplitConfig: defaultManualSplitConfig,
      setManualSplitConfig: (config) =>
        set((state) => ({
          manualSplitConfig: { ...state.manualSplitConfig, ...config },
        })),
      resetManualSplitConfig: () =>
        set({ manualSplitConfig: defaultManualSplitConfig }),

      // Images
      materialImages: [],
      referenceImages: [],
      addMaterialImage: (file) =>
        set((state) => {
          if (state.materialImages.length >= MATERIAL_IMAGE_LIMIT) {
            return state;
          }
          const newImage: UploadedImage = {
            id: generateId(),
            file,
            preview: URL.createObjectURL(file),
            type: 'material',
          };
          return { materialImages: [...state.materialImages, newImage] };
        }),
      addReferenceImage: (file) =>
        set((state) => {
          if (state.referenceImages.length >= REFERENCE_IMAGE_LIMIT) {
            return state;
          }
          const newImage: UploadedImage = {
            id: generateId(),
            file,
            preview: URL.createObjectURL(file),
            type: 'reference',
          };
          return { referenceImages: [...state.referenceImages, newImage] };
        }),
      removeImage: (id, type) =>
        set((state) => {
          if (type === 'material') {
            const image = state.materialImages.find((img) => img.id === id);
            if (image) {
              URL.revokeObjectURL(image.preview);
            }
            return {
              materialImages: state.materialImages.filter((img) => img.id !== id),
            };
          } else {
            const image = state.referenceImages.find((img) => img.id === id);
            if (image) {
              URL.revokeObjectURL(image.preview);
            }
            return {
              referenceImages: state.referenceImages.filter((img) => img.id !== id),
            };
          }
        }),

      // Prompt
      userPrompt: '',
      setUserPrompt: (prompt) => set({ userPrompt: prompt }),

      // Generation
      isGenerating: false,
      generatedImage: null,
      extractedEmojis: [],
      setIsGenerating: (isGenerating) => set({ isGenerating }),
      setGeneratedImage: (image) => set({ generatedImage: image, extractedEmojis: [], selectedEmojiId: null }),
      setExtractedEmojis: (emojis) => set({ extractedEmojis: emojis }),

      // Editor
      selectedEmojiId: null,
      editPrompt: '',
      isRegenerating: false,
      selectEmoji: (id) => set({ selectedEmojiId: id }),
      setEditPrompt: (prompt) => set({ editPrompt: prompt }),
      setIsRegenerating: (isRegenerating) => set({ isRegenerating }),
      replaceEmoji: (id, newEmoji) =>
        set((state) => ({
          extractedEmojis: state.extractedEmojis.map((emoji) =>
            emoji.id === id ? { ...newEmoji, id } : emoji
          ),
        })),
      deleteEmoji: (id) =>
        set((state) => ({
          extractedEmojis: state.extractedEmojis.filter((emoji) => emoji.id !== id),
          selectedEmojiId: state.selectedEmojiId === id ? null : state.selectedEmojiId,
        })),
      appendEmojis: (emojis) =>
        set((state) => ({
          extractedEmojis: [...state.extractedEmojis, ...emojis],
        })),
    }),
    {
      name: STORAGE_KEY,
      storage: createJSONStorage(() => localStorage),
      // 只持久化配置相关的状态
      partialize: (state): PersistedFields => ({
        apiConfig: state.apiConfig,
        languagePreference: state.languagePreference,
        aiSegmentationConfig: state.aiSegmentationConfig,
        manualSplitConfig: state.manualSplitConfig,
      }),
    }
  )
);
