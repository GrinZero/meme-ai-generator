/**
 * Feature: emoji-pack-generator, Property 2: API Config Validation
 * Validates: Requirements 1.6
 * 
 * For any API configuration input, if the apiKey is empty or the baseUrl is not a valid URL format,
 * validation should reject the input and return an error.
 */

import { describe, it, expect } from 'vitest';
import * as fc from 'fast-check';
import { validateAPIConfig, validateApiKey, validateBaseUrl } from './configValidation';

describe('API Config Validation', () => {
  /**
   * Property 2: API Config Validation
   * For any API configuration input, if the apiKey is empty or the baseUrl is not a valid URL format,
   * validation should reject the input and return an error.
   */
  describe('Property 2: API Config Validation', () => {
    // Property: Empty or whitespace-only API keys should always be rejected
    it('should reject empty or whitespace-only API keys', () => {
      fc.assert(
        fc.property(
          fc.array(fc.constantFrom(' ', '\t', '\n', '\r'), { minLength: 0, maxLength: 10 }).map(arr => arr.join('')),
          (whitespaceString) => {
            const error = validateApiKey(whitespaceString);
            expect(error).toBe('API Key 不能为空');
          }
        ),
        { numRuns: 100 }
      );
    });

    // Property: Non-empty API keys (with non-whitespace content) should be accepted
    it('should accept non-empty API keys with non-whitespace content', () => {
      fc.assert(
        fc.property(
          fc.string({ minLength: 1 }).filter((s) => s.trim().length > 0),
          (apiKey) => {
            const error = validateApiKey(apiKey);
            expect(error).toBeUndefined();
          }
        ),
        { numRuns: 100 }
      );
    });

    // Property: Valid URLs should be accepted
    it('should accept valid http/https URLs', () => {
      fc.assert(
        fc.property(
          fc.webUrl({ validSchemes: ['http', 'https'] }),
          (url) => {
            const error = validateBaseUrl(url);
            expect(error).toBeUndefined();
          }
        ),
        { numRuns: 100 }
      );
    });

    // Property: Invalid URL strings should be rejected
    it('should reject invalid URL formats', () => {
      fc.assert(
        fc.property(
          fc.string({ minLength: 1 }).filter((s) => {
            // Filter out strings that could be valid URLs
            try {
              const url = new URL(s);
              return url.protocol !== 'http:' && url.protocol !== 'https:';
            } catch {
              return true; // Invalid URL, keep it
            }
          }),
          (invalidUrl) => {
            const error = validateBaseUrl(invalidUrl);
            // Should either be undefined (empty) or an error message
            if (invalidUrl.trim() !== '') {
              expect(error).toBeDefined();
            }
          }
        ),
        { numRuns: 100 }
      );
    });

    // Property: Empty base URL should be accepted (it's optional)
    it('should accept empty base URL', () => {
      fc.assert(
        fc.property(
          fc.constantFrom('', '   ', '\t', '\n'),
          (emptyUrl) => {
            const error = validateBaseUrl(emptyUrl);
            expect(error).toBeUndefined();
          }
        ),
        { numRuns: 100 }
      );
    });

    // Property: Full validation should return isValid=false when apiKey is empty
    it('should return isValid=false when apiKey is empty regardless of baseUrl', () => {
      fc.assert(
        fc.property(
          fc.array(fc.constantFrom(' ', '\t', '\n', '\r', ''), { minLength: 0, maxLength: 10 }).map(arr => arr.join('')),
          fc.string(),
          (emptyApiKey, anyBaseUrl) => {
            const result = validateAPIConfig(emptyApiKey, anyBaseUrl);
            expect(result.isValid).toBe(false);
            expect(result.errors.apiKey).toBeDefined();
          }
        ),
        { numRuns: 100 }
      );
    });

    // Property: Full validation should return isValid=true when apiKey is valid and baseUrl is valid or empty
    it('should return isValid=true when apiKey is valid and baseUrl is valid or empty', () => {
      fc.assert(
        fc.property(
          fc.string({ minLength: 1 }).filter((s) => s.trim().length > 0),
          fc.oneof(
            fc.constant(''),
            fc.webUrl({ validSchemes: ['http', 'https'] })
          ),
          (validApiKey, validOrEmptyBaseUrl) => {
            const result = validateAPIConfig(validApiKey, validOrEmptyBaseUrl);
            expect(result.isValid).toBe(true);
            expect(result.errors.apiKey).toBeUndefined();
            expect(result.errors.baseUrl).toBeUndefined();
          }
        ),
        { numRuns: 100 }
      );
    });
  });
});
