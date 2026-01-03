/**
 * Feature: manual-region-selection, Emoji Normalizer Property Tests
 * 
 * Property 11: Output Size Normalization
 * Property 12: Centering and Transparency
 * 
 * Validates: Requirements 6.1, 6.2, 6.3, 6.5
 */

import { describe, it, expect } from 'vitest';
import * as fc from 'fast-check';
import {
  calculateScaledSize,
  calculateCenterOffset,
  getContentBounds,
  validateNormalization,
} from './emojiNormalizer';

// Helper to create ImageData with specific dimensions and content
function createTestImageData(
  width: number,
  height: number,
  fillColor: { r: number; g: number; b: number; a: number } = { r: 255, g: 0, b: 0, a: 255 }
): ImageData {
  const data = new Uint8ClampedArray(width * height * 4);
  
  for (let i = 0; i < width * height; i++) {
    data[i * 4] = fillColor.r;
    data[i * 4 + 1] = fillColor.g;
    data[i * 4 + 2] = fillColor.b;
    data[i * 4 + 3] = fillColor.a;
  }
  
  return new ImageData(data, width, height);
}

// Helper to create ImageData with a centered rectangle of content
function createImageDataWithContent(
  canvasWidth: number,
  canvasHeight: number,
  contentWidth: number,
  contentHeight: number
): ImageData {
  const data = new Uint8ClampedArray(canvasWidth * canvasHeight * 4);
  
  // Calculate content position (centered)
  const startX = Math.floor((canvasWidth - contentWidth) / 2);
  const startY = Math.floor((canvasHeight - contentHeight) / 2);
  
  for (let y = 0; y < canvasHeight; y++) {
    for (let x = 0; x < canvasWidth; x++) {
      const i = (y * canvasWidth + x) * 4;
      
      // Check if pixel is within content area
      if (x >= startX && x < startX + contentWidth &&
          y >= startY && y < startY + contentHeight) {
        // Content pixel (red, opaque)
        data[i] = 255;
        data[i + 1] = 0;
        data[i + 2] = 0;
        data[i + 3] = 255;
      } else {
        // Transparent pixel
        data[i] = 0;
        data[i + 1] = 0;
        data[i + 2] = 0;
        data[i + 3] = 0;
      }
    }
  }
  
  return new ImageData(data, canvasWidth, canvasHeight);
}

// Arbitraries for generating test data
const imageDimensionsArb = fc.record({
  width: fc.integer({ min: 10, max: 500 }),
  height: fc.integer({ min: 10, max: 500 }),
});

const outputSizeArb = fc.integer({ min: 100, max: 500 });

