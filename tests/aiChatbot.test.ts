import { describe, expect, it } from 'vitest';
import { DEFAULT_GEMINI_MODEL, getGeminiModelCandidates, isMissingGeminiModelError } from '../src/ai/chatbot';

describe('AI provider model selection', () => {
  it('uses a Gemini model that is supported by generateContent as the default', () => {
    expect(DEFAULT_GEMINI_MODEL).toBe('gemini-2.5-flash');
    expect(DEFAULT_GEMINI_MODEL).not.toBe('gemini-3-flash');
  });

  it('keeps a configured Gemini model first but adds safe fallbacks', () => {
    expect(getGeminiModelCandidates('gemini-3-flash')).toEqual([
      'gemini-3-flash',
      'gemini-2.5-flash',
      'gemini-flash-latest',
      'gemini-2.0-flash',
    ]);
  });

  it('detects missing Gemini model errors so the bot can try another model', () => {
    expect(isMissingGeminiModelError({ status: 404, message: 'models/gemini-3-flash is not found' })).toBe(true);
    expect(isMissingGeminiModelError(new Error('quota exceeded'))).toBe(false);
  });
});
