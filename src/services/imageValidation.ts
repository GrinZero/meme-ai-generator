/**
 * 图片验证服务
 * 提供图片格式验证和上传限制检查功能
 */

// 支持的图片 MIME 类型
export const SUPPORTED_FORMATS = ['image/png', 'image/jpeg', 'image/jpg', 'image/webp'];

// 支持的文件扩展名
export const SUPPORTED_EXTENSIONS = ['.png', '.jpg', '.jpeg', '.webp'];

// 图片数量限制
export const MATERIAL_IMAGE_LIMIT = 21;
export const REFERENCE_IMAGE_LIMIT = 3;

/**
 * 验证文件是否为支持的图片格式
 * @param file 要验证的文件
 * @returns 是否为有效的图片格式
 */
export function isValidImageFormat(file: File): boolean {
  // 检查 MIME 类型
  if (SUPPORTED_FORMATS.includes(file.type.toLowerCase())) {
    return true;
  }
  
  // 如果 MIME 类型不匹配，检查文件扩展名作为后备
  const fileName = file.name.toLowerCase();
  return SUPPORTED_EXTENSIONS.some(ext => fileName.endsWith(ext));
}

/**
 * 验证文件扩展名是否支持
 * @param fileName 文件名
 * @returns 是否为支持的扩展名
 */
export function isValidImageExtension(fileName: string): boolean {
  const lowerName = fileName.toLowerCase();
  return SUPPORTED_EXTENSIONS.some(ext => lowerName.endsWith(ext));
}

/**
 * 计算可上传的图片数量
 * @param currentCount 当前已上传数量
 * @param maxCount 最大允许数量
 * @param newFilesCount 新文件数量
 * @returns 实际可上传的数量
 */
export function calculateUploadableCount(
  currentCount: number,
  maxCount: number,
  newFilesCount: number
): number {
  const remainingSlots = maxCount - currentCount;
  if (remainingSlots <= 0) return 0;
  return Math.min(remainingSlots, newFilesCount);
}

/**
 * 验证上传结果
 */
export interface UploadValidationResult {
  validFiles: File[];
  invalidFormatCount: number;
  exceededLimitCount: number;
  error: string | null;
}

/**
 * 验证并过滤要上传的文件
 * @param files 要上传的文件列表
 * @param currentCount 当前已上传数量
 * @param maxCount 最大允许数量
 * @returns 验证结果
 */
export function validateUploadFiles(
  files: File[],
  currentCount: number,
  maxCount: number
): UploadValidationResult {
  // 过滤有效格式的文件
  const validFormatFiles = files.filter(isValidImageFormat);
  const invalidFormatCount = files.length - validFormatFiles.length;
  
  // 计算可上传数量
  const uploadableCount = calculateUploadableCount(currentCount, maxCount, validFormatFiles.length);
  const exceededLimitCount = validFormatFiles.length - uploadableCount;
  
  // 获取实际可上传的文件
  const validFiles = validFormatFiles.slice(0, uploadableCount);
  
  // 生成错误消息
  let error: string | null = null;
  const errors: string[] = [];
  
  if (invalidFormatCount > 0) {
    errors.push(`${invalidFormatCount} 个文件格式不支持，仅支持 PNG/JPG/JPEG/WebP`);
  }
  
  if (currentCount >= maxCount) {
    errors.push(`已达到最大数量限制 (${maxCount} 张)`);
  } else if (exceededLimitCount > 0) {
    errors.push(`超出限制，仅上传了前 ${uploadableCount} 张图片`);
  }
  
  if (errors.length > 0) {
    error = errors.join('；');
  }
  
  return {
    validFiles,
    invalidFormatCount,
    exceededLimitCount,
    error,
  };
}
