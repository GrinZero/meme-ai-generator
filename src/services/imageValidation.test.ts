/**
 * Feature: emoji-pack-generator, Property 4: Image Upload Limits
 * Validates: Requirements 3.1, 3.2, 3.3
 * 
 * For any number N of material images where N <= 21, upload should succeed and the image count should equal N.
 * For any number M of material images where M > 21, only the first 21 should be accepted.
 * The same applies to reference images with limit 3.
 */

import { describe, it, expect } from 'vitest';
import * as fc from 'fast-check';
import {
  calculateUploadableCount,
  validateUploadFiles,
  isValidImageFormat,
  MATERIAL_IMAGE_LIMIT,
  REFERENCE_IMAGE_LIMIT,
} from './imageValidation';

// Helper to create a mock File with a specific type
function createMockFile(name: string, type: string): File {
  const blob = new Blob([''], { type });
  return new File([blob], name, { type });
}

// Arbitrary for valid image files
const validImageFileArb = fc.constantFrom(
  createMockFile('test.png', 'image/png'),
  createMockFile('test.jpg', 'image/jpeg'),
  createMockFile('test.jpeg', 'image/jpeg'),
  createMockFile('test.webp', 'image/webp')
);

describe('Image Upload Limits', () => {
  /**
   * Property 4: Image Upload Limits
   * For any number N of material images where N <= 21, upload should succeed and the image count should equal N.
   * For any number M of material images where M > 21, only the first 21 should be accepted.
   */
  describe('Property 4: Image Upload Limits', () => {
    // Property: For material images, when uploading N <= 21 images with 0 existing, all N should be accepted
    it('should accept all material images when count is within limit', () => {
      fc.assert(
        fc.property(
          fc.integer({ min: 0, max: MATERIAL_IMAGE_LIMIT }),
          (uploadCount) => {
            const uploadable = calculateUploadableCount(0, MATERIAL_IMAGE_LIMIT, uploadCount);
            expect(uploadable).toBe(uploadCount);
          }
        ),
        { numRuns: 100 }
      );
    });

    // Property: For material images, when uploading M > 21 images with 0 existing, only 21 should be accepted
    it('should limit material images to maximum when exceeding limit', () => {
      fc.assert(
        fc.property(
          fc.integer({ min: MATERIAL_IMAGE_LIMIT + 1, max: 100 }),
          (uploadCount) => {
            const uploadable = calculateUploadableCount(0, MATERIAL_IMAGE_LIMIT, uploadCount);
            expect(uploadable).toBe(MATERIAL_IMAGE_LIMIT);
          }
        ),
        { numRuns: 100 }
      );
    });

    // Property: For reference images, when uploading N <= 3 images with 0 existing, all N should be accepted
    it('should accept all reference images when count is within limit', () => {
      fc.assert(
        fc.property(
          fc.integer({ min: 0, max: REFERENCE_IMAGE_LIMIT }),
          (uploadCount) => {
            const uploadable = calculateUploadableCount(0, REFERENCE_IMAGE_LIMIT, uploadCount);
            expect(uploadable).toBe(uploadCount);
          }
        ),
        { numRuns: 100 }
      );
    });

    // Property: For reference images, when uploading M > 3 images with 0 existing, only 3 should be accepted
    it('should limit reference images to maximum when exceeding limit', () => {
      fc.assert(
        fc.property(
          fc.integer({ min: REFERENCE_IMAGE_LIMIT + 1, max: 50 }),
          (uploadCount) => {
            const uploadable = calculateUploadableCount(0, REFERENCE_IMAGE_LIMIT, uploadCount);
            expect(uploadable).toBe(REFERENCE_IMAGE_LIMIT);
          }
        ),
        { numRuns: 100 }
      );
    });

    // Property: When current count + new files exceeds limit, only remaining slots should be filled
    it('should only fill remaining slots when partially full', () => {
      fc.assert(
        fc.property(
          fc.integer({ min: 0, max: MATERIAL_IMAGE_LIMIT }),
          fc.integer({ min: 1, max: 50 }),
          (currentCount, newFilesCount) => {
            const uploadable = calculateUploadableCount(currentCount, MATERIAL_IMAGE_LIMIT, newFilesCount);
            const remainingSlots = MATERIAL_IMAGE_LIMIT - currentCount;
            
            if (remainingSlots <= 0) {
              expect(uploadable).toBe(0);
            } else {
              expect(uploadable).toBe(Math.min(remainingSlots, newFilesCount));
            }
          }
        ),
        { numRuns: 100 }
      );
    });

    // Property: When at maximum capacity, no new files should be accepted
    it('should accept no files when at maximum capacity', () => {
      fc.assert(
        fc.property(
          fc.integer({ min: 1, max: 100 }),
          (newFilesCount) => {
            const uploadableMaterial = calculateUploadableCount(MATERIAL_IMAGE_LIMIT, MATERIAL_IMAGE_LIMIT, newFilesCount);
            const uploadableReference = calculateUploadableCount(REFERENCE_IMAGE_LIMIT, REFERENCE_IMAGE_LIMIT, newFilesCount);
            
            expect(uploadableMaterial).toBe(0);
            expect(uploadableReference).toBe(0);
          }
        ),
        { numRuns: 100 }
      );
    });

    // Property: validateUploadFiles should return correct validFiles count
    it('should return correct number of valid files in validation result', () => {
      fc.assert(
        fc.property(
          fc.array(validImageFileArb, { minLength: 0, maxLength: 30 }),
          fc.integer({ min: 0, max: MATERIAL_IMAGE_LIMIT }),
          (files, currentCount) => {
            const result = validateUploadFiles(files, currentCount, MATERIAL_IMAGE_LIMIT);
            const remainingSlots = Math.max(0, MATERIAL_IMAGE_LIMIT - currentCount);
            const expectedCount = Math.min(files.length, remainingSlots);
            
            expect(result.validFiles.length).toBe(expectedCount);
          }
        ),
        { numRuns: 100 }
      );
    });

    // Property: Total accepted files should never exceed the limit
    it('should never exceed the maximum limit after upload', () => {
      fc.assert(
        fc.property(
          fc.integer({ min: 0, max: MATERIAL_IMAGE_LIMIT }),
          fc.integer({ min: 0, max: 100 }),
          (currentCount, newFilesCount) => {
            const uploadable = calculateUploadableCount(currentCount, MATERIAL_IMAGE_LIMIT, newFilesCount);
            const totalAfterUpload = currentCount + uploadable;
            
            expect(totalAfterUpload).toBeLessThanOrEqual(MATERIAL_IMAGE_LIMIT);
          }
        ),
        { numRuns: 100 }
      );
    });
  });
});


