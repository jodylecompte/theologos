import { describe, it, expect } from 'vitest';
import {
  promoteHeading,
  demoteHeading,
  markParagraph,
  dehyphenate,
  fixDropCap,
  applyTransform,
} from './text-transforms';

describe('Text Transforms', () => {
  describe('promoteHeading', () => {
    it('should add # prefix to single line', () => {
      const input = 'Chapter One';
      const expected = '# Chapter One';
      expect(promoteHeading(input)).toBe(expected);
    });

    it('should add # prefix to multiple lines', () => {
      const input = 'Line 1\nLine 2\nLine 3';
      const expected = '# Line 1\n# Line 2\n# Line 3';
      expect(promoteHeading(input)).toBe(expected);
    });

    it('should preserve empty lines', () => {
      const input = 'Line 1\n\nLine 3';
      const expected = '# Line 1\n\n# Line 3';
      expect(promoteHeading(input)).toBe(expected);
    });

    it('should handle already-marked headings', () => {
      const input = '# Already a heading';
      const expected = '# # Already a heading';
      expect(promoteHeading(input)).toBe(expected);
    });
  });

  describe('demoteHeading', () => {
    it('should remove single # from line', () => {
      const input = '# Chapter One';
      const expected = 'Chapter One';
      expect(demoteHeading(input)).toBe(expected);
    });

    it('should remove multiple # from line', () => {
      const input = '### Deep Heading';
      const expected = 'Deep Heading';
      expect(demoteHeading(input)).toBe(expected);
    });

    it('should handle # without space', () => {
      const input = '#NoSpace';
      const expected = 'NoSpace';
      expect(demoteHeading(input)).toBe(expected);
    });

    it('should not affect lines without #', () => {
      const input = 'Regular text';
      expect(demoteHeading(input)).toBe(input);
    });

    it('should handle multiple lines', () => {
      const input = '# Heading 1\n## Heading 2\nNormal text';
      const expected = 'Heading 1\nHeading 2\nNormal text';
      expect(demoteHeading(input)).toBe(expected);
    });
  });

  describe('markParagraph', () => {
    it('should add ¶ prefix to single line', () => {
      const input = 'First paragraph line';
      const expected = '¶ First paragraph line';
      expect(markParagraph(input)).toBe(expected);
    });

    it('should not duplicate ¶ if already present', () => {
      const input = '¶ Already marked';
      const expected = '¶ Already marked';
      expect(markParagraph(input)).toBe(expected);
    });

    it('should add ¶ to multiple lines', () => {
      const input = 'Line 1\nLine 2';
      const expected = '¶ Line 1\n¶ Line 2';
      expect(markParagraph(input)).toBe(expected);
    });

    it('should preserve empty lines', () => {
      const input = 'Line 1\n\nLine 3';
      const expected = '¶ Line 1\n\n¶ Line 3';
      expect(markParagraph(input)).toBe(expected);
    });
  });

  describe('dehyphenate', () => {
    it('should join hyphenated word at line break', () => {
      const input = 'This is a long sen-\ntence that was split.';
      const expected = 'This is a long sentence that was split.';
      expect(dehyphenate(input)).toBe(expected);
    });

    it('should handle multiple hyphens', () => {
      const input = 'First hy-\nphen and sec-\nond hyphen.';
      const expected = 'First hyphen and second hyphen.';
      expect(dehyphenate(input)).toBe(expected);
    });

    it('should not join if next line starts with uppercase', () => {
      const input = 'End of sentence-\nNew sentence here.';
      const expected = 'End of sentence-\nNew sentence here.';
      expect(dehyphenate(input)).toBe(expected);
    });

    it('should not join if line does not end with hyphen', () => {
      const input = 'Normal line\nanother line';
      expect(dehyphenate(input)).toBe(input);
    });

    it('should preserve spacing in joined text', () => {
      const input = 'Some text hy-\nphenated word here';
      const expected = 'Some text hyphenated word here';
      expect(dehyphenate(input)).toBe(expected);
    });

    it('should handle lines with only hyphen', () => {
      const input = 'word-\n';
      const expected = 'word-\n';
      expect(dehyphenate(input)).toBe(expected);
    });
  });

  describe('fixDropCap', () => {
    it('should fix drop-cap with 2 spaces', () => {
      const input = 'T  he beginning of the chapter';
      const expected = 'The beginning of the chapter';
      expect(fixDropCap(input)).toBe(expected);
    });

    it('should fix drop-cap with 3+ spaces', () => {
      const input = 'I     n the beginning';
      const expected = 'In the beginning';
      expect(fixDropCap(input)).toBe(expected);
    });

    it('should only fix at start of line', () => {
      const input = 'Normal text with T  he in middle';
      const expected = 'Normal text with T  he in middle';
      expect(fixDropCap(input)).toBe(expected);
    });

    it('should not affect normal capitalization', () => {
      const input = 'The normal text';
      expect(fixDropCap(input)).toBe(input);
    });

    it('should handle multiple lines', () => {
      const input = 'T  he first line\nI   n the second\nNormal third';
      const expected = 'The first line\nIn the second\nNormal third';
      expect(fixDropCap(input)).toBe(expected);
    });

    it('should not match capital followed by capital', () => {
      const input = 'T  HE (all caps)';
      const expected = 'T  HE (all caps)';
      expect(fixDropCap(input)).toBe(expected);
    });
  });

  describe('applyTransform', () => {
    it('should apply promote-heading transform', () => {
      const input = 'Text';
      const result = applyTransform('promote-heading', input);
      expect(result).toBe('# Text');
    });

    it('should apply demote-heading transform', () => {
      const input = '# Text';
      const result = applyTransform('demote-heading', input);
      expect(result).toBe('Text');
    });

    it('should apply mark-paragraph transform', () => {
      const input = 'Text';
      const result = applyTransform('mark-paragraph', input);
      expect(result).toBe('¶ Text');
    });

    it('should apply dehyphenate transform', () => {
      const input = 'hy-\nphen';
      const result = applyTransform('dehyphenate', input);
      expect(result).toBe('hyphen');
    });

    it('should apply fix-drop-cap transform', () => {
      const input = 'T  ext';
      const result = applyTransform('fix-drop-cap', input);
      expect(result).toBe('Text');
    });

    it('should throw error for unknown transform', () => {
      expect(() => {
        applyTransform('invalid-transform' as any, 'text');
      }).toThrow('Unknown transform');
    });
  });
});
