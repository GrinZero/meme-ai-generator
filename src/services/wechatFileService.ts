/**
 * 微信表情平台文件服务
 * 
 * 功能：
 * - 文件格式验证
 * - 标准文件命名
 * - ZIP 打包下载
 */

import JSZip from 'jszip';
import type { ProcessedImage, StandardizationError } from '../types/wechatStandardization';
import { SUPPORTED_IMAGE_FORMATS, WECHAT_SPECS, FILE_NAMING } from './wechatConstants';

/**
 * 文件验证结果
 */
export interface FileValidationResult {
  valid: boolean;
  error?: StandardizationError;
}

/**
 * 验证文件格式是否为支持的图片格式
 * 
 * @param file - 要验证的文件
 * @returns 验证结果，包含是否有效和错误信息
 * 
 * **Validates: Requirements 1.2, 1.6**
 */
export function validateImageFormat(file: File): FileValidationResult {
  const mimeType = file.type.toLowerCase();
  
  // 检查 MIME 类型是否在支持列表中
  const isValidMime = SUPPORTED_IMAGE_FORMATS.MIME_TYPES.some(
    (supportedType) => supportedType === mimeType || 
      // 处理 image/jpg 作为 image/jpeg 的别名
      (mimeType === 'image/jpg' && supportedType === 'image/jpeg')
  );
  
  if (!isValidMime) {
    return {
      valid: false,
      error: {
        type: 'INVALID_FILE_FORMAT',
        message: `不支持的文件格式: ${mimeType || '未知'}。支持的格式: PNG, JPG, JPEG, WebP`,
        details: {
          providedType: mimeType,
          supportedTypes: SUPPORTED_IMAGE_FORMATS.MIME_TYPES,
        },
      },
    };
  }
  
  return { valid: true };
}

/**
 * 验证文件格式（通过 MIME 类型字符串）
 * 
 * @param mimeType - MIME 类型字符串
 * @returns 是否为有效的图片格式
 */
export function isValidImageMimeType(mimeType: string): boolean {
  const normalizedType = mimeType.toLowerCase();
  return SUPPORTED_IMAGE_FORMATS.MIME_TYPES.some(
    (supportedType) => supportedType === normalizedType ||
      (normalizedType === 'image/jpg' && supportedType === 'image/jpeg')
  );
}

/**
 * 生成标准文件名
 * 
 * @param type - 图片类型 ('banner' | 'cover' | 'icon')
 * @param format - 文件格式 ('png' | 'jpeg')
 * @returns 标准化的文件名
 * 
 * 命名规范:
 * - P1 Banner: 'banner_750x400.{png|jpg}'
 * - P2 Cover: 'cover_240x240.png'
 * - P3 Icon: 'icon_50x50.png'
 * 
 * **Validates: Requirements 6.5**
 */
export function generateStandardFileName(
  type: 'banner' | 'cover' | 'icon',
  format: 'png' | 'jpeg'
): string {
  return FILE_NAMING.getFileName(type, format);
}

/**
 * 获取图片类型对应的规格信息
 */
export function getImageTypeSpec(type: 'banner' | 'cover' | 'icon') {
  switch (type) {
    case 'banner':
      return WECHAT_SPECS.BANNER;
    case 'cover':
      return WECHAT_SPECS.COVER;
    case 'icon':
      return WECHAT_SPECS.ICON;
  }
}

/**
 * ZIP 包内容项
 */
export interface ZipContentItem {
  fileName: string;
  blob: Blob;
}

/**
 * 创建标准化 ZIP 包
 * 
 * @param images - 处理后的图片对象，包含 banner、cover、icon
 * @returns ZIP 文件 Blob
 * 
 * ZIP 包内容:
 * - banner_750x400.{png|jpg}
 * - cover_240x240.png
 * - icon_50x50.png
 * 
 * **Validates: Requirements 6.4**
 */
export async function createStandardizationZip(images: {
  banner: ProcessedImage | null;
  cover: ProcessedImage | null;
  icon: ProcessedImage | null;
}): Promise<Blob> {
  const zip = new JSZip();
  const items: ZipContentItem[] = [];
  
  // 添加 Banner (P1)
  if (images.banner) {
    const fileName = generateStandardFileName('banner', images.banner.format);
    items.push({ fileName, blob: images.banner.blob });
  }
  
  // 添加 Cover (P2)
  if (images.cover) {
    const fileName = generateStandardFileName('cover', images.cover.format);
    items.push({ fileName, blob: images.cover.blob });
  }
  
  // 添加 Icon (P3)
  if (images.icon) {
    const fileName = generateStandardFileName('icon', images.icon.format);
    items.push({ fileName, blob: images.icon.blob });
  }
  
  // 将所有文件添加到 ZIP
  for (const item of items) {
    zip.file(item.fileName, item.blob);
  }
  
  // 生成 ZIP 文件
  return zip.generateAsync({
    type: 'blob',
    compression: 'DEFLATE',
    compressionOptions: { level: 6 },
  });
}

/**
 * 获取 ZIP 包的默认文件名
 */
export function getZipFileName(): string {
  return FILE_NAMING.ZIP_NAME;
}

/**
 * 触发文件下载
 * 
 * @param blob - 要下载的文件 Blob
 * @param fileName - 下载的文件名
 */
export function triggerFileDownload(blob: Blob, fileName: string): void {
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = fileName;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

/**
 * 下载单个处理后的图片
 * 
 * @param image - 处理后的图片
 */
export function downloadProcessedImage(image: ProcessedImage): void {
  const fileName = generateStandardFileName(image.type, image.format);
  triggerFileDownload(image.blob, fileName);
}

/**
 * 下载标准化 ZIP 包
 * 
 * @param images - 处理后的图片对象
 */
export async function downloadStandardizationZip(images: {
  banner: ProcessedImage | null;
  cover: ProcessedImage | null;
  icon: ProcessedImage | null;
}): Promise<void> {
  const zipBlob = await createStandardizationZip(images);
  triggerFileDownload(zipBlob, getZipFileName());
}

/**
 * 从 ZIP 中提取文件列表（用于测试验证）
 * 
 * @param zipBlob - ZIP 文件 Blob
 * @returns 文件名列表
 */
export async function getZipFileList(zipBlob: Blob): Promise<string[]> {
  const zip = await JSZip.loadAsync(zipBlob);
  return Object.keys(zip.files);
}

/**
 * 验证 ZIP 包内容是否符合规范
 * 
 * @param zipBlob - ZIP 文件 Blob
 * @returns 验证结果
 */
export async function validateZipContents(zipBlob: Blob): Promise<{
  valid: boolean;
  files: string[];
  missingFiles: string[];
}> {
  const files = await getZipFileList(zipBlob);
  const expectedPatterns = [
    /^banner_750x400\.(png|jpg)$/,
    /^cover_240x240\.png$/,
    /^icon_50x50\.png$/,
  ];
  
  const missingFiles: string[] = [];
  
  // 检查每个预期的文件模式
  for (const pattern of expectedPatterns) {
    const found = files.some((file) => pattern.test(file));
    if (!found) {
      missingFiles.push(pattern.source);
    }
  }
  
  return {
    valid: missingFiles.length === 0,
    files,
    missingFiles,
  };
}
