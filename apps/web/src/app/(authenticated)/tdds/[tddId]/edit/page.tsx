'use client';

import { useState, useEffect, useRef, useCallback, use, useDeferredValue } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { MarkdownRenderer } from '@/components/markdown-renderer';
import { WysiwygEditor } from '@/components/wysiwyg-editor';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import {
  ArrowLeft, Save, Eye, Download, Loader2, Clock,
  History, CheckCircle2, AlertCircle, FileEdit,
} from 'lucide-react';
import { cn, formatDateTime } from '@/lib/utils';

type ViewMode = 'document' | 'editor' | 'split' | 'preview';

export default function TddEditPage({ params }: { params: Promise<{ tddId: string }> }) {
  const { tddId } = use(params);
  const router = useRouter();
  const [tdd, setTdd] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [content, setContent] = useState('');
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [viewMode, setViewMode] = useState<ViewMode>('document');
  const [revisions, setRevisions] = useState<any[]>([]);
  const [showRevisions, setShowRevisions] = useState(false);
  const [dirty, setDirty] = useState(false);
  const autosaveTimer = useRef<NodeJS.Timeout | null>(null);
  const previewContent = useDeferredValue(content);

  useEffect(() => {
    fetch(`/api/tdds/${tddId}`)
      .then((r) => r.json())
      .then((data) => {
        if (data.success) {
          setTdd(data.data);
          setContent(data.data.markdownContent);
          setTitle(data.data.title);
          setDescription(data.data.description || '');
          if (data.data.revisions) setRevisions(data.data.revisions);
        }
      })
      .finally(() => setLoading(false));
  }, [tddId]);

  const save = useCallback(async (auto = false) => {
    setSaving(true);
    try {
      if (!auto) {
        await fetch(`/api/tdds/${tddId}/revisions`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ message: 'Manual save' }),
        });
      }

      const res = await fetch(`/api/tdds/${tddId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title, description, markdownContent: content }),
      });
      const data = await res.json();
      if (data.success) {
        setSaved(true);
        setDirty(false);
        setTimeout(() => setSaved(false), 2000);
      }
    } catch {
      // handle silently
    } finally {
      setSaving(false);
    }
  }, [tddId, title, description, content]);

  useEffect(() => {
    if (!dirty) return;
    if (autosaveTimer.current) clearTimeout(autosaveTimer.current);
    autosaveTimer.current = setTimeout(() => save(true), 5000);
    return () => {
      if (autosaveTimer.current) clearTimeout(autosaveTimer.current);
    };
  }, [content, dirty, save]);

  const handleContentChange = (value: string) => {
    setContent(value);
    setDirty(true);
  };

  const handleExportPdf = async () => {
    if (dirty) await save(false);
    setExporting(true);
    try {
      const res = await fetch(`/api/tdds/${tddId}/export/pdf`, { method: 'POST' });
      if (res.ok) {
        const blob = await res.blob();
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `${title || 'tdd'}.pdf`;
        a.click();
        URL.revokeObjectURL(url);
      }
    } catch {
      // handle silently
    } finally {
      setExporting(false);
    }
  };

  const restoreRevision = (revision: any) => {
    setContent(revision.markdownContent);
    setDirty(true);
    setShowRevisions(false);
  };

  if (loading) {
    return (
      <div className="max-w-7xl mx-auto space-y-4">
        <Skeleton className="h-8 w-64" />
        <Skeleton className="h-[600px]" />
      </div>
    );
  }

  if (!tdd) {
    return (
      <div className="max-w-7xl mx-auto text-center py-16">
        <AlertCircle className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
        <h2 className="text-xl font-semibold mb-2">Document not found</h2>
        <Button variant="outline" onClick={() => router.push('/dashboard')}>
          <ArrowLeft className="h-4 w-4" />
          Back to Dashboard
        </Button>
      </div>
    );
  }

  const modeButtons: { key: ViewMode; label: string }[] = [
    { key: 'document', label: 'Document' },
    { key: 'editor', label: 'Markdown' },
    { key: 'split', label: 'Split' },
    { key: 'preview', label: 'Preview' },
  ];

  return (
    <div className="max-w-full mx-auto h-[calc(100vh-8rem)] flex flex-col gap-4">
      {/* Toolbar */}
      <div className="flex flex-wrap items-center gap-3 bg-white border rounded-xl px-4 py-3">
        <Button variant="ghost" size="icon" onClick={() => router.back()}>
          <ArrowLeft className="h-4 w-4" />
        </Button>

        <Input
          value={title}
          onChange={(e) => { setTitle(e.target.value); setDirty(true); }}
          className="max-w-xs font-semibold"
          placeholder="Document title"
        />

        <div className="flex-1" />

        <div className="flex items-center gap-2">
          {saved && (
            <Badge variant="success" className="gap-1">
              <CheckCircle2 className="h-3 w-3" />
              Saved
            </Badge>
          )}
          {dirty && !saved && (
            <Badge variant="warning" className="gap-1">
              <Clock className="h-3 w-3" />
              Unsaved
            </Badge>
          )}

          <div className="border rounded-lg flex">
            {modeButtons.map((btn, i) => (
              <button
                key={btn.key}
                className={cn(
                  'px-3 py-1.5 text-xs font-medium transition-colors',
                  i === 0 && 'rounded-l-lg',
                  i === modeButtons.length - 1 && 'rounded-r-lg',
                  i > 0 && 'border-l',
                  viewMode === btn.key ? 'bg-brand-primary text-white' : 'hover:bg-muted',
                )}
                onClick={() => setViewMode(btn.key)}
              >
                {btn.label}
              </button>
            ))}
          </div>

          <Button variant="outline" size="sm" onClick={() => setShowRevisions(true)}>
            <History className="h-3.5 w-3.5" />
            History
          </Button>
          <Button variant="outline" size="sm" onClick={() => save(false)} disabled={saving}>
            {saving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Save className="h-3.5 w-3.5" />}
            Save
          </Button>
          <Button variant="outline" size="sm" onClick={() => router.push(`/tdds/${tddId}/view`)}>
            <Eye className="h-3.5 w-3.5" />
            View
          </Button>
          <Button variant="secondary" size="sm" onClick={handleExportPdf} disabled={exporting}>
            {exporting ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Download className="h-3.5 w-3.5" />}
            PDF
          </Button>
        </div>
      </div>

      {/* Editor Area */}
      <div className="flex gap-4 flex-1 min-h-0">
        {/* Document (WYSIWYG) Mode */}
        {viewMode === 'document' && (
          <div className="flex-1 min-w-0 overflow-y-auto scrollbar-thin px-1 pb-8">
            <WysiwygEditor
              content={content}
              onChange={handleContentChange}
            />
          </div>
        )}

        {/* Raw Markdown Editor */}
        {(viewMode === 'editor' || viewMode === 'split') && (
          <div className={cn('flex-1 min-w-0', viewMode === 'split' && 'max-w-[50%]')}>
            <textarea
              value={content}
              onChange={(e) => handleContentChange(e.target.value)}
              className="w-full h-full bg-slate-900 text-slate-100 font-mono text-sm p-6 rounded-xl border-0 resize-none focus:outline-none focus:ring-2 focus:ring-brand-accent scrollbar-thin leading-relaxed"
              spellCheck={false}
              placeholder="Write your Markdown here..."
            />
          </div>
        )}

        {/* Preview */}
        {(viewMode === 'preview' || viewMode === 'split') && (
          <div className={cn('flex-1 min-w-0 overflow-y-auto bg-white border rounded-xl p-8 scrollbar-thin', viewMode === 'split' && 'max-w-[50%]')}>
            <MarkdownRenderer content={previewContent} />
          </div>
        )}
      </div>

      {/* Revisions Dialog */}
      <Dialog open={showRevisions} onOpenChange={setShowRevisions}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Version History</DialogTitle>
            <DialogDescription>
              Previous saved revisions of this document
            </DialogDescription>
          </DialogHeader>
          <div className="max-h-96 overflow-y-auto space-y-2">
            {revisions.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-8">No revisions yet</p>
            ) : (
              revisions.map((rev: any) => (
                <div
                  key={rev.id}
                  className="flex items-center justify-between p-3 rounded-lg border hover:bg-muted/50 transition-colors"
                >
                  <div>
                    <p className="text-sm font-medium">{rev.message || 'Revision'}</p>
                    <p className="text-xs text-muted-foreground">{formatDateTime(rev.createdAt)}</p>
                  </div>
                  <Button variant="outline" size="sm" onClick={() => restoreRevision(rev)}>
                    Restore
                  </Button>
                </div>
              ))
            )}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
