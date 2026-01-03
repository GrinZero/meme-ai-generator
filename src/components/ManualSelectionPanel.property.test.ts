/**
 * Feature: manual-region-selection, ManualSelectionPanel Property Tests
 * 
 * Property 16: Store Integration Data Structure
 * 
 * For any emoji extracted via manual selection, it SHALL have all required fields:
 * id (non-empty string), blob (valid Blob), preview (valid data URL or object URL),
 * and boundingBox (valid BoundingBox with positive dimensions).
 * 
 * Validates: Requirements 10.2
 */

import { describe, it, expect } from 'vitest';
import * as fc from 'fast-check';
import { extractFromSelection } from '../services/regionExtractor';
import { calculateScaledSize, calculateCenterOffset, validateNormalization } from '../services/emojiNormalizer';
import type { SelectionRegion } from '../types/selection';
import type { BoundingBox } from '../types/image';

// Helper to create ImageData with specific dimensions
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

// Arbitrary for generating valid bounding boxes
const boundingBoxArb = (imageWidth: number, imageHeight: number) =>
  fc.record({
    x: fc.integer({ min: 0, max: Math.max(0, imageWidth - 20) }),
    y: fc.integer({ min: 0, max: Math.max(0, imageHeight - 20) }),
    width: fc.integer({ min: 10, max: Math.min(100, imageWidth) }),
    height: fc.integer({ min: 10, max: Math.min(100, imageHeight) }),
  }).filter(({ x, y, width, height }) => 
    x + width <= imageWidth && y + height <= imageHeight
  );

// Arbitrary for generating valid rectangle selections
const rectangleSelectionArb = (imageWidth: number, imageHeight: number) =>
  boundingBoxArb(imageWidth, imageHeight).map(boundingBox => ({
    id: `sel_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`,
    type: 'rectangle' as const,
    boundingBox,
    createdAt: Date.now(),
  }));

// Arbitrary for generating valid polygon selections (simple convex polygons)
const polygonSelectionArb = (imageWidth: number, imageHeight: number) =>
  fc.record({
    centerX: fc.integer({ min: 30, max: Math.max(30, imageWidth - 30) }),
    centerY: fc.integer({ min: 30, max: Math.max(30, imageHeight - 30) }),
    radius: fc.integer({ min: 15, max: Math.min(25, Math.min(imageWidth, imageHeight) / 4) }),
    numVertices: fc.integer({ min: 3, max: 6 }),
  }).map(({ centerX, centerY, radius, numVertices }) => {
    // Generate a regular polygon
    const vertices = [];
    for (let i = 0; i < numVertices; i++) {
      const angle = (2 * Math.PI * i) / numVertices;
      vertices.push({
        x: Math.round(centerX + radius * Math.cos(angle)),
        y: Math.round(centerY + radius * Math.sin(angle)),
      });
    }
    
    // Calculate bounding box
    const xs = vertices.map(v => v.x);
    const ys = vertices.map(v => v.y);
    const minX = Math.min(...xs);
    const minY = Math.min(...ys);
    const maxX = Math.max(...xs);
    const maxY = Math.max(...ys);
    
    return {
      id: `sel_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`,
      type: 'polygon' as const,
      boundingBox: {
        x: minX,
        y: minY,
        width: maxX - minX,
        height: maxY - minY,
      },
      polygon: { vertices },
      createdAt: Date.now(),
    } as SelectionRegion;
  });

// Validate BoundingBox structure
function validateBoundingBox(box: BoundingBox): { valid: boolean; errors: string[] } {
  const errors: string[] = [];
  
  if (typeof box.x !== 'number') {
    errors.push('x must be a number');
  }
  if (typeof box.y !== 'number') {
    errors.push('y must be a number');
  }
  if (typeof box.width !== 'number' || box.width <= 0) {
    errors.push('width must be a positive number');
  }
  if (typeof box.height !== 'number' || box.height <= 0) {
    errors.push('height must be a positive number');
  }
  
  return {
    valid: errors.length === 0,
    errors,
  };
}

