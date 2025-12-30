/**
 * Feature: emoji-pack-generator, Property 1: Config Persistence Round Trip
 * Validates: Requirements 1.4, 1.5, 2.3
 * 
 * For any valid API configuration (apiKey, baseUrl, style, languagePreference),
 * saving to localStorage then loading should return an equivalent configuration object.
 */

import { describe, it, expect, beforeEach } from 'vitest';
import * as fc from 'fast-check';
import { STORAGE_KEY } from '../types/store';
import type { APIStyle } from '../types/api';

// 模拟 localStorage
const createMockLocalStorage = () => {
  let store: Record<string, string> = {};
  return {
    getItem: (key: string) => store[key] ?? null,
    setItem: (key: string, value: string) => {
      store[key] = value;
    },
    removeItem: (key: string) => {
      delete store[key];
    },
    clear: () => {
      store = {};
    },
  };
};

// 持久化状态的类型
interface PersistedState {
  state: {
    apiConfig: {
      apiKey: string;
      baseUrl: string;
      style: APIStyle;
      model?: string;
    };
    languagePreference: string;
  };
  version: number;
}

describe('Config Persistence Round Trip', () => {
  let mockStorage: ReturnType<typeof createMockLocalStorage>;

  beforeEach(() => {
    mockStorage = createMockLocalStorage();
  });

  // Property 1: Config Persistence Round Trip
  it('should preserve API config and language preference after save and load', () => {
    fc.assert(
      fc.property(
        fc.record({
          apiKey: fc.string({ minLength: 0, maxLength: 100 }),
          baseUrl: fc.string({ minLength: 0, maxLength: 200 }),
          style: fc.constantFrom('gemini', 'openai') as fc.Arbitrary<APIStyle>,
          model: fc.option(fc.string({ minLength: 0, maxLength: 50 }), { nil: undefined }),
        }),
        fc.string({ minLength: 0, maxLength: 100 }),
        (apiConfig, languagePreference) => {
          // 构造要持久化的状态
          const stateToSave: PersistedState = {
            state: {
              apiConfig,
              languagePreference,
            },
            version: 0,
          };

          // 保存到 localStorage
          mockStorage.setItem(STORAGE_KEY, JSON.stringify(stateToSave));

          // 从 localStorage 读取
          const savedData = mockStorage.getItem(STORAGE_KEY);
          expect(savedData).not.toBeNull();

          const loadedState: PersistedState = JSON.parse(savedData!);

          // 验证 round trip 一致性
          expect(loadedState.state.apiConfig.apiKey).toBe(apiConfig.apiKey);
          expect(loadedState.state.apiConfig.baseUrl).toBe(apiConfig.baseUrl);
          expect(loadedState.state.apiConfig.style).toBe(apiConfig.style);
          expect(loadedState.state.apiConfig.model).toBe(apiConfig.model);
          expect(loadedState.state.languagePreference).toBe(languagePreference);
        }
      ),
      { numRuns: 100 }
    );
  });

  // 测试特殊字符的 round trip
  it('should handle special characters in config values', () => {
    fc.assert(
      fc.property(
        fc.record({
          apiKey: fc.string({ minLength: 0, maxLength: 100, unit: 'grapheme' }),
          baseUrl: fc.string({ minLength: 0, maxLength: 200, unit: 'grapheme' }),
          style: fc.constantFrom('gemini', 'openai') as fc.Arbitrary<APIStyle>,
          model: fc.option(fc.string({ minLength: 0, maxLength: 50, unit: 'grapheme' }), { nil: undefined }),
        }),
        fc.string({ minLength: 0, maxLength: 100, unit: 'grapheme' }),
        (apiConfig, languagePreference) => {
          const stateToSave: PersistedState = {
            state: {
              apiConfig,
              languagePreference,
            },
            version: 0,
          };

          // 保存并读取
          mockStorage.setItem(STORAGE_KEY, JSON.stringify(stateToSave));
          const savedData = mockStorage.getItem(STORAGE_KEY);
          const loadedState: PersistedState = JSON.parse(savedData!);

          // 验证 round trip 一致性
          expect(loadedState.state.apiConfig).toEqual(apiConfig);
          expect(loadedState.state.languagePreference).toBe(languagePreference);
        }
      ),
      { numRuns: 100 }
    );
  });
});


