/**
 * Feature: manual-region-selection, Geometry Utilities Property Tests
 * Validates: Requirements 1.3, 3.6, 5.2
 */

import { describe, it, expect } from 'vitest';
import * as fc from 'fast-check';
import {
  isPointInPolygon,
  doEdgesIntersect,
  isPolygonSelfIntersecting,
  canvasToImageCoords,
  imageToCanvasCoords,
  type CanvasTransform,
} from './geometry';
import type { Point, Polygon } from '../types/selection';

// Arbitraries for generating test data
const pointArb = fc.record({
  x: fc.float({ min: Math.fround(0), max: Math.fround(500), noNaN: true }),
  y: fc.float({ min: Math.fround(0), max: Math.fround(500), noNaN: true }),
});

// Generate a convex polygon (guaranteed non-self-intersecting)
const convexPolygonArb = fc.tuple(
  fc.float({ min: Math.fround(50), max: Math.fround(200), noNaN: true }), // centerX
  fc.float({ min: Math.fround(50), max: Math.fround(200), noNaN: true }), // centerY
  fc.float({ min: Math.fround(20), max: Math.fround(100), noNaN: true }), // radius
  fc.integer({ min: 3, max: 12 }) // number of vertices
).map(([cx, cy, r, n]): Polygon => {
  const vertices: Point[] = [];
  for (let i = 0; i < n; i++) {
    const angle = (2 * Math.PI * i) / n;
    vertices.push({
      x: cx + r * Math.cos(angle),
      y: cy + r * Math.sin(angle),
    });
  }
  return { vertices };
});

// Generate a rectangle polygon (guaranteed non-self-intersecting)
const rectanglePolygonArb = fc.tuple(
  fc.float({ min: Math.fround(0), max: Math.fround(200), noNaN: true }),
  fc.float({ min: Math.fround(0), max: Math.fround(200), noNaN: true }),
  fc.float({ min: Math.fround(10), max: Math.fround(200), noNaN: true }),
  fc.float({ min: Math.fround(10), max: Math.fround(200), noNaN: true })
).map(([x, y, width, height]): Polygon => ({
  vertices: [
    { x, y },
    { x: x + width, y },
    { x: x + width, y: y + height },
    { x, y: y + height },
  ],
}));

// Generate a self-intersecting polygon (figure-8 shape)
const selfIntersectingPolygonArb = fc.tuple(
  fc.float({ min: Math.fround(50), max: Math.fround(150), noNaN: true }),
  fc.float({ min: Math.fround(50), max: Math.fround(150), noNaN: true }),
  fc.float({ min: Math.fround(30), max: Math.fround(80), noNaN: true })
).map(([cx, cy, size]): Polygon => ({
  // Figure-8 shape: edges cross in the middle
  vertices: [
    { x: cx - size, y: cy - size },
    { x: cx + size, y: cy + size },
    { x: cx + size, y: cy - size },
    { x: cx - size, y: cy + size },
  ],
}));

// Generate valid canvas transform
const transformArb = fc.record({
  zoom: fc.float({ min: Math.fround(0.1), max: Math.fround(5), noNaN: true }),
  offsetX: fc.float({ min: Math.fround(-500), max: Math.fround(500), noNaN: true }),
  offsetY: fc.float({ min: Math.fround(-500), max: Math.fround(500), noNaN: true }),
});

