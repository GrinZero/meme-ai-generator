/**
 * 应用状态类型定义
 */

import type { APIConfig } from './api';
import type { UploadedImage, ExtractedEmoji } from './image';

export interface AppState {
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
  removeImage: (id: string, type: 'material' | 'reference') => void;
  
  // Prompt
  userPrompt: string;
  setUserPrompt: (prompt: string) => void;
  
  // Generation
  isGenerating: boolean;
  generatedImage: Blob | null;
  extractedEmojis: ExtractedEmoji[];
  generate: () => Promise<void>;
  cancelGeneration: () => void;
  
  // Editor
  selectedEmojiId: string | null;
  selectEmoji: (id: string | null) => void;
  regenerateEmoji: (id: string, prompt: string) => Promise<void>;
}

/**
 * 持久化到 localStorage 的数据结构
 */
export interface PersistedState {
  apiConfig: {
    apiKey: string;
    baseUrl: string;
    style: 'gemini' | 'openai';
    model?: string;
  };
  languagePreference: string;
}

export const STORAGE_KEY = 'emoji-pack-generator-config';
