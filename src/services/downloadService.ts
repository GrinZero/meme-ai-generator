/**
 * Download Service - 表情包下载服务
 * 
 * 功能：
 * - 单个表情下载（透明 PNG）
 * - 批量打包下载（ZIP）
 * 
 * Requirements: 7.5, 8.1, 8.2, 8.3
 */

import JSZip from 'jszip';
import type { ExtractedEmoji } from '../types/image';

/**
 * 生成合适的文件名
 * @param index - 表情索引（从 1 开始）
 * @param prefix - 文件名前缀
 * @returns 格式化的文件名
 */
export function generateFileName(index: number, prefix: string = 'emoji'): string {
  const paddedIndex = String(index).padStart(3, '0');
  return `${prefix}_${paddedIndex}.png`;
}

/**
 * 验证 Blob 是否为有效的 PNG 格式
 * PNG 文件头: 89 50 4E 47 0D 0A 1A 0A
 * @param blob - 要验证的 Blob
 * @returns 是否为有效 PNG
 */
export async function isValidPNG(blob: Blob): Promise<boolean> {
  if (blob.size < 8) return false;
  
  // Use FileReader for better compatibility with jsdom
  return new Promise((resolve) => {
    const reader = new FileReader();
    reader.onload = () => {
      const arrayBuffer = reader.result as ArrayBuffer;
      const bytes = new Uint8Array(arrayBuffer.slice(0, 8));
      
      // PNG magic number
      const pngSignature = [0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A];
      const isValid = pngSignature.every((byte, i) => bytes[i] === byte);
      resolve(isValid);
    };
    reader.onerror = () => resolve(false);
    reader.readAsArrayBuffer(blob.slice(0, 8));
  });
}

/**
 * 触发浏览器下载
 * @param blob - 要下载的 Blob
 * @param fileName - 文件名
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
 * @param emoji - 要下载的表情
 * @param index - 表情索引（用于生成文件名）
 * @returns 下载是否成功
 */
export async function downloadSingleEmoji(
  emoji: ExtractedEmoji,
  index: number = 1
): Promise<boolean> {
  try {
    const fileName = generateFileName(index);
    triggerDownload(emoji.blob, fileName);
    return true;
  } catch (error) {
    console.error('下载表情失败:', error);
    return false;
  }
}

/**
 * 批量打包下载所有表情
 * @param emojis - 表情列表
 * @param zipFileName - ZIP 文件名（不含扩展名）
 * @returns 下载是否成功
 */
export async function downloadAllEmojis(
  emojis: ExtractedEmoji[],
  zipFileName: string = 'emoji_pack'
): Promise<boolean> {
  if (emojis.length === 0) {
    console.warn('没有可下载的表情');
    return false;
  }

  try {
    const zip = new JSZip();
    
    // 添加所有表情到 ZIP
    for (let i = 0; i < emojis.length; i++) {
      const emoji = emojis[i];
      const fileName = generateFileName(i + 1);
      zip.file(fileName, emoji.blob);
    }
    
    // 生成 ZIP 文件
    const zipBlob = await zip.generateAsync({
      type: 'blob',
      compression: 'DEFLATE',
      compressionOptions: { level: 6 },
    });
    
    // 触发下载
    triggerDownload(zipBlob, `${zipFileName}.zip`);
    
    return true;
  } catch (error) {
    console.error('批量下载失败:', error);
    return false;
  }
}

/**
 * 创建 ZIP 文件（不触发下载，用于测试）
 * @param emojis - 表情列表
 * @returns ZIP Blob
 */
export async function createZipBlob(emojis: ExtractedEmoji[]): Promise<Blob> {
  const zip = new JSZip();
  
  for (let i = 0; i < emojis.length; i++) {
    const emoji = emojis[i];
    const fileName = generateFileName(i + 1);
    zip.file(fileName, emoji.blob);
  }
  
  return zip.generateAsync({
    type: 'blob',
    compression: 'DEFLATE',
    compressionOptions: { level: 6 },
  });
}

/**
 * 从 ZIP 中提取文件列表（用于测试验证）
 * @param zipBlob - ZIP Blob
 * @returns 文件名列表
 */
export async function getZipFileList(zipBlob: Blob): Promise<string[]> {
  const zip = await JSZip.loadAsync(zipBlob);
  return Object.keys(zip.files);
}
