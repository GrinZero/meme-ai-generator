/**
 * Feature: ai-image-segmentation, Coordinate Utils Property Tests
 * Validates: Requirements 2.2, 2.3, 3.3, 3.4
 */

import { describe, it, expect } from 'vitest';
import * as fc from 'fast-check';
import {
  isValidPolygon,
  clampCoordinates,
  normalizeCoordinates,
  rectangleToBoundingBox,
  boundingBoxToPolygon,
} from './coordinateUtils';
import type { Point, Polygon } from '../types/segmentation';

// Arbitrary for Point
const pointArb = fc.record({
  x: fc.float({ min: -1000, max: 1000, noNaN: true }),
  y: fc.float({ min: -1000, max: 1000, noNaN: true }),
});

// Arbitrary for valid polygon (3+ vertices)
const validPolygonArb = fc.array(pointArb, { minLength: 3, maxLength: 20 }).map(
  (vertices): Polygon => ({ vertices })
);

// Arbitrary for invalid polygon (0-2 vertices)
const invalidPolygonArb = fc.array(pointArb, { minLength: 0, maxLength: 2 }).map(
  (vertices): Polygon => ({ vertices })
);

// Arbitrary for positive image dimensions
const imageDimensionArb = fc.integer({ min: 1, max: 10000 });

// Arbitrary for percentage values (0-100)
const percentageArb = fc.float({ min: 0, max: 100, noNaN: true });

// Arbitrary for valid BoundingBox
const boundingBoxArb = fc.record({
  x: fc.float({ min: 0, max: 500, noNaN: true }),
  y: fc.float({ min: 0, max: 500, noNaN: true }),
  width: fc.float({ min: 1, max: 500, noNaN: true }),
  height: fc.float({ min: 1, max: 500, noNaN: true }),
});

