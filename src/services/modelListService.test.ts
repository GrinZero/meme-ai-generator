/**
 * Model List Service Tests
 * 
 * Property-based tests for model list service functionality
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import * as fc from 'fast-check';
import {
  buildGeminiModelsUrl,
  buildOpenAIModelsUrl,
  filterGeminiModels,
  clearCache,
  fetchModels,
  generateCacheKey,
  getDefaultModels,
  DEFAULT_GEMINI_MODELS,
  DEFAULT_OPENAI_MODELS,
} from './modelListService';
import type { APIStyle } from '../types/api';

// Mock OpenAI SDK
vi.mock('openai', () => {
  const mockList = vi.fn();
  return {
    default: vi.fn().mockImplementation(() => ({
      models: {
        list: mockList,
      },
    })),
    __mockList: mockList,
  };
});

// Custom arbitrary for clean URLs (no trailing slashes, no double slashes in path)
const cleanWebUrl = fc.webUrl({ validSchemes: ['http', 'https'] })
  .filter(url => {
    try {
      const parsed = new URL(url);
      // Filter out URLs with double slashes in path or trailing slashes
      return !parsed.pathname.includes('//') && !url.endsWith('/');
    } catch {
      return false;
    }
  });

describe('Model List Service', () => {
  beforeEach(() => {
    clearCache();
    vi.clearAllMocks();
  });

  /**
   * Feature: dynamic-model-list, Property 5: URL Construction
   * Validates: Requirements 2.3, 3.3
   * 
   * For any base URL (including empty string for default), the constructed models endpoint URL
   * should be valid and follow the pattern: {baseUrl}/v1beta/models for Gemini or {baseUrl}/v1/models for OpenAI.
   */
  describe('Property 5: URL Construction', () => {
    // Property: Gemini URL should always end with /v1beta/models?key=
    it('should construct valid Gemini URL with correct path pattern', () => {
      fc.assert(
        fc.property(
          fc.oneof(
            fc.constant(''),
            cleanWebUrl
          ),
          fc.string({ minLength: 1 }).filter(s => s.trim().length > 0),
          (baseUrl, apiKey) => {
            const url = buildGeminiModelsUrl(baseUrl, apiKey);
            
            // URL should be parseable
            expect(() => new URL(url)).not.toThrow();
            
            // URL should contain the correct path
            expect(url).toContain('/v1beta/models');
            
            // URL should contain the API key as query parameter
            expect(url).toContain(`key=${apiKey}`);
            
            // If baseUrl is provided, it should be used as the base
            if (baseUrl) {
              const cleanBaseUrl = baseUrl.replace(/\/+$/, '');
              expect(url.startsWith(cleanBaseUrl)).toBe(true);
            } else {
              // Default should be Google's API
              expect(url.startsWith('https://generativelanguage.googleapis.com')).toBe(true);
            }
          }
        ),
        { numRuns: 100 }
      );
    });

    // Property: OpenAI URL should always end with /v1/models
    it('should construct valid OpenAI URL with correct path pattern', () => {
      fc.assert(
        fc.property(
          fc.oneof(
            fc.constant(''),
            cleanWebUrl
          ),
          (baseUrl) => {
            const url = buildOpenAIModelsUrl(baseUrl);
            
            // URL should be parseable
            expect(() => new URL(url)).not.toThrow();
            
            // URL should end with /v1/models
            expect(url).toContain('/v1/models');
            
            // If baseUrl is provided, it should be used as the base
            if (baseUrl) {
              const cleanBaseUrl = baseUrl.replace(/\/+$/, '');
              expect(url.startsWith(cleanBaseUrl)).toBe(true);
            } else {
              // Default should be OpenAI's API
              expect(url.startsWith('https://api.openai.com')).toBe(true);
            }
          }
        ),
        { numRuns: 100 }
      );
    });

    // Property: Trailing slashes in baseUrl should be handled correctly
    it('should handle trailing slashes in baseUrl correctly', () => {
      fc.assert(
        fc.property(
          cleanWebUrl,
          fc.integer({ min: 1, max: 5 }),
          fc.string({ minLength: 1 }).filter(s => s.trim().length > 0),
          (baseUrl, numSlashes, apiKey) => {
            // Add trailing slashes to the URL
            const urlWithSlashes = baseUrl + '/'.repeat(numSlashes);
            
            const geminiUrl = buildGeminiModelsUrl(urlWithSlashes, apiKey);
            const openaiUrl = buildOpenAIModelsUrl(urlWithSlashes);
            
            // The constructed URL should not have double slashes in the path
            // (except in the protocol part)
            const geminiPath = geminiUrl.replace(/^https?:\/\//, '');
            const openaiPath = openaiUrl.replace(/^https?:\/\//, '');
            
            expect(geminiPath).not.toContain('//');
            expect(openaiPath).not.toContain('//');
          }
        ),
        { numRuns: 100 }
      );
    });
  });

  /**
   * Feature: dynamic-model-list, Property 6: Gemini Model Filtering
   * Validates: Requirements 2.2
   * 
   * For any Gemini API response, only models with supportedGenerationMethods
   * containing generateContent should be included in the result.
   */
  describe('Property 6: Gemini Model Filtering', () => {
    // Generator for Gemini model objects
    const geminiModelArb = fc.record({
      name: fc.string({ minLength: 1 }).map(s => `models/${s}`),
      displayName: fc.string({ minLength: 1 }),
      description: fc.string(),
      supportedGenerationMethods: fc.array(
        fc.constantFrom('generateContent', 'embedContent', 'countTokens', 'createTunedModel'),
        { minLength: 0, maxLength: 4 }
      ),
    });

    // Property: Only models with generateContent should be included
    it('should only include models that support generateContent', () => {
      fc.assert(
        fc.property(
          fc.array(geminiModelArb, { minLength: 0, maxLength: 20 }),
          (models) => {
            const filtered = filterGeminiModels(models);
            
            // All filtered models should have had generateContent in their methods
            for (const filteredModel of filtered) {
              const originalModel = models.find(
                m => m.name.replace(/^models\//, '') === filteredModel.id
              );
              expect(originalModel).toBeDefined();
              expect(originalModel!.supportedGenerationMethods).toContain('generateContent');
            }
            
            // Count models without generateContent
            const modelsWithoutGenerateContent = models.filter(
              m => !m.supportedGenerationMethods.includes('generateContent')
            );
            
            // For models without generateContent, check they're not in filtered result
            // But we need to handle duplicate IDs - if a model ID appears multiple times,
            // it might be in filtered if ANY model with that ID has generateContent
            for (const model of modelsWithoutGenerateContent) {
              const modelId = model.name.replace(/^models\//, '');
              // Check if there's another model with same ID that HAS generateContent
              const hasDuplicateWithGenerateContent = models.some(
                m => m.name.replace(/^models\//, '') === modelId && 
                     m.supportedGenerationMethods.includes('generateContent')
              );
              
              if (!hasDuplicateWithGenerateContent) {
                const inFiltered = filtered.some(f => f.id === modelId);
                expect(inFiltered).toBe(false);
              }
            }
          }
        ),
        { numRuns: 100 }
      );
    });

    // Property: Model ID should have "models/" prefix removed
    it('should remove models/ prefix from model IDs', () => {
      fc.assert(
        fc.property(
          fc.array(
            fc.record({
              name: fc.string({ minLength: 1 }).map(s => `models/${s.replace(/\//g, '-')}`),
              displayName: fc.string({ minLength: 1 }),
              description: fc.string(),
              supportedGenerationMethods: fc.constant(['generateContent'] as string[]),
            }),
            { minLength: 1, maxLength: 10 }
          ),
          (models) => {
            const filtered = filterGeminiModels(models);
            
            // No filtered model ID should start with "models/"
            for (const model of filtered) {
              expect(model.id.startsWith('models/')).toBe(false);
            }
          }
        ),
        { numRuns: 100 }
      );
    });

    // Property: Filtered count should be <= original count
    it('should return at most as many models as input', () => {
      fc.assert(
        fc.property(
          fc.array(geminiModelArb, { minLength: 0, maxLength: 20 }),
          (models) => {
            const filtered = filterGeminiModels(models);
            expect(filtered.length).toBeLessThanOrEqual(models.length);
          }
        ),
        { numRuns: 100 }
      );
    });
  });

  /**
   * Feature: dynamic-model-list, Property 4: Cache Prevents Duplicate Requests
   * Validates: Requirements 1.7
   * 
   * For any sequence of fetch requests with identical configuration (apiKey, style, baseUrl),
   * only the first request should hit the API; subsequent requests within the cache TTL
   * should return cached results.
   */
  describe('Property 4: Cache Prevents Duplicate Requests', () => {
    // Property: Cache key generation is deterministic
    it('should generate identical cache keys for identical configs', () => {
      fc.assert(
        fc.property(
          fc.constantFrom('gemini', 'openai') as fc.Arbitrary<APIStyle>,
          fc.string({ minLength: 1, maxLength: 50 }),
          fc.string({ minLength: 0, maxLength: 100 }),
          (style, apiKey, baseUrl) => {
            const key1 = generateCacheKey(style, apiKey, baseUrl);
            const key2 = generateCacheKey(style, apiKey, baseUrl);
            
            expect(key1).toBe(key2);
          }
        ),
        { numRuns: 100 }
      );
    });

    // Property: Different configs produce different cache keys
    it('should generate different cache keys for different configs', () => {
      fc.assert(
        fc.property(
          fc.constantFrom('gemini', 'openai') as fc.Arbitrary<APIStyle>,
          fc.string({ minLength: 1, maxLength: 50 }),
          fc.string({ minLength: 0, maxLength: 100 }),
          fc.string({ minLength: 1, maxLength: 50 }).filter(s => s.length > 0),
          (style, apiKey, baseUrl, differentApiKey) => {
            // Only test when apiKeys are actually different
            fc.pre(apiKey !== differentApiKey);
            
            const key1 = generateCacheKey(style, apiKey, baseUrl);
            const key2 = generateCacheKey(style, differentApiKey, baseUrl);
            
            expect(key1).not.toBe(key2);
          }
        ),
        { numRuns: 100 }
      );
    });

    // Property: Cached results prevent duplicate API calls
    it('should return cached results for identical configs within TTL', async () => {
      // Clear cache before test
      clearCache();
      
      // Mock fetch to track calls
      let fetchCallCount = 0;
      
      const originalFetch = global.fetch;
      global.fetch = vi.fn().mockImplementation(() => {
        fetchCallCount++;
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve({
            models: [{
              name: 'models/test-model',
              displayName: 'Test Model',
              description: 'A test model',
              supportedGenerationMethods: ['generateContent'],
            }],
          }),
        });
      });

      try {
        const config = {
          apiKey: 'test-api-key',
          baseUrl: '',
          style: 'gemini' as APIStyle,
          model: '',
        };

        // First call should hit the API
        const result1 = await fetchModels(config);
        expect(result1.success).toBe(true);
        expect(fetchCallCount).toBe(1);

        // Second call with same config should use cache
        const result2 = await fetchModels(config);
        expect(result2.success).toBe(true);
        expect(fetchCallCount).toBe(1); // Still 1, cache was used

        // Third call with same config should still use cache
        const result3 = await fetchModels(config);
        expect(result3.success).toBe(true);
        expect(fetchCallCount).toBe(1); // Still 1, cache was used

        // Results should be equivalent
        expect(result1.models).toEqual(result2.models);
        expect(result2.models).toEqual(result3.models);
      } finally {
        global.fetch = originalFetch;
      }
    });

    // Property: Different configs should make separate API calls
    it('should make separate API calls for different configs', async () => {
      // Clear cache before test
      clearCache();
      
      let fetchCallCount = 0;
      
      const originalFetch = global.fetch;
      global.fetch = vi.fn().mockImplementation(() => {
        fetchCallCount++;
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve({
            models: [{
              name: 'models/test-model',
              displayName: 'Test Model',
              description: 'A test model',
              supportedGenerationMethods: ['generateContent'],
            }],
          }),
        });
      });

      try {
        const config1 = {
          apiKey: 'api-key-1',
          baseUrl: '',
          style: 'gemini' as APIStyle,
          model: '',
        };

        const config2 = {
          apiKey: 'api-key-2',
          baseUrl: '',
          style: 'gemini' as APIStyle,
          model: '',
        };

        // First call with config1
        await fetchModels(config1);
        expect(fetchCallCount).toBe(1);

        // Call with different config should hit API
        await fetchModels(config2);
        expect(fetchCallCount).toBe(2);

        // Call with config1 again should use cache
        await fetchModels(config1);
        expect(fetchCallCount).toBe(2); // Still 2, cache was used

        // Call with config2 again should use cache
        await fetchModels(config2);
        expect(fetchCallCount).toBe(2); // Still 2, cache was used
      } finally {
        global.fetch = originalFetch;
      }
    });

    // Property: clearCache should invalidate all cached entries
    it('should invalidate cache when clearCache is called', async () => {
      // Clear cache before test
      clearCache();
      
      let fetchCallCount = 0;
      
      const originalFetch = global.fetch;
      global.fetch = vi.fn().mockImplementation(() => {
        fetchCallCount++;
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve({
            models: [{
              name: 'models/test-model',
              displayName: 'Test Model',
              description: 'A test model',
              supportedGenerationMethods: ['generateContent'],
            }],
          }),
        });
      });

      try {
        const config = {
          apiKey: 'test-api-key',
          baseUrl: '',
          style: 'gemini' as APIStyle,
          model: '',
        };

        // First call should hit the API
        await fetchModels(config);
        expect(fetchCallCount).toBe(1);

        // Second call should use cache
        await fetchModels(config);
        expect(fetchCallCount).toBe(1);

        // Clear cache
        clearCache();

        // Third call should hit API again
        await fetchModels(config);
        expect(fetchCallCount).toBe(2);
      } finally {
        global.fetch = originalFetch;
      }
    });
  });

  /**
   * Feature: dynamic-model-list, Property 3: Fetch Failure Fallback
   * Validates: Requirements 1.4
   * 
   * For any failed API request (network error, invalid response, etc.), the system should
   * fall back to the default preset model list and set an error message.
   */
  describe('Property 3: Fetch Failure Fallback', () => {
    // Generator for error types
    const errorTypeArb = fc.constantFrom(
      'network',
      'unauthorized',
      'rate_limit',
      'server_error',
      'invalid_response'
    );

    // Property: Any fetch failure should return success=false with error message
    it('should return failure result with error message for any API error', async () => {
      await fc.assert(
        fc.asyncProperty(
          // Only test gemini style since OpenAI uses SDK which is harder to mock in property tests
          fc.constant('gemini' as APIStyle),
          fc.string({ minLength: 1, maxLength: 50 }),
          errorTypeArb,
          async (style, apiKey, errorType) => {
            // Clear cache before each test
            clearCache();
            
            const originalFetch = global.fetch;
            
            // Mock fetch to simulate different error types
            global.fetch = vi.fn().mockImplementation(() => {
              switch (errorType) {
                case 'network':
                  return Promise.reject(new Error('Failed to fetch'));
                case 'unauthorized':
                  return Promise.resolve({
                    ok: false,
                    status: 401,
                    json: () => Promise.resolve({ error: 'Unauthorized' }),
                  });
                case 'rate_limit':
                  return Promise.resolve({
                    ok: false,
                    status: 429,
                    json: () => Promise.resolve({ error: 'Rate limited' }),
                  });
                case 'server_error':
                  return Promise.resolve({
                    ok: false,
                    status: 500,
                    json: () => Promise.resolve({ error: 'Server error' }),
                  });
                case 'invalid_response':
                  return Promise.resolve({
                    ok: true,
                    json: () => Promise.resolve({ invalid: 'response' }),
                  });
                default:
                  return Promise.reject(new Error('Unknown error'));
              }
            });

            try {
              const config = {
                apiKey,
                baseUrl: '',
                style,
                model: '',
              };

              const result = await fetchModels(config);
              
              // Result should indicate failure
              expect(result.success).toBe(false);
              
              // Error message should be set
              expect(result.error).toBeDefined();
              expect(typeof result.error).toBe('string');
              expect(result.error!.length).toBeGreaterThan(0);
            } finally {
              global.fetch = originalFetch;
            }
          }
        ),
        { numRuns: 50 }
      );
    });

    // Property: getDefaultModels returns correct defaults for each style
    it('should return correct default models for each API style', () => {
      fc.assert(
        fc.property(
          fc.constantFrom('gemini', 'openai') as fc.Arbitrary<APIStyle>,
          (style) => {
            const defaults = getDefaultModels(style);
            
            // Should return non-empty array
            expect(defaults.length).toBeGreaterThan(0);
            
            // Each model should have id and name
            for (const model of defaults) {
              expect(model.id).toBeDefined();
              expect(typeof model.id).toBe('string');
              expect(model.id.length).toBeGreaterThan(0);
              
              expect(model.name).toBeDefined();
              expect(typeof model.name).toBe('string');
              expect(model.name.length).toBeGreaterThan(0);
            }
            
            // Should match the expected defaults
            if (style === 'gemini') {
              expect(defaults).toEqual(DEFAULT_GEMINI_MODELS);
            } else {
              expect(defaults).toEqual(DEFAULT_OPENAI_MODELS);
            }
          }
        ),
        { numRuns: 100 }
      );
    });

    // Property: Network errors should return fallback-compatible result (Gemini only)
    it('should handle network errors gracefully', async () => {
      await fc.assert(
        fc.asyncProperty(
          // Only test gemini style since OpenAI uses SDK
          fc.constant('gemini' as APIStyle),
          fc.string({ minLength: 1, maxLength: 50 }),
          fc.constantFrom(
            'Failed to fetch',
            'network error',
            'NetworkError',
            'ECONNREFUSED'
          ),
          async (style, apiKey, errorMessage) => {
            clearCache();
            
            const originalFetch = global.fetch;
            global.fetch = vi.fn().mockImplementation(() => {
              return Promise.reject(new Error(errorMessage));
            });

            try {
              const config = {
                apiKey,
                baseUrl: '',
                style,
                model: '',
              };

              const result = await fetchModels(config);
              
              // Should return failure
              expect(result.success).toBe(false);
              
              // Should have error message
              expect(result.error).toBeDefined();
            } finally {
              global.fetch = originalFetch;
            }
          }
        ),
        { numRuns: 50 }
      );
    });

    // Property: HTTP error status codes should return appropriate error messages (Gemini only)
    it('should return appropriate error messages for HTTP error status codes', async () => {
      await fc.assert(
        fc.asyncProperty(
          // Only test gemini style since OpenAI uses SDK
          fc.constant('gemini' as APIStyle),
          fc.string({ minLength: 1, maxLength: 50 }),
          fc.constantFrom(400, 401, 403, 404, 429, 500, 502, 503),
          async (style, apiKey, statusCode) => {
            clearCache();
            
            const originalFetch = global.fetch;
            global.fetch = vi.fn().mockImplementation(() => {
              return Promise.resolve({
                ok: false,
                status: statusCode,
                json: () => Promise.resolve({ error: 'Error' }),
              });
            });

            try {
              const config = {
                apiKey,
                baseUrl: '',
                style,
                model: '',
              };

              const result = await fetchModels(config);
              
              // Should return failure
              expect(result.success).toBe(false);
              
              // Should have error message
              expect(result.error).toBeDefined();
              expect(result.error!.length).toBeGreaterThan(0);
              
              // Specific status codes should have specific messages
              if (statusCode === 401 || statusCode === 403) {
                expect(result.error).toContain('API Key');
              } else if (statusCode === 429) {
                expect(result.error).toContain('频繁');
              }
            } finally {
              global.fetch = originalFetch;
            }
          }
        ),
        { numRuns: 50 }
      );
    });

    // Test OpenAI SDK error handling separately
    it('should handle OpenAI SDK errors correctly', async () => {
      clearCache();
      
      // For OpenAI style, we test that errors are handled gracefully
      // The actual SDK is mocked, so we just verify the error handling path works
      const config = {
        apiKey: 'test-key',
        baseUrl: '',
        style: 'openai' as APIStyle,
        model: '',
      };

      // The mock will throw an error, and we should get a failure result
      const result = await fetchModels(config);
      
      // Should return failure since the mock throws
      expect(result.success).toBe(false);
      expect(result.error).toBeDefined();
    });
  });
});
