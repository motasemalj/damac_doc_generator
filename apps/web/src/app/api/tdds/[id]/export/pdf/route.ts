import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@damac/db';
import { requireAuth, auditLog } from '@/lib/auth';
import { MarkdownSanitizer, getDocumentStructure, normalizeGeneratedMarkdown } from '@damac/core';
import { getStorage } from '@/lib/storage';
import { createHash } from 'crypto';

export const maxDuration = 120;
const PDF_RENDERER_VERSION = 'pdf-v2';
const PDF_CACHE_DIR = 'cache/pdf';
const PDF_MERMAID_CACHE_DIR = 'cache/mermaid';
const PDF_MERMAID_CACHE_VERSION = 'pdf-mermaid-v1';
let browserPromise: Promise<any> | null = null;

function stripPdfFrontMatter(markdown: string): string {
  return getDocumentStructure(normalizeGeneratedMarkdown(markdown)).bodyMarkdown;
}

function decodeHtmlEntities(value: string): string {
  return value
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'");
}

function stripKnownHtmlWrappers(value: string): string {
  return value
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/?(?:p|div|span|pre|code)\b[^>]*>/gi, '')
    .replace(/\n{3,}/g, '\n\n');
}

function dedent(value: string): string {
  const lines = value.split('\n');
  const indents = lines
    .filter((line) => line.trim())
    .map((line) => line.match(/^\s*/)?.[0].length || 0);
  const minIndent = indents.length > 0 ? Math.min(...indents) : 0;
  return lines.map((line) => line.slice(minIndent)).join('\n');
}

function normalizeMermaidCode(raw: string): string {
  const decoded = decodeHtmlEntities(raw)
    .replace(/\r\n/g, '\n')
    .replace(/\u00A0/g, ' ')
    .replace(/[\u200B-\u200D\uFEFF]/g, '')
    .trim();
  const fenced = decoded.match(/^```(?:mermaid)?\s*\n([\s\S]*?)\n```$/i);
  const unfenced = stripKnownHtmlWrappers(fenced ? fenced[1] : decoded);
  const cleanLines = dedent(unfenced)
    .split('\n')
    .map((line) => line.replace(/\s+$/g, ''));
  const startIndex = cleanLines.findIndex((line) => /^(?:flowchart|graph|sequenceDiagram|classDiagram|erDiagram|journey|gantt|pie|mindmap|timeline|gitGraph|stateDiagram(?:-v2)?|classDiagram-v2|quadrantChart|requirementDiagram|block-beta|packet-beta|architecture(?:-beta)?|C4Context|C4Container|C4Component|C4Dynamic|C4Deployment)\b/i.test(line.trim()));

  if (startIndex === -1) {
    return cleanLines.join('\n').trim();
  }

  let includeFrom = startIndex;
  while (includeFrom > 0) {
    const previous = cleanLines[includeFrom - 1].trim();
    if (!previous || previous.startsWith('%%')) {
      includeFrom -= 1;
      continue;
    }
    break;
  }

  return cleanLines.slice(includeFrom).join('\n').trim();
}

function simpleHash(input: string): string {
  let hash = 5381;
  for (let i = 0; i < input.length; i += 1) {
    hash = ((hash << 5) + hash) ^ input.charCodeAt(i);
  }
  return (hash >>> 0).toString(36);
}

function getPdfArtifactCacheKey(parts: Record<string, unknown>): string {
  const hash = createHash('sha256').update(JSON.stringify(parts)).digest('hex');
  return `${PDF_CACHE_DIR}/${hash}.pdf`;
}

function getMermaidSvgCacheKey(code: string): string {
  return `${PDF_MERMAID_CACHE_VERSION}-${simpleHash(code)}`;
}

function extractMermaidCacheKeys(markdown: string): string[] {
  const matches = markdown.matchAll(/```mermaid\s*\n([\s\S]*?)```/gi);
  const keys = new Set<string>();

  for (const match of matches) {
    const normalized = normalizeMermaidCode(match[1] || '');
    if (normalized) {
      keys.add(getMermaidSvgCacheKey(normalized));
    }
  }

  return Array.from(keys);
}

async function loadCachedMermaidSvgs(markdown: string): Promise<Record<string, string>> {
  const storage = getStorage();
  const cacheKeys = extractMermaidCacheKeys(markdown);
  const entries = await Promise.all(cacheKeys.map(async (cacheKey) => {
    const storageKey = `${PDF_MERMAID_CACHE_DIR}/${cacheKey}.svg`;
    if (!(await storage.exists(storageKey))) {
      return null;
    }
    const svg = (await storage.read(storageKey)).toString('utf8');
    return [cacheKey, svg] as const;
  }));

  return Object.fromEntries(entries.filter((entry): entry is readonly [string, string] => Boolean(entry)));
}

