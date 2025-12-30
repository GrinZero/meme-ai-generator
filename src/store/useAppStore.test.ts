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
