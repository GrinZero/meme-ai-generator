/**
 * Zustand Store - 应用状态管理
 */

import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import type { APIConfig, APIStyle } from '../types/api';
import type { UploadedImage, ExtractedEmoji, ImageType } from '../types/image';
import { STORAGE_KEY } from '../types/store';
import { MATERIAL_IMAGE_LIMIT, REFERENCE_IMAGE_LIMIT } from '../services/imageValidation';

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
}

// 需要持久化的状态字段
type PersistedFields = Pick<AppState, 'apiConfig' | 'languagePreference'>;

export const useAppStore = create<AppState>()(
  persist(
    (set) => ({
      // API Config
      apiConfig: defaultAPIConfig,
      setAPIConfig: (config) =>
        set((state) => ({
          apiConfig: { ...state.apiConfig, ...config },
        })),

      // Language Preference
      languagePreference: '',
      setLanguagePreference: (pref) => set({ languagePreference: pref }),

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
      setGeneratedImage: (image) => set({ generatedImage: image }),
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
    }),
    {
      name: STORAGE_KEY,
      storage: createJSONStorage(() => localStorage),
      // 只持久化配置相关的状态
      partialize: (state): PersistedFields => ({
        apiConfig: state.apiConfig,
        languagePreference: state.languagePreference,
      }),
    }
  )
);
