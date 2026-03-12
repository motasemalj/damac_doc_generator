'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Dialog, DialogContent, DialogDescription, DialogFooter,
  DialogHeader, DialogTitle, DialogTrigger,
} from '@/components/ui/dialog';
import {
  Plus, BookTemplate, Pencil, Copy, Trash2, Loader2,
  Search, Star, LayoutGrid, FileText, Eye, EyeOff,
} from 'lucide-react';
import { formatDate } from '@/lib/utils';
import { getAvailableTemplateSections, parseTemplateSections } from '@/lib/template-sections';

export default function TemplatesPage() {
  const router = useRouter();
  const [templates, setTemplates] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [dialogOpen, setDialogOpen] = useState(false);
  const [creating, setCreating] = useState(false);
  const [newName, setNewName] = useState('');
  const [newDesc, setNewDesc] = useState('');
  const [startFromDefault, setStartFromDefault] = useState(true);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);

  const fetchTemplates = async () => {
    try {
      const res = await fetch('/api/templates');
      const data = await res.json();
      if (data.success) setTemplates(data.data);
    } catch {
      // handle silently
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchTemplates(); }, []);

  const handleCreate = async () => {
    setCreating(true);
    try {
      const res = await fetch('/api/templates', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: newName.trim() || 'New Template',
          description: newDesc.trim() || null,
          startFromDefault,
        }),
      });
      const data = await res.json();
      if (data.success) {
        setDialogOpen(false);
        setNewName('');
        setNewDesc('');
        router.push(`/templates/${data.data.id}/edit`);
      }
    } catch {
      // handle silently
    } finally {
      setCreating(false);
    }
  };

  const handleClone = async (id: string) => {
    try {
      const res = await fetch('/api/templates', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ cloneFromId: id }),
      });
      const data = await res.json();
      if (data.success) fetchTemplates();
    } catch {
      // handle silently
    }
  };

  const handleDelete = async () => {
    if (!deleteId) return;
    setDeleting(true);
    try {
      await fetch(`/api/templates/${deleteId}`, { method: 'DELETE' });
      setDeleteId(null);
      fetchTemplates();
    } catch {
      // handle silently
    } finally {
      setDeleting(false);
    }
  };

  const filtered = templates.filter(
    (t) =>
      t.name.toLowerCase().includes(search.toLowerCase()) ||
      t.description?.toLowerCase().includes(search.toLowerCase()),
  );

  const getSectionInfo = (template: any) => {
    const sections = parseTemplateSections(
      template.sectionsSchema,
      template.isDefault ? getAvailableTemplateSections() : [],
    );
    if (sections.length === 0) return null;

    const enabled = sections.filter((section) => section.enabled);
    const diagrams = enabled.filter((section) => section.hasDiagram);
    const tables = enabled.filter((section) => section.hasTable);
    return { total: sections.length, enabled: enabled.length, diagrams: diagrams.length, tables: tables.length, sections: enabled };
  };

  return (
    <div className="max-w-6xl mx-auto space-y-8">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-brand-primary">Templates</h1>
          <p className="text-muted-foreground mt-1">
            Manage TDD generation templates with modular section design
          </p>
        </div>
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogTrigger asChild>
            <Button size="lg">
              <Plus className="h-4 w-4" />
              New Template
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Create Template</DialogTitle>
              <DialogDescription>
                Choose a starting point for your new TDD template
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4">
              <div className="space-y-2">
                <Input
                  placeholder="Template name"
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Input
                  placeholder="Description (optional)"
                  value={newDesc}
                  onChange={(e) => setNewDesc(e.target.value)}
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <button
                  onClick={() => setStartFromDefault(true)}
                  className={`p-4 rounded-xl border-2 text-left transition-all ${
                    startFromDefault
                      ? 'border-brand-accent bg-brand-accent/5 shadow-sm'
                      : 'border-gray-200 hover:border-gray-300'
                  }`}
                >
                  <LayoutGrid className="h-5 w-5 text-brand-accent mb-2" />
                  <p className="font-medium text-sm">DAMAC Enterprise</p>
                  <p className="text-xs text-muted-foreground mt-1">15 sections pre-configured</p>
                </button>
                <button
                  onClick={() => setStartFromDefault(false)}
                  className={`p-4 rounded-xl border-2 text-left transition-all ${
                    !startFromDefault
                      ? 'border-brand-accent bg-brand-accent/5 shadow-sm'
                      : 'border-gray-200 hover:border-gray-300'
                  }`}
                >
                  <FileText className="h-5 w-5 text-muted-foreground mb-2" />
                  <p className="font-medium text-sm">Start Blank</p>
                  <p className="text-xs text-muted-foreground mt-1">Build from scratch</p>
                </button>
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setDialogOpen(false)}>Cancel</Button>
              <Button onClick={handleCreate} disabled={creating}>
                {creating ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Create Template'}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="Search templates..."
          className="pl-10"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      </div>

      {loading ? (
        <div className="grid gap-4 md:grid-cols-2">
          {[1, 2, 3].map((i) => (
            <Card key={i}>
              <CardHeader><Skeleton className="h-6 w-3/4" /></CardHeader>
              <CardContent><Skeleton className="h-20" /></CardContent>
            </Card>
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <Card className="border-dashed">
          <CardContent className="flex flex-col items-center justify-center py-16">
            <BookTemplate className="h-12 w-12 text-muted-foreground/40 mb-4" />
            <h3 className="text-lg font-medium text-muted-foreground mb-2">
              {templates.length === 0 ? 'No templates yet' : 'No matching templates'}
            </h3>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 md:grid-cols-2">
          {filtered.map((template) => {
            const info = getSectionInfo(template);
            return (
              <Card key={template.id} className="hover:shadow-sm transition-shadow">
                <CardHeader className="pb-3">
                  <div className="flex items-start justify-between">
                    <CardTitle className="text-lg flex items-center gap-2">
                      {template.isDefault && <Star className="h-4 w-4 text-brand-accent fill-brand-accent" />}
                      {template.name}
                    </CardTitle>
                  </div>
                  {template.description && (
                    <CardDescription>{template.description}</CardDescription>
                  )}
                </CardHeader>
                <CardContent className="space-y-4">
                  {info && (
                    <div className="flex flex-wrap gap-1.5">
                      <Badge variant="secondary" className="text-xs gap-1">
                        <Eye className="h-3 w-3" />
                        {info.enabled} sections
                      </Badge>
                      {info.diagrams > 0 && (
                        <Badge variant="outline" className="text-xs text-indigo-600">
                          {info.diagrams} diagrams
                        </Badge>
                      )}
                      {info.tables > 0 && (
                        <Badge variant="outline" className="text-xs text-amber-600">
                          {info.tables} tables
                        </Badge>
                      )}
                    </div>
                  )}

                  {info && info.sections.length > 0 && (
                    <div className="flex flex-wrap gap-1">
                      {info.sections.slice(0, 6).map((s: any, index: number) => (
                        <span key={`${template.id}:${s.id}:${index}`} className="text-[10px] px-1.5 py-0.5 rounded bg-muted text-muted-foreground">
                          {s.title}
                        </span>
                      ))}
                      {info.sections.length > 6 && (
                        <span className="text-[10px] px-1.5 py-0.5 rounded bg-muted text-muted-foreground">
                          +{info.sections.length - 6} more
                        </span>
                      )}
                    </div>
                  )}

                  <div className="flex items-center gap-2 pt-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => router.push(`/templates/${template.id}/edit`)}
                    >
                      <Pencil className="h-3.5 w-3.5" />
                      Edit
                    </Button>
                    <Button variant="outline" size="sm" onClick={() => handleClone(template.id)}>
                      <Copy className="h-3.5 w-3.5" />
                      Clone
                    </Button>
                    {!template.isDefault && (
                      <Button
                        variant="outline"
                        size="sm"
                        className="text-destructive hover:bg-destructive/10"
                        onClick={() => setDeleteId(template.id)}
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    )}
                  </div>

                  <p className="text-xs text-muted-foreground">Updated {formatDate(template.updatedAt)}</p>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      <Dialog open={!!deleteId} onOpenChange={() => setDeleteId(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete Template</DialogTitle>
            <DialogDescription>
              Are you sure you want to delete this template? This action cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteId(null)}>Cancel</Button>
            <Button variant="destructive" onClick={handleDelete} disabled={deleting}>
              {deleting ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Delete'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
