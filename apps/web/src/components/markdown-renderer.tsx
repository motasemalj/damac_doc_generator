'use client';

import { memo, useEffect, useMemo, useRef, useCallback } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import type { Components } from 'react-markdown';
import { getDocumentStructure } from '@/lib/document-structure';

interface MarkdownRendererProps {
  content: string;
  className?: string;
}

let mermaidCounter = 0;
const MERMAID_CACHE_VERSION = 'web-v1';
const MAX_MERMAID_CACHE_ENTRIES = 100;
const MERMAID_CONFIG = {
  startOnLoad: false,
  theme: 'neutral' as const,
  securityLevel: 'loose' as const,
  fontFamily: 'Inter, system-ui, sans-serif',
  flowchart: { useMaxWidth: true, htmlLabels: true, curve: 'basis' as const },
  sequence: { useMaxWidth: true, wrap: true },
  er: { useMaxWidth: true },
};
const mermaidSvgCache = new Map<string, string>();
const mermaidInflightCache = new Map<string, Promise<string>>();
let mermaidModulePromise: Promise<any> | null = null;
let mermaidInitialized = false;

/**
 * Cleans raw AI output so react-markdown receives pure Markdown.
 * Handles the common case where the LLM wraps its reply in
 * ```markdown ... ``` or ```md ... ``` fences.
 */
