/**
 * 图片相关类型定义
 */

export type ImageType = 'material' | 'reference';

export interface UploadedImage {
  id: string;
  file: File;
  preview: string;  // base64 或 object URL
  type: ImageType;
}

export interface ImageUploadState {
  materialImages: UploadedImage[];  // 最多 21 张
  referenceImages: UploadedImage[]; // 最多 3 张
}

export interface BoundingBox {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface ExtractedEmoji {
  id: string;
  imageData: ImageData;
  blob: Blob;
  preview: string;
  boundingBox: BoundingBox;
}