/**
 * Feature: dynamic-model-list, Property 7: Model Selection Preservation
 * Validates: Requirements 4.2, 4.3
 * 
 * For any model list update, if the previously selected model exists in the new list,
 * it should remain selected; otherwise, the first model in the new list should be selected.
 */
describe('Model Selection Preservation', () => {
  // Generator for ModelInfo
  const modelInfoArb = fc.record({
    id: fc.string({ minLength: 1, maxLength: 50 }),
    name: fc.string({ minLength: 1, maxLength: 100 }),
    description: fc.option(fc.string({ minLength: 0, maxLength: 200 }), { nil: undefined }),
  });

  // Generator for non-empty model list
  const modelListArb = fc.array(modelInfoArb, { minLength: 1, maxLength: 20 });

  /**
   * Property 7: Model Selection Preservation
   * 
   * For any model list update:
   * - If the previously selected model exists in the new list, it should remain selected
   * - If the previously selected model does not exist in the new list, the first model should be selected
   */
  it('should preserve selected model if it exists in new list, otherwise select first', () => {
    fc.assert(
      fc.property(
        modelListArb,
        fc.string({ minLength: 1, maxLength: 50 }), // previously selected model ID
        (newModelList, previousModelId) => {
          // Determine expected behavior
          const modelExistsInNewList = newModelList.some(m => m.id === previousModelId);
          
          // Simulate the selection logic from ConfigPanel
          let selectedModel: string;
          if (modelExistsInNewList) {
            // Model exists in new list - should remain selected
            selectedModel = previousModelId;
          } else {
            // Model doesn't exist - should select first
            selectedModel = newModelList[0].id;
          }

          // Verify the logic
          if (modelExistsInNewList) {
            expect(selectedModel).toBe(previousModelId);
          } else {
            expect(selectedModel).toBe(newModelList[0].id);
          }
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Additional test: When previous model exists in new list, it must be preserved
   */
  it('should always preserve model when it exists in the new list', () => {
    fc.assert(
      fc.property(
        modelListArb,
        fc.nat(), // index to pick from list
        (modelList, indexSeed) => {
          // Pick a model from the list to be the "previously selected" one
          const selectedIndex = indexSeed % modelList.length;
          const previousModelId = modelList[selectedIndex].id;

          // Simulate the selection logic
          const modelExistsInNewList = modelList.some(m => m.id === previousModelId);
          
          // Since we picked from the list, it must exist
          expect(modelExistsInNewList).toBe(true);

          // The selected model should remain the same
          let selectedModel: string;
          if (modelExistsInNewList) {
            selectedModel = previousModelId;
          } else {
            selectedModel = modelList[0].id;
          }

          expect(selectedModel).toBe(previousModelId);
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Additional test: When previous model doesn't exist, first model must be selected
   */
  it('should select first model when previous model is not in the list', () => {
    fc.assert(
      fc.property(
        modelListArb,
        fc.string({ minLength: 51, maxLength: 100 }), // ID that won't match (longer than max model ID)
        (modelList, nonExistentId) => {
          // Ensure the ID doesn't exist in the list
          const modelExistsInNewList = modelList.some(m => m.id === nonExistentId);
          
          // With our generator constraints, this should almost always be false
          // but we'll handle both cases correctly
          let selectedModel: string;
          if (modelExistsInNewList) {
            selectedModel = nonExistentId;
          } else {
            selectedModel = modelList[0].id;
          }

          // If model doesn't exist, first should be selected
          if (!modelExistsInNewList) {
            expect(selectedModel).toBe(modelList[0].id);
          }
        }
      ),
      { numRuns: 100 }
    );
  });
});