function cleanMarkdownContent(raw: string): string {
  let s = raw;

  // Strip leading/trailing whitespace
  s = s.trim();

  // Pattern: entire content wrapped in ```markdown ... ``` (or ```md, or bare ```)
  // May appear at the very start/end or with small whitespace
  const wrapperPatterns = [
    /^```(?:markdown|md)?\s*\n([\s\S]*?)\n\s*```\s*$/,
    /^```(?:markdown|md)?\s*\r?\n([\s\S]*?)\r?\n\s*```\s*$/,
  ];

  for (const pattern of wrapperPatterns) {
    const match = s.match(pattern);
    if (match) {
      s = match[1];
      break;
    }
  }

  // Also handle if there's a leading ``` line with no closing (truncated)
  if (/^```(?:markdown|md)?\s*$/m.test(s.split('\n')[0]) && !s.endsWith('```')) {
    s = s.replace(/^```(?:markdown|md)?\s*\n/, '');
  }

  // And handle a trailing ``` that closes a wrapper
  if (s.endsWith('\n```')) {
    // Only strip if the ``` isn't inside a code block
    const lines = s.split('\n');
    let fenceDepth = 0;
    for (let i = 0; i < lines.length - 1; i++) {
      if (/^```/.test(lines[i].trim())) fenceDepth++;
    }
    // If even number of fences before the last ```, the last one is a stray wrapper close
    if (fenceDepth % 2 === 0) {
      s = s.slice(0, -4);
    }
  }

  return s.trim();
}

/**
 * Replace DAMAC logo references — both the intended placeholder and
 * any hallucinated image markdown the AI may produce — with nothing.
 * The actual logo is rendered by the component itself above the markdown.
 */
function replaceDamacLogoRefs(md: string): string {
  let s = md;

  // Remove the HTML comment placeholder (rendered as a visual logo by the component)
  s = s.replace(/<!--\s*DAMAC_LOGO\s*-->/g, '');

  // Remove any markdown image tags referencing DAMAC logo (hallucinated URLs)
  s = s.replace(/!\[.*?[Dd][Aa][Mm][Aa][Cc].*?\]\(.*?\)\s*/g, '');

  return s;
}

export const MarkdownRenderer = memo(function MarkdownRenderer({ content, className = '' }: MarkdownRendererProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const renderIdRef = useRef(0);

  const renderMermaidDiagrams = useCallback(async () => {
    if (!containerRef.current) return;
    const currentRenderId = ++renderIdRef.current;

    try {
      const mermaid = await getMermaidModule();

      if (currentRenderId !== renderIdRef.current) return;

      const elements = containerRef.current?.querySelectorAll('.mermaid-pending');
      if (!elements || elements.length === 0) return;

      for (let i = 0; i < elements.length; i++) {
        if (currentRenderId !== renderIdRef.current) return;

        const el = elements[i] as HTMLElement;
        const rawCode = el.getAttribute('data-mermaid-code') || '';
        const code = normalizeMermaidCode(rawCode);
        if (!code.trim()) continue;

        try {
          const svg = await getCachedMermaidSvg(mermaid, code.trim());
          el.classList.remove('mermaid-pending');
          el.classList.add('mermaid-rendered');
          el.innerHTML = svg;
        } catch {
          el.classList.remove('mermaid-pending');
          el.classList.add('mermaid-error');
          el.innerHTML = `
            <div class="mermaid-error-box">
              <p><strong>Diagram rendering failed</strong></p>
              <pre>${escapeHtml(code.trim().substring(0, 300))}</pre>
            </div>`;
        }
      }
    } catch {
      // mermaid module unavailable
    }
  }, []);

  const cleaned = useMemo(
    () => replaceDamacLogoRefs(cleanMarkdownContent(content)),
    [content],
  );
  const documentStructure = useMemo(() => getDocumentStructure(cleaned), [cleaned]);
  const coverInfo = useMemo(() => extractCoverInfo(documentStructure), [documentStructure]);
  const bodyMarkdown = useMemo(
    () => injectGeneratedTableOfContents(documentStructure.afterCoverMarkdown || documentStructure.normalizedMarkdown),
    [documentStructure],
  );

  useEffect(() => {
    const timer = setTimeout(renderMermaidDiagrams, 200);
    return () => clearTimeout(timer);
  }, [bodyMarkdown, renderMermaidDiagrams]);

  const components: Components = useMemo(() => ({
    pre({ children, node, ...props }) {
      // Detect mermaid: react-markdown nests <code> inside <pre>.
      // The code element may be a direct child or nested.
      const codeChild = findCodeChild(children);
      if (codeChild) {
        const lang = getLanguageFromClassName(codeChild.props?.className);
        if (lang === 'mermaid') {
          const code = extractTextContent(codeChild.props?.children);
          return (
            <div
              className="mermaid-pending mermaid-container"
              data-mermaid-code={code}
            >
              <div className="mermaid-loading">
                <div className="mermaid-loading-spinner" />
                <span>Rendering diagram...</span>
              </div>
            </div>
          );
        }
      }

      return <pre className="code-block" {...props}>{children}</pre>;
    },

    code({ className, children, node, ...props }) {
      const lang = getLanguageFromClassName(className);

      // If this code is a direct child of <pre>, it's a block code element.
      // react-markdown always wraps fenced code in <pre><code>.
      // Inline code has no className at all (no language-xxx).
      // But fenced code without a language ALSO has no className.
      // We solve this: the `pre` handler above always wraps with .code-block,
      // so any <code> inside .code-block is guaranteed to be block-level.
      // We just need to handle the inline case here.

      if (lang === 'mermaid') {
        return <code data-language="mermaid" className={className} {...props}>{children}</code>;
      }

      if (lang) {
        // Definitely block-level (has language tag)
        return (
          <code className={`${className || ''} block-code`} {...props}>
            <span className="code-lang-badge">{lang}</span>
            {children}
          </code>
        );
      }

      // No lang: Could be inline or a no-lang fenced block.
      // Inline codes are NOT wrapped in <pre> by react-markdown.
      // We can't check parent here, but we set the class and let CSS handle it:
      // - Inside pre.code-block → forced to block style via CSS
      // - Outside pre → inline style
      return (
        <code className="auto-code" {...props}>
          {children}
        </code>
      );
    },

    table({ children, ...props }) {
      return (
        <div className="table-wrapper">
          <table {...props}>{children}</table>
        </div>
      );
    },

    thead({ children, ...props }) {
      return <thead {...props}>{children}</thead>;
    },

    th({ children, ...props }) {
      return <th {...props}>{children}</th>;
    },

    td({ children, ...props }) {
      return <td {...props}>{children}</td>;
    },

    h1({ children, ...props }) {
      return <h1 id={makeHeadingId(children)} {...props}>{children}</h1>;
    },

    h2({ children, ...props }) {
      return <h2 id={makeHeadingId(children)} {...props}>{children}</h2>;
    },

    h3({ children, ...props }) {
      return <h3 id={makeHeadingId(children)} {...props}>{children}</h3>;
    },

    h4({ children, ...props }) {
      return <h4 id={makeHeadingId(children)} {...props}>{children}</h4>;
    },

    h5({ children, ...props }) {
      return <h5 id={makeHeadingId(children)} {...props}>{children}</h5>;
    },

    h6({ children, ...props }) {
      return <h6 id={makeHeadingId(children)} {...props}>{children}</h6>;
    },

    a({ children, href, ...props }) {
      if (href?.startsWith('#')) {
        return <a href={href} {...props}>{children}</a>;
      }

      return (
        <a href={href} target="_blank" rel="noopener noreferrer" {...props}>
          {children}
        </a>
      );
    },

    blockquote({ children, ...props }) {
      return <blockquote {...props}>{children}</blockquote>;
    },

    hr() {
      return <hr />;
    },

    img({ src, alt, ...props }) {
      return <img src={src} alt={alt || ''} loading="lazy" {...props} />;
    },
  }), []);

  return (
    <div ref={containerRef} className={`markdown-body ${className}`}>
      {coverInfo && (
        <div className="tdd-cover-page">
          <div className="tdd-cover-inner">
            <div className="tdd-cover-logo">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src="/brand/damac-logo.svg" alt="DAMAC" />
            </div>
            <div className="tdd-cover-divider" />
            <h1 className="tdd-cover-title">{coverInfo.systemName}</h1>
            <p className="tdd-cover-subtitle">Technical Design Documentation</p>
            {coverInfo.date && <p className="tdd-cover-date">{coverInfo.date}</p>}
          </div>
        </div>
      )}
      <ReactMarkdown remarkPlugins={[remarkGfm]} components={components}>
        {bodyMarkdown}
      </ReactMarkdown>
    </div>
  );
});

// ---------- Cover Page Extraction ----------

interface CoverInfo {
  systemName: string;
  date: string | null;
  remainingMarkdown: string;
}

function extractCoverInfo(documentStructure: ReturnType<typeof getDocumentStructure>): CoverInfo | null {
  if (!documentStructure.coverTitle || !documentStructure.systemName) {
    return null;
  }

  const today = new Date().toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });

  return {
    systemName: documentStructure.systemName,
    date: today,
    remainingMarkdown: documentStructure.afterCoverMarkdown || documentStructure.normalizedMarkdown,
  };
}

// ---------- Helpers ----------

function makeHeadingId(children: React.ReactNode): string {
  return slugifyHeading(extractTextContent(children));
}

function extractTextContent(node: React.ReactNode): string {
  if (node == null) return '';
  if (typeof node === 'string') return node;
  if (typeof node === 'number') return String(node);
  if (Array.isArray(node)) return node.map(extractTextContent).join('');
  if (typeof node === 'object' && 'props' in node) {
    return extractTextContent((node as any).props?.children);
  }
  return '';
}

function getLanguageFromClassName(className?: string): string | null {
  if (!className) return null;
  const match = /language-(\w+)/.exec(className);
  return match ? match[1] : null;
}

/**
 * Walk children tree to find the first <code> React element.
 * react-markdown usually produces <pre><code>…</code></pre>,
 * but children can be an array or a single element.
 */
function findCodeChild(children: React.ReactNode): any {
  if (!children) return null;

  if (Array.isArray(children)) {
    for (const c of children) {
      const found = findCodeChild(c);
      if (found) return found;
    }
    return null;
  }

  if (typeof children === 'object' && children !== null && 'props' in children) {
    const el = children as any;
    if (el.type === 'code' || el.props?.mdxType === 'code') return el;
    if (typeof el.type === 'function' || typeof el.type === 'object') {
      // Custom component wrapping code
      if (el.props?.className && /language-/.test(el.props.className)) return el;
    }
    return findCodeChild(el.props?.children);
  }

  return null;
}

function escapeHtml(str: string): string {
  return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

function decodeHtmlEntities(str: string): string {
  return str
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'");
}

function normalizeMermaidCode(raw: string): string {
  const decoded = decodeHtmlEntities(raw)
    .replace(/\r\n/g, '\n')
    .replace(/\u00A0/g, ' ')
    .replace(/[\u200B-\u200D\uFEFF]/g, '')
    .trim();
  const fenced = decoded.match(/^```(?:mermaid)?\s*\n([\s\S]*?)\n```$/i);
  const unfenced = stripKnownHtmlWrappers(fenced ? fenced[1] : decoded);
  const lines = dedent(unfenced)
    .split('\n')
    .map((line) => line.replace(/\s+$/g, ''));
  const startIndex = lines.findIndex((line) => /^(?:flowchart|graph|sequenceDiagram|classDiagram|erDiagram|journey|gantt|pie|mindmap|timeline|gitGraph|stateDiagram(?:-v2)?|classDiagram-v2|quadrantChart|requirementDiagram|block-beta|packet-beta|architecture(?:-beta)?|C4Context|C4Container|C4Component|C4Dynamic|C4Deployment)\b/i.test(line.trim()));

  if (startIndex === -1) {
    return lines.join('\n').trim();
  }

  let includeFrom = startIndex;
  while (includeFrom > 0) {
    const previous = lines[includeFrom - 1].trim();
    if (!previous || previous.startsWith('%%')) {
      includeFrom -= 1;
      continue;
    }
    break;
  }

  return lines.slice(includeFrom).join('\n').trim();
}

function dedent(str: string): string {
  const lines = str.split('\n');
  const indents = lines
    .filter((line) => line.trim())
    .map((line) => line.match(/^\s*/)?.[0].length || 0);
  const minIndent = indents.length > 0 ? Math.min(...indents) : 0;
  return lines.map((line) => line.slice(minIndent)).join('\n');
}

function stripKnownHtmlWrappers(str: string): string {
  return str
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/?(?:p|div|span|pre|code)\b[^>]*>/gi, '')
    .replace(/\n{3,}/g, '\n\n');
}

async function getMermaidModule() {
  if (!mermaidModulePromise) {
    mermaidModulePromise = import('mermaid').then((mod) => mod.default);
  }

  const mermaid = await mermaidModulePromise;
  if (!mermaidInitialized) {
    mermaid.initialize(MERMAID_CONFIG);
    mermaidInitialized = true;
  }

  return mermaid;
}

function getMermaidCacheKey(code: string): string {
  return `${MERMAID_CACHE_VERSION}:${simpleHash(`${JSON.stringify(MERMAID_CONFIG)}:${code}`)}`;
}

async function getCachedMermaidSvg(mermaid: any, code: string): Promise<string> {
  const cacheKey = getMermaidCacheKey(code);
  const cached = mermaidSvgCache.get(cacheKey);
  if (cached) {
    mermaidSvgCache.delete(cacheKey);
    mermaidSvgCache.set(cacheKey, cached);
    return cached;
  }

  const inflight = mermaidInflightCache.get(cacheKey);
  if (inflight) return inflight;

  const renderPromise = mermaid.render(`mmd-${++mermaidCounter}`, code).then(({ svg }: { svg: string }) => {
    setMermaidCache(cacheKey, svg);
    mermaidInflightCache.delete(cacheKey);
    return svg;
  }).catch((error: unknown) => {
    mermaidInflightCache.delete(cacheKey);
    throw error;
  });

  mermaidInflightCache.set(cacheKey, renderPromise);
  return renderPromise;
}

function setMermaidCache(key: string, svg: string) {
  if (mermaidSvgCache.has(key)) {
    mermaidSvgCache.delete(key);
  }
  mermaidSvgCache.set(key, svg);
  if (mermaidSvgCache.size > MAX_MERMAID_CACHE_ENTRIES) {
    const oldestKey = mermaidSvgCache.keys().next().value;
    if (oldestKey) mermaidSvgCache.delete(oldestKey);
  }
}

function simpleHash(input: string): string {
  let hash = 5381;
  for (let i = 0; i < input.length; i += 1) {
    hash = ((hash << 5) + hash) ^ input.charCodeAt(i);
  }
  return (hash >>> 0).toString(36);
}

// ---------- TOC extraction ----------

interface TocItem {
  level: number;
  text: string;
  id: string;
}

interface HeadingMatch extends TocItem {
  lineIndex: number;
}

function normalizeHeadingText(text: string): string {
  return text
    .replace(/!\[([^\]]*)\]\([^)]*\)/g, '$1')
    .replace(/\[([^\]]*)\]\([^)]*\)/g, '$1')
    .replace(/\*\*/g, '')
    .replace(/\*/g, '')
    .replace(/`/g, '')
    .replace(/<[^>]+>/g, '')
    .trim();
}

function slugifyHeading(text: string): string {
  return normalizeHeadingText(text)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
}

function isTableOfContentsHeading(text: string): boolean {
  const normalized = normalizeHeadingText(text)
    .replace(/^\d+(?:\.\d+)*\s+/, '')
    .trim()
    .toLowerCase();

  return normalized === 'table of contents';
}

function collectMarkdownHeadings(markdown: string): HeadingMatch[] {
  const lines = markdown.split('\n');
  const items: HeadingMatch[] = [];
  let inFence = false;

  for (let lineIndex = 0; lineIndex < lines.length; lineIndex += 1) {
    const line = lines[lineIndex];
    const trimmed = line.trim();

    if (/^```/.test(trimmed)) {
      inFence = !inFence;
      continue;
    }

    if (inFence) continue;

    const match = /^(#{1,6})\s+(.+?)\s*$/.exec(line);
    if (!match) continue;

    const text = normalizeHeadingText(match[2]);
    const id = slugifyHeading(text);
    if (!text || !id) continue;

    items.push({
      level: match[1].length,
      text,
      id,
      lineIndex,
    });
  }

  return items;
}

