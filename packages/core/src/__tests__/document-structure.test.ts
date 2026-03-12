import { describe, expect, it } from 'vitest';
import { getDocumentStructure, normalizeGeneratedMarkdown } from '../document-structure';

describe('document-structure', () => {
  it('removes instructional numbering and heading annotations', () => {
    const markdown = [
      '# Payments Platform - Technical Design Documentation',
      '',
      '## 0.2 Table of Contents',
      '',
      '- item',
      '',
      '## 0.3 Executive Summary (NON-technical)',
      '',
      'Overview',
      '',
      '## 2.1 Functional Requirements (Human-readable)',
      '',
      'FR1',
      '',
      '## 4. API Specification (ALL ENDPOINTS FOUND)',
    ].join('\n');

    const normalized = normalizeGeneratedMarkdown(markdown);

    expect(normalized).toContain('## Table of Contents');
    expect(normalized).toContain('## Executive Summary');
    expect(normalized).toContain('## 2.1 Functional Requirements');
    expect(normalized).toContain('## 4. API Specification');
    expect(normalized).not.toContain('(NON-technical)');
    expect(normalized).not.toContain('(Human-readable)');
    expect(normalized).not.toContain('(ALL ENDPOINTS FOUND)');
  });

  it('drops everything before the table of contents from the body flow', () => {
    const markdown = [
      '# Payments Platform - Technical Design Documentation',
      '',
      'Repository Artifact: abc123',
      '',
      'Primary Domain: Payments',
      '',
      '## Table of Contents',
      '',
      '- [Executive Summary](#executive-summary)',
      '',
      '## Executive Summary',
      '',
      'Release-ready summary.',
    ].join('\n');

    const structure = getDocumentStructure(markdown);

    expect(structure.systemName).toBe('Payments Platform');
    expect(structure.afterCoverMarkdown.startsWith('## Table of Contents')).toBe(true);
    expect(structure.afterCoverMarkdown).not.toContain('Repository Artifact');
    expect(structure.bodyMarkdown.startsWith('## Executive Summary')).toBe(true);
    expect(structure.bodyMarkdown).not.toContain('Primary Domain');
  });
});
