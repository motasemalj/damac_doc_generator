'use client';

import { useState, useEffect, use } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { MarkdownRenderer, extractTocItems } from '@/components/markdown-renderer';
import {
  ArrowLeft, Pencil, Download, Loader2, FileText,
  List, ChevronRight, AlertCircle,
} from 'lucide-react';
import { cn, formatDateTime } from '@/lib/utils';

export default function TddViewPage({ params }: { params: Promise<{ tddId: string }> }) {
  const { tddId } = use(params);
  const router = useRouter();
  const [tdd, setTdd] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [exporting, setExporting] = useState(false);
  const [tocOpen, setTocOpen] = useState(true);

  useEffect(() => {
    fetch(`/api/tdds/${tddId}`)
      .then((r) => r.json())
      .then((data) => {
        if (data.success) setTdd(data.data);
      })
      .finally(() => setLoading(false));
  }, [tddId]);

  const handleExportPdf = async () => {
    setExporting(true);
    try {
      const res = await fetch(`/api/tdds/${tddId}/export/pdf`, { method: 'POST' });
      if (res.ok) {
        const blob = await res.blob();
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `${tdd?.title || 'tdd'}.pdf`;
        a.click();
        URL.revokeObjectURL(url);
      }
    } catch {
      // handle silently
    } finally {
      setExporting(false);
    }
  };

  const scrollToSection = (id: string) => {
    const el = document.getElementById(id);
    if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' });
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

  const tocItems = extractTocItems(tdd.markdownContent);
  const tags = (() => { try { return JSON.parse(tdd.tags); } catch { return []; } })();

  return (
    <div className="max-w-7xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center gap-4">
        <Button variant="ghost" size="icon" onClick={() => router.back()}>
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <div className="flex-1 min-w-0">
          <h1 className="text-2xl font-bold text-brand-primary truncate">{tdd.title}</h1>
          <div className="flex items-center gap-3 mt-1 text-sm text-muted-foreground">
            {tdd.project?.name && (
              <>
                <span>Project: {tdd.project.name}</span>
                <span>&middot;</span>
              </>
            )}
            {tdd.source === 'custom' && (
              <>
                <Badge variant="secondary">Custom Document</Badge>
                <span>&middot;</span>
              </>
            )}
            <span>Updated {formatDateTime(tdd.updatedAt)}</span>
          </div>
          {tags.length > 0 && (
            <div className="flex gap-1.5 mt-2">
              {tags.map((tag: string) => (
                <Badge key={tag} variant="secondary">{tag}</Badge>
              ))}
            </div>
          )}
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" onClick={() => setTocOpen(!tocOpen)}>
            <List className="h-4 w-4" />
            TOC
          </Button>
          <Button variant="outline" onClick={() => router.push(`/tdds/${tddId}/edit`)}>
            <Pencil className="h-4 w-4" />
            Edit
          </Button>
          <Button variant="secondary" onClick={handleExportPdf} disabled={exporting}>
            {exporting ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Download className="h-4 w-4" />
            )}
            PDF
          </Button>
        </div>
      </div>

      {/* Content with TOC */}
      <div className="flex gap-6">
        {/* TOC Sidebar */}
        {tocOpen && tocItems.length > 0 && (
          <aside className="hidden lg:block w-64 flex-shrink-0">
            <div className="sticky top-24 bg-white border rounded-xl p-4 max-h-[calc(100vh-8rem)] overflow-y-auto scrollbar-thin">
              <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">
                Table of Contents
              </h3>
              <nav className="space-y-0.5">
                {tocItems.map((item, i) => (
                  <a
                    key={i}
                    href={`#${item.id}`}
                    onClick={(event) => {
                      event.preventDefault();
                      scrollToSection(item.id);
                    }}
                    className={cn(
                      'block w-full text-left text-sm py-1 hover:text-brand-primary transition-colors truncate',
                      item.level === 1 && 'font-medium text-foreground',
                      item.level === 2 && 'pl-3 text-muted-foreground',
                      item.level === 3 && 'pl-6 text-muted-foreground text-xs',
                      item.level >= 4 && 'pl-9 text-muted-foreground text-xs',
                    )}
                  >
                    {item.text}
                  </a>
                ))}
              </nav>
            </div>
          </aside>
        )}

        {/* Document */}
        <div className="flex-1 min-w-0">
          <div className="bg-white border rounded-xl p-8 lg:p-12 shadow-sm">
            <MarkdownRenderer content={tdd.markdownContent} />
          </div>
        </div>
      </div>
    </div>
  );
}
