/**
 * Feature: manual-region-selection, Selection Store Property Tests
 * 
 * Property 9: Keyboard Deletion Removes Active Selection
 * Property 17: Store Update on Extraction
 * Property 18: Selection Count Display Accuracy
 * Property 19: Multi-Selection via Shift+Click
 * 
 * Validates: Requirements 4.4, 4.6, 7.6, 10.1
 */

import { describe, it, expect, beforeEach } from 'vitest';
import * as fc from 'fast-check';
import { useSelectionStore } from './useSelectionStore';

// Helper to reset store before each test
const resetStore = () => {
  useSelectionStore.getState().reset();
};

// Arbitrary for generating valid bounding boxes
const boundingBoxArb = fc.record({
  x: fc.float({ min: Math.fround(0), max: Math.fround(400), noNaN: true }),
  y: fc.float({ min: Math.fround(0), max: Math.fround(400), noNaN: true }),
  width: fc.float({ min: Math.fround(10), max: Math.fround(100), noNaN: true }),
  height: fc.float({ min: Math.fround(10), max: Math.fround(100), noNaN: true }),
});

// Arbitrary for generating selection region data (without id and createdAt)
const selectionDataArb = fc.record({
  type: fc.constantFrom('rectangle' as const, 'polygon' as const),
  boundingBox: boundingBoxArb,
  isSelected: fc.boolean(),
});

// Arbitrary for generating multiple selection data
const multipleSelectionsArb = fc.array(selectionDataArb, { minLength: 1, maxLength: 20 });

