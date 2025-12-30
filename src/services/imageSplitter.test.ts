/**
 * Image Splitter Service Tests
 * Feature: emoji-pack-generator, Property 8: Emoji Detection on Solid Background
 * Feature: emoji-pack-generator, Property 9: Background Removal Transparency
 * Validates: Requirements 6.1, 6.2, 6.3
 */

import { describe, it, expect } from 'vitest';
import * as fc from 'fast-check';
import {
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
  type RGBAColor,
} from './imageSplitter';

/**
 * Helper: Create a mock ImageData with a solid background and colored regions
 */
function createTestImageData(
  width: number,
  height: number,
  backgroundColor: RGBAColor,
  regions: Array<{ x: number; y: number; w: number; h: number; color: RGBAColor }>
): ImageData {
  const data = new Uint8ClampedArray(width * height * 4);
  
  // Fill with background color
  for (let i = 0; i < width * height; i++) {
    data[i * 4] = backgroundColor.r;
    data[i * 4 + 1] = backgroundColor.g;
    data[i * 4 + 2] = backgroundColor.b;
    data[i * 4 + 3] = backgroundColor.a;
  }
  
  // Draw regions
  for (const region of regions) {
    for (let y = region.y; y < region.y + region.h && y < height; y++) {
      for (let x = region.x; x < region.x + region.w && x < width; x++) {
        if (x >= 0 && x < width && y >= 0 && y < height) {
          const index = (y * width + x) * 4;
          data[index] = region.color.r;
          data[index + 1] = region.color.g;
          data[index + 2] = region.color.b;
          data[index + 3] = region.color.a;
        }
      }
    }
  }
  
  return { data, width, height, colorSpace: 'srgb' } as ImageData;
}

