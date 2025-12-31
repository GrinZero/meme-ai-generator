/**
 * Download Service - 表情包下载服务
 * 
 * 功能：
 * - 单个表情下载（透明 PNG）
 * - 批量打包下载（ZIP）
 * - 支持标准化尺寸输出（默认 240x240）
 */

import JSZip from 'jszip';
import type { ExtractedEmoji } from '../types/image';

/** 默认标准化尺寸 */
export const DEFAULT_STANDARD_SIZE = 240;

/**
 * 下载选项
 */
export interface DownloadOptions {
  /** 是否标准化尺寸（默认 true） */
  standardize?: boolean;
  /** 标准化尺寸（默认 240） */
  size?: number;
}

/**
 * 生成合适的文件名
 */
export function generateFileName(index: number, prefix: string = 'emoji'): string {
  const paddedIndex = String(index).padStart(3, '0');
  return `${prefix}_${paddedIndex}.png`;
}

/**
 * 验证 Blob 是否为有效的 PNG 格式
 */
export async function isValidPNG(blob: Blob): Promise<boolean> {
  if (blob.size < 8) return false;
  
  return new Promise((resolve) => {
    const reader = new FileReader();
    reader.onload = () => {
      const arrayBuffer = reader.result as ArrayBuffer;
      const bytes = new Uint8Array(arrayBuffer.slice(0, 8));
      const pngSignature = [0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A];
      const isValid = pngSignature.every((byte, i) => bytes[i] === byte);
      resolve(isValid);
    };
    reader.onerror = () => resolve(false);
    reader.readAsArrayBuffer(blob.slice(0, 8));
  });
}

/**
 * 将图片标准化为正方形
 * 图片会被居中放置在正方形画布中，保持原始比例
 */
export async function standardizeImage(
  blob: Blob,
  size: number = DEFAULT_STANDARD_SIZE
): Promise<Blob> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      const canvas = document.createElement('canvas');
      canvas.width = size;
      canvas.height = size;
      const ctx = canvas.getContext('2d')!;
      
      // 透明背景
      ctx.clearRect(0, 0, size, size);
      
      // 计算缩放比例，保持原始比例
      const scale = Math.min(size / img.width, size / img.height);
      const scaledWidth = img.width * scale;
      const scaledHeight = img.height * scale;
      
      // 居中绘制
      const x = (size - scaledWidth) / 2;
      const y = (size - scaledHeight) / 2;
      
      ctx.drawImage(img, x, y, scaledWidth, scaledHeight);
      
      canvas.toBlob((result) => {
        if (result) {
          resolve(result);
        } else {
          reject(new Error('Failed to create blob'));
        }
      }, 'image/png');
      
      URL.revokeObjectURL(img.src);
    };
    img.onerror = () => {
      URL.revokeObjectURL(img.src);
      reject(new Error('Failed to load image'));
    };
    img.src = URL.createObjectURL(blob);
  });
}

/**
 * 触发浏览器下载
 */
export function triggerDownload(blob: Blob, fileName: string): void {
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
 * 下载单个表情
 */
export async function downloadSingleEmoji(
  emoji: ExtractedEmoji,
  index: number = 1,
  options: DownloadOptions = {}
): Promise<boolean> {
  const { standardize = true, size = DEFAULT_STANDARD_SIZE } = options;
  
  try {
    let blobToDownload = emoji.blob;
    
    if (standardize) {
      blobToDownload = await standardizeImage(emoji.blob, size);
    }
    
    const fileName = generateFileName(index);
    triggerDownload(blobToDownload, fileName);
    return true;
  } catch (error) {
    console.error('下载表情失败:', error);
    return false;
  }
}

/**
 * 批量打包下载所有表情
 */
export async function downloadAllEmojis(
  emojis: ExtractedEmoji[],
  zipFileName: string = 'emoji_pack',
  options: DownloadOptions = {}
): Promise<boolean> {
  const { standardize = true, size = DEFAULT_STANDARD_SIZE } = options;
  
  if (emojis.length === 0) {
    console.warn('没有可下载的表情');
    return false;
  }

  try {
    const zip = new JSZip();
    
    for (let i = 0; i < emojis.length; i++) {
      const emoji = emojis[i];
      let blobToAdd = emoji.blob;
      
      if (standardize) {
        blobToAdd = await standardizeImage(emoji.blob, size);
      }
      
      const fileName = generateFileName(i + 1);
      zip.file(fileName, blobToAdd);
    }
    
    const zipBlob = await zip.generateAsync({
      type: 'blob',
      compression: 'DEFLATE',
      compressionOptions: { level: 6 },
    });
    
    triggerDownload(zipBlob, `${zipFileName}.zip`);
    
    return true;
  } catch (error) {
    console.error('批量下载失败:', error);
    return false;
  }
}

/**
 * 创建 ZIP 文件（不触发下载，用于测试）
 */
export async function createZipBlob(
  emojis: ExtractedEmoji[],
  options: DownloadOptions = {}
): Promise<Blob> {
  const { standardize = true, size = DEFAULT_STANDARD_SIZE } = options;
  const zip = new JSZip();
  
  for (let i = 0; i < emojis.length; i++) {
    const emoji = emojis[i];
    let blobToAdd = emoji.blob;
    
    if (standardize) {
      blobToAdd = await standardizeImage(emoji.blob, size);
    }
    
    const fileName = generateFileName(i + 1);
    zip.file(fileName, blobToAdd);
  }
  
  return zip.generateAsync({
    type: 'blob',
    compression: 'DEFLATE',
    compressionOptions: { level: 6 },
  });
}

/**
 * 从 ZIP 中提取文件列表（用于测试验证）
 */
export async function getZipFileList(zipBlob: Blob): Promise<string[]> {
  const zip = await JSZip.loadAsync(zipBlob);
  return Object.keys(zip.files);
}
