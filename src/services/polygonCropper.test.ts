/**
 * Feature: ai-image-segmentation, Polygon Cropper Property Tests
 * Validates: Requirements 4.1, 4.2
 */

import { describe, it, expect } from 'vitest';
import * as fc from 'fast-check';
import {
  calculatePolygonBoundingBox,
  isConvexPolygon,
  isPointInPolygon,
} from './polygonCropper';
import type { Point, Polygon } from '../types/segmentation';

const pointArb = fc.record({
  x: fc.float({ min: 0, max: 500, noNaN: true }),
  y: fc.float({ min: 0, max: 500, noNaN: true }),
});

const validPolygonArb = fc.array(pointArb, { minLength: 3, maxLength: 20 }).map(
  (vertices): Polygon => ({ vertices })
);

const triangleArb = fc.tuple(
  fc.float({ min: 10, max: 100, noNaN: true }),
  fc.float({ min: 10, max: 100, noNaN: true }),
  fc.float({ min: 50, max: 200, noNaN: true })
).map(([baseX, baseY, size]): Polygon => ({
  vertices: [
    { x: baseX + size / 2, y: baseY },
    { x: baseX + size, y: baseY + size },
    { x: baseX, y: baseY + size },
  ],
}));

const rectanglePolygonArb = fc.tuple(
  fc.float({ min: 0, max: 200, noNaN: true }),
  fc.float({ min: 0, max: 200, noNaN: true }),
  fc.float({ min: 10, max: 200, noNaN: true }),
  fc.float({ min: 10, max: 200, noNaN: true })
).map(([x, y, width, height]): Polygon => ({
  vertices: [
    { x, y },
    { x: x + width, y },
    { x: x + width, y: y + height },
    { x, y: y + height },
  ],
}));

describe('Polygon Cropper Property Tests', () => {
  describe('Property 7: Polygon Bounding Box Calculation', () => {
    it('should calculate bounding box that contains all vertices', () => {
      fc.assert(
        fc.property(validPolygonArb, (polygon) => {
          const box = calculatePolygonBoundingBox(polygon);
          for (const vertex of polygon.vertices) {
            expect(vertex.x).toBeGreaterThanOrEqual(box.x);
            expect(vertex.x).toBeLessThanOrEqual(box.x + box.width);
            expect(vertex.y).toBeGreaterThanOrEqual(box.y);
            expect(vertex.y).toBeLessThanOrEqual(box.y + box.height);
          }
        }),
        { numRuns: 100 }
      );
    });

    it('should produce minimal bounding box', () => {
      fc.assert(
        fc.property(validPolygonArb, (polygon) => {
          const box = calculatePolygonBoundingBox(polygon);
          const vertices = polygon.vertices;
          const touchesLeft = vertices.some((v) => Math.abs(v.x - box.x) < 0.001);
          const touchesRight = vertices.some((v) => Math.abs(v.x - (box.x + box.width)) < 0.001);
          const touchesTop = vertices.some((v) => Math.abs(v.y - box.y) < 0.001);
          const touchesBottom = vertices.some((v) => Math.abs(v.y - (box.y + box.height)) < 0.001);
          expect(touchesLeft).toBe(true);
          expect(touchesRight).toBe(true);
          expect(touchesTop).toBe(true);
          expect(touchesBottom).toBe(true);
        }),
        { numRuns: 100 }
      );
    });

    it('should handle empty polygon gracefully', () => {
      const emptyPolygon: Polygon = { vertices: [] };
      const box = calculatePolygonBoundingBox(emptyPolygon);
      expect(box.x).toBe(0);
      expect(box.y).toBe(0);
      expect(box.width).toBe(0);
      expect(box.height).toBe(0);
    });
  });

  describe('Property 8: Polygon Clipping Transparency', () => {
    it('should identify points outside polygon as false', () => {
      fc.assert(
        fc.property(rectanglePolygonArb, (polygon) => {
          const box = calculatePolygonBoundingBox(polygon);
          const outsidePoints: Point[] = [
            { x: box.x - 10, y: box.y + box.height / 2 },
            { x: box.x + box.width + 10, y: box.y + box.height / 2 },
            { x: box.x + box.width / 2, y: box.y - 10 },
            { x: box.x + box.width / 2, y: box.y + box.height + 10 },
          ];
          for (const point of outsidePoints) {
            expect(isPointInPolygon(point, polygon)).toBe(false);
          }
        }),
        { numRuns: 100 }
      );
    });

    it('should identify points inside polygon as true', () => {
      fc.assert(
        fc.property(rectanglePolygonArb, (polygon) => {
          const box = calculatePolygonBoundingBox(polygon);
          const centerPoint: Point = {
            x: box.x + box.width / 2,
            y: box.y + box.height / 2,
          };
          expect(isPointInPolygon(centerPoint, polygon)).toBe(true);
        }),
        { numRuns: 100 }
      );
    });

    it('should classify triangle centroids as inside', () => {
      fc.assert(
        fc.property(triangleArb, (polygon) => {
          const centroid: Point = {
            x: polygon.vertices.reduce((sum, v) => sum + v.x, 0) / 3,
            y: polygon.vertices.reduce((sum, v) => sum + v.y, 0) / 3,
          };
          expect(isPointInPolygon(centroid, polygon)).toBe(true);
        }),
        { numRuns: 100 }
      );
    });
  });

  describe('isConvexPolygon', () => {
    it('should identify rectangles as convex', () => {
      fc.assert(
        fc.property(rectanglePolygonArb, (polygon) => {
          expect(isConvexPolygon(polygon)).toBe(true);
        }),
        { numRuns: 100 }
      );
    });

    it('should identify triangles as convex', () => {
      fc.assert(
        fc.property(triangleArb, (polygon) => {
          expect(isConvexPolygon(polygon)).toBe(true);
        }),
        { numRuns: 100 }
      );
    });

    it('should identify L-shaped polygon as concave', () => {
      const concavePolygon: Polygon = {
        vertices: [
          { x: 0, y: 0 },
          { x: 100, y: 0 },
          { x: 100, y: 50 },
          { x: 50, y: 50 },
          { x: 50, y: 100 },
          { x: 0, y: 100 },
        ],
      };
      expect(isConvexPolygon(concavePolygon)).toBe(false);
    });
  });

  describe('isPointInPolygon', () => {
    it('should correctly identify points in rectangle', () => {
      const rectangle: Polygon = {
        vertices: [
          { x: 0, y: 0 },
          { x: 100, y: 0 },
          { x: 100, y: 100 },
          { x: 0, y: 100 },
        ],
      };
      expect(isPointInPolygon({ x: 50, y: 50 }, rectangle)).toBe(true);
      expect(isPointInPolygon({ x: -1, y: 50 }, rectangle)).toBe(false);
      expect(isPointInPolygon({ x: 101, y: 50 }, rectangle)).toBe(false);
    });
  });
});
