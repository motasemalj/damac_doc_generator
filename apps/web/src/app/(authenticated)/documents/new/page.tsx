'use client';

import { useState, useDeferredValue, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { MarkdownRenderer } from '@/components/markdown-renderer';
import {
  ArrowLeft, FileText, Eye, Code2, Columns2,
  Loader2, Upload, Sparkles, CheckCircle2,
} from 'lucide-react';
import { cn } from '@/lib/utils';

type PreviewMode = 'edit' | 'preview' | 'split';

export default function NewCustomDocumentPage() {
  const router = useRouter();
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [markdown, setMarkdown] = useState('');
  const [creating, setCreating] = useState(false);
  const [previewMode, setPreviewMode] = useState<PreviewMode>('split');
  const [dragOver, setDragOver] = useState(false);

  const deferredMarkdown = useDeferredValue(markdown);

  const handleCreate = useCallback(async () => {
    if (!title.trim() || !markdown.trim()) return;
    setCreating(true);
    try {
      const res = await fetch('/api/tdds', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: title.trim(),
          description: description.trim() || null,
          markdownContent: markdown.trim(),
        }),
      });
      const data = await res.json();
      if (data.success) {
        router.push(`/tdds/${data.data.id}/view`);
      }
    } catch {
      // handle silently
    } finally {
      setCreating(false);
    }
  }, [title, description, markdown, router]);

  const handleFileDrop = useCallback(async (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);

    const file = e.dataTransfer.files[0];
    if (!file) return;

    if (!file.name.endsWith('.md') && !file.name.endsWith('.markdown') && file.type !== 'text/markdown' && file.type !== 'text/plain') {
      return;
    }

    const text = await file.text();
    setMarkdown(text);
    if (!title.trim()) {
      setTitle(file.name.replace(/\.(md|markdown)$/, ''));
    }
  }, [title]);

  const handleFileSelect = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const text = await file.text();
    setMarkdown(text);
    if (!title.trim()) {
      setTitle(file.name.replace(/\.(md|markdown)$/, ''));
    }
    e.target.value = '';
  }, [title]);

  const modeButtons: { key: PreviewMode; label: string; icon: React.ReactNode }[] = [
    { key: 'edit', label: 'Editor', icon: <Code2 className="h-3.5 w-3.5" /> },
    { key: 'split', label: 'Split', icon: <Columns2 className="h-3.5 w-3.5" /> },
    { key: 'preview', label: 'Preview', icon: <Eye className="h-3.5 w-3.5" /> },
  ];

  const canCreate = title.trim() && markdown.trim();

  return (
    <div className="max-w-full mx-auto h-[calc(100vh-8rem)] flex flex-col gap-4">
      {/* Header */}
      <div className="flex flex-wrap items-center gap-3 bg-white border rounded-xl px-4 py-3">
        <Button variant="ghost" size="icon" onClick={() => router.back()}>
          <ArrowLeft className="h-4 w-4" />
        </Button>

        <div className="flex items-center gap-2">
          <FileText className="h-4.5 w-4.5 text-brand-primary" />
          <h1 className="text-lg font-semibold text-brand-primary">Create Custom Document</h1>
        </div>

        <div className="flex-1" />

        <div className="flex items-center gap-2">
          <div className="border rounded-lg flex">
            {modeButtons.map((btn, i) => (
              <button
                key={btn.key}
                className={cn(
                  'flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium transition-colors',
                  i === 0 && 'rounded-l-lg',
                  i === modeButtons.length - 1 && 'rounded-r-lg',
                  i > 0 && 'border-l',
                  previewMode === btn.key ? 'bg-brand-primary text-white' : 'hover:bg-muted',
                )}
                onClick={() => setPreviewMode(btn.key)}
              >
                {btn.icon}
                {btn.label}
              </button>
            ))}
          </div>

          <Button
            onClick={handleCreate}
            disabled={creating || !canCreate}
            className="gap-2"
          >
            {creating ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Sparkles className="h-4 w-4" />
            )}
            Create Document
          </Button>
        </div>
      </div>

      {/* Main Content */}
      <div className="flex gap-4 flex-1 min-h-0">
        {/* Editor Panel */}
        {(previewMode === 'edit' || previewMode === 'split') && (
          <div className={cn('flex flex-col gap-3 min-w-0', previewMode === 'split' ? 'flex-1 max-w-[50%]' : 'flex-1')}>
            {/* Title & Description */}
            <div className="bg-white border rounded-xl p-4 space-y-3">
              <div className="space-y-1.5">
                <Label htmlFor="doc-title">Document Title</Label>
                <Input
                  id="doc-title"
                  placeholder="Enter a title for your document..."
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  className="font-medium"
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="doc-desc">Description <span className="text-muted-foreground font-normal">(optional)</span></Label>
                <Input
                  id="doc-desc"
                  placeholder="Brief description of this document..."
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                />
              </div>
            </div>

            {/* Markdown Input */}
            <div
              className={cn(
                'flex-1 min-h-0 flex flex-col rounded-xl border transition-colors',
                dragOver ? 'border-brand-accent border-dashed bg-brand-accent/5' : 'bg-white',
              )}
              onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
              onDragLeave={() => setDragOver(false)}
              onDrop={handleFileDrop}
            >
              {/* Markdown toolbar */}
              <div className="flex items-center gap-2 px-4 py-2 border-b bg-slate-50 rounded-t-xl">
                <Code2 className="h-3.5 w-3.5 text-muted-foreground" />
                <span className="text-xs font-medium text-muted-foreground">Markdown</span>
                <div className="flex-1" />
                <label className="cursor-pointer">
                  <input
                    type="file"
                    accept=".md,.markdown,text/markdown,text/plain"
                    onChange={handleFileSelect}
                    className="hidden"
                  />
                  <span className="inline-flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors px-2 py-1 rounded-md hover:bg-muted">
                    <Upload className="h-3 w-3" />
                    Upload .md file
                  </span>
                </label>
              </div>

              {/* Textarea / Drop zone */}
              {markdown.trim() || !dragOver ? (
                <textarea
                  value={markdown}
                  onChange={(e) => setMarkdown(e.target.value)}
                  className="flex-1 w-full bg-transparent font-mono text-sm p-4 resize-none focus:outline-none leading-relaxed scrollbar-thin placeholder:text-muted-foreground/50"
                  spellCheck={false}
                  placeholder={
                    'Paste your Markdown content here...\n\n' +
                    'You can also drag & drop a .md file into this area.\n\n' +
                    '# Example Heading\n\n' +
                    'Your document content goes here. The platform will\n' +
                    'automatically style it with the DAMAC design language.'
                  }
                />
              ) : (
                <div className="flex-1 flex flex-col items-center justify-center gap-3 p-8">
                  <Upload className="h-10 w-10 text-brand-accent" />
                  <p className="text-sm font-medium text-brand-accent">Drop your Markdown file here</p>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Preview Panel */}
        {(previewMode === 'preview' || previewMode === 'split') && (
          <div className={cn('flex flex-col min-w-0', previewMode === 'split' ? 'flex-1 max-w-[50%]' : 'flex-1')}>
            <div className="flex-1 min-h-0 overflow-y-auto bg-white border rounded-xl scrollbar-thin">
              {deferredMarkdown.trim() ? (
                <div className="p-8 lg:p-12">
                  {title.trim() && (
                    <div className="mb-6 pb-4 border-b border-slate-100">
                      <h1 className="text-2xl font-bold text-brand-primary">{title}</h1>
                      {description.trim() && (
                        <p className="text-sm text-muted-foreground mt-1">{description}</p>
                      )}
                    </div>
                  )}
                  <MarkdownRenderer content={deferredMarkdown} />
                </div>
              ) : (
                <div className="flex flex-col items-center justify-center h-full text-center p-8">
                  <Eye className="h-10 w-10 text-muted-foreground/30 mb-3" />
                  <p className="text-sm font-medium text-muted-foreground">Preview</p>
                  <p className="text-xs text-muted-foreground/70 mt-1">
                    Start typing or paste Markdown to see the styled preview
                  </p>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