function buildGeneratedToc(items: TocItem[]): string {
  if (items.length === 0) return '';

  const minLevel = Math.min(...items.map((item) => item.level));

  return items
    .map((item) => {
      const depth = Math.max(item.level - minLevel, 0);
      return `${'  '.repeat(depth)}- [${item.text}](#${item.id})`;
    })
    .join('\n');
}

function injectGeneratedTableOfContents(markdown: string): string {
  const headings = collectMarkdownHeadings(markdown);
  const tocHeading = headings.find((heading) => isTableOfContentsHeading(heading.text));

  if (!tocHeading) return markdown;

  const tocItems = headings.filter((heading) => !isTableOfContentsHeading(heading.text));
  const generatedToc = buildGeneratedToc(tocItems);
  const lines = markdown.split('\n');

  let nextHeadingLineIndex = lines.length;
  for (const heading of headings) {
    if (heading.lineIndex <= tocHeading.lineIndex) continue;
    if (heading.level <= tocHeading.level) {
      nextHeadingLineIndex = heading.lineIndex;
      break;
    }
  }

  const replacementLines = generatedToc ? ['', generatedToc, ''] : [''];

  return [
    ...lines.slice(0, tocHeading.lineIndex + 1),
    ...replacementLines,
    ...lines.slice(nextHeadingLineIndex),
  ].join('\n').replace(/\n{3,}/g, '\n\n').trim();
}

export function extractTocItems(markdown: string): TocItem[] {
  const cleaned = cleanMarkdownContent(markdown);
  const documentStructure = getDocumentStructure(cleaned);
  const bodyMarkdown = documentStructure.afterCoverMarkdown || documentStructure.normalizedMarkdown;

  return collectMarkdownHeadings(bodyMarkdown)
    .filter((item) => !isTableOfContentsHeading(item.text))
    .map(({ level, text, id }) => ({ level, text, id }));
}