/**
 * Feature: emoji-pack-generator, Property 6: Supported Image Formats
 * Validates: Requirements 3.6
 * 
 * For any file with extension in {png, jpg, jpeg, webp} (case-insensitive), the Image_Uploader should accept the file.
 * For any file with extension not in this set, the uploader should reject it.
 */
describe('Supported Image Formats', () => {
  /**
   * Property 6: Supported Image Formats
   * For any file with extension in {png, jpg, jpeg, webp} (case-insensitive), the Image_Uploader should accept the file.
   * For any file with extension not in this set, the uploader should reject it.
   */
  describe('Property 6: Supported Image Formats', () => {
    // Property: Files with valid MIME types should be accepted
    it('should accept files with valid image MIME types', () => {
      fc.assert(
        fc.property(
          fc.constantFrom('image/png', 'image/jpeg', 'image/jpg', 'image/webp'),
          fc.string({ minLength: 1, maxLength: 20 }).filter(s => !s.includes('.')),
          (mimeType, baseName) => {
            const file = createMockFile(`${baseName}.test`, mimeType);
            expect(isValidImageFormat(file)).toBe(true);
          }
        ),
        { numRuns: 100 }
      );
    });

    // Property: Files with valid extensions should be accepted (case-insensitive)
    it('should accept files with valid extensions regardless of case', () => {
      fc.assert(
        fc.property(
          fc.constantFrom('.png', '.jpg', '.jpeg', '.webp', '.PNG', '.JPG', '.JPEG', '.WEBP', '.Png', '.Jpg'),
          fc.string({ minLength: 1, maxLength: 20 }).filter(s => !s.includes('.')),
          (extension, baseName) => {
            // Create file with valid extension but generic MIME type
            const file = createMockFile(`${baseName}${extension}`, 'application/octet-stream');
            expect(isValidImageFormat(file)).toBe(true);
          }
        ),
        { numRuns: 100 }
      );
    });

    // Property: Files with invalid MIME types and invalid extensions should be rejected
    it('should reject files with invalid MIME types and extensions', () => {
      fc.assert(
        fc.property(
          fc.constantFrom(
            'application/pdf',
            'text/plain',
            'image/gif',
            'image/bmp',
            'image/tiff',
            'video/mp4',
            'audio/mp3'
          ),
          fc.constantFrom('.pdf', '.txt', '.gif', '.bmp', '.tiff', '.mp4', '.doc', '.exe'),
          fc.string({ minLength: 1, maxLength: 20 }).filter(s => !s.includes('.')),
          (mimeType, extension, baseName) => {
            const file = createMockFile(`${baseName}${extension}`, mimeType);
            expect(isValidImageFormat(file)).toBe(false);
          }
        ),
        { numRuns: 100 }
      );
    });

    // Property: validateUploadFiles should filter out invalid format files
    it('should filter out invalid format files in validation', () => {
      fc.assert(
        fc.property(
          fc.array(
            fc.oneof(
              validImageFileArb,
              fc.constant(createMockFile('invalid.pdf', 'application/pdf')),
              fc.constant(createMockFile('invalid.gif', 'image/gif'))
            ),
            { minLength: 1, maxLength: 20 }
          ),
          (files) => {
            const result = validateUploadFiles(files, 0, MATERIAL_IMAGE_LIMIT);
            
            // All valid files should be accepted (up to limit)
            const validCount = files.filter(f => isValidImageFormat(f)).length;
            const expectedCount = Math.min(validCount, MATERIAL_IMAGE_LIMIT);
            
            expect(result.validFiles.length).toBe(expectedCount);
            
            // All returned files should be valid format
            result.validFiles.forEach(file => {
              expect(isValidImageFormat(file)).toBe(true);
            });
          }
        ),
        { numRuns: 100 }
      );
    });

    // Property: Invalid format count should be correctly reported
    it('should correctly report invalid format count', () => {
      fc.assert(
        fc.property(
          fc.array(validImageFileArb, { minLength: 0, maxLength: 10 }),
          fc.array(
            fc.constant(createMockFile('invalid.pdf', 'application/pdf')),
            { minLength: 0, maxLength: 10 }
          ),
          (validFiles, invalidFiles) => {
            const allFiles = [...validFiles, ...invalidFiles];
            const result = validateUploadFiles(allFiles, 0, MATERIAL_IMAGE_LIMIT);
            
            expect(result.invalidFormatCount).toBe(invalidFiles.length);
          }
        ),
        { numRuns: 100 }
      );
    });

    // Property: PNG files should always be accepted
    it('should always accept PNG files', () => {
      fc.assert(
        fc.property(
          fc.string({ minLength: 1, maxLength: 50 }).filter(s => !s.includes('.')),
          (baseName) => {
            const pngFile = createMockFile(`${baseName}.png`, 'image/png');
            expect(isValidImageFormat(pngFile)).toBe(true);
          }
        ),
        { numRuns: 100 }
      );
    });

    // Property: JPG/JPEG files should always be accepted
    it('should always accept JPG/JPEG files', () => {
      fc.assert(
        fc.property(
          fc.string({ minLength: 1, maxLength: 50 }).filter(s => !s.includes('.')),
          fc.constantFrom('.jpg', '.jpeg', '.JPG', '.JPEG'),
          (baseName, ext) => {
            const jpgFile = createMockFile(`${baseName}${ext}`, 'image/jpeg');
            expect(isValidImageFormat(jpgFile)).toBe(true);
          }
        ),
        { numRuns: 100 }
      );
    });

    // Property: WebP files should always be accepted
    it('should always accept WebP files', () => {
      fc.assert(
        fc.property(
          fc.string({ minLength: 1, maxLength: 50 }).filter(s => !s.includes('.')),
          (baseName) => {
            const webpFile = createMockFile(`${baseName}.webp`, 'image/webp');
            expect(isValidImageFormat(webpFile)).toBe(true);
          }
        ),
        { numRuns: 100 }
      );
    });
  });
});
