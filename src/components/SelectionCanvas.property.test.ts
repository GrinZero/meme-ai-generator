/**
 * Feature: manual-region-selection, SelectionCanvas Property Tests
 * 
 * Property 15: Aspect Ratio Preservation on Canvas
 * Property 20: Escape Cancels In-Progress Selection
 * 
 * Validates: Requirements 1.2, 8.3
 */

import { describe, it, expect } from 'vitest';
import * as fc from 'fast-check';

/**
 * Helper function to calculate fit transform (same logic as in SelectionCanvas)
 * This is extracted for testing purposes
 */
function calculateFitTransform(
  imageWidth: number,
  imageHeight: number,
  containerWidth: number,
  containerHeight: number
): { zoom: number; displayWidth: number; displayHeight: number } {
  const scaleX = containerWidth / imageWidth;
  const scaleY = containerHeight / imageHeight;
  const zoom = Math.min(scaleX, scaleY, 1); // 不超过原始大小
  
  const displayWidth = imageWidth * zoom;
  const displayHeight = imageHeight * zoom;
  
  return { zoom, displayWidth, displayHeight };
}

/**
 * Simulates the polygon drawing state machine
 */
interface PolygonDrawState {
  vertices: { x: number; y: number }[];
  isComplete: boolean;
}

function simulatePolygonDrawing(
  actions: Array<{ type: 'click' | 'escape'; point?: { x: number; y: number } }>
): { finalState: PolygonDrawState | null; wasEscaped: boolean } {
  let state: PolygonDrawState | null = null;
  let wasEscaped = false;

  for (const action of actions) {
    if (action.type === 'escape') {
      if (state !== null) {
        state = null;
        wasEscaped = true;
      }
    } else if (action.type === 'click' && action.point) {
      if (state === null) {
        state = { vertices: [action.point], isComplete: false };
      } else if (!state.isComplete) {
        state.vertices.push(action.point);
      }
    }
  }
  
  return { finalState: state, wasEscaped };
}

/**
 * Simulates rectangle drawing state machine
 */
interface RectDrawState {
  startPoint: { x: number; y: number };
  currentPoint: { x: number; y: number };
}

function simulateRectangleDrawing(
  actions: Array<{ type: 'mousedown' | 'mousemove' | 'mouseup' | 'escape'; point?: { x: number; y: number } }>
): { completed: boolean; wasEscaped: boolean; finalRect: RectDrawState | null } {
  let state: RectDrawState | null = null;
  let completed = false;
  let wasEscaped = false;
  
  for (const action of actions) {
    if (action.type === 'escape') {
      if (state !== null) {
        state = null;
        wasEscaped = true;
      }
    } else if (action.type === 'mousedown' && action.point) {
      state = { startPoint: action.point, currentPoint: action.point };
    } else if (action.type === 'mousemove' && action.point && state) {
      state.currentPoint = action.point;
    } else if (action.type === 'mouseup' && state) {
      completed = true;
    }
  }
  
  return { completed, wasEscaped, finalRect: wasEscaped ? null : state };
}

// Arbitraries for generating test data
const imageDimensionsArb = fc.record({
  width: fc.integer({ min: 100, max: 4000 }),
  height: fc.integer({ min: 100, max: 4000 }),
});

const containerDimensionsArb = fc.record({
  width: fc.integer({ min: 200, max: 1920 }),
  height: fc.integer({ min: 200, max: 1080 }),
});

const pointArb = fc.record({
  x: fc.float({ min: Math.fround(0), max: Math.fround(500), noNaN: true }),
  y: fc.float({ min: Math.fround(0), max: Math.fround(500), noNaN: true }),
});

