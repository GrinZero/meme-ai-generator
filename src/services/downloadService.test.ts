/**
 * Download Service Tests
 * Feature: emoji-pack-generator, Property 10: Download Output Format
 * Validates: Requirements 8.1, 8.2, 8.3
 */

import { describe, it, expect } from 'vitest';
import * as fc from 'fast-check';
import {
  generateFileName,
  isValidPNG,
  createZipBlob,
  getZipFileList,
} from './downloadService';
import type { ExtractedEmoji, BoundingBox } from '../types/image';

/**
 * Helper: Create a minimal valid PNG blob
 * PNG files have a specific header signature
 */
function createMinimalPNGBlob(): Blob {
  // Minimal valid PNG: 1x1 transparent pixel
  const pngData = new Uint8Array([
    0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A, // PNG signature
    0x00, 0x00, 0x00, 0x0D, // IHDR chunk length
    0x49, 0x48, 0x44, 0x52, // IHDR
    0x00, 0x00, 0x00, 0x01, // width: 1
    0x00, 0x00, 0x00, 0x01, // height: 1
    0x08, 0x06, // bit depth: 8, color type: RGBA
    0x00, 0x00, 0x00, // compression, filter, interlace
    0x1F, 0x15, 0xC4, 0x89, // CRC
    0x00, 0x00, 0x00, 0x0A, // IDAT chunk length
    0x49, 0x44, 0x41, 0x54, // IDAT
    0x78, 0x9C, 0x63, 0x00, 0x01, 0x00, 0x00, 0x05, 0x00, 0x01, // compressed data
    0x0D, 0x0A, 0x2D, 0xB4, // CRC
    0x00, 0x00, 0x00, 0x00, // IEND chunk length
    0x49, 0x45, 0x4E, 0x44, // IEND
    0xAE, 0x42, 0x60, 0x82, // CRC
  ]);
  return new Blob([pngData], { type: 'image/png' });
}

/**
 * Helper: Create a mock ExtractedEmoji
 */
function createMockEmoji(id: string): ExtractedEmoji {
  const boundingBox: BoundingBox = {
    x: 0,
    y: 0,
    width: 10,
    height: 10,
  };
  
  return {
    id,
    blob: createMinimalPNGBlob(),
    preview: 'data:image/png;base64,test',
    boundingBox,
  };
}

