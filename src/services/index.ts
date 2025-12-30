/**
 * 服务导出
 */

export {
  validateAPIConfig,
  validateApiKey,
  validateBaseUrl,
  isConfigComplete,
} from './configValidation';

export type {
  ConfigValidationErrors,
  ValidationResult,
} from './configValidation';

export {
  isValidImageFormat,
  isValidImageExtension,
  calculateUploadableCount,
  validateUploadFiles,
  SUPPORTED_FORMATS,
  SUPPORTED_EXTENSIONS,
  MATERIAL_IMAGE_LIMIT,
  REFERENCE_IMAGE_LIMIT,
} from './imageValidation';

export type { UploadValidationResult } from './imageValidation';

export {
  buildSystemPrompt,
  buildFullPrompt,
  isPromptConfigValid,
  getSystemPrompt,
} from './promptBuilder';

export {
  generateImage,
  generateWithGemini,
  generateWithOpenAI,
  cancelGeneration,
  getErrorMessage,
  AIError,
} from './aiService';

export type {
  GenerationResult,
  AIErrorType,
} from './aiService';

export {
  getErrorInfo,
  inferErrorType,
  getUserFriendlyMessage,
  isUserFriendlyMessage,
  calculateRetryDelay,
  withRetry,
} from './errorHandler';

export type {
  ErrorInfo,
  RetryConfig,
} from './errorHandler';

export {
  detectBackgroundColor,
  createBinaryMask,
  labelConnectedRegions,
  extractBoundingBoxes,
  detectEmojis,
  getPixelColor,
  colorDistance,
  colorsAreSimilar,
  removeBackgroundSimple,
  cropImage,
  imageDataToBlob,
  imageDataToPreviewUrl,
  removeBackground,
  extractEmoji,
  extractAllEmojis,
  getImageDataFromImage,
  loadImageFromBlob,
} from './imageSplitter';

export type {
  RGBAColor,
  BackgroundDetectionConfig,
  RegionDetectionConfig,
} from './imageSplitter';

export {
  regenerateEmoji,
  buildRegenerationPrompt,
} from './emojiRegeneration';

export type {
  RegenerationConfig,
  RegenerationResult,
} from './emojiRegeneration';

export {
  generateFileName,
  isValidPNG,
  triggerDownload,
  downloadSingleEmoji,
  downloadAllEmojis,
  createZipBlob,
  getZipFileList,
} from './downloadService';

export {
  fetchModels,
  clearCache,
  getDefaultModels,
  buildGeminiModelsUrl,
  buildOpenAIModelsUrl,
  filterGeminiModels,
  transformOpenAIModels,
  generateCacheKey,
  DEFAULT_GEMINI_MODELS,
  DEFAULT_OPENAI_MODELS,
} from './modelListService';

export type {
  ModelInfo,
  FetchModelsResult,
} from './modelListService';
