/**
 * Feature: emoji-pack-generator, Property 3: Prompt Composition
 * Validates: Requirements 2.2, 4.3
 * 
 * For any combination of language preference string and user prompt string,
 * the final generated prompt should contain both the language preference and
 * the user prompt as substrings.
 */

import { describe, it, expect } from 'vitest';
import * as fc from 'fast-check';
import { buildFullPrompt, buildSystemPrompt, getSystemPrompt } from './promptBuilder';

describe('Prompt Builder', () => {
  /**
   * Property 3: Prompt Composition
   * For any combination of language preference string and user prompt string,
   * the final generated prompt should contain both the language preference and
   * the user prompt as substrings.
   */
  describe('Property 3: Prompt Composition', () => {
    // Property: System prompt should always be included in the full prompt
    it('should always include system prompt in the full prompt', () => {
      fc.assert(
        fc.property(
          fc.string(),
          fc.string(),
          (languagePreference, userPrompt) => {
            const fullPrompt = buildFullPrompt({ languagePreference, userPrompt });
            const systemPrompt = getSystemPrompt();
            expect(fullPrompt).toContain(systemPrompt);
          }
        ),
        { numRuns: 100 }
      );
    });

    // Property: Non-empty language preference should be included in the full prompt
    it('should include non-empty language preference in the full prompt', () => {
      fc.assert(
        fc.property(
          fc.string({ minLength: 1 }).filter((s) => s.trim().length > 0),
          fc.string(),
          (languagePreference, userPrompt) => {
            const fullPrompt = buildFullPrompt({ languagePreference, userPrompt });
            expect(fullPrompt).toContain(languagePreference.trim());
          }
        ),
        { numRuns: 100 }
      );
    });

    // Property: Non-empty user prompt should be included in the full prompt
    it('should include non-empty user prompt in the full prompt', () => {
      fc.assert(
        fc.property(
          fc.string(),
          fc.string({ minLength: 1 }).filter((s) => s.trim().length > 0),
          (languagePreference, userPrompt) => {
            const fullPrompt = buildFullPrompt({ languagePreference, userPrompt });
            expect(fullPrompt).toContain(userPrompt.trim());
          }
        ),
        { numRuns: 100 }
      );
    });

    // Property: Both non-empty language preference and user prompt should be in the full prompt
    it('should include both language preference and user prompt when both are non-empty', () => {
      fc.assert(
        fc.property(
          fc.string({ minLength: 1 }).filter((s) => s.trim().length > 0),
          fc.string({ minLength: 1 }).filter((s) => s.trim().length > 0),
          (languagePreference, userPrompt) => {
            const fullPrompt = buildFullPrompt({ languagePreference, userPrompt });
            expect(fullPrompt).toContain(languagePreference.trim());
            expect(fullPrompt).toContain(userPrompt.trim());
          }
        ),
        { numRuns: 100 }
      );
    });

    // Property: Empty or whitespace-only strings should not add extra content
    it('should not add empty or whitespace-only strings to the prompt', () => {
      fc.assert(
        fc.property(
          fc.array(fc.constantFrom(' ', '\t', '\n', '\r', ''), { minLength: 0, maxLength: 10 }).map(arr => arr.join('')),
          fc.array(fc.constantFrom(' ', '\t', '\n', '\r', ''), { minLength: 0, maxLength: 10 }).map(arr => arr.join('')),
          (emptyLangPref, emptyUserPrompt) => {
            const fullPrompt = buildFullPrompt({ 
              languagePreference: emptyLangPref, 
              userPrompt: emptyUserPrompt 
            });
            const systemPrompt = getSystemPrompt();
            // The full prompt should just be the system prompt when both inputs are empty/whitespace
            expect(fullPrompt).toBe(systemPrompt);
          }
        ),
        { numRuns: 100 }
      );
    });
  });

  // Unit tests for buildSystemPrompt
  describe('buildSystemPrompt', () => {
    it('should return a non-empty string', () => {
      const systemPrompt = buildSystemPrompt();
      expect(systemPrompt).toBeTruthy();
      expect(typeof systemPrompt).toBe('string');
    });

    it('should contain key requirements for emoji generation', () => {
      const systemPrompt = buildSystemPrompt();
      expect(systemPrompt).toContain('纯色背景');
      expect(systemPrompt).toContain('网格');
      expect(systemPrompt).toContain('素材图');
      expect(systemPrompt).toContain('基准图');
    });
  });
});
