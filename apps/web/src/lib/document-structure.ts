export interface DocumentStructure {
  normalizedMarkdown: string;
  coverTitle: string | null;
  systemName: string | null;
  afterCoverMarkdown: string;
  bodyMarkdown: string;
}

interface ParsedHeading {
  level: number;
  text: string;
}

const INSTRUCTIONAL_HEADING_SUFFIX_RE = /\s+\((?:NON-technical|Human-readable|Readable,\s*grounded|ALL ENDPOINTS FOUND)\)\s*$/i;

function parseHeading(line: string): ParsedHeading | null {
  const match = /^(#{1,6})\s+(.+?)\s*$/.exec(line);
  if (!match) return null;

  return {
    level: match[1].length,
    text: match[2].trim(),
  };
}

function normalizeHeadingText(text: string): string {
  return text
    .replace(/^0\.(?:1|2|3)\s+/, '')
    .replace(INSTRUCTIONAL_HEADING_SUFFIX_RE, '')
    .trim();
}

function isCoverTitle(text: string): boolean {
  return /technical design document(?:ation)?|\bTDD\b/i.test(text);
}

function isGenericTddTitle(text: string): boolean {
  const normalized = normalizeHeadingText(text).toLowerCase();
  return (
    normalized === 'technical design documentation' ||
    normalized === 'technical design document' ||
    normalized === 'tdd'
  );
}

function isTableOfContents(text: string): boolean {
  return normalizeHeadingText(text).toLowerCase() === 'table of contents';
}

function deriveSystemName(coverTitle: string): string {
  const systemName = normalizeHeadingText(coverTitle)
    .replace(/\s*[-–—:]\s*Technical Design Document(?:ation)?\s*$/i, '')
    .replace(/\s*Technical Design Document(?:ation)?\s*$/i, '')
    .replace(/\s*[-–—:]\s*TDD\s*$/i, '')
    .replace(/\s*TDD\s*$/i, '')
    .trim();

  if (systemName) return systemName;

  return normalizeHeadingText(coverTitle)
    .replace(/Technical Design Document(?:ation)?/gi, '')
    .replace(/\bTDD\b/g, '')
    .replace(/[-–—:]/g, '')
    .trim() || normalizeHeadingText(coverTitle);
}

export function normalizeGeneratedMarkdown(markdown: string): string {
  return markdown
    .split('\n')
    .map((line) => {
      const heading = parseHeading(line);
      if (!heading) return line;
      return `${'#'.repeat(heading.level)} ${normalizeHeadingText(heading.text)}`;
    })
    .join('\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

export function getDocumentStructure(markdown: string): DocumentStructure {
  const normalizedMarkdown = normalizeGeneratedMarkdown(markdown);
  const lines = normalizedMarkdown.split('\n');

  const coverHeadingIndex = lines.findIndex((line) => {
    const heading = parseHeading(line);
    return heading ? isCoverTitle(heading.text) : false;
  });

  if (coverHeadingIndex === -1) {
    return {
      normalizedMarkdown,
      coverTitle: null,
      systemName: null,
      afterCoverMarkdown: normalizedMarkdown,
      bodyMarkdown: normalizedMarkdown,
    };
  }

  const coverHeading = parseHeading(lines[coverHeadingIndex]);
  let coverTitle = coverHeading?.text ?? null;
  let systemName = coverTitle ? deriveSystemName(coverTitle) : null;

  // If the cover heading is a generic "Technical Design Documentation", try to recover
  // the actual system name from a nearby heading (common when the model outputs two H1s).
  if (coverTitle && (isGenericTddTitle(coverTitle) || isGenericTddTitle(systemName ?? ''))) {
    for (let i = coverHeadingIndex - 1; i >= 0 && i >= coverHeadingIndex - 12; i -= 1) {
      const candidate = parseHeading(lines[i]);
      if (!candidate) continue;
      if (candidate.level > 2) continue;
      if (isTableOfContents(candidate.text)) continue;
      if (isCoverTitle(candidate.text)) continue;
      const recoveredSystemName = normalizeHeadingText(candidate.text);
      if (!recoveredSystemName) continue;

      systemName = recoveredSystemName;
      coverTitle = `${recoveredSystemName} - Technical Design Documentation`;
      break;
    }
  }

  const tocHeadingIndex = lines.findIndex((line, index) => {
    if (index <= coverHeadingIndex) return false;
    const heading = parseHeading(line);
    return heading ? isTableOfContents(heading.text) : false;
  });

  const afterCoverMarkdown = lines
    .slice(tocHeadingIndex === -1 ? coverHeadingIndex + 1 : tocHeadingIndex)
    .join('\n')
    .trimStart();

  if (tocHeadingIndex === -1) {
    return {
      normalizedMarkdown,
      coverTitle,
      systemName,
      afterCoverMarkdown,
      bodyMarkdown: afterCoverMarkdown,
    };
  }

  const tocHeading = parseHeading(lines[tocHeadingIndex]);
  let bodyStartIndex = lines.length;

  for (let index = tocHeadingIndex + 1; index < lines.length; index += 1) {
    const heading = parseHeading(lines[index]);
    if (heading && tocHeading && heading.level <= tocHeading.level) {
      bodyStartIndex = index;
      break;
    }
  }

  return {
    normalizedMarkdown,
    coverTitle,
    systemName,
    afterCoverMarkdown,
    bodyMarkdown: lines.slice(bodyStartIndex).join('\n').trimStart(),
  };
}
