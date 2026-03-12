'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Dialog, DialogContent, DialogDescription, DialogFooter,
  DialogHeader, DialogTitle,
} from '@/components/ui/dialog';
import {
  Plus, FileText, Search, LayoutGrid, List, Pencil,
  Trash2, Loader2, X, Eye, FolderOpen,
} from 'lucide-react';
import { formatDate, cn } from '@/lib/utils';

interface DocumentData {
  id: string;
  title: string;
  description: string | null;
  source: string;
  createdAt: string;
  updatedAt: string;
  project: { id: string; name: string } | null;
}

export default function DocumentsPage() {
  const router = useRouter();
  const [documents, setDocuments] = useState<DocumentData[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [viewStyle, setViewStyle] = useState<'grid' | 'list'>('grid');
  const [editMode, setEditMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [filter, setFilter] = useState<'all' | 'custom' | 'generated'>('all');

  const fetchDocuments = async () => {
    try {
      const params = filter !== 'all' ? `?source=${filter}` : '';
      const res = await fetch(`/api/tdds${params}`);
      const data = await res.json();
      if (data.success) setDocuments(data.data);
    } catch {
      // handle silently
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    setLoading(true);
    fetchDocuments();
  }, [filter]);

  const filtered = documents.filter(
    (d) =>
      d.title.toLowerCase().includes(search.toLowerCase()) ||
      d.description?.toLowerCase().includes(search.toLowerCase()),
  );

  const toggleSelect = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const selectAll = () => {
    if (selectedIds.size === filtered.length) setSelectedIds(new Set());
    else setSelectedIds(new Set(filtered.map((d) => d.id)));
  };

  const handleDeleteSelected = async () => {
    if (selectedIds.size === 0) return;
    setDeleting(true);
    try {
      await Promise.all(
        Array.from(selectedIds).map((id) =>
          fetch(`/api/tdds/${id}`, { method: 'DELETE' }),
        ),
      );
      setDeleteDialogOpen(false);
      setSelectedIds(new Set());
      setEditMode(false);
      await fetchDocuments();
    } catch {
      // handle silently
    } finally {
      setDeleting(false);
    }
  };

  const filterButtons: { key: typeof filter; label: string }[] = [
    { key: 'all', label: 'All' },
    { key: 'custom', label: 'Custom' },
    { key: 'generated', label: 'Generated' },
  ];

  return (
    <div className="max-w-6xl mx-auto space-y-8">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-brand-primary">Documents</h1>
          <p className="text-muted-foreground mt-1">
            All your documents — custom and generated
          </p>
        </div>
        <Button size="lg" onClick={() => router.push('/documents/new')}>
          <Plus className="h-4 w-4" />
          Custom Document
        </Button>
      </div>

      {/* Search and filters */}
      <div className="flex flex-col sm:flex-row gap-4 sm:items-center sm:justify-between">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search documents..."
            className="pl-10"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          {/* Source filter */}
          <div className="border rounded-lg flex p-0.5">
            {filterButtons.map((btn) => (
              <button
                key={btn.key}
                onClick={() => setFilter(btn.key)}
                className={cn(
                  'px-3 py-1.5 text-xs font-medium rounded-md transition-colors',
                  filter === btn.key ? 'bg-brand-primary text-white' : 'hover:bg-muted',
                )}
              >
                {btn.label}
              </button>
            ))}
          </div>

          <span className="text-sm text-muted-foreground">View:</span>
          <div className="border rounded-lg flex p-0.5">
            <button
              onClick={() => setViewStyle('grid')}
              className={cn(
                'p-2 rounded-md transition-colors',
                viewStyle === 'grid' ? 'bg-brand-primary text-white' : 'hover:bg-muted',
              )}
              title="Grid view"
            >
              <LayoutGrid className="h-4 w-4" />
            </button>
            <button
              onClick={() => setViewStyle('list')}
              className={cn(
                'p-2 rounded-md transition-colors',
                viewStyle === 'list' ? 'bg-brand-primary text-white' : 'hover:bg-muted',
              )}
              title="List view"
            >
              <List className="h-4 w-4" />
            </button>
          </div>

          {!editMode ? (
            <Button variant="outline" size="sm" onClick={() => setEditMode(true)}>
              <Pencil className="h-3.5 w-3.5" />
              Edit
            </Button>
          ) : (
            <>
              <Button variant="outline" size="sm" onClick={selectAll}>
                {selectedIds.size === filtered.length ? 'Deselect all' : 'Select all'}
              </Button>
              <Button
                variant="destructive"
                size="sm"
                onClick={() => selectedIds.size > 0 && setDeleteDialogOpen(true)}
                disabled={selectedIds.size === 0}
              >
                <Trash2 className="h-3.5 w-3.5" />
                Delete ({selectedIds.size})
              </Button>
              <Button variant="ghost" size="sm" onClick={() => { setEditMode(false); setSelectedIds(new Set()); }}>
                <X className="h-3.5 w-3.5" />
                Cancel
              </Button>
            </>
          )}
        </div>
      </div>

      {/* Documents */}
      {loading ? (
        viewStyle === 'grid' ? (
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {[1, 2, 3].map((i) => (
              <Card key={i}>
                <CardHeader>
                  <Skeleton className="h-6 w-3/4" />
                  <Skeleton className="h-4 w-1/2 mt-2" />
                </CardHeader>
                <CardContent>
                  <Skeleton className="h-16" />
                </CardContent>
              </Card>
            ))}
          </div>
        ) : (
          <div className="space-y-2">
            {[1, 2, 3].map((i) => (
              <Card key={i}>
                <CardContent className="flex items-center gap-4 py-4">
                  <Skeleton className="h-5 w-5 rounded" />
                  <Skeleton className="h-5 flex-1 max-w-xs" />
                  <Skeleton className="h-4 w-24" />
                </CardContent>
              </Card>
            ))}
          </div>
        )
      ) : filtered.length === 0 ? (
        <Card className="border-dashed">
          <CardContent className="flex flex-col items-center justify-center py-16">
            <FolderOpen className="h-12 w-12 text-muted-foreground/40 mb-4" />
            <h3 className="text-lg font-medium text-muted-foreground mb-2">
              {documents.length === 0 ? 'No documents yet' : 'No matching documents'}
            </h3>
            <p className="text-sm text-muted-foreground mb-6">
              {documents.length === 0
                ? 'Create a custom document from Markdown or generate one from a project.'
                : 'Try adjusting your search query or filter.'}
            </p>
            {documents.length === 0 && (
              <Button onClick={() => router.push('/documents/new')}>
                <Plus className="h-4 w-4" />
                Create Custom Document
              </Button>
            )}
          </CardContent>
        </Card>
      ) : viewStyle === 'list' ? (
        <div className="space-y-2">
          {filtered.map((doc) => (
            <Card
              key={doc.id}
              className={cn(
                'transition-shadow',
                editMode ? 'cursor-pointer' : 'cursor-pointer hover:shadow-md group',
                selectedIds.has(doc.id) && 'ring-2 ring-brand-primary',
              )}
              onClick={() => {
                if (editMode) toggleSelect(doc.id);
                else router.push(`/tdds/${doc.id}/view`);
              }}
            >
              <CardContent className="flex items-center gap-4 py-3 px-4">
                {editMode && (
                  <Checkbox
                    checked={selectedIds.has(doc.id)}
                    onCheckedChange={() => toggleSelect(doc.id)}
                    onClick={(e) => e.stopPropagation()}
                  />
                )}
                <FileText className="h-4 w-4 text-muted-foreground shrink-0" />
                <div className="flex-1 min-w-0">
                  <p className="font-semibold group-hover:text-brand-primary transition-colors truncate">{doc.title}</p>
                  {doc.description && (
                    <p className="text-sm text-muted-foreground truncate">{doc.description}</p>
                  )}
                </div>
                <div className="flex items-center gap-3 text-sm text-muted-foreground shrink-0">
                  <Badge variant={doc.source === 'custom' ? 'secondary' : 'outline'} className="text-xs">
                    {doc.source === 'custom' ? 'Custom' : 'Generated'}
                  </Badge>
                  {doc.project && (
                    <span className="hidden sm:inline truncate max-w-32">{doc.project.name}</span>
                  )}
                  <span>{formatDate(doc.updatedAt)}</span>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {filtered.map((doc) => (
            <Card
              key={doc.id}
              className={cn(
                'transition-shadow relative',
                editMode ? 'cursor-pointer' : 'hover:shadow-md cursor-pointer group',
                selectedIds.has(doc.id) && 'ring-2 ring-brand-primary',
              )}
              onClick={() => {
                if (editMode) toggleSelect(doc.id);
                else router.push(`/tdds/${doc.id}/view`);
              }}
            >
              {editMode && (
                <div className="absolute top-3 left-3 z-10" onClick={(e) => e.stopPropagation()}>
                  <Checkbox
                    checked={selectedIds.has(doc.id)}
                    onCheckedChange={() => toggleSelect(doc.id)}
                  />
                </div>
              )}
              <CardHeader className="pb-3">
                <div className="flex items-start justify-between gap-2">
                  <CardTitle className={cn('text-lg transition-colors line-clamp-1', editMode ? '' : 'group-hover:text-brand-primary')}>
                    {doc.title}
                  </CardTitle>
                  <Badge variant={doc.source === 'custom' ? 'secondary' : 'outline'} className="text-xs shrink-0">
                    {doc.source === 'custom' ? 'Custom' : 'Generated'}
                  </Badge>
                </div>
                {doc.description && (
                  <CardDescription className="line-clamp-2">{doc.description}</CardDescription>
                )}
              </CardHeader>
              <CardContent>
                <div className="flex items-center gap-3 text-sm text-muted-foreground">
                  {doc.project && (
                    <div className="flex items-center gap-1.5">
                      <FolderOpen className="h-3.5 w-3.5" />
                      <span className="truncate max-w-32">{doc.project.name}</span>
                    </div>
                  )}
                </div>
                <p className="text-xs text-muted-foreground mt-3">
                  Updated {formatDate(doc.updatedAt)}
                </p>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Delete confirmation */}
      <Dialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete selected documents</DialogTitle>
            <DialogDescription>
              Permanently delete {selectedIds.size} document{selectedIds.size !== 1 ? 's' : ''}? This cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteDialogOpen(false)}>Cancel</Button>
            <Button variant="destructive" onClick={handleDeleteSelected} disabled={deleting}>
              {deleting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
              Delete {selectedIds.size} document{selectedIds.size !== 1 ? 's' : ''}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
