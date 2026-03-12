import { describe, it, expect } from 'vitest';
import { MarkdownSanitizer } from '../markdown-sanitizer';

describe('MarkdownSanitizer', () => {
  describe('sanitize', () => {
    it('should remove script tags', () => {
      const result = MarkdownSanitizer.sanitize('Hello <script>alert("xss")</script> world');
      expect(result).toBe('Hello alert("xss") world');
      expect(result).not.toContain('<script');
    });

    it('should remove iframe tags', () => {
      const result = MarkdownSanitizer.sanitize('<iframe src="evil.com"></iframe>');
      expect(result).not.toContain('<iframe');
    });

    it('should remove event handlers', () => {
      const result = MarkdownSanitizer.sanitize('<div onclick="alert(1)">click</div>');
      expect(result).not.toContain('onclick');
    });

    it('should remove javascript: URLs', () => {
      const result = MarkdownSanitizer.sanitize('[link](javascript:alert(1))');
      expect(result).not.toContain('javascript:');
    });

    it('should preserve safe markdown', () => {
      const safe = '# Hello\n\n**Bold** and *italic*\n\n```code```';
      const result = MarkdownSanitizer.sanitize(safe);
      expect(result).toBe(safe);
    });

    it('should preserve mermaid code blocks', () => {
      const md = '```mermaid\ngraph TD\nA-->B\n```';
      const result = MarkdownSanitizer.sanitize(md);
      expect(result).toContain('mermaid');
      expect(result).toContain('graph TD');
    });
  });

  describe('isClean', () => {
    it('should detect script tags', () => {
      expect(MarkdownSanitizer.isClean('<script>bad</script>')).toBe(false);
    });

    it('should detect javascript: URLs', () => {
      expect(MarkdownSanitizer.isClean('javascript:alert(1)')).toBe(false);
    });

    it('should pass clean markdown', () => {
      expect(MarkdownSanitizer.isClean('# Hello World')).toBe(true);
    });
  });

  describe('stripHtml', () => {
    it('should strip all HTML tags', () => {
      const result = MarkdownSanitizer.stripHtml('<p>Hello <strong>world</strong></p>');
      expect(result).toBe('Hello world');
    });
  });
});
