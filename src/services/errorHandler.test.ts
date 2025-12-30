/**
 * Feature: emoji-pack-generator, Property 7: Error Message Display
 * Validates: Requirements 5.4
 * 
 * For any API error response, the system should display a non-empty, user-friendly error message
 * (not raw error codes or stack traces).
 */

import { describe, it, expect } from 'vitest';
import * as fc from 'fast-check';
import {
  getErrorInfo,
  inferErrorType,
  getUserFriendlyMessage,
  isUserFriendlyMessage,
} from './errorHandler';
import { getErrorMessage, AIError } from './aiService';
import type { AIErrorType } from './aiService';

// All possible error types
const ALL_ERROR_TYPES: AIErrorType[] = [
  'INVALID_API_KEY',
  'RATE_LIMIT',
  'NETWORK_ERROR',
  'TIMEOUT',
  'INVALID_RESPONSE',
  'CANCELLED',
  'UNKNOWN',
];

describe('Error Message Display', () => {
  /**
   * Property 7: Error Message Display
   * For any API error response, the system should display a non-empty, user-friendly error message
   * (not raw error codes or stack traces).
   */
  describe('Property 7: Error Message Display', () => {
    // Property: For any error type, getErrorMessage should return a non-empty string
    it('should return non-empty error messages for all error types', () => {
      fc.assert(
        fc.property(
          fc.constantFrom(...ALL_ERROR_TYPES),
          (errorType) => {
            const message = getErrorMessage(errorType);
            expect(message).toBeDefined();
            expect(typeof message).toBe('string');
            expect(message.length).toBeGreaterThan(0);
          }
        ),
        { numRuns: 100 }
      );
    });

    // Property: For any error type, the message should be user-friendly (no technical details)
    it('should return user-friendly messages without technical details', () => {
      fc.assert(
        fc.property(
          fc.constantFrom(...ALL_ERROR_TYPES),
          (errorType) => {
            const message = getErrorMessage(errorType);
            expect(isUserFriendlyMessage(message)).toBe(true);
          }
        ),
        { numRuns: 100 }
      );
    });

    // Property: For any error type, getErrorInfo should return complete error info
    it('should return complete error info for all error types', () => {
      fc.assert(
        fc.property(
          fc.constantFrom(...ALL_ERROR_TYPES),
          (errorType) => {
            const info = getErrorInfo(errorType);
            expect(info.type).toBe(errorType);
            expect(info.message).toBeDefined();
            expect(info.userMessage).toBeDefined();
            expect(typeof info.canRetry).toBe('boolean');
            expect(isUserFriendlyMessage(info.userMessage)).toBe(true);
          }
        ),
        { numRuns: 100 }
      );
    });

    // Property: For any AIError, getUserFriendlyMessage should return a user-friendly message
    it('should convert AIError to user-friendly message', () => {
      fc.assert(
        fc.property(
          fc.constantFrom(...ALL_ERROR_TYPES),
          fc.string({ minLength: 1, maxLength: 100 }),
          (errorType, errorMessage) => {
            const error = new AIError(errorType, errorMessage);
            const friendlyMessage = getUserFriendlyMessage(error);
            expect(friendlyMessage).toBeDefined();
            expect(friendlyMessage.length).toBeGreaterThan(0);
            expect(isUserFriendlyMessage(friendlyMessage)).toBe(true);
          }
        ),
        { numRuns: 100 }
      );
    });

    // Property: For any generic Error with technical message, getUserFriendlyMessage should sanitize it
    it('should sanitize technical error messages', () => {
      fc.assert(
        fc.property(
          fc.constantFrom(
            'Error: Something went wrong',
            'TypeError: undefined is not a function',
            'at Object.<anonymous> (/path/to/file.js:10:5)',
            '401 Unauthorized',
            '500 Internal Server Error',
            'null pointer exception',
            'stack trace: ...'
          ),
          (technicalMessage) => {
            const error = new Error(technicalMessage);
            const friendlyMessage = getUserFriendlyMessage(error);
            expect(friendlyMessage).toBeDefined();
            expect(friendlyMessage.length).toBeGreaterThan(0);
            expect(isUserFriendlyMessage(friendlyMessage)).toBe(true);
          }
        ),
        { numRuns: 100 }
      );
    });

    // Property: inferErrorType should correctly identify error types from error messages
    it('should correctly infer error types from error messages', () => {
      const errorPatterns: Array<{ pattern: string; expectedType: AIErrorType }> = [
        { pattern: 'Invalid API key', expectedType: 'INVALID_API_KEY' },
        { pattern: 'Unauthorized access', expectedType: 'INVALID_API_KEY' },
        { pattern: '401 error', expectedType: 'INVALID_API_KEY' },
        { pattern: 'Rate limit exceeded', expectedType: 'RATE_LIMIT' },
        { pattern: 'Quota exceeded', expectedType: 'RATE_LIMIT' },
        { pattern: '429 Too Many Requests', expectedType: 'RATE_LIMIT' },
        { pattern: 'Network error occurred', expectedType: 'NETWORK_ERROR' },
        { pattern: 'Failed to fetch', expectedType: 'NETWORK_ERROR' },
        { pattern: 'Connection refused', expectedType: 'NETWORK_ERROR' },
        { pattern: 'Request timeout', expectedType: 'TIMEOUT' },
        { pattern: 'Operation timed out', expectedType: 'TIMEOUT' },
        { pattern: 'Request cancelled', expectedType: 'CANCELLED' },
        { pattern: 'Operation aborted', expectedType: 'CANCELLED' },
        { pattern: 'Invalid response format', expectedType: 'INVALID_RESPONSE' },
      ];

      fc.assert(
        fc.property(
          fc.constantFrom(...errorPatterns),
          ({ pattern, expectedType }) => {
            const error = new Error(pattern);
            const inferredType = inferErrorType(error);
            expect(inferredType).toBe(expectedType);
          }
        ),
        { numRuns: 100 }
      );
    });

    // Property: For any unknown error, should return UNKNOWN type
    it('should return UNKNOWN type for unrecognized errors', () => {
      fc.assert(
        fc.property(
          fc.string({ minLength: 1, maxLength: 50 }).filter((s) => {
            const lower = s.toLowerCase();
            return !lower.includes('api key') &&
                   !lower.includes('unauthorized') &&
                   !lower.includes('401') &&
                   !lower.includes('rate') &&
                   !lower.includes('quota') &&
                   !lower.includes('429') &&
                   !lower.includes('network') &&
                   !lower.includes('fetch') &&
                   !lower.includes('connection') &&
                   !lower.includes('timeout') &&
                   !lower.includes('timed out') &&
                   !lower.includes('cancel') &&
                   !lower.includes('abort') &&
                   !lower.includes('invalid') &&
                   !lower.includes('response');
          }),
          (randomMessage) => {
            const error = new Error(randomMessage);
            const inferredType = inferErrorType(error);
            expect(inferredType).toBe('UNKNOWN');
          }
        ),
        { numRuns: 100 }
      );
    });

    // Property: User-friendly messages should not contain HTTP status codes
    it('should not contain HTTP status codes in user-friendly messages', () => {
      fc.assert(
        fc.property(
          fc.constantFrom(...ALL_ERROR_TYPES),
          (errorType) => {
            const message = getErrorMessage(errorType);
            // Should not contain 3-digit HTTP status codes
            expect(message).not.toMatch(/\b[1-5]\d{2}\b/);
          }
        ),
        { numRuns: 100 }
      );
    });

    // Property: User-friendly messages should not contain "Error:" prefix
    it('should not contain "Error:" prefix in user-friendly messages', () => {
      fc.assert(
        fc.property(
          fc.constantFrom(...ALL_ERROR_TYPES),
          (errorType) => {
            const message = getErrorMessage(errorType);
            expect(message).not.toMatch(/^Error:/i);
          }
        ),
        { numRuns: 100 }
      );
    });
  });
});
