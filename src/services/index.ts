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
  extractAllEmojisWithAI,
  getImageDataFromImage,
  loadImageFromBlob,
} from './imageSplitter';

export type {
  RGBAColor,
  BackgroundDetectionConfig,
  RegionDetectionConfig,
  AIExtractionOptions,
  AIExtractionResult,
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
  standardizeImage,
  DEFAULT_STANDARD_SIZE,
} from './downloadService';

export type {
  DownloadOptions,
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

export {
  isValidPolygon,
  clampCoordinates,
  normalizeCoordinates,
  rectangleToBoundingBox,
  boundingBoxToPolygon,
} from './coordinateUtils';

export {
  AISegmentationService,
  createAISegmentationService,
  DEFAULT_AI_SEGMENTATION_CONFIG,
} from './aiSegmentationService';

export {
  calculatePolygonBoundingBox,
  isConvexPolygon,
  isPointInPolygon,
  cropWithPolygon,
  extractEmojisFromRegions,
} from './polygonCropper';

// Selection Manager exports
export {
  generateSelectionId,
  createRectangleSelection,
  createPolygonSelection,
  updateSelectionPosition,
  updateSelectionSize,
  movePolygonVertex,
  insertPolygonVertex,
  isPolygonClosed,
  validatePolygon,
  SelectionHistory,
  createSelectionHistory,
} from './selectionManager';

// Region Extractor exports
export {
  extractRectangleRegion,
  extractPolygonRegion,
  removeRegionBackground,
  extractFromSelection,
  extractSelectionToEmoji,
  extractAllSelections,
} from './regionExtractor';

export type {
  RegionExtractionOptions,
} from './regionExtractor';

// Emoji Normalizer exports
export {
  normalizeImageData,
  normalizeEmoji,
  normalizeAllEmojis,
  calculateScaledSize,
  calculateCenterOffset,
  isAlreadyNormalized,
  getContentBounds,
  validateNormalization,
} from './emojiNormalizer';

export type {
  NormalizationOptions,
} from './emojiNormalizer';

// WeChat Standardization Constants exports
export {
  WECHAT_SPECS,
  SUPPORTED_IMAGE_FORMATS,
  UPLOAD_LIMITS,
  DEFAULT_PROMPTS,
  COMPRESSION_CONFIG,
  FILE_NAMING,
  isValidImageFormat as isValidWeChatImageFormat,
  isValidFileSize,
  getSpecByType,
} from './wechatConstants';

// WeChat File Service exports
export {
  validateImageFormat as validateWeChatImageFormat,
  isValidImageMimeType,
  generateStandardFileName,
  getImageTypeSpec,
  createStandardizationZip,
  getZipFileName,
  triggerFileDownload,
  downloadProcessedImage,
  downloadStandardizationZip,
  getZipFileList as getWeChatZipFileList,
  validateZipContents,
} from './wechatFileService';

export type {
  FileValidationResult,
  ZipContentItem,
} from './wechatFileService';

// WeChat Image Processor exports
export {
  resizeImage,
  compressImage,
  processToBanner,
  processToCover,
  processToIcon,
  compressToBannerLimit,
  compressToCoverLimit,
  compressToIconLimit,
  getImageDimensions,
  WeChatImageProcessor,
} from './wechatImageProcessor';

// WeChat Background Remover exports
export {
  removeBackground as removeWeChatBackground,
  removeBackgroundForCover,
  removeBackgroundForIcon,
  hasTransparentPixels,
  createBackgroundRemovalError,
  WeChatBackgroundRemover,
} from './wechatBackgroundRemover';

export type {
  BackgroundRemovalOptions,
  BackgroundRemovalResult,
} from './wechatBackgroundRemover';

// WeChat Standardization Service exports
export {
  generateBanner,
  generateCover,
  generateIcon,
  generateAll,
  cancelGeneration as cancelWeChatGeneration,
  validateProcessedImage,
  WeChatStandardizationService,
} from './wechatStandardizationService';

export type {
  ProgressCallback,
} from './wechatStandardizationService';