describe('Geometry Property Tests', () => {
  /**
   * Property 5: Polygon Non-Self-Intersection
   * For any valid polygon selection with N vertices, no two non-adjacent edges
   * (edges that don't share a vertex) SHALL intersect each other.
   * Validates: Requirements 3.6
   */
  describe('Property 5: Polygon Non-Self-Intersection', () => {
    it('convex polygons should never be self-intersecting', () => {
      fc.assert(
        fc.property(convexPolygonArb, (polygon) => {
          expect(isPolygonSelfIntersecting(polygon)).toBe(false);
        }),
        { numRuns: 100 }
      );
    });

    it('rectangle polygons should never be self-intersecting', () => {
      fc.assert(
        fc.property(rectanglePolygonArb, (polygon) => {
          expect(isPolygonSelfIntersecting(polygon)).toBe(false);
        }),
        { numRuns: 100 }
      );
    });

    it('figure-8 shaped polygons should be detected as self-intersecting', () => {
      fc.assert(
        fc.property(selfIntersectingPolygonArb, (polygon) => {
          expect(isPolygonSelfIntersecting(polygon)).toBe(true);
        }),
        { numRuns: 100 }
      );
    });

    it('triangles (3 vertices) should never be self-intersecting', () => {
      const triangleArb = fc.tuple(
        pointArb,
        pointArb,
        pointArb
      ).filter(([p1, p2, p3]) => {
        // Filter out degenerate triangles (collinear points)
        const area = Math.abs(
          (p2.x - p1.x) * (p3.y - p1.y) - (p3.x - p1.x) * (p2.y - p1.y)
        );
        return area > 1;
      }).map(([p1, p2, p3]): Polygon => ({
        vertices: [p1, p2, p3],
      }));

      fc.assert(
        fc.property(triangleArb, (polygon) => {
          expect(isPolygonSelfIntersecting(polygon)).toBe(false);
        }),
        { numRuns: 100 }
      );
    });
  });

  /**
   * Property 13: Polygon Masking Correctness
   * For any polygon selection extraction and any pixel coordinate (x, y),
   * if the pixel is outside the polygon boundary (as determined by point-in-polygon test),
   * its alpha value SHALL be 0 (fully transparent).
   * Validates: Requirements 5.2
   */
  describe('Property 13: Polygon Masking Correctness', () => {
    it('points clearly outside convex polygon should be identified as outside', () => {
      fc.assert(
        fc.property(
          convexPolygonArb,
          fc.float({ min: Math.fround(300), max: Math.fround(500), noNaN: true }),
          fc.float({ min: Math.fround(300), max: Math.fround(500), noNaN: true }),
          (polygon, farX, farY) => {
            // Points far from the polygon center should be outside
            const outsidePoint: Point = { x: farX, y: farY };
            expect(isPointInPolygon(outsidePoint, polygon)).toBe(false);
          }
        ),
        { numRuns: 100 }
      );
    });

    it('centroid of convex polygon should be inside', () => {
      fc.assert(
        fc.property(convexPolygonArb, (polygon) => {
          const centroid: Point = {
            x: polygon.vertices.reduce((sum, v) => sum + v.x, 0) / polygon.vertices.length,
            y: polygon.vertices.reduce((sum, v) => sum + v.y, 0) / polygon.vertices.length,
          };
          expect(isPointInPolygon(centroid, polygon)).toBe(true);
        }),
        { numRuns: 100 }
      );
    });

    it('center of rectangle should be inside', () => {
      fc.assert(
        fc.property(rectanglePolygonArb, (polygon) => {
          const minX = Math.min(...polygon.vertices.map((v) => v.x));
          const maxX = Math.max(...polygon.vertices.map((v) => v.x));
          const minY = Math.min(...polygon.vertices.map((v) => v.y));
          const maxY = Math.max(...polygon.vertices.map((v) => v.y));
          const center: Point = {
            x: (minX + maxX) / 2,
            y: (minY + maxY) / 2,
          };
          expect(isPointInPolygon(center, polygon)).toBe(true);
        }),
        { numRuns: 100 }
      );
    });

    it('points outside bounding box should be outside polygon', () => {
      fc.assert(
        fc.property(rectanglePolygonArb, (polygon) => {
          const minX = Math.min(...polygon.vertices.map((v) => v.x));
          const maxX = Math.max(...polygon.vertices.map((v) => v.x));
          const minY = Math.min(...polygon.vertices.map((v) => v.y));
          const maxY = Math.max(...polygon.vertices.map((v) => v.y));

          // Test points clearly outside the bounding box
          const outsidePoints: Point[] = [
            { x: minX - 10, y: (minY + maxY) / 2 },
            { x: maxX + 10, y: (minY + maxY) / 2 },
            { x: (minX + maxX) / 2, y: minY - 10 },
            { x: (minX + maxX) / 2, y: maxY + 10 },
          ];

          for (const point of outsidePoints) {
            expect(isPointInPolygon(point, polygon)).toBe(false);
          }
        }),
        { numRuns: 100 }
      );
    });
  });

  /**
   * Property 14: Selection Coordinate Transformation
   * For any selection drawn on a canvas with zoom level Z and pan offset (Ox, Oy),
   * the stored selection coordinates SHALL correctly map to the original image
   * coordinate space using the inverse transformation.
   * Validates: Requirements 1.3
   */
  describe('Property 14: Selection Coordinate Transformation', () => {
    it('canvas to image to canvas should return original point (round-trip)', () => {
      fc.assert(
        fc.property(pointArb, transformArb, (point, transform) => {
          const imagePoint = canvasToImageCoords(point, transform);
          const backToCanvas = imageToCanvasCoords(imagePoint, transform);

          // Allow small floating point tolerance
          expect(backToCanvas.x).toBeCloseTo(point.x, 5);
          expect(backToCanvas.y).toBeCloseTo(point.y, 5);
        }),
        { numRuns: 100 }
      );
    });

    it('image to canvas to image should return original point (round-trip)', () => {
      fc.assert(
        fc.property(pointArb, transformArb, (point, transform) => {
          const canvasPoint = imageToCanvasCoords(point, transform);
          const backToImage = canvasToImageCoords(canvasPoint, transform);

          // Allow small floating point tolerance
          expect(backToImage.x).toBeCloseTo(point.x, 5);
          expect(backToImage.y).toBeCloseTo(point.y, 5);
        }),
        { numRuns: 100 }
      );
    });

    it('zoom of 1 and offset of 0 should preserve coordinates', () => {
      fc.assert(
        fc.property(pointArb, (point) => {
          const identityTransform: CanvasTransform = {
            zoom: 1,
            offsetX: 0,
            offsetY: 0,
          };

          const imagePoint = canvasToImageCoords(point, identityTransform);
          expect(imagePoint.x).toBeCloseTo(point.x, 5);
          expect(imagePoint.y).toBeCloseTo(point.y, 5);

          const canvasPoint = imageToCanvasCoords(point, identityTransform);
          expect(canvasPoint.x).toBeCloseTo(point.x, 5);
          expect(canvasPoint.y).toBeCloseTo(point.y, 5);
        }),
        { numRuns: 100 }
      );
    });

    it('zoom should scale coordinates proportionally', () => {
      fc.assert(
        fc.property(
          pointArb,
          fc.float({ min: Math.fround(0.5), max: Math.fround(3), noNaN: true }),
          (point, zoom) => {
            const transform: CanvasTransform = {
              zoom,
              offsetX: 0,
              offsetY: 0,
            };

            const canvasPoint = imageToCanvasCoords(point, transform);
            expect(canvasPoint.x).toBeCloseTo(point.x * zoom, 5);
            expect(canvasPoint.y).toBeCloseTo(point.y * zoom, 5);
          }
        ),
        { numRuns: 100 }
      );
    });

    it('offset should translate coordinates correctly', () => {
      fc.assert(
        fc.property(
          pointArb,
          fc.float({ min: Math.fround(-100), max: Math.fround(100), noNaN: true }),
          fc.float({ min: Math.fround(-100), max: Math.fround(100), noNaN: true }),
          (point, offsetX, offsetY) => {
            const transform: CanvasTransform = {
              zoom: 1,
              offsetX,
              offsetY,
            };

            const canvasPoint = imageToCanvasCoords(point, transform);
            expect(canvasPoint.x).toBeCloseTo(point.x + offsetX, 5);
            expect(canvasPoint.y).toBeCloseTo(point.y + offsetY, 5);
          }
        ),
        { numRuns: 100 }
      );
    });
  });

  describe('doEdgesIntersect', () => {
    it('parallel non-overlapping edges should not intersect', () => {
      fc.assert(
        fc.property(
          fc.float({ min: Math.fround(0), max: Math.fround(100), noNaN: true }),
          fc.float({ min: Math.fround(0), max: Math.fround(100), noNaN: true }),
          fc.float({ min: Math.fround(10), max: Math.fround(50), noNaN: true }),
          (x, y, length) => {
            // Two horizontal parallel lines
            const p1: Point = { x, y };
            const p2: Point = { x: x + length, y };
            const p3: Point = { x, y: y + 20 };
            const p4: Point = { x: x + length, y: y + 20 };

            expect(doEdgesIntersect(p1, p2, p3, p4)).toBe(false);
          }
        ),
        { numRuns: 100 }
      );
    });

    it('crossing edges should intersect', () => {
      fc.assert(
        fc.property(
          fc.float({ min: Math.fround(50), max: Math.fround(150), noNaN: true }),
          fc.float({ min: Math.fround(50), max: Math.fround(150), noNaN: true }),
          fc.float({ min: Math.fround(20), max: Math.fround(50), noNaN: true }),
          (cx, cy, size) => {
            // X-shaped crossing edges
            const p1: Point = { x: cx - size, y: cy - size };
            const p2: Point = { x: cx + size, y: cy + size };
            const p3: Point = { x: cx - size, y: cy + size };
            const p4: Point = { x: cx + size, y: cy - size };

            expect(doEdgesIntersect(p1, p2, p3, p4)).toBe(true);
          }
        ),
        { numRuns: 100 }
      );
    });
  });
});
