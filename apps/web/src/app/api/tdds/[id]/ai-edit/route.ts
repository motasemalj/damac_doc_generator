import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@damac/db';
import { requireAuth, auditLog } from '@/lib/auth';
import { GenerationService, normalizeGeneratedMarkdown } from '@damac/core';
import { createNoStoreHeaders } from '@/lib/http-cache';
import { validateContextFile, extractContextText, classifyContextFile } from '@/lib/context-files';
import type { ClassifiedFile } from '@/lib/context-files';
import {
  AI_EDIT_MAX_FILES,
  AI_EDIT_MAX_INSTRUCTION_LENGTH,
} from '@damac/shared';

export const maxDuration = 300;

// ---------------------------------------------------------------------------
// Section parsing & splicing
// ---------------------------------------------------------------------------

interface DocumentSection {
  heading: string;
  level: number;
  startLine: number;
  endLine: number;
  content: string;
}

function parseDocumentSections(markdown: string): DocumentSection[] {
  const lines = markdown.split('\n');
  const sections: DocumentSection[] = [];
  let currentSection: DocumentSection | null = null;

  for (let i = 0; i < lines.length; i++) {
    const match = /^(#{1,6})\s+(.+?)\s*$/.exec(lines[i]);
    if (match) {
      if (currentSection) {
        currentSection.endLine = i - 1;
        currentSection.content = lines
          .slice(currentSection.startLine, i)
          .join('\n');
      }
      currentSection = {
        heading: match[2].trim(),
        level: match[1].length,
        startLine: i,
        endLine: lines.length - 1,
        content: '',
      };
      sections.push(currentSection);
    }
  }

  if (currentSection) {
    currentSection.endLine = lines.length - 1;
    currentSection.content = lines
      .slice(currentSection.startLine)
      .join('\n');
  }

  return sections;
}

/**
 * Given a target section, collect it plus all its child subsections
 * (headings with a higher level number that appear before the next same-or-higher heading).
 */
function collectSectionWithChildren(
  sections: DocumentSection[],
  targetIndex: number,
): { start: number; end: number; combined: string } {
  const target = sections[targetIndex];
  let endLine = target.endLine;

  for (let i = targetIndex + 1; i < sections.length; i++) {
    if (sections[i].level <= target.level) break;
    endLine = sections[i].endLine;
  }

  const lines = sections[0].content.split('\n');
  const fullDoc = sections.map((s) => s.content).join('\n');
  const allLines = fullDoc.split('\n');

  const startLine = target.startLine;
  const sourceLines = allLines.length > 0 ? allLines : lines;

  const combinedLines: string[] = [];
  for (const s of sections) {
    if (s.startLine >= startLine && s.endLine <= endLine) {
      combinedLines.push(s.content);
    } else if (s.startLine >= startLine && s.startLine <= endLine) {
      combinedLines.push(s.content);
    }
  }

  return {
    start: startLine,
    end: endLine,
    combined: combinedLines.join('\n') || target.content,
  };
}

function spliceSection(
  originalMarkdown: string,
  startLine: number,
  endLine: number,
  newContent: string,
): string {
  const lines = originalMarkdown.split('\n');
  const before = lines.slice(0, startLine);
  const after = lines.slice(endLine + 1);
  return [...before, newContent, ...after].join('\n');
}

function buildDocumentOutline(
  sections: DocumentSection[],
  excludeIndex?: number,
): string {
  return sections
    .map((s, i) => {
      const indent = '  '.repeat(s.level - 1);
      const marker = i === excludeIndex ? ' ← TARGET SECTION (content provided separately)' : '';
      return `${indent}- ${'#'.repeat(s.level)} ${s.heading}${marker}`;
    })
    .join('\n');
}

// classifyContextFile and ClassifiedFile are imported from @/lib/context-files

// ---------------------------------------------------------------------------
// Section matching
// ---------------------------------------------------------------------------

const SECTION_KEYWORDS: Record<string, string[]> = {
  'cover': ['cover', 'title page', 'table of contents', 'toc'],
  'executive summary': ['executive summary', 'summary', 'overview'],
  'purpose': ['purpose', 'introduction', 'scope'],
  'system specification': ['system specification', 'specification', 'capabilities'],
  'functional requirements': ['functional requirements', 'functional', 'fr1', 'fr2', 'fr3', 'requirements'],
  'non-functional': ['non-functional', 'nonfunctional', 'nfr', 'performance', 'reliability', 'scalability'],
  'technical approach': ['technical approach', 'architecture', 'component', 'design pattern'],
  'process flow': ['process flow', 'end-to-end', 'workflow', 'sequence'],
  'data design': ['data design', 'data model', 'database', 'schema', 'entity', 'er diagram', 'persistence'],
  'security': ['security', 'access control', 'authentication', 'authorization', 'auth'],
  'error handling': ['error handling', 'resilience', 'retry', 'fault tolerance', 'error'],
  'observability': ['observability', 'logging', 'monitoring', 'metrics', 'tracing', 'health'],
  'deployment': ['deployment', 'runtime', 'docker', 'kubernetes', 'ci/cd', 'infrastructure'],
  'api specification': ['api specification', 'api spec', 'endpoint', 'rest api', 'api'],
  'method details': ['method details', 'method', 'function', 'signature'],
  'configuration': ['configuration', 'environment variable', 'env var', 'config', 'settings', 'feature flag'],
};

function findMatchingSectionIndex(
  sections: DocumentSection[],
  targetSectionId: string | null,
  instruction: string,
): number | null {
  if (targetSectionId) {
    const normalizedTarget = targetSectionId.toLowerCase().trim();
    for (let i = 0; i < sections.length; i++) {
      const heading = sections[i].heading.toLowerCase();
      if (heading === normalizedTarget || heading.includes(normalizedTarget)) {
        return i;
      }
    }
  }

  const instructionLower = instruction.toLowerCase();

  let bestMatch: { index: number; score: number } | null = null;

  for (let i = 0; i < sections.length; i++) {
    const heading = sections[i].heading.toLowerCase();
    let score = 0;

    for (const [_category, keywords] of Object.entries(SECTION_KEYWORDS)) {
      for (const kw of keywords) {
        if (instructionLower.includes(kw) && heading.includes(kw)) {
          score += kw.length;
        }
      }
    }

    if (instructionLower.includes(heading)) {
      score += heading.length * 2;
    }

    const headingWords = heading.split(/\s+/);
    for (const word of headingWords) {
      if (word.length > 3 && instructionLower.includes(word)) {
        score += word.length;
      }
    }

    if (score > 0 && (!bestMatch || score > bestMatch.score)) {
      bestMatch = { index: i, score };
    }
  }

  return bestMatch?.index ?? null;
}

// ---------------------------------------------------------------------------
// Prompt construction
// ---------------------------------------------------------------------------

const SECTION_EDIT_SYSTEM_PROMPT = [
  'You are a precise technical document editor specializing in enterprise Technical Design Documents (TDDs).',
  '',
  'You receive a SPECIFIC SECTION of a TDD document together with edit instructions.',
  'Your task is to produce an UPDATED version of ONLY that section.',
  '',
  'Rules:',
  '1. Output ONLY the edited section content — from its heading to the end of the section (including all subsections).',
  '2. Apply the requested changes accurately and completely.',
  '3. Preserve the heading hierarchy, numbering scheme, and formatting style of the original section.',
  '4. Do NOT include content from other sections.',
  '5. Do NOT add commentary, notes, or explanations about what you changed.',
  '6. Output raw Markdown directly. Do NOT wrap in code fences.',
  '7. Maintain the same professional enterprise documentation tone.',
  '8. If reference files are provided, use them as authoritative sources — extract concrete data (types, names, schemas, parameters) rather than paraphrasing vaguely.',
  '9. Keep Mermaid diagrams if present and update them to reflect changes. Add new diagrams only if the changes warrant them.',
  '10. Ensure tables are properly formatted with aligned columns and accurate data from reference files.',
].join('\n');

const FULL_DOC_EDIT_SYSTEM_PROMPT = [
  'You are a precise technical document editor specializing in enterprise Technical Design Documents (TDDs).',
  '',
  'You receive an existing TDD in Markdown format together with specific edit instructions.',
  '',
  'Rules:',
  '1. Identify the section(s) that need modification based on the user instructions.',
  '2. Apply ONLY the requested changes to those sections.',
  '3. Return the COMPLETE document with changes applied — not just the changed parts.',
  '4. Do NOT modify any sections that are not mentioned in the instructions.',
  '5. Preserve all formatting, structure, headings, and content of unchanged sections EXACTLY as they appear.',
  '6. Do NOT add commentary, notes, or explanations about what you changed.',
  '7. Output raw Markdown directly. Do NOT wrap in code fences.',
  '8. Keep the exact heading hierarchy and document structure.',
  '9. If reference files are provided, use them as authoritative sources — extract concrete data (types, names, schemas, parameters) rather than paraphrasing vaguely.',
].join('\n');

function buildSectionEditPrompt(
  instruction: string,
  sectionContent: string,
  documentOutline: string,
  referenceFiles: ClassifiedFile[],
): string {
  const parts: string[] = [];

  parts.push('=== DOCUMENT OUTLINE (for context — do NOT reproduce these sections) ===');
  parts.push(documentOutline);

  parts.push('');
  parts.push('=== EDIT INSTRUCTIONS ===');
  parts.push(instruction);

  if (referenceFiles.length > 0) {
    parts.push('');
    parts.push('=== REFERENCE FILES ===');
    for (const file of referenceFiles) {
      parts.push('');
      parts.push(`--- ${file.name} [${file.fileType}] ---`);
      parts.push(`Context: ${file.guidance}`);
      parts.push('');
      parts.push(file.content);
    }
  }

  parts.push('');
  parts.push('=== TARGET SECTION TO EDIT ===');
  parts.push('Edit this section according to the instructions above and return ONLY the updated section:');
  parts.push('');
  parts.push(sectionContent);

  return parts.join('\n');
}

function buildFullDocEditPrompt(
  instruction: string,
  currentMarkdown: string,
  referenceFiles: ClassifiedFile[],
): string {
  const parts: string[] = [];

  parts.push('=== EDIT INSTRUCTIONS ===');
  parts.push(instruction);

  if (referenceFiles.length > 0) {
    parts.push('');
    parts.push('=== REFERENCE FILES ===');
    for (const file of referenceFiles) {
      parts.push('');
      parts.push(`--- ${file.name} [${file.fileType}] ---`);
      parts.push(`Context: ${file.guidance}`);
      parts.push('');
      parts.push(file.content);
    }
  }

  parts.push('');
  parts.push('=== CURRENT TDD DOCUMENT ===');
  parts.push('Apply the edit instructions to this document and return the complete updated version:');
  parts.push('');
  parts.push(currentMarkdown);

  return parts.join('\n');
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function stripMarkdownWrapper(raw: string): string {
  let s = raw.trim();
  const m = s.match(/^```(?:markdown|md)?\s*\n([\s\S]*?)\n\s*```\s*$/);
  if (m) return m[1].trim();
  if (/^```(?:markdown|md)?\s*$/m.test(s.split('\n')[0])) {
    s = s.replace(/^```(?:markdown|md)?\s*\n/, '');
    if (s.endsWith('\n```')) s = s.slice(0, -4);
    else if (s.endsWith('```')) s = s.slice(0, -3);
  }
  return s.trim();
}

// ---------------------------------------------------------------------------
// Route handler
// ---------------------------------------------------------------------------

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await requireAuth();
    const { id } = await params;

    const tdd = await prisma.tddDocument.findFirst({
      where: {
        id,
        OR: [
          { userId: user.id },
          { project: { userId: user.id } },
        ],
      },
    });
    if (!tdd) {
      return NextResponse.json({ success: false, error: 'TDD not found' }, { status: 404 });
    }

    const formData = await req.formData();
    const instruction = formData.get('instruction') as string | null;
    const targetSection = formData.get('targetSection') as string | null;

    if (!instruction?.trim()) {
      return NextResponse.json(
        { success: false, error: 'Edit instruction is required' },
        { status: 400 },
      );
    }

    if (instruction.length > AI_EDIT_MAX_INSTRUCTION_LENGTH) {
      return NextResponse.json(
        { success: false, error: `Instruction exceeds maximum length of ${AI_EDIT_MAX_INSTRUCTION_LENGTH} characters` },
        { status: 400 },
      );
    }

    const referenceFiles: ClassifiedFile[] = [];
    const fileEntries = formData.getAll('files');

    if (fileEntries.length > AI_EDIT_MAX_FILES) {
      return NextResponse.json(
        { success: false, error: `Maximum ${AI_EDIT_MAX_FILES} files allowed` },
        { status: 400 },
      );
    }

    for (const entry of fileEntries) {
      if (!(entry instanceof File)) continue;
      const validation = validateContextFile(entry.name, entry.size, entry.type);
      if (!validation.valid) {
        return NextResponse.json(
          { success: false, error: `File "${entry.name}": ${validation.message}` },
          { status: 400 },
        );
      }
      const buffer = Buffer.from(await entry.arrayBuffer());
      const content = extractContextText(buffer);
      if (content) {
        referenceFiles.push(classifyContextFile(entry.name, content));
      }
    }

    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) {
      return NextResponse.json(
        { success: false, error: 'OpenAI API key not configured' },
        { status: 500 },
      );
    }

    await prisma.tddRevision.create({
      data: {
        tddDocumentId: id,
        markdownContent: tdd.markdownContent,
        message: `Before AI edit: ${instruction.slice(0, 100)}`,
      },
    });

    const sections = parseDocumentSections(tdd.markdownContent);
    const matchedIndex = findMatchingSectionIndex(sections, targetSection, instruction);

    const isSectionEdit = matchedIndex !== null && sections.length > 1;

    let systemPrompt: string;
    let editPrompt: string;
    let sectionStart = -1;
    let sectionEnd = -1;
    let editedSectionHeading = '';

    if (isSectionEdit) {
      const { start, end, combined } = collectSectionWithChildren(sections, matchedIndex);
      sectionStart = start;
      sectionEnd = end;
      editedSectionHeading = sections[matchedIndex].heading;

      const outline = buildDocumentOutline(sections, matchedIndex);
      systemPrompt = SECTION_EDIT_SYSTEM_PROMPT;
      editPrompt = buildSectionEditPrompt(instruction, combined, outline, referenceFiles);
    } else {
      systemPrompt = FULL_DOC_EDIT_SYSTEM_PROMPT;
      editPrompt = buildFullDocEditPrompt(instruction, tdd.markdownContent, referenceFiles);
    }

    const genService = new GenerationService({
      apiKey,
      model: process.env.OPENAI_MODEL || undefined,
    });

    const encoder = new TextEncoder();
    let fullContent = '';

    const stream = new ReadableStream({
      async start(controller) {
        try {
          controller.enqueue(
            encoder.encode(`data: ${JSON.stringify({
              meta: {
                mode: isSectionEdit ? 'section' : 'full',
                targetSection: editedSectionHeading || null,
              },
            })}\n\n`),
          );

          const gen = genService.generateStream({
            systemPrompt,
            codebaseSummary: '',
            templatePrompt: editPrompt,
          });

          while (true) {
            const result = await gen.next();
            if (result.done) break;
            fullContent += result.value;
            controller.enqueue(encoder.encode(`data: ${JSON.stringify({ token: result.value })}\n\n`));
          }

          let cleanedContent: string;

          if (isSectionEdit) {
            const editedSection = normalizeGeneratedMarkdown(stripMarkdownWrapper(fullContent));
            cleanedContent = normalizeGeneratedMarkdown(
              spliceSection(tdd.markdownContent, sectionStart, sectionEnd, editedSection),
            );
          } else {
            cleanedContent = normalizeGeneratedMarkdown(stripMarkdownWrapper(fullContent));
          }

          await prisma.tddDocument.update({
            where: { id },
            data: { markdownContent: cleanedContent },
          });

          await auditLog(user.id, 'ai-edit', 'tdd', id, {
            instruction: instruction.slice(0, 200),
            fileCount: referenceFiles.length,
            mode: isSectionEdit ? 'section' : 'full',
            targetSection: editedSectionHeading || null,
          });

          controller.enqueue(
            encoder.encode(`data: ${JSON.stringify({ done: true, content: cleanedContent })}\n\n`),
          );
          controller.close();
        } catch (error: any) {
          controller.enqueue(
            encoder.encode(`data: ${JSON.stringify({ error: error.message || 'AI edit failed' })}\n\n`),
          );
          controller.close();
        }
      },
    });

    return new NextResponse(stream, {
      headers: {
        'Content-Type': 'text/event-stream',
        Connection: 'keep-alive',
        ...createNoStoreHeaders(),
      },
    });
  } catch (error: any) {
    if (error.message === 'Unauthorized') {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }
    console.error('AI edit error:', error);
    return NextResponse.json({ success: false, error: 'Internal server error' }, { status: 500 });
  }
}