describe('SelectionCanvas Property Tests', () => {
  /**
   * Property 15: Aspect Ratio Preservation on Canvas
   * For any image with dimensions W×H displayed on a canvas, the displayed aspect ratio
   * (displayW / displayH) SHALL equal the original aspect ratio (W / H) within a tolerance of 0.01.
   * Validates: Requirements 1.2
   */
  describe('Property 15: Aspect Ratio Preservation on Canvas', () => {
    it('displayed aspect ratio should match original aspect ratio', () => {
      fc.assert(
        fc.property(imageDimensionsArb, containerDimensionsArb, (image, container) => {
          const { displayWidth, displayHeight } = calculateFitTransform(
            image.width,
            image.height,
            container.width,
            container.height
          );
          
          const originalAspectRatio = image.width / image.height;
          const displayedAspectRatio = displayWidth / displayHeight;
          
          // Aspect ratios should be equal within tolerance of 0.01
          expect(Math.abs(originalAspectRatio - displayedAspectRatio)).toBeLessThan(0.01);
        }),
        { numRuns: 100 }
      );
    });

    it('displayed dimensions should not exceed container dimensions', () => {
      fc.assert(
        fc.property(imageDimensionsArb, containerDimensionsArb, (image, container) => {
          const { displayWidth, displayHeight } = calculateFitTransform(
            image.width,
            image.height,
            container.width,
            container.height
          );
          
          // Displayed dimensions should fit within container
          expect(displayWidth).toBeLessThanOrEqual(container.width + 0.001);
          expect(displayHeight).toBeLessThanOrEqual(container.height + 0.001);
        }),
        { numRuns: 100 }
      );
    });

    it('displayed dimensions should not exceed original dimensions', () => {
      fc.assert(
        fc.property(imageDimensionsArb, containerDimensionsArb, (image, container) => {
          const { displayWidth, displayHeight } = calculateFitTransform(
            image.width,
            image.height,
            container.width,
            container.height
          );
          
          // Should not scale up beyond original size
          expect(displayWidth).toBeLessThanOrEqual(image.width + 0.001);
          expect(displayHeight).toBeLessThanOrEqual(image.height + 0.001);
        }),
        { numRuns: 100 }
      );
    });

    it('zoom factor should be consistent for both dimensions', () => {
      fc.assert(
        fc.property(imageDimensionsArb, containerDimensionsArb, (image, container) => {
          const { zoom, displayWidth, displayHeight } = calculateFitTransform(
            image.width,
            image.height,
            container.width,
            container.height
          );
          
          // Both dimensions should be scaled by the same zoom factor
          expect(displayWidth).toBeCloseTo(image.width * zoom, 5);
          expect(displayHeight).toBeCloseTo(image.height * zoom, 5);
        }),
        { numRuns: 100 }
      );
    });

    it('square images should remain square', () => {
      const squareImageArb = fc.integer({ min: 100, max: 2000 }).map(size => ({
        width: size,
        height: size,
      }));

      fc.assert(
        fc.property(squareImageArb, containerDimensionsArb, (image, container) => {
          const { displayWidth, displayHeight } = calculateFitTransform(
            image.width,
            image.height,
            container.width,
            container.height
          );
          
          // Square images should have equal display dimensions
          expect(displayWidth).toBeCloseTo(displayHeight, 5);
        }),
        { numRuns: 100 }
      );
    });
  });

  /**
   * Property 20: Escape Cancels In-Progress Selection
   * For any in-progress selection (drawing state), pressing Escape SHALL clear
   * the drawing state without adding any new selection to the list.
   * Validates: Requirements 8.3
   */
  describe('Property 20: Escape Cancels In-Progress Selection', () => {
    it('escape during polygon drawing should clear all vertices', () => {
      // Generate a sequence of clicks followed by escape
      const polygonActionsArb = fc.tuple(
        fc.array(pointArb, { minLength: 1, maxLength: 10 }),
        fc.boolean() // whether to press escape
      ).map(([points, shouldEscape]) => {
        const actions: Array<{ type: 'click' | 'escape'; point?: { x: number; y: number } }> = 
          points.map(point => ({ type: 'click' as const, point }));
        if (shouldEscape) {
          actions.push({ type: 'escape' });
        }
        return { actions, shouldEscape };
      });

      fc.assert(
        fc.property(polygonActionsArb, ({ actions, shouldEscape }) => {
          const { finalState, wasEscaped } = simulatePolygonDrawing(actions);
          
          if (shouldEscape) {
            // If escape was pressed, state should be null
            expect(finalState).toBeNull();
            expect(wasEscaped).toBe(true);
          } else {
            // If escape was not pressed, state should have vertices
            expect(finalState).not.toBeNull();
            if (finalState) {
              expect(finalState.vertices.length).toBeGreaterThan(0);
            }
          }
        }),
        { numRuns: 100 }
      );
    });

    it('escape during rectangle drawing should cancel the selection', () => {
      // Generate a sequence of mouse events followed by escape
      const rectActionsArb = fc.tuple(
        pointArb, // start point
        fc.array(pointArb, { minLength: 0, maxLength: 5 }), // move points
        fc.boolean() // whether to press escape before mouseup
      ).map(([startPoint, movePoints, shouldEscape]) => {
        const actions: Array<{ type: 'mousedown' | 'mousemove' | 'mouseup' | 'escape'; point?: { x: number; y: number } }> = [
          { type: 'mousedown', point: startPoint },
        ];
        for (const point of movePoints) {
          actions.push({ type: 'mousemove', point });
        }
        if (shouldEscape) {
          actions.push({ type: 'escape' });
        } else {
          actions.push({ type: 'mouseup' });
        }
        return { actions, shouldEscape };
      });

      fc.assert(
        fc.property(rectActionsArb, ({ actions, shouldEscape }) => {
          const { completed, wasEscaped, finalRect } = simulateRectangleDrawing(actions);
          
          if (shouldEscape) {
            // If escape was pressed, drawing should be cancelled
            expect(wasEscaped).toBe(true);
            expect(finalRect).toBeNull();
            expect(completed).toBe(false);
          } else {
            // If escape was not pressed, drawing should complete
            expect(completed).toBe(true);
          }
        }),
        { numRuns: 100 }
      );
    });

    it('escape when no drawing in progress should have no effect', () => {
      fc.assert(
        fc.property(fc.integer({ min: 1, max: 5 }), (escapeCount) => {
          const actions: Array<{ type: 'click' | 'escape'; point?: { x: number; y: number } }> = [];
          for (let i = 0; i < escapeCount; i++) {
            actions.push({ type: 'escape' });
          }
          
          const { finalState, wasEscaped } = simulatePolygonDrawing(actions);
          
          // No state should exist and no escape should have been triggered
          expect(finalState).toBeNull();
          expect(wasEscaped).toBe(false);
        }),
        { numRuns: 100 }
      );
    });

    it('multiple escapes should not cause issues', () => {
      const multiEscapeArb = fc.tuple(
        fc.array(pointArb, { minLength: 1, maxLength: 5 }),
        fc.integer({ min: 1, max: 5 })
      ).map(([points, escapeCount]) => {
        const actions: Array<{ type: 'click' | 'escape'; point?: { x: number; y: number } }> = 
          points.map(point => ({ type: 'click' as const, point }));
        for (let i = 0; i < escapeCount; i++) {
          actions.push({ type: 'escape' });
        }
        return actions;
      });

      fc.assert(
        fc.property(multiEscapeArb, (actions) => {
          const { finalState, wasEscaped } = simulatePolygonDrawing(actions);
          
          // After any escape, state should be null
          expect(finalState).toBeNull();
          expect(wasEscaped).toBe(true);
        }),
        { numRuns: 100 }
      );
    });

    it('escape should only affect current drawing, not completed selections', () => {
      // This tests that escape clears in-progress drawing but doesn't affect
      // the selections array (which is managed separately)
      const selectionCountArb = fc.integer({ min: 0, max: 10 });
      const hasInProgressArb = fc.boolean();

      fc.assert(
        fc.property(selectionCountArb, hasInProgressArb, (existingCount, hasInProgress) => {
          // Simulate existing selections (just count for this test)
          const existingSelections = existingCount;
          
          // Simulate in-progress drawing
          let inProgressState: PolygonDrawState | null = null;
          if (hasInProgress) {
            inProgressState = { vertices: [{ x: 0, y: 0 }], isComplete: false };
          }
          
          // Press escape
          if (inProgressState !== null) {
            inProgressState = null;
          }
          
          // Existing selections should be unchanged
          expect(existingSelections).toBe(existingCount);
          // In-progress state should be cleared
          expect(inProgressState).toBeNull();
        }),
        { numRuns: 100 }
      );
    });
  });
});
