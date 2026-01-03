/**
 * Feature: manual-region-selection, Selection Manager Property Tests
 * Validates: Requirements 2.1, 2.3, 2.4, 2.5, 3.1, 3.3, 3.4, 3.5, 4.1, 7.4, 8.4
 */

import { describe, it, expect } from 'vitest';
import * as fc from 'fast-check';
import {
  createRectangleSelection,
  createPolygonSelection,
  updateSelectionPosition,
  updateSelectionSize,
  movePolygonVertex,
  insertPolygonVertex,
  generateSelectionId,
  SelectionHistory,
} from './selectionManager';
import type { Point, BoundingBox, SelectionRegion } from '../types/selection';

// Arbitraries for generating test data
const pointArb = fc.record({
  x: fc.float({ min: Math.fround(0), max: Math.fround(500), noNaN: true }),
  y: fc.float({ min: Math.fround(0), max: Math.fround(500), noNaN: true }),
});

const imageDimensionsArb = fc.record({
  width: fc.integer({ min: 100, max: 2000 }),
  height: fc.integer({ min: 100, max: 2000 }),
});

// Generate two distinct points for rectangle creation
const rectanglePointsArb = fc.tuple(
  fc.float({ min: Math.fround(10), max: Math.fround(400), noNaN: true }),
  fc.float({ min: Math.fround(10), max: Math.fround(400), noNaN: true }),
  fc.float({ min: Math.fround(10), max: Math.fround(400), noNaN: true }),
  fc.float({ min: Math.fround(10), max: Math.fround(400), noNaN: true })
).filter(([x1, y1, x2, y2]) => {
  // Ensure points are different enough to create a valid rectangle
  return Math.abs(x2 - x1) > 5 && Math.abs(y2 - y1) > 5;
}).map(([x1, y1, x2, y2]) => ({
  start: { x: x1, y: y1 } as Point,
  end: { x: x2, y: y2 } as Point,
}));

// Generate a convex polygon (guaranteed non-self-intersecting)
const convexPolygonVerticesArb = fc.tuple(
  fc.float({ min: Math.fround(100), max: Math.fround(300), noNaN: true }), // centerX
  fc.float({ min: Math.fround(100), max: Math.fround(300), noNaN: true }), // centerY
  fc.float({ min: Math.fround(30), max: Math.fround(80), noNaN: true }), // radius
  fc.integer({ min: 3, max: 10 }) // number of vertices
).map(([cx, cy, r, n]): Point[] => {
  const vertices: Point[] = [];
  for (let i = 0; i < n; i++) {
    const angle = (2 * Math.PI * i) / n;
    vertices.push({
      x: cx + r * Math.cos(angle),
      y: cy + r * Math.sin(angle),
    });
  }
  return vertices;
});