describe('Coordinate Utils Property Tests', () => {
  /**
   * Property 2: Polygon Vertex Validation
   * For any polygon returned by AI, if it has fewer than 3 vertices,
   * the validation function SHALL reject it and exclude it from the results.
   * Validates: Requirements 2.2
   */
  describe('Property 2: Polygon Vertex Validation', () => {
    it('should accept polygons with 3 or more vertices', () => {
      fc.assert(
        fc.property(validPolygonArb, (polygon) => {
          expect(isValidPolygon(polygon)).toBe(true);
        }),
        { numRuns: 100 }
      );
    });

    it('should reject polygons with fewer than 3 vertices', () => {
      fc.assert(
        fc.property(invalidPolygonArb, (polygon) => {
          expect(isValidPolygon(polygon)).toBe(false);
        }),
        { numRuns: 100 }
      );
    });

    it('should reject null, undefined, or malformed polygon objects', () => {
      expect(isValidPolygon(null as unknown as Polygon)).toBe(false);
      expect(isValidPolygon(undefined as unknown as Polygon)).toBe(false);
      expect(isValidPolygon({} as Polygon)).toBe(false);
      expect(isValidPolygon({ vertices: null } as unknown as Polygon)).toBe(false);
    });
  });

  /**
   * Property 3: Rectangle to BoundingBox Conversion
   * For any valid rectangle coordinates (topLeft, bottomRight),
   * converting to BoundingBox and back SHALL produce equivalent coordinates.
   * Validates: Requirements 2.3
   */
  describe('Property 3: Rectangle to BoundingBox Conversion', () => {
    it('should produce correct BoundingBox from rectangle coordinates', () => {
      fc.assert(
        fc.property(
          fc.float({ min: 0, max: 500, noNaN: true }),
          fc.float({ min: 0, max: 500, noNaN: true }),
          fc.float({ min: 1, max: 500, noNaN: true }),
          fc.float({ min: 1, max: 500, noNaN: true }),
          (x, y, width, height) => {
            const topLeft: Point = { x, y };
            const bottomRight: Point = { x: x + width, y: y + height };
            
            const box = rectangleToBoundingBox(topLeft, bottomRight);
            
            expect(box.x).toBeCloseTo(topLeft.x);
            expect(box.y).toBeCloseTo(topLeft.y);
            expect(box.width).toBeCloseTo(width);
            expect(box.height).toBeCloseTo(height);
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should round-trip: BoundingBox -> Polygon -> back to equivalent rectangle', () => {
      fc.assert(
        fc.property(boundingBoxArb, (box) => {
          const polygon = boundingBoxToPolygon(box);
          
          // Polygon should have 4 vertices
          expect(polygon.vertices.length).toBe(4);
          
          // Extract corners from polygon
          const [topLeft, topRight, bottomRight, bottomLeft] = polygon.vertices;
          
          // Verify corners match original box
          expect(topLeft.x).toBeCloseTo(box.x);
          expect(topLeft.y).toBeCloseTo(box.y);
          expect(topRight.x).toBeCloseTo(box.x + box.width);
          expect(topRight.y).toBeCloseTo(box.y);
          expect(bottomRight.x).toBeCloseTo(box.x + box.width);
          expect(bottomRight.y).toBeCloseTo(box.y + box.height);
          expect(bottomLeft.x).toBeCloseTo(box.x);
          expect(bottomLeft.y).toBeCloseTo(box.y + box.height);
          
          // Convert back using rectangleToBoundingBox
          const reconstructedBox = rectangleToBoundingBox(topLeft, bottomRight);
          
          expect(reconstructedBox.x).toBeCloseTo(box.x);
          expect(reconstructedBox.y).toBeCloseTo(box.y);
          expect(reconstructedBox.width).toBeCloseTo(box.width);
          expect(reconstructedBox.height).toBeCloseTo(box.height);
        }),
        { numRuns: 100 }
      );
    });
  });

  /**
   * Property 5: Coordinate Clamping
   * For any point with coordinates outside image bounds (negative or exceeding dimensions),
   * clamping SHALL produce coordinates within [0, width-1] and [0, height-1].
   * Validates: Requirements 3.3
   */
  describe('Property 5: Coordinate Clamping', () => {
    it('should clamp coordinates to valid range [0, dimension-1]', () => {
      fc.assert(
        fc.property(
          pointArb,
          imageDimensionArb,
          imageDimensionArb,
          (point, width, height) => {
            const clamped = clampCoordinates(point, width, height);
            
            // Result should be within bounds
            expect(clamped.x).toBeGreaterThanOrEqual(0);
            expect(clamped.x).toBeLessThan(width);
            expect(clamped.y).toBeGreaterThanOrEqual(0);
            expect(clamped.y).toBeLessThan(height);
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should not modify coordinates already within bounds', () => {
      fc.assert(
        fc.property(
          imageDimensionArb,
          imageDimensionArb,
          (width, height) => {
            // Generate a point that's definitely within bounds
            return fc.assert(
              fc.property(
                fc.float({ min: 0, max: width - 1, noNaN: true }),
                fc.float({ min: 0, max: height - 1, noNaN: true }),
                (x, y) => {
                  const point: Point = { x, y };
                  const clamped = clampCoordinates(point, width, height);
                  
                  expect(clamped.x).toBeCloseTo(point.x);
                  expect(clamped.y).toBeCloseTo(point.y);
                }
              ),
              { numRuns: 10 }
            );
          }
        ),
        { numRuns: 10 }
      );
    });

    it('should clamp negative coordinates to 0', () => {
      fc.assert(
        fc.property(
          fc.float({ min: Math.fround(-1000), max: Math.fround(-0.001), noNaN: true }),
          fc.float({ min: Math.fround(-1000), max: Math.fround(-0.001), noNaN: true }),
          imageDimensionArb,
          imageDimensionArb,
          (negX, negY, width, height) => {
            const point: Point = { x: negX, y: negY };
            const clamped = clampCoordinates(point, width, height);
            
            expect(clamped.x).toBe(0);
            expect(clamped.y).toBe(0);
          }
        ),
        { numRuns: 100 }
      );
    });
  });

  /**
   * Property 6: Coordinate Normalization
   * For any percentage-based coordinate (0-100),
   * normalizing to pixels SHALL produce values in the range [0, imageDimension].
   * Validates: Requirements 3.4
   */
  describe('Property 6: Coordinate Normalization', () => {
    it('should convert percentage coordinates to pixel values within image bounds', () => {
      fc.assert(
        fc.property(
          percentageArb,
          percentageArb,
          imageDimensionArb,
          imageDimensionArb,
          (percentX, percentY, width, height) => {
            const point: Point = { x: percentX, y: percentY };
            const normalized = normalizeCoordinates(point, width, height, true);
            
            // Result should be within [0, dimension]
            expect(normalized.x).toBeGreaterThanOrEqual(0);
            expect(normalized.x).toBeLessThanOrEqual(width);
            expect(normalized.y).toBeGreaterThanOrEqual(0);
            expect(normalized.y).toBeLessThanOrEqual(height);
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should correctly calculate pixel values from percentages', () => {
      fc.assert(
        fc.property(
          percentageArb,
          percentageArb,
          imageDimensionArb,
          imageDimensionArb,
          (percentX, percentY, width, height) => {
            const point: Point = { x: percentX, y: percentY };
            const normalized = normalizeCoordinates(point, width, height, true);
            
            const expectedX = (percentX / 100) * width;
            const expectedY = (percentY / 100) * height;
            
            expect(normalized.x).toBeCloseTo(expectedX);
            expect(normalized.y).toBeCloseTo(expectedY);
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should not modify coordinates when isPercentage is false', () => {
      fc.assert(
        fc.property(
          pointArb,
          imageDimensionArb,
          imageDimensionArb,
          (point, width, height) => {
            const normalized = normalizeCoordinates(point, width, height, false);
            
            expect(normalized.x).toBeCloseTo(point.x);
            expect(normalized.y).toBeCloseTo(point.y);
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should handle boundary percentages correctly', () => {
      // 0% should map to 0
      const zeroPercent = normalizeCoordinates({ x: 0, y: 0 }, 100, 100, true);
      expect(zeroPercent.x).toBe(0);
      expect(zeroPercent.y).toBe(0);
      
      // 100% should map to dimension
      const hundredPercent = normalizeCoordinates({ x: 100, y: 100 }, 200, 300, true);
      expect(hundredPercent.x).toBe(200);
      expect(hundredPercent.y).toBe(300);
      
      // 50% should map to half dimension
      const fiftyPercent = normalizeCoordinates({ x: 50, y: 50 }, 200, 400, true);
      expect(fiftyPercent.x).toBe(100);
      expect(fiftyPercent.y).toBe(200);
    });
  });
});