describe('imageSplitter', () => {
  describe('getPixelColor', () => {
    it('should return correct pixel color', () => {
      const imageData = createTestImageData(10, 10, { r: 255, g: 255, b: 255, a: 255 }, []);
      const color = getPixelColor(imageData, 0, 0);
      expect(color).toEqual({ r: 255, g: 255, b: 255, a: 255 });
    });
  });

  describe('colorDistance', () => {
    it('should return 0 for identical colors', () => {
      const c1: RGBAColor = { r: 100, g: 150, b: 200, a: 255 };
      expect(colorDistance(c1, c1)).toBe(0);
    });

    it('should calculate correct distance', () => {
      const c1: RGBAColor = { r: 0, g: 0, b: 0, a: 255 };
      const c2: RGBAColor = { r: 255, g: 255, b: 255, a: 255 };
      // sqrt(255^2 + 255^2 + 255^2) ≈ 441.67
      expect(colorDistance(c1, c2)).toBeCloseTo(441.67, 1);
    });
  });

  describe('colorsAreSimilar', () => {
    it('should return true for identical colors', () => {
      const c1: RGBAColor = { r: 100, g: 150, b: 200, a: 255 };
      expect(colorsAreSimilar(c1, c1, 0)).toBe(true);
    });

    it('should return true for colors within tolerance', () => {
      const c1: RGBAColor = { r: 100, g: 100, b: 100, a: 255 };
      const c2: RGBAColor = { r: 110, g: 100, b: 100, a: 255 };
      expect(colorsAreSimilar(c1, c2, 15)).toBe(true);
    });

    it('should return false for colors outside tolerance', () => {
      const c1: RGBAColor = { r: 0, g: 0, b: 0, a: 255 };
      const c2: RGBAColor = { r: 255, g: 255, b: 255, a: 255 };
      expect(colorsAreSimilar(c1, c2, 30)).toBe(false);
    });
  });

  describe('detectBackgroundColor', () => {
    it('should detect white background', () => {
      const imageData = createTestImageData(100, 100, { r: 255, g: 255, b: 255, a: 255 }, [
        { x: 30, y: 30, w: 20, h: 20, color: { r: 255, g: 0, b: 0, a: 255 } },
      ]);
      const bgColor = detectBackgroundColor(imageData);
      expect(bgColor.r).toBe(255);
      expect(bgColor.g).toBe(255);
      expect(bgColor.b).toBe(255);
    });

    it('should detect colored background', () => {
      const imageData = createTestImageData(100, 100, { r: 200, g: 200, b: 200, a: 255 }, [
        { x: 30, y: 30, w: 20, h: 20, color: { r: 255, g: 0, b: 0, a: 255 } },
      ]);
      const bgColor = detectBackgroundColor(imageData);
      expect(bgColor.r).toBe(200);
      expect(bgColor.g).toBe(200);
      expect(bgColor.b).toBe(200);
    });
  });

  describe('createBinaryMask', () => {
    it('should create correct mask for simple image', () => {
      const imageData = createTestImageData(10, 10, { r: 255, g: 255, b: 255, a: 255 }, [
        { x: 3, y: 3, w: 4, h: 4, color: { r: 0, g: 0, b: 0, a: 255 } },
      ]);
      const mask = createBinaryMask(imageData, { r: 255, g: 255, b: 255, a: 255 }, 30);
      
      // Background pixels should be false
      expect(mask[0][0]).toBe(false);
      // Region pixels should be true
      expect(mask[3][3]).toBe(true);
      expect(mask[5][5]).toBe(true);
    });
  });

  describe('labelConnectedRegions', () => {
    it('should label single region correctly', () => {
      const mask = [
        [false, false, false, false, false],
        [false, true, true, false, false],
        [false, true, true, false, false],
        [false, false, false, false, false],
      ];
      const { labels, regionCount } = labelConnectedRegions(mask);
      expect(regionCount).toBe(1);
      expect(labels[1][1]).toBe(1);
      expect(labels[1][2]).toBe(1);
      expect(labels[2][1]).toBe(1);
      expect(labels[2][2]).toBe(1);
    });

    it('should label multiple separate regions', () => {
      const mask = [
        [true, true, false, true, true],
        [true, true, false, true, true],
        [false, false, false, false, false],
        [true, true, false, true, true],
        [true, true, false, true, true],
      ];
      const { regionCount } = labelConnectedRegions(mask);
      expect(regionCount).toBe(4);
    });
  });

  describe('extractBoundingBoxes', () => {
    it('should extract correct bounding boxes', () => {
      const labels = [
        [0, 0, 0, 0, 0],
        [0, 1, 1, 0, 0],
        [0, 1, 1, 0, 0],
        [0, 0, 0, 0, 0],
      ];
      const boxes = extractBoundingBoxes(labels, 1, { minArea: 1, minSize: 1 });
      expect(boxes.length).toBe(1);
      expect(boxes[0]).toEqual({ x: 1, y: 1, width: 2, height: 2 });
    });

    it('should filter small regions', () => {
      const labels = [
        [0, 0, 0, 0, 0],
        [0, 1, 0, 0, 0],
        [0, 0, 0, 0, 0],
        [0, 0, 0, 0, 0],
      ];
      const boxes = extractBoundingBoxes(labels, 1, { minArea: 10, minSize: 5 });
      expect(boxes.length).toBe(0);
    });
  });

  describe('detectEmojis', () => {
    it('should detect single emoji region', () => {
      const imageData = createTestImageData(100, 100, { r: 255, g: 255, b: 255, a: 255 }, [
        { x: 20, y: 20, w: 30, h: 30, color: { r: 255, g: 0, b: 0, a: 255 } },
      ]);
      const boxes = detectEmojis(imageData, { minArea: 100, minSize: 10 });
      expect(boxes.length).toBe(1);
      expect(boxes[0].x).toBe(20);
      expect(boxes[0].y).toBe(20);
      expect(boxes[0].width).toBe(30);
      expect(boxes[0].height).toBe(30);
    });

    it('should detect multiple emoji regions', () => {
      const imageData = createTestImageData(200, 100, { r: 255, g: 255, b: 255, a: 255 }, [
        { x: 10, y: 10, w: 30, h: 30, color: { r: 255, g: 0, b: 0, a: 255 } },
        { x: 100, y: 10, w: 30, h: 30, color: { r: 0, g: 255, b: 0, a: 255 } },
      ]);
      const boxes = detectEmojis(imageData, { minArea: 100, minSize: 10 });
      expect(boxes.length).toBe(2);
    });
  });

  describe('cropImage', () => {
    it('should crop image correctly', () => {
      const imageData = createTestImageData(100, 100, { r: 255, g: 255, b: 255, a: 255 }, [
        { x: 20, y: 20, w: 30, h: 30, color: { r: 0, g: 0, b: 0, a: 255 } },
      ]);
      
      const cropped = cropImage(imageData, { x: 20, y: 20, width: 30, height: 30 }, 0);
      
      expect(cropped.width).toBe(30);
      expect(cropped.height).toBe(30);
      
      // Check that the cropped region contains the foreground color
      const centerIndex = (15 * 30 + 15) * 4;
      expect(cropped.data[centerIndex]).toBe(0); // r
      expect(cropped.data[centerIndex + 1]).toBe(0); // g
      expect(cropped.data[centerIndex + 2]).toBe(0); // b
    });

    it('should add padding when cropping', () => {
      const imageData = createTestImageData(100, 100, { r: 255, g: 255, b: 255, a: 255 }, []);
      
      const cropped = cropImage(imageData, { x: 20, y: 20, width: 30, height: 30 }, 5);
      
      expect(cropped.width).toBe(40); // 30 + 5*2
      expect(cropped.height).toBe(40);
    });
  });

  /**
   * Property 8: Emoji Detection on Solid Background
   * For any image containing N distinct non-background colored regions on a solid color background
   * (where regions are separated by background color), the Image_Splitter should detect exactly N bounding boxes.
   */
  describe('Property 8: Emoji Detection on Solid Background', () => {
    // Helper to generate non-overlapping regions
    function generateNonOverlappingRegions(
      imageWidth: number,
      imageHeight: number,
      count: number,
      foregroundColor: RGBAColor
    ): Array<{ x: number; y: number; w: number; h: number; color: RGBAColor }> {
      const regionSize = 20;
      const gap = 10;
      const cellSize = regionSize + gap;
      const cols = Math.floor((imageWidth - gap) / cellSize);
      const rows = Math.floor((imageHeight - gap) / cellSize);
      const maxPossible = cols * rows;
      const actualCount = Math.min(count, maxPossible);

      const regions: Array<{ x: number; y: number; w: number; h: number; color: RGBAColor }> = [];
      const positions: Array<{ col: number; row: number }> = [];
      
      // Generate all possible positions
      for (let row = 0; row < rows; row++) {
        for (let col = 0; col < cols; col++) {
          positions.push({ col, row });
        }
      }
      
      // Take first 'actualCount' positions (deterministic for reproducibility)
      const selectedPositions = positions.slice(0, actualCount);
      
      for (const pos of selectedPositions) {
        regions.push({
          x: gap + pos.col * cellSize,
          y: gap + pos.row * cellSize,
          w: regionSize,
          h: regionSize,
          color: foregroundColor,
        });
      }
      
      return regions;
    }

    // Property: Should detect exactly N regions for N distinct non-overlapping colored areas
    it('should detect exactly N regions for N distinct non-overlapping colored areas', () => {
      fc.assert(
        fc.property(
          // Background color (light colors)
          fc.record({
            r: fc.integer({ min: 200, max: 255 }),
            g: fc.integer({ min: 200, max: 255 }),
            b: fc.integer({ min: 200, max: 255 }),
            a: fc.constant(255),
          }),
          // Foreground color (dark colors, distinct from background)
          fc.record({
            r: fc.integer({ min: 0, max: 100 }),
            g: fc.integer({ min: 0, max: 100 }),
            b: fc.integer({ min: 0, max: 100 }),
            a: fc.constant(255),
          }),
          // Image dimensions
          fc.integer({ min: 100, max: 300 }),
          fc.integer({ min: 100, max: 300 }),
          // Number of regions
          fc.integer({ min: 1, max: 9 }),
          (backgroundColor, foregroundColor, width, height, regionCount) => {
            const regions = generateNonOverlappingRegions(width, height, regionCount, foregroundColor);
            const imageData = createTestImageData(width, height, backgroundColor, regions);
            const detectedBoxes = detectEmojis(imageData, { 
              tolerance: 50,
              minArea: 100,
              minSize: 10,
            });
            
            // The number of detected boxes should equal the number of regions
            expect(detectedBoxes.length).toBe(regions.length);
          }
        ),
        { numRuns: 100 }
      );
    });

    // Property: Should detect zero regions for image with only background color
    it('should detect zero regions for image with only background color', () => {
      fc.assert(
        fc.property(
          fc.record({
            r: fc.integer({ min: 200, max: 255 }),
            g: fc.integer({ min: 200, max: 255 }),
            b: fc.integer({ min: 200, max: 255 }),
            a: fc.constant(255),
          }),
          fc.integer({ min: 100, max: 200 }),
          fc.integer({ min: 100, max: 200 }),
          (backgroundColor, width, height) => {
            const imageData = createTestImageData(width, height, backgroundColor, []);
            const detectedBoxes = detectEmojis(imageData, { 
              tolerance: 30,
              minArea: 100,
              minSize: 10,
            });
            
            expect(detectedBoxes.length).toBe(0);
          }
        ),
        { numRuns: 100 }
      );
    });
  });

  /**
   * Property 9: Background Removal Transparency
   * For any extracted emoji image, pixels that were part of the solid background color
   * should have alpha value of 0 (fully transparent) in the output.
   */
  describe('Property 9: Background Removal Transparency', () => {
    // Property: Background pixels should become transparent after simple removal
    it('should make background pixels transparent after simple removal', () => {
      fc.assert(
        fc.property(
          // Background color (light colors)
          fc.record({
            r: fc.integer({ min: 200, max: 255 }),
            g: fc.integer({ min: 200, max: 255 }),
            b: fc.integer({ min: 200, max: 255 }),
            a: fc.constant(255),
          }),
          // Foreground color (dark colors, distinct from background)
          fc.record({
            r: fc.integer({ min: 0, max: 100 }),
            g: fc.integer({ min: 0, max: 100 }),
            b: fc.integer({ min: 0, max: 100 }),
            a: fc.constant(255),
          }),
          // Image dimensions
          fc.integer({ min: 50, max: 100 }),
          fc.integer({ min: 50, max: 100 }),
          (backgroundColor, foregroundColor, width, height) => {
            // Create image with a centered foreground region
            const regionSize = Math.floor(Math.min(width, height) / 2);
            const regionX = Math.floor((width - regionSize) / 2);
            const regionY = Math.floor((height - regionSize) / 2);
            
            const imageData = createTestImageData(width, height, backgroundColor, [
              { x: regionX, y: regionY, w: regionSize, h: regionSize, color: foregroundColor },
            ]);
            
            // Apply simple background removal
            const result = removeBackgroundSimple(imageData, backgroundColor, 50);
            
            // Check that background pixels are transparent
            let backgroundPixelsTransparent = true;
            let foregroundPixelsOpaque = true;
            
            for (let y = 0; y < height; y++) {
              for (let x = 0; x < width; x++) {
                const index = (y * width + x) * 4;
                const originalColor: RGBAColor = {
                  r: imageData.data[index],
                  g: imageData.data[index + 1],
                  b: imageData.data[index + 2],
                  a: imageData.data[index + 3],
                };
                const resultAlpha = result.data[index + 3];
                
                const isBackground = colorsAreSimilar(originalColor, backgroundColor, 50);
                
                if (isBackground && resultAlpha !== 0) {
                  backgroundPixelsTransparent = false;
                }
                if (!isBackground && resultAlpha === 0) {
                  foregroundPixelsOpaque = false;
                }
              }
            }
            
            expect(backgroundPixelsTransparent).toBe(true);
            expect(foregroundPixelsOpaque).toBe(true);
          }
        ),
        { numRuns: 100 }
      );
    });

    // Property: Foreground pixels should remain opaque after background removal
    it('should keep foreground pixels opaque after background removal', () => {
      fc.assert(
        fc.property(
          // Background color
          fc.record({
            r: fc.integer({ min: 220, max: 255 }),
            g: fc.integer({ min: 220, max: 255 }),
            b: fc.integer({ min: 220, max: 255 }),
            a: fc.constant(255),
          }),
          // Foreground color (very different from background)
          fc.record({
            r: fc.integer({ min: 0, max: 50 }),
            g: fc.integer({ min: 0, max: 50 }),
            b: fc.integer({ min: 0, max: 50 }),
            a: fc.constant(255),
          }),
          (backgroundColor, foregroundColor) => {
            const width = 50;
            const height = 50;
            
            // Create image with foreground in center
            const imageData = createTestImageData(width, height, backgroundColor, [
              { x: 15, y: 15, w: 20, h: 20, color: foregroundColor },
            ]);
            
            const result = removeBackgroundSimple(imageData, backgroundColor, 30);
            
            // Check center pixel (should be foreground and opaque)
            const centerIndex = (25 * width + 25) * 4;
            expect(result.data[centerIndex + 3]).toBe(255);
            
            // Check corner pixel (should be background and transparent)
            const cornerIndex = 3; // alpha of pixel (0,0)
            expect(result.data[cornerIndex]).toBe(0);
          }
        ),
        { numRuns: 100 }
      );
    });
  });
});