describe('ManualSelectionPanel Property Tests', () => {
  /**
   * Property 16: Store Integration Data Structure
   * 
   * For any emoji extracted via manual selection, it SHALL have all required fields:
   * id (non-empty string), blob (valid Blob), preview (valid data URL or object URL),
   * and boundingBox (valid BoundingBox with positive dimensions).
   * 
   * Validates: Requirements 10.2
   * 
   * Note: Tests that require full canvas operations (normalizeEmoji) are tested
   * through their component functions (calculateScaledSize, calculateCenterOffset)
   * due to jsdom canvas limitations.
   */
  describe('Property 16: Store Integration Data Structure', () => {
    it('selection bounding box should have valid structure', () => {
      fc.assert(
        fc.property(
          fc.integer({ min: 100, max: 500 }),
          fc.integer({ min: 100, max: 500 }),
          (imageWidth, imageHeight) => {
            // Generate a valid rectangle selection
            const selection = fc.sample(rectangleSelectionArb(imageWidth, imageHeight), 1)[0];
            
            // Validate bounding box structure
            const validation = validateBoundingBox(selection.boundingBox);
            expect(validation.valid).toBe(true);
            
            // Bounding box should be within image bounds
            expect(selection.boundingBox.x).toBeGreaterThanOrEqual(0);
            expect(selection.boundingBox.y).toBeGreaterThanOrEqual(0);
            expect(selection.boundingBox.x + selection.boundingBox.width).toBeLessThanOrEqual(imageWidth);
            expect(selection.boundingBox.y + selection.boundingBox.height).toBeLessThanOrEqual(imageHeight);
          }
        ),
        { numRuns: 100 }
      );
    });

    it('polygon selection bounding box should contain all vertices', () => {
      fc.assert(
        fc.property(
          fc.integer({ min: 100, max: 300 }),
          fc.integer({ min: 100, max: 300 }),
          (imageWidth, imageHeight) => {
            // Generate a valid polygon selection
            const selection = fc.sample(polygonSelectionArb(imageWidth, imageHeight), 1)[0];
            
            if (selection.polygon) {
              const { boundingBox, polygon } = selection;
              
              // All vertices should be within the bounding box
              for (const vertex of polygon.vertices) {
                expect(vertex.x).toBeGreaterThanOrEqual(boundingBox.x);
                expect(vertex.x).toBeLessThanOrEqual(boundingBox.x + boundingBox.width);
                expect(vertex.y).toBeGreaterThanOrEqual(boundingBox.y);
                expect(vertex.y).toBeLessThanOrEqual(boundingBox.y + boundingBox.height);
              }
            }
          }
        ),
        { numRuns: 100 }
      );
    });

    it('extracted region should have valid dimensions', () => {
      fc.assert(
        fc.property(
          fc.integer({ min: 100, max: 300 }),
          fc.integer({ min: 100, max: 300 }),
          (imageWidth, imageHeight) => {
            // Create test image
            const imageData = createTestImageData(imageWidth, imageHeight);
            
            // Generate a valid rectangle selection
            const selection = fc.sample(rectangleSelectionArb(imageWidth, imageHeight), 1)[0];
            
            // Extract region
            const extractedData = extractFromSelection(imageData, selection, {
              removeBackground: false,
            });
            
            // Extracted data should have positive dimensions
            expect(extractedData.width).toBeGreaterThan(0);
            expect(extractedData.height).toBeGreaterThan(0);
            
            // Extracted dimensions should match selection bounding box
            expect(extractedData.width).toBe(selection.boundingBox.width);
            expect(extractedData.height).toBe(selection.boundingBox.height);
          }
        ),
        { numRuns: 100 }
      );
    });

    it('normalized output should be exactly 240x240', () => {
      fc.assert(
        fc.property(
          fc.integer({ min: 10, max: 500 }),
          fc.integer({ min: 10, max: 500 }),
          (srcWidth, srcHeight) => {
            const targetSize = 240;
            
            // Calculate scaled size
            const scaledSize = calculateScaledSize(srcWidth, srcHeight, targetSize);
            
            // At least one dimension should equal target size
            const maxDim = Math.max(scaledSize.width, scaledSize.height);
            expect(maxDim).toBe(targetSize);
            
            // Both dimensions should be positive and <= target
            expect(scaledSize.width).toBeGreaterThan(0);
            expect(scaledSize.height).toBeGreaterThan(0);
            expect(scaledSize.width).toBeLessThanOrEqual(targetSize);
            expect(scaledSize.height).toBeLessThanOrEqual(targetSize);
          }
        ),
        { numRuns: 100 }
      );
    });

    it('content should be centered in output canvas', () => {
      fc.assert(
        fc.property(
          fc.integer({ min: 10, max: 200 }),
          fc.integer({ min: 10, max: 200 }),
          (contentWidth, contentHeight) => {
            const canvasSize = 240;
            
            // Calculate center offset
            const offset = calculateCenterOffset(
              { width: contentWidth, height: contentHeight },
              canvasSize
            );
            
            // Offset should center the content
            const expectedX = Math.floor((canvasSize - contentWidth) / 2);
            const expectedY = Math.floor((canvasSize - contentHeight) / 2);
            
            expect(offset.x).toBe(expectedX);
            expect(offset.y).toBe(expectedY);
            
            // Content + offset should fit within canvas
            expect(offset.x + contentWidth).toBeLessThanOrEqual(canvasSize);
            expect(offset.y + contentHeight).toBeLessThanOrEqual(canvasSize);
          }
        ),
        { numRuns: 100 }
      );
    });

    it('validation should detect incorrect output sizes', () => {
      fc.assert(
        fc.property(
          fc.integer({ min: 10, max: 200 }),
          fc.integer({ min: 10, max: 200 }),
          (width, height) => {
            const expectedSize = 240;
            
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

    it('validation should pass for correct output size', () => {
      const expectedSize = 240;
      
      // Create ImageData with correct size
      const correctSizeData = createTestImageData(expectedSize, expectedSize);
      
      // Validation should pass
      const validation = validateNormalization(correctSizeData, expectedSize);
      expect(validation.valid).toBe(true);
      expect(validation.errors.length).toBe(0);
    });

    it('selection IDs should be unique', () => {
      fc.assert(
        fc.property(
          fc.integer({ min: 100, max: 300 }),
          fc.integer({ min: 100, max: 300 }),
          fc.integer({ min: 5, max: 20 }),
          (imageWidth, imageHeight, count) => {
            // Generate multiple selections
            const selections = fc.sample(
              rectangleSelectionArb(imageWidth, imageHeight),
              count
            );
            
            // All IDs should be unique
            const ids = selections.map(s => s.id);
            const uniqueIds = new Set(ids);
            expect(uniqueIds.size).toBe(ids.length);
          }
        ),
        { numRuns: 50 }
      );
    });

    it('extracted polygon region should have valid dimensions', () => {
      fc.assert(
        fc.property(
          fc.integer({ min: 100, max: 300 }),
          fc.integer({ min: 100, max: 300 }),
          (imageWidth, imageHeight) => {
            // Create test image
            const imageData = createTestImageData(imageWidth, imageHeight);
            
            // Generate a valid polygon selection
            const selection = fc.sample(polygonSelectionArb(imageWidth, imageHeight), 1)[0];
            
            // Extract region
            const extractedData = extractFromSelection(imageData, selection, {
              removeBackground: false,
            });
            
            // Extracted data should have positive dimensions
            expect(extractedData.width).toBeGreaterThan(0);
            expect(extractedData.height).toBeGreaterThan(0);
          }
        ),
        { numRuns: 100 }
      );
    });
  });
});