describe('Selection Store Property Tests', () => {
  beforeEach(() => {
    resetStore();
  });

  /**
   * Property 9: Keyboard Deletion Removes Active Selection
   * 
   * For any active selection in the selection list, pressing Delete or Backspace key
   * SHALL remove exactly that selection from the list, leaving all other selections unchanged.
   * 
   * Validates: Requirements 4.4, 8.5
   */
  describe('Property 9: Keyboard Deletion Removes Active Selection', () => {
    it('removing active selection should only remove that selection', () => {
      fc.assert(
        fc.property(
          multipleSelectionsArb,
          fc.nat(),
          (selectionsData, indexSeed) => {
            resetStore();
            const store = useSelectionStore.getState();
            
            // Add all selections
            const addedIds: string[] = [];
            for (const data of selectionsData) {
              const id = store.addSelection(data);
              addedIds.push(id);
            }
            
            // Pick a random selection to be active
            const activeIndex = indexSeed % addedIds.length;
            const activeId = addedIds[activeIndex];
            store.setActiveSelection(activeId);
            
            // Get state before removal
            const beforeCount = useSelectionStore.getState().selections.length;
            const otherIds = addedIds.filter((id) => id !== activeId);
            
            // Remove the active selection
            store.removeSelection(activeId);
            
            // Verify
            const afterState = useSelectionStore.getState();
            
            // Count should decrease by 1
            expect(afterState.selections.length).toBe(beforeCount - 1);
            
            // Active selection should be cleared
            expect(afterState.activeSelectionId).toBeNull();
            
            // All other selections should still exist
            for (const otherId of otherIds) {
              const exists = afterState.selections.some((s) => s.id === otherId);
              expect(exists).toBe(true);
            }
            
            // Removed selection should not exist
            const removedExists = afterState.selections.some((s) => s.id === activeId);
            expect(removedExists).toBe(false);
          }
        ),
        { numRuns: 100 }
      );
    });

    it('removing non-active selection should not affect active selection', () => {
      fc.assert(
        fc.property(
          fc.array(selectionDataArb, { minLength: 2, maxLength: 10 }),
          fc.nat(),
          fc.nat(),
          (selectionsData, activeIndexSeed, removeIndexSeed) => {
            resetStore();
            const store = useSelectionStore.getState();
            
            // Add all selections
            const addedIds: string[] = [];
            for (const data of selectionsData) {
              const id = store.addSelection(data);
              addedIds.push(id);
            }
            
            // Pick different indices for active and to-remove
            const activeIndex = activeIndexSeed % addedIds.length;
            let removeIndex = removeIndexSeed % addedIds.length;
            if (removeIndex === activeIndex) {
              removeIndex = (removeIndex + 1) % addedIds.length;
            }
            
            const activeId = addedIds[activeIndex];
            const removeId = addedIds[removeIndex];
            
            store.setActiveSelection(activeId);
            
            // Remove non-active selection
            store.removeSelection(removeId);
            
            // Active selection should remain unchanged
            const afterState = useSelectionStore.getState();
            expect(afterState.activeSelectionId).toBe(activeId);
          }
        ),
        { numRuns: 100 }
      );
    });
  });

  /**
   * Property 17: Store Update on Extraction
   * 
   * For any manual selection extraction that produces N emojis,
   * the extractedEmojis array in the store SHALL increase by exactly N items.
   * 
   * Note: This property tests the addSelection behavior which is the store's
   * contribution to the extraction flow. The actual emoji extraction is handled
   * by regionExtractor and emojiNormalizer services.
   * 
   * Validates: Requirements 10.1
   */
  describe('Property 17: Store Update on Extraction', () => {
    it('adding N selections should increase count by exactly N', () => {
      fc.assert(
        fc.property(
          multipleSelectionsArb,
          (selectionsData) => {
            resetStore();
            const store = useSelectionStore.getState();
            
            const initialCount = useSelectionStore.getState().selections.length;
            expect(initialCount).toBe(0);
            
            // Add all selections
            for (const data of selectionsData) {
              store.addSelection(data);
            }
            
            const finalCount = useSelectionStore.getState().selections.length;
            expect(finalCount).toBe(selectionsData.length);
          }
        ),
        { numRuns: 100 }
      );
    });

    it('each added selection should have valid structure', () => {
      fc.assert(
        fc.property(
          selectionDataArb,
          (selectionData) => {
            resetStore();
            const store = useSelectionStore.getState();
            
            const id = store.addSelection(selectionData);
            
            const selection = useSelectionStore.getState().selections.find((s) => s.id === id);
            
            // Verify required fields exist
            expect(selection).toBeDefined();
            expect(selection!.id).toBe(id);
            expect(selection!.id.length).toBeGreaterThan(0);
            expect(selection!.type).toBe(selectionData.type);
            expect(selection!.boundingBox).toBeDefined();
            expect(selection!.boundingBox.width).toBeGreaterThan(0);
            expect(selection!.boundingBox.height).toBeGreaterThan(0);
            expect(selection!.createdAt).toBeGreaterThan(0);
          }
        ),
        { numRuns: 100 }
      );
    });
  });

  /**
   * Property 18: Selection Count Display Accuracy
   * 
   * For any number of selections N in the selection list,
   * the displayed count in the tool panel SHALL equal N.
   * 
   * Validates: Requirements 7.6
   */
  describe('Property 18: Selection Count Display Accuracy', () => {
    it('getSelectionCount should always match actual selection count', () => {
      fc.assert(
        fc.property(
          multipleSelectionsArb,
          (selectionsData) => {
            resetStore();
            const store = useSelectionStore.getState();
            
            // Initially should be 0
            expect(store.getSelectionCount()).toBe(0);
            
            // Add selections one by one and verify count
            for (let i = 0; i < selectionsData.length; i++) {
              store.addSelection(selectionsData[i]);
              const expectedCount = i + 1;
              expect(useSelectionStore.getState().getSelectionCount()).toBe(expectedCount);
              expect(useSelectionStore.getState().selections.length).toBe(expectedCount);
            }
          }
        ),
        { numRuns: 100 }
      );
    });

    it('count should decrease correctly after removals', () => {
      fc.assert(
        fc.property(
          fc.array(selectionDataArb, { minLength: 2, maxLength: 10 }),
          fc.nat(),
          (selectionsData, removeCountSeed) => {
            resetStore();
            const store = useSelectionStore.getState();
            
            // Add all selections
            const addedIds: string[] = [];
            for (const data of selectionsData) {
              const id = store.addSelection(data);
              addedIds.push(id);
            }
            
            const initialCount = selectionsData.length;
            const removeCount = (removeCountSeed % (initialCount - 1)) + 1; // Remove at least 1
            
            // Remove some selections
            for (let i = 0; i < removeCount; i++) {
              useSelectionStore.getState().removeSelection(addedIds[i]);
            }
            
            const expectedCount = initialCount - removeCount;
            expect(useSelectionStore.getState().getSelectionCount()).toBe(expectedCount);
            expect(useSelectionStore.getState().selections.length).toBe(expectedCount);
          }
        ),
        { numRuns: 100 }
      );
    });

    it('clearAll should set count to 0', () => {
      fc.assert(
        fc.property(
          multipleSelectionsArb,
          (selectionsData) => {
            resetStore();
            const store = useSelectionStore.getState();
            
            // Add selections
            for (const data of selectionsData) {
              store.addSelection(data);
            }
            
            expect(useSelectionStore.getState().getSelectionCount()).toBe(selectionsData.length);
            
            // Clear all
            useSelectionStore.getState().clearAll();
            
            expect(useSelectionStore.getState().getSelectionCount()).toBe(0);
            expect(useSelectionStore.getState().selections.length).toBe(0);
          }
        ),
        { numRuns: 100 }
      );
    });
  });

  /**
   * Property 19: Multi-Selection via Shift+Click
   * 
   * For any sequence of Shift+Click operations on K different selections,
   * exactly those K selections SHALL be marked as selected (isSelected = true).
   * 
   * Validates: Requirements 4.6
   */
  describe('Property 19: Multi-Selection via Shift+Click', () => {
    it('shift+click should toggle selection without affecting others', () => {
      fc.assert(
        fc.property(
          fc.array(selectionDataArb, { minLength: 3, maxLength: 10 }),
          fc.array(fc.nat(), { minLength: 1, maxLength: 5 }),
          (selectionsData, clickIndices) => {
            resetStore();
            const store = useSelectionStore.getState();
            
            // Add all selections
            const addedIds: string[] = [];
            for (const data of selectionsData) {
              const id = store.addSelection(data);
              addedIds.push(id);
            }
            
            // Track which selections should be selected
            const selectedSet = new Set<string>();
            
            // Perform shift+clicks
            for (const indexSeed of clickIndices) {
              const index = indexSeed % addedIds.length;
              const id = addedIds[index];
              
              // Toggle in our tracking set
              if (selectedSet.has(id)) {
                selectedSet.delete(id);
              } else {
                selectedSet.add(id);
              }
              
              // Perform shift+click (multiSelect = true)
              useSelectionStore.getState().toggleSelectionSelected(id, true);
            }
            
            // Verify selections match our tracking
            const finalState = useSelectionStore.getState();
            for (const selection of finalState.selections) {
              const shouldBeSelected = selectedSet.has(selection.id);
              expect(selection.isSelected).toBe(shouldBeSelected);
            }
          }
        ),
        { numRuns: 100 }
      );
    });

    it('non-shift click should deselect all others', () => {
      fc.assert(
        fc.property(
          fc.array(selectionDataArb, { minLength: 3, maxLength: 10 }),
          fc.nat(),
          (selectionsData, clickIndexSeed) => {
            resetStore();
            const store = useSelectionStore.getState();
            
            // Add all selections
            const addedIds: string[] = [];
            for (const data of selectionsData) {
              const id = store.addSelection(data);
              addedIds.push(id);
            }
            
            // First, select multiple with shift+click
            for (let i = 0; i < Math.min(3, addedIds.length); i++) {
              useSelectionStore.getState().toggleSelectionSelected(addedIds[i], true);
            }
            
            // Now do a non-shift click on a random selection
            const clickIndex = clickIndexSeed % addedIds.length;
            const clickedId = addedIds[clickIndex];
            useSelectionStore.getState().toggleSelectionSelected(clickedId, false);
            
            // Verify only the clicked selection is selected
            const finalState = useSelectionStore.getState();
            for (const selection of finalState.selections) {
              if (selection.id === clickedId) {
                expect(selection.isSelected).toBe(true);
              } else {
                expect(selection.isSelected).toBe(false);
              }
            }
          }
        ),
        { numRuns: 100 }
      );
    });

    it('count of selected items should match shift+click operations', () => {
      fc.assert(
        fc.property(
          fc.array(selectionDataArb, { minLength: 5, maxLength: 15 }),
          fc.array(fc.nat(), { minLength: 1, maxLength: 8 }),
          (selectionsData, uniqueClickIndices) => {
            resetStore();
            const store = useSelectionStore.getState();
            
            // Add all selections
            const addedIds: string[] = [];
            for (const data of selectionsData) {
              const id = store.addSelection(data);
              addedIds.push(id);
            }
            
            // Get unique indices to click (no toggling back)
            const clickedIndices = new Set<number>();
            for (const indexSeed of uniqueClickIndices) {
              clickedIndices.add(indexSeed % addedIds.length);
            }
            
            // Perform shift+clicks on unique selections
            for (const index of clickedIndices) {
              useSelectionStore.getState().toggleSelectionSelected(addedIds[index], true);
            }
            
            // Count selected
            const finalState = useSelectionStore.getState();
            const selectedCount = finalState.selections.filter((s) => s.isSelected).length;
            
            expect(selectedCount).toBe(clickedIndices.size);
          }
        ),
        { numRuns: 100 }
      );
    });
  });
});
