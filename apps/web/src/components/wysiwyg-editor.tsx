'use client';

import { useEffect, useRef, useState, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { Bold, Italic, Code, Link2, List, ListOrdered, Quote } from 'lucide-react';

interface WysiwygEditorProps {
  content: string;
  onChange: (markdown: string) => void;
  className?: string;
}

export function WysiwygEditor({ content, onChange, className = '' }: WysiwygEditorProps) {
  const editorRef = useRef<HTMLDivElement>(null);
  const toolbarRef = useRef<HTMLDivElement>(null);
  const [toolbarVisible, setToolbarVisible] = useState(false);
  const [toolbarPos, setToolbarPos] = useState({ top: 0, left: 0 });
  const suppressInputRef = useRef(false);
  const initializedRef = useRef(false);
  const contentRef = useRef(content);

  contentRef.current = content;

  const markdownToHtml = useCallback((md: string): string => {
    if (!md || !md.trim()) return '<p><br></p>';
    let html = md;

    html = html.replace(/```mermaid\n([\s\S]*?)```/g, (_, code) =>
      `<div class="mermaid-wysiwyg-block" data-mermaid="${escapeAttr(code.trim())}" contenteditable="false"><div class="mermaid-wysiwyg-label">Mermaid Diagram</div><pre>${escapeHtml(code.trim())}</pre></div>`);

    html = html.replace(/```(\w*)\n([\s\S]*?)```/g, (_, lang, code) =>
      `<pre class="wysiwyg-code-block" data-lang="${lang}" contenteditable="false"><code>${escapeHtml(code)}</code></pre>`);

    html = html.replace(
      /(\|.+\|)\n(\|[-:| ]+\|)\n((?:\|.+\|\n?)*)/g,
      (match) => `<div class="wysiwyg-table-block" contenteditable="false"><pre>${escapeHtml(match.trim())}</pre></div>`,
    );

    html = html.replace(/^######\s+(.+)$/gm, '<h6>$1</h6>');
    html = html.replace(/^#####\s+(.+)$/gm, '<h5>$1</h5>');
    html = html.replace(/^####\s+(.+)$/gm, '<h4>$1</h4>');
    html = html.replace(/^###\s+(.+)$/gm, '<h3>$1</h3>');
    html = html.replace(/^##\s+(.+)$/gm, '<h2>$1</h2>');
    html = html.replace(/^#\s+(.+)$/gm, '<h1>$1</h1>');

    html = html.replace(/^>\s+(.+)$/gm, '<blockquote><p>$1</p></blockquote>');
    html = html.replace(/^---$/gm, '<hr>');

    html = html.replace(/\*\*\*(.+?)\*\*\*/g, '<strong><em>$1</em></strong>');
    html = html.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');
    html = html.replace(/(?<!\*)\*([^*\n]+?)\*(?!\*)/g, '<em>$1</em>');
    html = html.replace(/`([^`\n]+)`/g, '<code class="inline-code">$1</code>');
    html = html.replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2">$1</a>');

    html = html.replace(/(?:^[-*]\s+.+\n?)+/gm, (match) => {
      const items = match.trim().split('\n').map((l) => `<li>${l.replace(/^[-*]\s+/, '')}</li>`).join('');
      return `<ul>${items}</ul>`;
    });

    html = html.replace(/(?:^\d+\.\s+.+\n?)+/gm, (match) => {
      const items = match.trim().split('\n').map((l) => `<li>${l.replace(/^\d+\.\s+/, '')}</li>`).join('');
      return `<ol>${items}</ol>`;
    });

    const lines = html.split('\n');
    const processed = lines.map((line) => {
      const trimmed = line.trim();
      if (!trimmed) return '';
      if (/^<[houblpd\/]/.test(trimmed) || /^<(div|pre|blockquote|hr)/.test(trimmed)) return trimmed;
      return `<p>${trimmed}</p>`;
    });

    return processed.filter(Boolean).join('\n') || '<p><br></p>';
  }, []);

  const htmlToMarkdown = useCallback((el: HTMLElement): string => {
    const processNode = (node: Node): string => {
      if (node.nodeType === Node.TEXT_NODE) {
        return node.textContent || '';
      }
      if (node.nodeType !== Node.ELEMENT_NODE) return '';

      const element = node as HTMLElement;
      const tag = element.tagName.toLowerCase();

      if (element.classList.contains('mermaid-wysiwyg-block')) {
        return `\n\`\`\`mermaid\n${element.getAttribute('data-mermaid') || ''}\n\`\`\`\n`;
      }
      if (element.classList.contains('wysiwyg-code-block')) {
        const lang = element.getAttribute('data-lang') || '';
        const code = element.querySelector('code')?.textContent || element.textContent || '';
        return `\n\`\`\`${lang}\n${code}\n\`\`\`\n`;
      }
      if (element.classList.contains('wysiwyg-table-block')) {
        return '\n' + (element.querySelector('pre')?.textContent || '') + '\n';
      }

      const childText = () => Array.from(element.childNodes).map(processNode).join('');

      switch (tag) {
        case 'h1': return `\n# ${childText().trim()}\n`;
        case 'h2': return `\n## ${childText().trim()}\n`;
        case 'h3': return `\n### ${childText().trim()}\n`;
        case 'h4': return `\n#### ${childText().trim()}\n`;
        case 'h5': return `\n##### ${childText().trim()}\n`;
        case 'h6': return `\n###### ${childText().trim()}\n`;
        case 'p': {
          const text = childText().trim();
          return text ? `\n${text}\n` : '\n';
        }
        case 'strong': case 'b': return `**${childText()}**`;
        case 'em': case 'i': return `*${childText()}*`;
        case 'code':
          if (element.parentElement?.tagName.toLowerCase() === 'pre') return childText();
          return `\`${childText()}\``;
        case 'a': return `[${childText()}](${element.getAttribute('href') || ''})`;
        case 'blockquote': return `\n> ${element.textContent?.trim() || ''}\n`;
        case 'hr': return '\n---\n';
        case 'ul': {
          const items = Array.from(element.querySelectorAll(':scope > li'));
          return '\n' + items.map((li) => `- ${li.textContent?.trim() || ''}`).join('\n') + '\n';
        }
        case 'ol': {
          const items = Array.from(element.querySelectorAll(':scope > li'));
          return '\n' + items.map((li, i) => `${i + 1}. ${li.textContent?.trim() || ''}`).join('\n') + '\n';
        }
        case 'li': return childText();
        case 'br': return '\n';
        case 'div': return '\n' + childText();
        default: return childText();
      }
    };

    return Array.from(el.childNodes).map(processNode).join('')
      .replace(/\n{3,}/g, '\n\n')
      .trim();
  }, []);

  // Set innerHTML once when content first becomes non-empty, or on external content reset (e.g. revision restore)
  useEffect(() => {
    if (!editorRef.current) return;

    if (!initializedRef.current && content && content.trim()) {
      initializedRef.current = true;
      suppressInputRef.current = true;
      editorRef.current.innerHTML = markdownToHtml(content);
      requestAnimationFrame(() => { suppressInputRef.current = false; });
      return;
    }

    // Detect external content reset (revision restore): the content prop changed
    // to something very different from what the editor currently holds
    if (initializedRef.current && content && content.trim()) {
      const currentEditorMd = htmlToMarkdown(editorRef.current);
      const propNorm = content.trim().substring(0, 200);
      const editorNorm = currentEditorMd.trim().substring(0, 200);

      if (propNorm !== editorNorm && Math.abs(content.length - currentEditorMd.length) > content.length * 0.3) {
        suppressInputRef.current = true;
        editorRef.current.innerHTML = markdownToHtml(content);
        requestAnimationFrame(() => { suppressInputRef.current = false; });
      }
    }
  }, [content, markdownToHtml, htmlToMarkdown]);

  const handleInput = useCallback(() => {
    if (!editorRef.current || suppressInputRef.current) return;
    const md = htmlToMarkdown(editorRef.current);
    onChange(md);
  }, [htmlToMarkdown, onChange]);

  // Toolbar: use fixed position and viewport coords so it's always visible (portal to body)
  const updateToolbarPosition = useCallback(() => {
    if (typeof document === 'undefined') return;
    const selection = window.getSelection();
    if (!selection || selection.rangeCount === 0 || selection.isCollapsed || !editorRef.current) {
      setToolbarVisible(false);
      return;
    }
    const anchor = selection.anchorNode;
    if (!anchor || !editorRef.current.contains(anchor)) {
      setToolbarVisible(false);
      return;
    }
    try {
      const range = selection.getRangeAt(0);
      const rect = range.getBoundingClientRect();
      const fallbackRect = range.getClientRects()[0];
      const activeRect = (rect.width === 0 && rect.height === 0 && fallbackRect) ? fallbackRect : rect;
      if (activeRect.width === 0 && activeRect.height === 0) {
        setToolbarVisible(false);
        return;
      }
      const toolbarWidth = toolbarRef.current?.offsetWidth ?? 280;
      const desiredTop = activeRect.top - 48;
      const desiredLeft = activeRect.left + activeRect.width / 2 - toolbarWidth / 2;
      const clampedTop = desiredTop < 12 ? activeRect.bottom + 8 : desiredTop;
      const maxLeft = Math.max(12, window.innerWidth - toolbarWidth - 12);
      setToolbarPos({
        top: clampedTop,
        left: Math.min(maxLeft, Math.max(12, desiredLeft)),
      });
      setToolbarVisible(true);
    } catch {
      setToolbarVisible(false);
    }
  }, []);

  useEffect(() => {
    const handler = () => {
      requestAnimationFrame(updateToolbarPosition);
    };
    document.addEventListener('selectionchange', handler);
    window.addEventListener('scroll', handler, true);
    window.addEventListener('resize', handler);
    return () => {
      document.removeEventListener('selectionchange', handler);
      window.removeEventListener('scroll', handler, true);
      window.removeEventListener('resize', handler);
    };
  }, [updateToolbarPosition]);

  const execFormat = useCallback((command: string, value?: string) => {
    document.execCommand(command, false, value);
    editorRef.current?.focus();
    setTimeout(() => {
      if (editorRef.current) {
        const md = htmlToMarkdown(editorRef.current);
        onChange(md);
      }
      updateToolbarPosition();
    }, 50);
  }, [htmlToMarkdown, onChange, updateToolbarPosition]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'b' && (e.metaKey || e.ctrlKey)) {
      e.preventDefault();
      execFormat('bold');
    } else if (e.key === 'i' && (e.metaKey || e.ctrlKey)) {
      e.preventDefault();
      execFormat('italic');
    }
  };

  const insertInlineHtml = useCallback((html: string) => {
    document.execCommand('insertHTML', false, html);
    editorRef.current?.focus();
    setTimeout(() => {
      if (editorRef.current) {
        const md = htmlToMarkdown(editorRef.current);
        onChange(md);
      }
    }, 50);
  }, [htmlToMarkdown, onChange]);

  return (
    <div className={`wysiwyg-editor-wrapper ${className}`}>
      {/* Floating toolbar: portal with fixed position so it stays visible and isn't clipped */}
      {toolbarVisible && typeof document !== 'undefined' && createPortal(
        <div
          ref={toolbarRef}
          className="wysiwyg-toolbar"
          style={{
            position: 'fixed',
            top: toolbarPos.top,
            left: toolbarPos.left,
          }}
          onMouseDown={(e) => e.preventDefault()}
        >
          <button type="button" onClick={() => execFormat('bold')} title="Bold (Cmd+B)"><Bold className="h-3.5 w-3.5" /></button>
          <button type="button" onClick={() => execFormat('italic')} title="Italic (Cmd+I)"><Italic className="h-3.5 w-3.5" /></button>
          <button type="button" onClick={() => {
            const sel = window.getSelection();
            if (sel && !sel.isCollapsed) {
              insertInlineHtml(`<code class="inline-code">${sel.toString()}</code>`);
            }
          }} title="Inline Code"><Code className="h-3.5 w-3.5" /></button>
          <div className="wysiwyg-toolbar-divider" />
          <button type="button" onClick={() => {
            const url = prompt('Enter URL:');
            if (url) execFormat('createLink', url);
          }} title="Link"><Link2 className="h-3.5 w-3.5" /></button>
          <button type="button" onClick={() => execFormat('insertUnorderedList')} title="Bullet List"><List className="h-3.5 w-3.5" /></button>
          <button type="button" onClick={() => execFormat('insertOrderedList')} title="Numbered List"><ListOrdered className="h-3.5 w-3.5" /></button>
          <div className="wysiwyg-toolbar-divider" />
          <button type="button" onClick={() => {
            const sel = window.getSelection();
            if (sel && !sel.isCollapsed) {
              insertInlineHtml(`<blockquote><p>${sel.toString()}</p></blockquote>`);
            }
          }} title="Blockquote"><Quote className="h-3.5 w-3.5" /></button>
        </div>,
        document.body,
      )}

      {/* Editable document */}
      <div
        ref={editorRef}
        className="wysiwyg-page markdown-body"
        contentEditable
        suppressContentEditableWarning
        onInput={handleInput}
        onKeyDown={handleKeyDown}
        onMouseUp={() => requestAnimationFrame(updateToolbarPosition)}
        onBlur={() => setToolbarVisible(false)}
      />
    </div>
  );
}

function escapeHtml(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

function escapeAttr(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}