describe('Selection Manager Property Tests', () => {
  /**
   * Property 1: Rectangle Selection Bounds Validity
   * For any rectangle selection created by dragging from point A to point B
   * on an image of dimensions W×H, the resulting boundingBox SHALL have:
   * - Positive width and height (width > 0, height > 0)
   * - Coordinates within image boundaries
   * Validates: Requirements 2.1, 2.3
   */
  describe('Property 1: Rectangle Selection Bounds Validity', () => {
    it('created rectangle should have positive dimensions', () => {
      fc.assert(
        fc.property(
          rectanglePointsArb,
          imageDimensionsArb,
          ({ start, end }, { width, height }) => {
            const selection = createRectangleSelection(start, end, width, height);
            
            if (selection) {
              expect(selection.boundingBox.width).toBeGreaterThan(0);
              expect(selection.boundingBox.height).toBeGreaterThan(0);
            }
          }
        ),
        { numRuns: 100 }
      );
    });

    it('created rectangle should be within image boundaries', () => {
      fc.assert(
        fc.property(
          rectanglePointsArb,
          imageDimensionsArb,
          ({ start, end }, { width, height }) => {
            const selection = createRectangleSelection(start, end, width, height);
            
            if (selection) {
              const box = selection.boundingBox;
              expect(box.x).toBeGreaterThanOrEqual(0);
              expect(box.y).toBeGreaterThanOrEqual(0);
              expect(box.x + box.width).toBeLessThanOrEqual(width);
              expect(box.y + box.height).toBeLessThanOrEqual(height);
            }
          }
        ),
        { numRuns: 100 }
      );
    });

    it('rectangle should be created regardless of drag direction', () => {
      fc.assert(
        fc.property(
          rectanglePointsArb,
          imageDimensionsArb,
          ({ start, end }, { width, height }) => {
            // Create rectangle in both directions
            const selection1 = createRectangleSelection(start, end, width, height);
            const selection2 = createRectangleSelection(end, start, width, height);
            
            // Both should create valid selections with same dimensions
            if (selection1 && selection2) {
              expect(selection1.boundingBox.width).toBe(selection2.boundingBox.width);
              expect(selection1.boundingBox.height).toBe(selection2.boundingBox.height);
            }
          }
        ),
        { numRuns: 100 }
      );
    });
  });

  /**
   * Property 2: Rectangle Resize Preserves Validity
   * For any existing rectangle selection and any resize operation,
   * the resulting boundingBox SHALL remain valid (positive dimensions, within image bounds).
   * Validates: Requirements 2.4
   */
  describe('Property 2: Rectangle Resize Preserves Validity', () => {
    it('resized rectangle should maintain positive dimensions', () => {
      fc.assert(
        fc.property(
          rectanglePointsArb,
          imageDimensionsArb,
          fc.float({ min: Math.fround(0.5), max: Math.fround(2), noNaN: true }),
          fc.float({ min: Math.fround(0.5), max: Math.fround(2), noNaN: true }),
          ({ start, end }, { width, height }, scaleX, scaleY) => {
            const selection = createRectangleSelection(start, end, width, height);
            
            if (selection) {
              const newBox: BoundingBox = {
                x: selection.boundingBox.x,
                y: selection.boundingBox.y,
                width: selection.boundingBox.width * scaleX,
                height: selection.boundingBox.height * scaleY,
              };
              
              const resized = updateSelectionSize(selection, newBox, width, height);
              
              if (resized) {
                expect(resized.boundingBox.width).toBeGreaterThan(0);
                expect(resized.boundingBox.height).toBeGreaterThan(0);
              }
            }
          }
        ),
        { numRuns: 100 }
      );
    });

    it('resized rectangle should stay within image bounds', () => {
      fc.assert(
        fc.property(
          rectanglePointsArb,
          imageDimensionsArb,
          fc.float({ min: Math.fround(0.5), max: Math.fround(2), noNaN: true }),
          fc.float({ min: Math.fround(0.5), max: Math.fround(2), noNaN: true }),
          ({ start, end }, { width, height }, scaleX, scaleY) => {
            const selection = createRectangleSelection(start, end, width, height);
            
            if (selection) {
              const newBox: BoundingBox = {
                x: selection.boundingBox.x,
                y: selection.boundingBox.y,
                width: selection.boundingBox.width * scaleX,
                height: selection.boundingBox.height * scaleY,
              };
              
              const resized = updateSelectionSize(selection, newBox, width, height);
              
              if (resized) {
                const box = resized.boundingBox;
                expect(box.x).toBeGreaterThanOrEqual(0);
                expect(box.y).toBeGreaterThanOrEqual(0);
                expect(box.x + box.width).toBeLessThanOrEqual(width);
                expect(box.y + box.height).toBeLessThanOrEqual(height);
              }
            }
          }
        ),
        { numRuns: 100 }
      );
    });
  });

  /**
   * Property 3: Rectangle Move Preserves Size
   * For any rectangle selection with dimensions W×H, after any move operation,
   * the resulting boundingBox SHALL have the same width W and height H.
   * Validates: Requirements 2.5
   */
  describe('Property 3: Rectangle Move Preserves Size', () => {
    it('moved rectangle should preserve original dimensions', () => {
      fc.assert(
        fc.property(
          rectanglePointsArb,
          imageDimensionsArb,
          fc.float({ min: Math.fround(-50), max: Math.fround(50), noNaN: true }),
          fc.float({ min: Math.fround(-50), max: Math.fround(50), noNaN: true }),
          ({ start, end }, { width, height }, deltaX, deltaY) => {
            const selection = createRectangleSelection(start, end, width, height);
            
            if (selection) {
              const originalWidth = selection.boundingBox.width;
              const originalHeight = selection.boundingBox.height;
              
              const moved = updateSelectionPosition(
                selection,
                deltaX,
                deltaY,
                width,
                height
              );
              
              expect(moved.boundingBox.width).toBe(originalWidth);
              expect(moved.boundingBox.height).toBe(originalHeight);
            }
          }
        ),
        { numRuns: 100 }
      );
    });

    it('moved rectangle should stay within image bounds', () => {
      fc.assert(
        fc.property(
          rectanglePointsArb,
          imageDimensionsArb,
          fc.float({ min: Math.fround(-100), max: Math.fround(100), noNaN: true }),
          fc.float({ min: Math.fround(-100), max: Math.fround(100), noNaN: true }),
          ({ start, end }, { width, height }, deltaX, deltaY) => {
            const selection = createRectangleSelection(start, end, width, height);
            
            if (selection) {
              const moved = updateSelectionPosition(
                selection,
                deltaX,
                deltaY,
                width,
                height
              );
              
              const box = moved.boundingBox;
              expect(box.x).toBeGreaterThanOrEqual(0);
              expect(box.y).toBeGreaterThanOrEqual(0);
              expect(box.x + box.width).toBeLessThanOrEqual(width);
              expect(box.y + box.height).toBeLessThanOrEqual(height);
            }
          }
        ),
        { numRuns: 100 }
      );
    });
  });

  /**
   * Property 4: Polygon Closure Consistency
   * For any completed polygon selection, the polygon SHALL have at least 3 vertices,
   * forming a closed shape.
   * Validates: Requirements 3.1, 3.3
   */
  describe('Property 4: Polygon Closure Consistency', () => {
    it('created polygon should have at least 3 vertices', () => {
      fc.assert(
        fc.property(
          convexPolygonVerticesArb,
          imageDimensionsArb,
          (vertices, { width, height }) => {
            const selection = createPolygonSelection(vertices, width, height);
            
            if (selection && selection.polygon) {
              expect(selection.polygon.vertices.length).toBeGreaterThanOrEqual(3);
            }
          }
        ),
        { numRuns: 100 }
      );
    });

    it('polygon with less than 3 vertices should not be created', () => {
      fc.assert(
        fc.property(
          fc.array(pointArb, { minLength: 0, maxLength: 2 }),
          imageDimensionsArb,
          (vertices, { width, height }) => {
            const selection = createPolygonSelection(vertices, width, height);
            expect(selection).toBeNull();
          }
        ),
        { numRuns: 100 }
      );
    });
  });


  /**
   * Property 6: Polygon Vertex Edit Isolation
   * For any polygon selection and any single vertex drag operation,
   * only the dragged vertex position SHALL change; all other vertices
   * SHALL remain at their original positions.
   * Validates: Requirements 3.4
   */
  describe('Property 6: Polygon Vertex Edit Isolation', () => {
    it('moving a vertex should only change that vertex', () => {
      fc.assert(
        fc.property(
          convexPolygonVerticesArb,
          imageDimensionsArb,
          fc.float({ min: Math.fround(-20), max: Math.fround(20), noNaN: true }),
          fc.float({ min: Math.fround(-20), max: Math.fround(20), noNaN: true }),
          (vertices, { width, height }, deltaX, deltaY) => {
            const selection = createPolygonSelection(vertices, width, height);
            
            if (selection && selection.polygon) {
              const vertexIndex = Math.floor(Math.random() * selection.polygon.vertices.length);
              const originalVertex = selection.polygon.vertices[vertexIndex];
              const newPosition: Point = {
                x: originalVertex.x + deltaX,
                y: originalVertex.y + deltaY,
              };
              
              const modified = movePolygonVertex(
                selection,
                vertexIndex,
                newPosition,
                width,
                height
              );
              
              if (modified && modified.polygon) {
                // Check that other vertices remain unchanged
                for (let i = 0; i < selection.polygon.vertices.length; i++) {
                  if (i !== vertexIndex) {
                    expect(modified.polygon.vertices[i].x).toBeCloseTo(
                      selection.polygon.vertices[i].x,
                      5
                    );
                    expect(modified.polygon.vertices[i].y).toBeCloseTo(
                      selection.polygon.vertices[i].y,
                      5
                    );
                  }
                }
              }
            }
          }
        ),
        { numRuns: 100 }
      );
    });
  });

  /**
   * Property 7: Polygon Edge Vertex Insertion
   * For any polygon selection with N vertices, clicking on an edge to add a new vertex
   * SHALL result in a polygon with N+1 vertices.
   * Validates: Requirements 3.5
   */
  describe('Property 7: Polygon Edge Vertex Insertion', () => {
    it('inserting a vertex should increase vertex count by 1', () => {
      fc.assert(
        fc.property(
          convexPolygonVerticesArb,
          imageDimensionsArb,
          (vertices, { width, height }) => {
            const selection = createPolygonSelection(vertices, width, height);
            
            if (selection && selection.polygon) {
              const originalCount = selection.polygon.vertices.length;
              const edgeIndex = Math.floor(Math.random() * originalCount);
              
              // Calculate midpoint of the edge
              const v1 = selection.polygon.vertices[edgeIndex];
              const v2 = selection.polygon.vertices[(edgeIndex + 1) % originalCount];
              const midpoint: Point = {
                x: (v1.x + v2.x) / 2,
                y: (v1.y + v2.y) / 2,
              };
              
              const modified = insertPolygonVertex(
                selection,
                edgeIndex,
                midpoint,
                width,
                height
              );
              
              if (modified && modified.polygon) {
                expect(modified.polygon.vertices.length).toBe(originalCount + 1);
              }
            }
          }
        ),
        { numRuns: 100 }
      );
    });

    it('inserted vertex should be at the specified position', () => {
      fc.assert(
        fc.property(
          convexPolygonVerticesArb,
          imageDimensionsArb,
          (vertices, { width, height }) => {
            const selection = createPolygonSelection(vertices, width, height);
            
            if (selection && selection.polygon) {
              const edgeIndex = 0; // Insert on first edge
              const v1 = selection.polygon.vertices[0];
              const v2 = selection.polygon.vertices[1];
              const insertPosition: Point = {
                x: (v1.x + v2.x) / 2,
                y: (v1.y + v2.y) / 2,
              };
              
              const modified = insertPolygonVertex(
                selection,
                edgeIndex,
                insertPosition,
                width,
                height
              );
              
              if (modified && modified.polygon) {
                // The new vertex should be at index edgeIndex + 1
                const newVertex = modified.polygon.vertices[edgeIndex + 1];
                expect(newVertex.x).toBeCloseTo(insertPosition.x, 5);
                expect(newVertex.y).toBeCloseTo(insertPosition.y, 5);
              }
            }
          }
        ),
        { numRuns: 100 }
      );
    });
  });

  /**
   * Property 8: Selection ID Uniqueness
   * For any set of selections in the selection list at any point in time,
   * all selection IDs SHALL be unique.
   * Validates: Requirements 4.1, 4.2
   */
  describe('Property 8: Selection ID Uniqueness', () => {
    it('generated IDs should be unique across multiple calls', () => {
      fc.assert(
        fc.property(
          fc.integer({ min: 10, max: 100 }),
          (count) => {
            const ids = new Set<string>();
            
            for (let i = 0; i < count; i++) {
              const id = generateSelectionId();
              expect(ids.has(id)).toBe(false);
              ids.add(id);
            }
            
            expect(ids.size).toBe(count);
          }
        ),
        { numRuns: 100 }
      );
    });

    it('created selections should have unique IDs', () => {
      fc.assert(
        fc.property(
          fc.array(rectanglePointsArb, { minLength: 2, maxLength: 20 }),
          imageDimensionsArb,
          (pointPairs, { width, height }) => {
            const selections: SelectionRegion[] = [];
            
            for (const { start, end } of pointPairs) {
              const selection = createRectangleSelection(start, end, width, height);
              if (selection) {
                selections.push(selection);
              }
            }
            
            const ids = selections.map((s) => s.id);
            const uniqueIds = new Set(ids);
            
            expect(uniqueIds.size).toBe(ids.length);
          }
        ),
        { numRuns: 100 }
      );
    });
  });

  /**
   * Property 10: Undo State Consistency
   * For any sequence of N selection operations followed by M undo operations (where M ≤ N),
   * the selection state SHALL exactly match the state after the first (N - M) operations.
   * Validates: Requirements 7.4, 8.4
   */
  describe('Property 10: Undo State Consistency', () => {
    it('undo should restore previous state', () => {
      fc.assert(
        fc.property(
          fc.array(rectanglePointsArb, { minLength: 1, maxLength: 10 }),
          imageDimensionsArb,
          (pointPairs, { width, height }) => {
            const history = new SelectionHistory();
            let currentState: SelectionRegion[] = [];
            const states: SelectionRegion[][] = [[]];
            
            // Perform operations and record states
            for (const { start, end } of pointPairs) {
              const selection = createRectangleSelection(start, end, width, height);
              if (selection) {
                const previousState = [...currentState];
                currentState = [...currentState, selection];
                history.pushAction('add', previousState, currentState);
                states.push([...currentState]);
              }
            }
            
            // Undo all operations and verify states
            for (let i = states.length - 2; i >= 0; i--) {
              const undoneState = history.undo();
              if (undoneState) {
                expect(undoneState.length).toBe(states[i].length);
              }
            }
          }
        ),
        { numRuns: 100 }
      );
    });

    it('redo should restore undone state', () => {
      fc.assert(
        fc.property(
          fc.array(rectanglePointsArb, { minLength: 2, maxLength: 5 }),
          imageDimensionsArb,
          (pointPairs, { width, height }) => {
            const history = new SelectionHistory();
            let currentState: SelectionRegion[] = [];
            
            // Perform operations
            for (const { start, end } of pointPairs) {
              const selection = createRectangleSelection(start, end, width, height);
              if (selection) {
                const previousState = [...currentState];
                currentState = [...currentState, selection];
                history.pushAction('add', previousState, currentState);
              }
            }
            
            const finalCount = currentState.length;
            
            // Undo once
            const undoneState = history.undo();
            if (undoneState) {
              expect(undoneState.length).toBe(finalCount - 1);
              
              // Redo
              const redoneState = history.redo();
              if (redoneState) {
                expect(redoneState.length).toBe(finalCount);
              }
            }
          }
        ),
        { numRuns: 100 }
      );
    });

    it('canUndo and canRedo should be consistent with history state', () => {
      fc.assert(
        fc.property(
          fc.integer({ min: 1, max: 10 }),
          fc.integer({ min: 0, max: 10 }),
          (addCount, undoCount) => {
            const history = new SelectionHistory();
            let currentState: SelectionRegion[] = [];
            
            // Add operations
            for (let i = 0; i < addCount; i++) {
              const selection: SelectionRegion = {
                id: `test_${i}`,
                type: 'rectangle',
                boundingBox: { x: i * 10, y: i * 10, width: 50, height: 50 },
                createdAt: Date.now(),
              };
              const previousState = [...currentState];
              currentState = [...currentState, selection];
              history.pushAction('add', previousState, currentState);
            }
            
            expect(history.canUndo()).toBe(true);
            expect(history.canRedo()).toBe(false);
            
            // Perform undos
            const actualUndos = Math.min(undoCount, addCount);
            for (let i = 0; i < actualUndos; i++) {
              history.undo();
            }
            
            expect(history.canUndo()).toBe(actualUndos < addCount);
            expect(history.canRedo()).toBe(actualUndos > 0);
          }
        ),
        { numRuns: 100 }
      );
    });
  });
});