describe('downloadService', () => {
  describe('generateFileName', () => {
    it('should generate correct file name with default prefix', () => {
      expect(generateFileName(1)).toBe('emoji_001.png');
      expect(generateFileName(10)).toBe('emoji_010.png');
      expect(generateFileName(100)).toBe('emoji_100.png');
    });

    it('should generate correct file name with custom prefix', () => {
      expect(generateFileName(1, 'sticker')).toBe('sticker_001.png');
      expect(generateFileName(42, 'meme')).toBe('meme_042.png');
    });
  });

  describe('isValidPNG', () => {
    it('should return true for valid PNG blob', async () => {
      const pngBlob = createMinimalPNGBlob();
      const result = await isValidPNG(pngBlob);
      expect(result).toBe(true);
    });

    it('should return false for non-PNG blob', async () => {
      const textBlob = new Blob(['hello world'], { type: 'text/plain' });
      const result = await isValidPNG(textBlob);
      expect(result).toBe(false);
    });

    it('should return false for empty blob', async () => {
      const emptyBlob = new Blob([], { type: 'image/png' });
      const result = await isValidPNG(emptyBlob);
      expect(result).toBe(false);
    });

    it('should return false for blob smaller than PNG header', async () => {
      const smallBlob = new Blob([new Uint8Array([0x89, 0x50, 0x4E])], { type: 'image/png' });
      const result = await isValidPNG(smallBlob);
      expect(result).toBe(false);
    });
  });

  /**
   * Property 10: Download Output Format
   * For any downloaded emoji, the file should be in PNG format with alpha channel support.
   * For any batch download, the ZIP archive should contain exactly the same number of files as extracted emojis.
   */
  describe('Property 10: Download Output Format', () => {
    // Property: All emoji blobs should be valid PNG format
    it('should ensure all emoji blobs are valid PNG format', async () => {
      await fc.assert(
        fc.asyncProperty(
          // Generate 1-10 emojis
          fc.integer({ min: 1, max: 10 }),
          async (emojiCount) => {
            const emojis: ExtractedEmoji[] = [];
            for (let i = 0; i < emojiCount; i++) {
              emojis.push(createMockEmoji(`emoji-${i}`));
            }
            
            // Verify each emoji blob is a valid PNG
            for (const emoji of emojis) {
              const isValid = await isValidPNG(emoji.blob);
              expect(isValid).toBe(true);
            }
          }
        ),
        { numRuns: 100 }
      );
    });

    // Property: ZIP archive should contain exactly N files for N emojis
    it('should create ZIP with exactly N files for N emojis', async () => {
      await fc.assert(
        fc.asyncProperty(
          // Generate 1-10 emojis (reduced for performance)
          fc.integer({ min: 1, max: 10 }),
          async (emojiCount) => {
            const emojis: ExtractedEmoji[] = [];
            for (let i = 0; i < emojiCount; i++) {
              emojis.push(createMockEmoji(`emoji-${i}`));
            }
            
            // Create ZIP (skip standardization for faster tests)
            const zipBlob = await createZipBlob(emojis, { standardize: false });
            
            // Get file list from ZIP
            const fileList = await getZipFileList(zipBlob);
            
            // ZIP should contain exactly the same number of files as emojis
            expect(fileList.length).toBe(emojiCount);
          }
        ),
        { numRuns: 20 } // Reduced iterations for ZIP operations (slow)
      );
    }, 30000); // 30 second timeout for ZIP operations

    // Property: All files in ZIP should have .png extension
    it('should ensure all files in ZIP have .png extension', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.integer({ min: 1, max: 10 }),
          async (emojiCount) => {
            const emojis: ExtractedEmoji[] = [];
            for (let i = 0; i < emojiCount; i++) {
              emojis.push(createMockEmoji(`emoji-${i}`));
            }
            
            // Skip standardization for faster tests
            const zipBlob = await createZipBlob(emojis, { standardize: false });
            const fileList = await getZipFileList(zipBlob);
            
            // All files should have .png extension
            for (const fileName of fileList) {
              expect(fileName.endsWith('.png')).toBe(true);
            }
          }
        ),
        { numRuns: 20 } // Reduced iterations for ZIP operations (slow)
      );
    }, 30000); // 30 second timeout for ZIP operations

    // Property: File names should be unique and properly formatted
    it('should generate unique and properly formatted file names', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.integer({ min: 1, max: 10 }),
          async (emojiCount) => {
            const emojis: ExtractedEmoji[] = [];
            for (let i = 0; i < emojiCount; i++) {
              emojis.push(createMockEmoji(`emoji-${i}`));
            }
            
            // Skip standardization for faster tests
            const zipBlob = await createZipBlob(emojis, { standardize: false });
            const fileList = await getZipFileList(zipBlob);
            
            // All file names should be unique
            const uniqueNames = new Set(fileList);
            expect(uniqueNames.size).toBe(fileList.length);
            
            // All file names should match expected pattern
            const pattern = /^emoji_\d{3}\.png$/;
            for (const fileName of fileList) {
              expect(pattern.test(fileName)).toBe(true);
            }
          }
        ),
        { numRuns: 20 } // Reduced iterations for ZIP operations (slow)
      );
    }, 30000); // 30 second timeout for ZIP operations

    // Property: Empty emoji list should create empty ZIP
    it('should create empty ZIP for empty emoji list', async () => {
      const emojis: ExtractedEmoji[] = [];
      const zipBlob = await createZipBlob(emojis);
      const fileList = await getZipFileList(zipBlob);
      
      expect(fileList.length).toBe(0);
    });
  });
});