describe('Emoji Normalizer Property Tests', () => {
  /**
   * Property 11: Output Size Normalization
   * 
   * For any extracted emoji from a selection region of any dimensions,
   * the output image SHALL be exactly 240×240 pixels (or specified output size),
   * with the original content scaled to fit while maintaining aspect ratio.
   * 
   * Validates: Requirements 6.1, 6.5
   */
  describe('Property 11: Output Size Normalization', () => {
    it('scaled size should fit within target size while maintaining aspect ratio', () => {
      fc.assert(
        fc.property(
          imageDimensionsArb,
          outputSizeArb,
          ({ width, height }, targetSize) => {
            const scaledSize = calculateScaledSize(width, height, targetSize);
            
            // Scaled size should fit within target
            expect(scaledSize.width).toBeLessThanOrEqual(targetSize);
            expect(scaledSize.height).toBeLessThanOrEqual(targetSize);
            
            // At least one dimension should equal target size
            const maxDimension = Math.max(scaledSize.width, scaledSize.height);
            expect(maxDimension).toBe(targetSize);
          }
        ),
        { numRuns: 100 }
      );
    });

    it('scaled size should maintain aspect ratio within rounding tolerance', () => {
      fc.assert(
        fc.property(
          // Use more reasonable aspect ratios (max 3:1)
          fc.integer({ min: 50, max: 300 }),
          fc.integer({ min: 50, max: 300 }),
          outputSizeArb,
          (width, height, targetSize) => {
            const scaledSize = calculateScaledSize(width, height, targetSize);
            
            // Aspect ratio should be preserved (within rounding tolerance)
            const originalRatio = width / height;
            const scaledRatio = scaledSize.width / scaledSize.height;
            
            // Allow for rounding errors
            // Math.round can introduce up to 0.5 pixel error on the smaller dimension
            // For ratio calculation, the error propagates as: error ≈ ratio * (1/minDim)
            const minScaledDim = Math.min(scaledSize.width, scaledSize.height);
            // Tolerance: account for rounding error on smaller dimension
            const tolerance = originalRatio / minScaledDim + 0.02;
            expect(Math.abs(originalRatio - scaledRatio)).toBeLessThan(tolerance);
          }
        ),
        { numRuns: 100 }
      );
    });

    it('small images should be scaled up proportionally', () => {
      fc.assert(
        fc.property(
          fc.integer({ min: 10, max: 100 }),
          fc.integer({ min: 10, max: 100 }),
          (width, height) => {
            const targetSize = 240;
            const scaledSize = calculateScaledSize(width, height, targetSize);
            
            // Scaled size should be larger than original
            expect(scaledSize.width).toBeGreaterThanOrEqual(width);
            expect(scaledSize.height).toBeGreaterThanOrEqual(height);
            
            // At least one dimension should equal target
            expect(Math.max(scaledSize.width, scaledSize.height)).toBe(targetSize);
          }
        ),
        { numRuns: 100 }
      );
    });

    it('large images should be scaled down proportionally', () => {
      fc.assert(
        fc.property(
          fc.integer({ min: 300, max: 1000 }),
          fc.integer({ min: 300, max: 1000 }),
          (width, height) => {
            const targetSize = 240;
            const scaledSize = calculateScaledSize(width, height, targetSize);
            
            // Scaled size should be smaller than original
            expect(scaledSize.width).toBeLessThanOrEqual(width);
            expect(scaledSize.height).toBeLessThanOrEqual(height);
            
            // At least one dimension should equal target
            expect(Math.max(scaledSize.width, scaledSize.height)).toBe(targetSize);
          }
        ),
        { numRuns: 100 }
      );
    });

    it('square images should scale to square output', () => {
      fc.assert(
        fc.property(
          fc.integer({ min: 10, max: 500 }),
          outputSizeArb,
          (size, targetSize) => {
            const scaledSize = calculateScaledSize(size, size, targetSize);
            
            // Square input should produce square output
            expect(scaledSize.width).toBe(targetSize);
            expect(scaledSize.height).toBe(targetSize);
          }
        ),
        { numRuns: 100 }
      );
    });

    it('validation should detect incorrect sizes', () => {
      fc.assert(
        fc.property(
          fc.integer({ min: 10, max: 200 }),
          fc.integer({ min: 10, max: 200 }),
          outputSizeArb,
          (width, height, expectedSize) => {
            // Create ImageData with wrong size
            const wrongSizeData = createTestImageData(width, height);
            
            // Validation should fail if size doesn't match expected
            const validation = validateNormalization(wrongSizeData, expectedSize);
            
            if (width !== expectedSize || height !== expectedSize) {
              expect(validation.valid).toBe(false);
              expect(validation.errors.length).toBeGreaterThan(0);
            }
          }
        ),
        { numRuns: 100 }
      );
    });
  });

  /**
   * Property 12: Centering and Transparency
   * 
   * For any extracted emoji where the scaled content does not fill the entire
   * 240×240 canvas, the content SHALL be centered, and all padding pixels
   * SHALL have alpha value of 0 (fully transparent).
   * 
   * Validates: Requirements 6.2, 6.3
   */
  describe('Property 12: Centering and Transparency', () => {
    it('center offset should position content in the middle', () => {
      fc.assert(
        fc.property(
          fc.integer({ min: 10, max: 200 }),
          fc.integer({ min: 10, max: 200 }),
          fc.integer({ min: 240, max: 500 }),
          (contentWidth, contentHeight, canvasSize) => {
            const offset = calculateCenterOffset(
              { width: contentWidth, height: contentHeight },
              canvasSize
            );
            
            // Content should be centered
            const expectedX = Math.floor((canvasSize - contentWidth) / 2);
            const expectedY = Math.floor((canvasSize - contentHeight) / 2);
            
            expect(offset.x).toBe(expectedX);
            expect(offset.y).toBe(expectedY);
          }
        ),
        { numRuns: 100 }
      );
    });

    it('center offset should be symmetric for square content', () => {
      fc.assert(
        fc.property(
          fc.integer({ min: 10, max: 200 }),
          fc.integer({ min: 240, max: 500 }),
          (contentSize, canvasSize) => {
            const offset = calculateCenterOffset(
              { width: contentSize, height: contentSize },
              canvasSize
            );
            
            // For square content, x and y offsets should be equal
            expect(offset.x).toBe(offset.y);
          }
        ),
        { numRuns: 100 }
      );
    });

    it('center offset should be zero when content fills canvas', () => {
      fc.assert(
        fc.property(
          fc.integer({ min: 100, max: 500 }),
          (size) => {
            const offset = calculateCenterOffset(
              { width: size, height: size },
              size
            );
            
            // When content fills canvas, offset should be zero
            expect(offset.x).toBe(0);
            expect(offset.y).toBe(0);
          }
        ),
        { numRuns: 100 }
      );
    });

    it('getContentBounds should return null for fully transparent images', () => {
      fc.assert(
        fc.property(
          fc.integer({ min: 10, max: 100 }),
          fc.integer({ min: 10, max: 100 }),
          (width, height) => {
            // Create fully transparent image
            const transparentData = createTestImageData(width, height, { r: 0, g: 0, b: 0, a: 0 });
            const bounds = getContentBounds(transparentData);
            
            expect(bounds).toBeNull();
          }
        ),
        { numRuns: 100 }
      );
    });

    it('getContentBounds should correctly identify content area', () => {
      fc.assert(
        fc.property(
          fc.integer({ min: 50, max: 150 }),
          fc.integer({ min: 50, max: 150 }),
          fc.integer({ min: 20, max: 40 }),
          fc.integer({ min: 20, max: 40 }),
          (canvasWidth, canvasHeight, contentWidth, contentHeight) => {
            // Ensure content fits in canvas
            const actualContentWidth = Math.min(contentWidth, canvasWidth - 10);
            const actualContentHeight = Math.min(contentHeight, canvasHeight - 10);
            
            const imageData = createImageDataWithContent(
              canvasWidth,
              canvasHeight,
              actualContentWidth,
              actualContentHeight
            );
            
            const bounds = getContentBounds(imageData);
            
            if (bounds) {
              // Bounds should match content dimensions
              expect(bounds.width).toBe(actualContentWidth);
              expect(bounds.height).toBe(actualContentHeight);
            }
          }
        ),
        { numRuns: 100 }
      );
    });

    it('getContentBounds should find content at correct position', () => {
      fc.assert(
        fc.property(
          fc.integer({ min: 60, max: 100 }),
          fc.integer({ min: 60, max: 100 }),
          fc.integer({ min: 20, max: 30 }),
          fc.integer({ min: 20, max: 30 }),
          (canvasWidth, canvasHeight, contentWidth, contentHeight) => {
            const imageData = createImageDataWithContent(
              canvasWidth,
              canvasHeight,
              contentWidth,
              contentHeight
            );
            
            const bounds = getContentBounds(imageData);
            
            if (bounds) {
              // Content should be centered
              const expectedX = Math.floor((canvasWidth - contentWidth) / 2);
              const expectedY = Math.floor((canvasHeight - contentHeight) / 2);
              
              expect(bounds.x).toBe(expectedX);
              expect(bounds.y).toBe(expectedY);
            }
          }
        ),
        { numRuns: 100 }
      );
    });
  });
});