async function persistMermaidSvgCache(cacheEntries: Record<string, string>) {
  const storage = getStorage();
  await Promise.all(
    Object.entries(cacheEntries).map(([cacheKey, svg]) =>
      storage.save(`${PDF_MERMAID_CACHE_DIR}/${cacheKey}.svg`, Buffer.from(svg, 'utf8'))),
  );
}

async function getPdfBrowser() {
  if (!browserPromise) {
    let puppeteer;
    try {
      puppeteer = require('puppeteer');
    } catch {
      throw new Error('PDF generation not available. Install puppeteer.');
    }

    browserPromise = puppeteer.launch({
      headless: true,
      args: ['--no-sandbox', '--disable-setuid-sandbox'],
    }).catch((error: unknown) => {
      browserPromise = null;
      throw error;
    });
  }

  return browserPromise;
}

export async function POST(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
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
      include: { project: { select: { name: true } } },
    });

    if (!tdd) {
      return NextResponse.json({ success: false, error: 'TDD not found' }, { status: 404 });
    }

    const sanitized = normalizeGeneratedMarkdown(MarkdownSanitizer.sanitize(tdd.markdownContent));
    const documentStructure = getDocumentStructure(sanitized);
    const bodyMarkdown = stripPdfFrontMatter(sanitized);
    const coverTitle = (documentStructure.systemName || tdd.title || tdd.project?.name || 'Technical Design Document')
      .replace(/\s*[-–—:]?\s*Technical Design Document(?:ation)?\s*$/i, '')
      .replace(/^TDD\s*[-–—:]\s*/i, '')
      .trim() || tdd.title || tdd.project?.name || 'Technical Design Document';
    const coverDate = new Date().toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });
    const storage = getStorage();
    const pdfCacheKey = getPdfArtifactCacheKey({
      rendererVersion: PDF_RENDERER_VERSION,
      documentId: tdd.id,
      updatedAt: tdd.updatedAt.toISOString(),
      projectName: tdd.project?.name ?? '',
      title: coverTitle,
      coverDate,
      markdownHash: createHash('sha256').update(bodyMarkdown).digest('hex'),
    });
    const cachedPdfExists = await storage.exists(pdfCacheKey);
    if (cachedPdfExists) {
      await auditLog(user.id, 'export_pdf', 'tdd', id, { cache: 'hit' });
      const cachedPdf = await storage.read(pdfCacheKey);
      return new NextResponse(new Uint8Array(cachedPdf), {
        headers: {
          'Content-Type': 'application/pdf',
          'Content-Disposition': `attachment; filename="${(tdd.title || 'tdd').replace(/[^a-zA-Z0-9]/g, '_')}.pdf"`,
          'Cache-Control': 'private, no-store',
        },
      });
    }
    const cachedMermaidSvgs = await loadCachedMermaidSvgs(bodyMarkdown);

    const fullHtml = `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <style>
    @import url('https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700&display=swap');
    @page { size: A4; margin: 0; }
    * { margin: 0; padding: 0; box-sizing: border-box; }
    html, body { background: #ffffff; }
    body { font-family: 'Inter', sans-serif; color: #1a1a2e; line-height: 1.7; font-size: 11pt; }
    #pdf-root { width: 210mm; margin: 0 auto; }
    .pdf-page {
      width: 210mm;
      height: 297mm;
      background: #ffffff;
      position: relative;
      page-break-after: always;
      break-after: page;
      page-break-inside: avoid;
      break-inside: avoid;
      overflow: hidden;
    }
    .pdf-page:last-child { page-break-after: auto; break-after: auto; }
    .pdf-page-body { padding: 20mm 15mm 18mm; }
    .pdf-page-footer {
      position: absolute;
      left: 15mm;
      right: 15mm;
      bottom: 8mm;
      text-align: center;
      color: #64748b;
      font-size: 9pt;
      letter-spacing: 0.02em;
    }
    .cover-page {
      height: 297mm;
      display: flex;
      flex-direction: column;
      justify-content: center;
      align-items: center;
      background: linear-gradient(135deg, #1B2B4B 0%, #2D4A7A 100%);
      color: white;
      text-align: center;
      position: relative;
      overflow: hidden;
    }
    .cover-page::before {
      content: '';
      position: absolute;
      inset: 0;
      background:
        radial-gradient(ellipse at 20% 50%, rgba(197,165,114,0.12) 0%, transparent 60%),
        radial-gradient(ellipse at 80% 50%, rgba(255,255,255,0.08) 0%, transparent 50%);
    }
    .cover-page > * { position: relative; z-index: 1; }
    .cover-page .logo { width: 180px; margin-bottom: 40px; opacity: 0.92; }
    .cover-page .divider { width: 60px; height: 2px; background: #C5A572; margin: 0 auto 36px; border-radius: 1px; }
    .cover-page h1 { font-size: 32pt; font-weight: 700; margin-bottom: 14px; line-height: 1.2; color: #ffffff !important; }
    .cover-page h2 { font-size: 13pt; font-weight: 300; color: #C5A572; margin-bottom: 40px; letter-spacing: 0.15em; text-transform: uppercase; }
    .cover-page .project-name { font-size: 12pt; color: rgba(255,255,255,0.78); margin-bottom: 8px; }
    .cover-page .date { font-size: 10pt; color: rgba(255,255,255,0.48); }
    .render-surface { width: 180mm; margin: 0 auto; }
    .toc-title { margin: 0 0 18px; font-size: 21pt; color: #1B2B4B; font-weight: 700; }
    .toc-list { list-style: none; margin: 0; padding: 0; }
    .toc-row {
      display: flex;
      align-items: baseline;
      gap: 8px;
      margin: 0 0 8px;
      color: #1f2937;
    }
    .toc-link { color: #1B2B4B; text-decoration: none; flex: 0 1 auto; }
    .toc-link.level-1 { font-weight: 600; }
    .toc-link.level-2 { padding-left: 12px; }
    .toc-link.level-3 { padding-left: 24px; color: #334155; font-size: 10pt; }
    .toc-link.level-4 { padding-left: 36px; color: #475569; font-size: 9.5pt; }
    .toc-dots { flex: 1 1 auto; border-bottom: 1px dotted #cbd5e1; transform: translateY(-2px); }
    .toc-page-number { min-width: 20px; text-align: right; color: #475569; font-size: 9.5pt; }
    h1 { font-size: 22pt; color: #1B2B4B; margin: 0 0 16px; border-bottom: 2px solid #C5A572; padding-bottom: 8px; }
    h2 { font-size: 16pt; color: #1B2B4B; margin: 24px 0 12px; }
    h3 { font-size: 13pt; color: #2D4A7A; margin: 20px 0 10px; }
    h4 { font-size: 11.5pt; color: #2D4A7A; margin: 18px 0 8px; }
    p { margin: 8px 0; }
    table { width: 100%; border-collapse: collapse; margin: 16px 0; font-size: 10pt; }
    th { background: #1B2B4B; color: white; padding: 10px; text-align: left; }
    td { padding: 8px 10px; border: 1px solid #e5e7eb; }
    tr:nth-child(even) { background: #f9fafb; }
    pre {
      background: #1e293b;
      color: #e2e8f0;
      padding: 16px;
      border-radius: 8px;
      overflow-x: auto;
      margin: 16px 0;
      font-size: 9pt;
      white-space: pre-wrap;
      word-break: break-word;
    }
    pre code { background: transparent; color: #e2e8f0; padding: 0; }
    code {
      font-family: 'JetBrains Mono', monospace;
      font-size: 9pt;
      background: #f1f5f9;
      color: #1B2B4B;
      padding: 2px 5px;
      border-radius: 3px;
    }
    ul, ol { margin: 8px 0 8px 24px; }
    li { margin: 4px 0; }
    blockquote {
      margin: 16px 0;
      padding: 10px 14px;
      border-left: 4px solid #C5A572;
      background: #f8fafc;
      color: #475569;
    }
    hr {
      border: none;
      height: 1px;
      background: linear-gradient(to right, transparent, #C5A572, transparent);
      margin: 24px 0;
    }
    img { max-width: 100%; height: auto; }
    .mermaid {
      text-align: center;
      margin: 16px 0;
      padding: 10px 12px;
      border: 1px solid #e5e7eb;
      border-radius: 10px;
      background: #fafbfc;
      overflow: visible;
    }
    .mermaid.diagram-sequence,
    .mermaid.diagram-journey,
    .mermaid.diagram-pie,
    .mermaid.diagram-mindmap,
    .mermaid.diagram-timeline {
      padding-left: 8px;
      padding-right: 8px;
    }
    .mermaid.diagram-flow,
    .mermaid.diagram-er,
    .mermaid.diagram-class,
    .mermaid.diagram-state,
    .mermaid.diagram-c4,
    .mermaid.diagram-architecture,
    .mermaid.diagram-gantt,
    .mermaid.diagram-git,
    .mermaid.diagram-requirement,
    .mermaid.diagram-quadrant {
      padding-left: 10px;
      padding-right: 10px;
    }
    .mermaid svg {
      display: block;
      max-width: 100% !important;
      width: auto !important;
      height: auto !important;
      margin: 0 auto;
      overflow: visible;
    }
    .mermaid svg * {
      overflow: visible;
    }
    .mermaid + p {
      margin-top: -4px;
      margin-bottom: 14px;
      font-size: 9.5pt;
      line-height: 1.45;
      color: #64748b;
      font-style: italic;
    }
    .mermaid + p strong:first-child {
      color: #475569;
      font-weight: 600;
    }
    .measurement-root {
      position: absolute;
      left: -99999px;
      top: 0;
      visibility: hidden;
      pointer-events: none;
    }
    .measurement-page { width: 180mm; min-height: 1px; overflow: hidden; }
  </style>
  <script src="https://cdn.jsdelivr.net/npm/marked/marked.min.js"></script>
  <script src="https://cdn.jsdelivr.net/npm/mermaid@11/dist/mermaid.min.js"></script>
</head>
<body>
  <div id="pdf-root">
    <section class="pdf-page cover-page">
      <svg xmlns="http://www.w3.org/2000/svg" width="225" height="30" viewBox="0 0 75 10" class="logo">
        <g transform="translate(3.1468532,0.59003497)">
          <g transform="matrix(0,1.25,1.25,0,11.666872,4.446747)">
            <path style="fill:#ffffff;stroke:none" d="m 0,0 c -1.137,0.473 -2.021,0.432 -2.653,-0.12 -0.629,-0.553 -0.945,-1.595 -0.945,-3.128 l 0,-5.186 1.139,-0.468 0,3.57 c 0,1.823 0.915,2.35 2.43,1.721 0.876,-0.362 1.681,-0.683 2.039,-1.441 0.329,-0.694 0.425,-1.411 0.425,-2.686 l -0.004,-1.653 -2.948,1.235 0,-1.556 4.198,-1.752 0,4.7 c 0,1.318 -0.121,2.359 -0.368,3.124 -0.271,0.841 -0.716,1.595 -1.34,2.26 C 1.382,-0.76 0.723,-0.3 0,0"/>
          </g>
          <g transform="matrix(0,1.25,1.25,0,48.580672,5.404257)">
            <path style="fill:#ffffff;stroke:none" d="M 0,0 -3.096,3.159 0,3.815 0,0 z m 0.012,-26.854 -2.962,3.076 2.962,0.555 0,-3.631 z m -4.385,29.742 0.007,0.002 0,-1.926 6.974,-7.4 -6.972,2.893 0,-3.172 3.023,-3.832 1.632,-1.973 0,-0.09 -2.377,0.929 -2.278,-1.132 0,-3.188 6.986,-2.896 -6.986,-1.668 0,-3.492 7.279,-7.712 0,1.926 -1.903,1.972 0,4.859 1.903,0.387 0,5.163 -4.499,1.868 c -0.226,0.093 -0.486,0.183 -0.778,0.27 0.237,0.01 0.487,0.073 0.748,0.188 l 3.754,1.64 0,0.279 -3.74,4.697 c -0.14,0.175 -0.393,0.441 -0.762,0.798 0.342,-0.181 0.599,-0.308 0.778,-0.384 l 4.499,-1.866 0,3.41 0,3.594 L 1,-1.02 l 0,5.047 1.912,0.406 0,1.774 -7.285,-1.729 0,-1.59"/>
          </g>
          <g transform="matrix(0,1.25,1.25,0,71.343172,-0.05076301)">
            <path style="fill:#ffffff;stroke:none" d="m 0,0 0,-5.187 c 0,-1.532 0.316,-2.835 0.945,-3.911 0.632,-1.076 1.516,-1.848 2.653,-2.321 0.723,-0.3 1.382,-0.386 1.973,-0.257 0.624,0.151 1.07,0.533 1.34,1.147 0.247,0.563 0.368,1.505 0.368,2.822 l 0,4.689 -1.155,0.466 0,-2.64 c 0,-1.275 -0.167,-2.122 -0.496,-2.543 -0.355,-0.463 -1.182,-0.411 -2.059,-0.05 -1.515,0.629 -2.458,1.946 -2.458,3.768 l 0,2.045 1.137,-0.469 0,1.556 -2.184,0.906 0,-0.046 L 0,0"/>
          </g>
        </g>
      </svg>
      <div class="divider"></div>
      <h1>${(tdd.title || coverTitle || '').toString()}</h1>
      <h2>Technical Design Documentation</h2>
      <p class="project-name">${tdd.project?.name ?? ''}</p>
      <p class="date">${coverDate}</p>
    </section>
    <div id="render-output"></div>
  </div>
  <div class="measurement-root">
    <div id="measure-doc" class="measurement-page render-surface"></div>
    <div id="measure-toc" class="measurement-page render-surface"></div>
  </div>
  <script>
    window.__pdfReady = false;
    window.__renderedMermaidSvgs = {};
    const markdown = ${JSON.stringify(bodyMarkdown)};
    const cachedMermaidSvgs = ${JSON.stringify(cachedMermaidSvgs)};
    const PDF_MERMAID_CACHE_VERSION = ${JSON.stringify(PDF_MERMAID_CACHE_VERSION)};
    const PAGE_CONTENT_HEIGHT_MM = 259;
    const PAGINATION_BUFFER_PX = 4;
    const PAGE_CONTENT_HEIGHT_PX = PAGE_CONTENT_HEIGHT_MM * (96 / 25.4) - PAGINATION_BUFFER_PX;
    const MERMAID_START_RE = /^(?:flowchart|graph|sequenceDiagram|classDiagram|erDiagram|journey|gantt|pie|mindmap|timeline|gitGraph|stateDiagram(?:-v2)?|classDiagram-v2|quadrantChart|requirementDiagram|block-beta|packet-beta|architecture(?:-beta)?|C4Context|C4Container|C4Component|C4Dynamic|C4Deployment)\\b/i;

    const slugify = (value) => ((value || '')
      .toLowerCase()
      .trim()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '') || 'section');

    const ensureUniqueId = (baseId, seen) => {
      let nextId = baseId;
      let suffix = 2;
      while (seen.has(nextId)) {
        nextId = baseId + '-' + suffix;
        suffix += 1;
      }
      seen.add(nextId);
      return nextId;
    };

    const decodeHtmlEntities = (value) => value
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>')
      .replace(/&amp;/g, '&')
      .replace(/&quot;/g, '"')
      .replace(/&#39;/g, "'");

    const stripKnownHtmlWrappers = (value) => value
      .replace(/<br\\s*\\/?>/gi, '\\n')
      .replace(/<\\/?(?:p|div|span|pre|code)\\b[^>]*>/gi, '')
      .replace(/\\n{3,}/g, '\\n\\n');

    const dedent = (value) => {
      const lines = value.split('\\n');
      const indents = lines
        .filter((line) => line.trim())
        .map((line) => (line.match(/^\\s*/)?.[0].length || 0));
      const minIndent = indents.length > 0 ? Math.min(...indents) : 0;
      return lines.map((line) => line.slice(minIndent)).join('\\n');
    };

    const escapeHtml = (value) => value.replace(/[&<>]/g, (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' }[char]));

    const normalizeMermaidCode = (raw) => {
      const decoded = decodeHtmlEntities(raw)
        .replace(/\\r\\n/g, '\\n')
        .replace(/\\u00A0/g, ' ')
        .replace(/[\\u200B-\\u200D\\uFEFF]/g, '')
        .trim();
      const fenced = decoded.match(/^\\\`\\\`\\\`(?:mermaid)?\\s*\\n([\\s\\S]*?)\\n\\\`\\\`\\\`$/i);
      const unfenced = stripKnownHtmlWrappers(fenced ? fenced[1] : decoded);
      const cleanLines = dedent(unfenced)
        .split('\\n')
        .map((line) => line.replace(/\\s+$/g, ''));
      const startIndex = cleanLines.findIndex((line) => MERMAID_START_RE.test(line.trim()));
      if (startIndex === -1) {
        return cleanLines.join('\\n').trim();
      }
      let includeFrom = startIndex;
      while (includeFrom > 0) {
        const previous = cleanLines[includeFrom - 1].trim();
        if (!previous || previous.startsWith('%%')) {
          includeFrom -= 1;
          continue;
        }
        break;
      }
      return cleanLines.slice(includeFrom).join('\\n').trim();
    };

    const detectMermaidType = (code) => {
      const firstMeaningfulLine = code
        .split('\\n')
        .map((line) => line.trim())
        .find((line) => line && !line.startsWith('%%'));

      if (!firstMeaningfulLine) return 'generic';
      if (/^sequenceDiagram\\b/i.test(firstMeaningfulLine)) return 'sequence';
      if (/^erDiagram\\b/i.test(firstMeaningfulLine)) return 'er';
      if (/^(?:flowchart|graph)\\b/i.test(firstMeaningfulLine)) return 'flow';
      if (/^classDiagram(?:-v2)?\\b/i.test(firstMeaningfulLine)) return 'class';
      if (/^stateDiagram(?:-v2)?\\b/i.test(firstMeaningfulLine)) return 'state';
      if (/^journey\\b/i.test(firstMeaningfulLine)) return 'journey';
      if (/^gantt\\b/i.test(firstMeaningfulLine)) return 'gantt';
      if (/^pie\\b/i.test(firstMeaningfulLine)) return 'pie';
      if (/^mindmap\\b/i.test(firstMeaningfulLine)) return 'mindmap';
      if (/^timeline\\b/i.test(firstMeaningfulLine)) return 'timeline';
      if (/^gitGraph\\b/i.test(firstMeaningfulLine)) return 'git';
      if (/^quadrantChart\\b/i.test(firstMeaningfulLine)) return 'quadrant';
      if (/^requirementDiagram\\b/i.test(firstMeaningfulLine)) return 'requirement';
      if (/^architecture(?:-beta)?\\b/i.test(firstMeaningfulLine)) return 'architecture';
      if (/^(?:C4Context|C4Container|C4Component|C4Dynamic|C4Deployment)\\b/.test(firstMeaningfulLine)) return 'c4';
      return 'generic';
    };

    const getDiagramSizing = (diagramType) => {
      switch (diagramType) {
        case 'sequence':
          return { maxWidth: 660, maxHeight: 380, forceFullWidth: false };
        case 'er':
          return { maxWidth: 700, maxHeight: 440, forceFullWidth: false };
        case 'flow':
          return { maxWidth: 760, maxHeight: 460, forceFullWidth: false };
        case 'class':
          return { maxWidth: 720, maxHeight: 460, forceFullWidth: false };
        case 'state':
          return { maxWidth: 700, maxHeight: 440, forceFullWidth: false };
        case 'journey':
          return { maxWidth: 620, maxHeight: 320, forceFullWidth: false };
        case 'gantt':
          return { maxWidth: 760, maxHeight: 420, forceFullWidth: false };
        case 'pie':
          return { maxWidth: 420, maxHeight: 320, forceFullWidth: false };
        case 'mindmap':
          return { maxWidth: 620, maxHeight: 420, forceFullWidth: false };
        case 'timeline':
          return { maxWidth: 700, maxHeight: 340, forceFullWidth: false };
        case 'git':
          return { maxWidth: 720, maxHeight: 340, forceFullWidth: false };
        case 'quadrant':
          return { maxWidth: 520, maxHeight: 360, forceFullWidth: false };
        case 'requirement':
          return { maxWidth: 720, maxHeight: 460, forceFullWidth: false };
        case 'architecture':
          return { maxWidth: 760, maxHeight: 460, forceFullWidth: false };
        case 'c4':
          return { maxWidth: 760, maxHeight: 500, forceFullWidth: false };
        default:
          return { maxWidth: 700, maxHeight: 440, forceFullWidth: false };
      }
    };

    const simpleHash = (input) => {
      let hash = 5381;
      for (let i = 0; i < input.length; i += 1) {
        hash = ((hash << 5) + hash) ^ input.charCodeAt(i);
      }
      return (hash >>> 0).toString(36);
    };

    const getMermaidCacheKey = (code) => PDF_MERMAID_CACHE_VERSION + '-' + simpleHash(code);

    const applySvgSizing = (wrapper, sizing) => {
      const svg = wrapper.querySelector('svg');
      if (!svg) return;

      const width = Number.parseFloat(svg.getAttribute('width') || '');
      const height = Number.parseFloat(svg.getAttribute('height') || '');
      if (!svg.getAttribute('viewBox') && Number.isFinite(width) && Number.isFinite(height) && width > 0 && height > 0) {
        svg.setAttribute('viewBox', '0 0 ' + width + ' ' + height);
      }
      svg.removeAttribute('height');
      svg.removeAttribute('width');
      svg.setAttribute('preserveAspectRatio', 'xMidYMid meet');
      svg.style.maxWidth = '100%';
      svg.style.width = sizing.forceFullWidth
        ? '100%'
        : (Number.isFinite(width) && width > 0 ? Math.min(width, sizing.maxWidth) + 'px' : 'auto');
      svg.style.height = 'auto';
      svg.style.overflow = 'visible';
      if (Number.isFinite(sizing.maxHeight)) {
        svg.style.maxHeight = sizing.maxHeight + 'px';
      }
      if (Number.isFinite(height) && height > 0 && Number.isFinite(width) && width > 0 && (height / width) > 1.35) {
        svg.style.maxHeight = Math.min(sizing.maxHeight, 500) + 'px';
      }
    };

    const createFooter = (pageNumber) => {
      const footer = document.createElement('div');
      footer.className = 'pdf-page-footer';
      footer.textContent = String(pageNumber);
      return footer;
    };

    const createPage = (pageNumber) => {
      const page = document.createElement('section');
      page.className = 'pdf-page';
      const body = document.createElement('div');
      body.className = 'pdf-page-body';
      page.appendChild(body);
      if (pageNumber != null) {
        page.appendChild(createFooter(pageNumber));
      }
      return { page, body };
    };

    const getNodeSpans = (nodes) => {
      if (!nodes.length) return [];
      return nodes.map((node, index) => {
        const nextTop = index < nodes.length - 1 ? nodes[index + 1].offsetTop : node.offsetTop + node.offsetHeight;
        const span = Math.max(node.offsetHeight, nextTop - node.offsetTop);
        const tocId = node.getAttribute('data-toc-id') || '';
        return {
          node,
          span,
          id: /^H[1-4]$/.test(node.tagName) ? node.id : tocId,
          text: /^H[1-4]$/.test(node.tagName) ? (node.textContent || '').trim() : '',
          level: /^H[1-4]$/.test(node.tagName) ? Number(node.tagName.substring(1)) : null,
          isHeading: /^H[1-4]$/.test(node.tagName),
        };
      });
    };

    const paginateMeasuredBlocks = (blocks, firstPageAvailablePx, nextPageAvailablePx) => {
      const pages = [];
      let currentPage = [];
      let remaining = firstPageAvailablePx;

      for (let index = 0; index < blocks.length; index += 1) {
        const block = blocks[index];
        const nextBlock = blocks[index + 1];
        const required = block.isHeading && nextBlock
          ? Math.max(block.span + Math.min(nextBlock.span, 72), block.span)
          : block.span;

        if (currentPage.length > 0 && required > remaining) {
          pages.push(currentPage);
          currentPage = [];
          remaining = nextPageAvailablePx;
        }

        currentPage.push(block);
        remaining -= block.span;

        if (remaining < 0 && currentPage.length === 1) {
          pages.push(currentPage);
          currentPage = [];
          remaining = nextPageAvailablePx;
        }
      }

      if (currentPage.length > 0) {
        pages.push(currentPage);
      }

      return pages;
    };

    const renderMermaidBlocks = async (root) => {
      const mermaidBlocks = Array.from(root.querySelectorAll('pre code.language-mermaid'));
      if (mermaidBlocks.length === 0) return;

      mermaid.initialize({
        startOnLoad: false,
        theme: 'neutral',
        securityLevel: 'loose',
        fontFamily: 'Inter, system-ui, sans-serif',
        flowchart: { useMaxWidth: true, htmlLabels: true, curve: 'basis' },
        sequence: { useMaxWidth: true, wrap: true },
        er: { useMaxWidth: true },
      });

      for (const block of mermaidBlocks) {
        const pre = block.closest('pre');
        if (!pre) continue;

        const code = normalizeMermaidCode(block.textContent || '');
        const diagramType = detectMermaidType(code);
        const sizing = getDiagramSizing(diagramType);
        const cacheKey = getMermaidCacheKey(code);
        const wrapper = document.createElement('div');
        wrapper.className = 'mermaid diagram-' + diagramType;

        if (!code) {
          wrapper.innerHTML = '<pre><code>Mermaid diagram is empty.</code></pre>';
          pre.replaceWith(wrapper);
          continue;
        }

        const cachedSvg = cachedMermaidSvgs[cacheKey];
        if (cachedSvg) {
          wrapper.innerHTML = cachedSvg;
          applySvgSizing(wrapper, sizing);
          pre.replaceWith(wrapper);
          continue;
        }

        try {
          const id = 'pdf-mermaid-' + Math.random().toString(36).slice(2);
          const result = await mermaid.render(id, code);
          wrapper.innerHTML = result.svg;
          applySvgSizing(wrapper, sizing);
          window.__renderedMermaidSvgs[cacheKey] = wrapper.innerHTML;
        } catch {
          wrapper.innerHTML = '<pre><code>' + escapeHtml(code) + '</code></pre>';
        }

        pre.replaceWith(wrapper);
      }
    };

    const buildMeasuredDocument = async () => {
      const measureDoc = document.getElementById('measure-doc');
      if (!measureDoc) return null;

      measureDoc.innerHTML = marked.parse(markdown, { gfm: true, breaks: false });
      await renderMermaidBlocks(measureDoc);

      const seenIds = new Set();
      Array.from(measureDoc.querySelectorAll('h1, h2, h3, h4')).forEach((heading) => {
        heading.id = ensureUniqueId(slugify(heading.textContent || ''), seenIds);
      });

      const measuredBlocks = getNodeSpans(Array.from(measureDoc.children));
      const contentPages = paginateMeasuredBlocks(measuredBlocks, PAGE_CONTENT_HEIGHT_PX, PAGE_CONTENT_HEIGHT_PX);
      const headingPageMap = new Map();

      contentPages.forEach((pageBlocks, pageIndex) => {
        pageBlocks.forEach((block) => {
          if (block.isHeading && block.id) {
            headingPageMap.set(block.id, {
              id: block.id,
              text: block.text,
              level: block.level,
              relativePageNumber: pageIndex + 1,
            });
          }
        });
      });

      return { contentPages, headingPageMap };
    };

    const measureTocPages = (tocItems, tocOffset) => {
      const measureToc = document.getElementById('measure-toc');
      if (!measureToc) return [];

      const buildRows = (title) => {
        measureToc.innerHTML = '';

        const titleEl = document.createElement('h1');
        titleEl.className = 'toc-title';
        titleEl.textContent = title;
        measureToc.appendChild(titleEl);

        const list = document.createElement('div');
        list.className = 'toc-list';
        measureToc.appendChild(list);

        tocItems.forEach((item) => {
          const row = document.createElement('div');
          row.className = 'toc-row';
          row.setAttribute('data-toc-id', item.id);

          const link = document.createElement('a');
          link.className = 'toc-link level-' + item.level;
          link.href = '#' + item.id;
          link.textContent = item.text;

          const dots = document.createElement('span');
          dots.className = 'toc-dots';

          const page = document.createElement('span');
          page.className = 'toc-page-number';
          page.textContent = String(item.relativePageNumber + tocOffset);

          row.appendChild(link);
          row.appendChild(dots);
          row.appendChild(page);
          list.appendChild(row);
        });

        return {
          titleHeight: titleEl.offsetHeight + 12,
          rows: getNodeSpans(Array.from(list.children)),
        };
      };

      const firstLayout = buildRows('Table of Contents');
      const continuationLayout = buildRows('Table of Contents (continued)');
      const pages = paginateMeasuredBlocks(
        firstLayout.rows,
        PAGE_CONTENT_HEIGHT_PX - firstLayout.titleHeight,
        PAGE_CONTENT_HEIGHT_PX - continuationLayout.titleHeight,
      );

      return pages.map((rows, index) => ({
        title: index === 0 ? 'Table of Contents' : 'Table of Contents (continued)',
        showSubtitle: index === 0,
        rows,
      }));
    };

    const buildOutput = async () => {
      const renderOutput = document.getElementById('render-output');
      if (!renderOutput) {
        window.__pdfReady = true;
        return;
      }

      const documentModel = await buildMeasuredDocument();
      if (!documentModel) {
        window.__pdfReady = true;
        return;
      }

      const tocItemsBase = Array.from(documentModel.headingPageMap.values());
      let tocPages = [];
      let tocOffset = 0;

      for (let i = 0; i < 4; i += 1) {
        tocPages = measureTocPages(tocItemsBase, tocOffset);
        if (tocPages.length === tocOffset) break;
        tocOffset = tocPages.length;
      }

      tocPages = measureTocPages(tocItemsBase, tocOffset).filter((page) => page.rows.length > 0);
      const pageNumberOffset = tocPages.length;

      tocPages.forEach((tocPage, pageIndex) => {
        const { page, body } = createPage(pageIndex + 1);

        const title = document.createElement('h1');
        title.className = 'toc-title';
        title.textContent = tocPage.title;
        body.appendChild(title);

        const list = document.createElement('div');
        list.className = 'toc-list';

        tocPage.rows.forEach((rowData) => {
          const headingInfo = documentModel.headingPageMap.get(rowData.id);
          if (!headingInfo) return;

          const row = document.createElement('div');
          row.className = 'toc-row';

          const link = document.createElement('a');
          link.className = 'toc-link level-' + headingInfo.level;
          link.href = '#' + headingInfo.id;
          link.textContent = headingInfo.text;

          const dots = document.createElement('span');
          dots.className = 'toc-dots';

          const pageNo = document.createElement('span');
          pageNo.className = 'toc-page-number';
          pageNo.textContent = String(headingInfo.relativePageNumber + pageNumberOffset);

          row.appendChild(link);
          row.appendChild(dots);
          row.appendChild(pageNo);
          list.appendChild(row);
        });

        body.appendChild(list);
        renderOutput.appendChild(page);
      });

      documentModel.contentPages.filter((contentPage) => contentPage.length > 0).forEach((contentPage, pageIndex) => {
        const { page, body } = createPage(pageNumberOffset + pageIndex + 1);
        contentPage.forEach((block, blockIndex) => {
          const cloned = block.node.cloneNode(true);
          if (blockIndex === 0 && cloned.style) {
            cloned.style.marginTop = '0';
          }
          body.appendChild(cloned);
        });
        renderOutput.appendChild(page);
      });

      window.__pdfReady = true;
    };

    buildOutput();
  </script>
</body>
</html>`;

    const browser = await getPdfBrowser();
    let page: any = null;

    try {
      page = await browser.newPage();
      await page.setViewport({ width: 1440, height: 2048, deviceScaleFactor: 1 });
      await page.setContent(fullHtml, { waitUntil: 'networkidle0', timeout: 60000 });
      await page.waitForFunction(() => (globalThis as { __pdfReady?: boolean }).__pdfReady === true, { timeout: 60000 });
      const renderedMermaidSvgs = await page.evaluate(() => (globalThis as { __renderedMermaidSvgs?: Record<string, string> }).__renderedMermaidSvgs || {});
      if (Object.keys(renderedMermaidSvgs).length > 0) {
        await persistMermaidSvgCache(renderedMermaidSvgs);
      }

      const pdfBuffer = await page.pdf({
        preferCSSPageSize: true,
        printBackground: true,
        margin: { top: '0', right: '0', bottom: '0', left: '0' },
      });
      await storage.save(pdfCacheKey, Buffer.from(pdfBuffer));

      await auditLog(user.id, 'export_pdf', 'tdd', id, { cache: 'miss' });

      return new NextResponse(pdfBuffer, {
        headers: {
          'Content-Type': 'application/pdf',
          'Content-Disposition': `attachment; filename="${(tdd.title || 'tdd').replace(/[^a-zA-Z0-9]/g, '_')}.pdf"`,
          'Cache-Control': 'private, no-store',
        },
      });
    } finally {
      await page?.close().catch(() => {});
    }
  } catch (error: any) {
    if (error.message === 'Unauthorized') {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }
    console.error('PDF export error:', error);
    return NextResponse.json({ success: false, error: 'Failed to generate PDF' }, { status: 500 });
  }
}
