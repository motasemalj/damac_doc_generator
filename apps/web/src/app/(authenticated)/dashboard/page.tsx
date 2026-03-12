'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Dialog, DialogContent, DialogDescription, DialogFooter,
  DialogHeader, DialogTitle, DialogTrigger,
} from '@/components/ui/dialog';
import {
  Plus, FolderOpen, FileText, Upload, Search,
  LayoutGrid, List, Pencil, Trash2, Loader2, X,
} from 'lucide-react';
import { formatDate, cn } from '@/lib/utils';
import { Checkbox } from '@/components/ui/checkbox';

interface ProjectData {
  id: string;
  name: string;
  description: string | null;
  createdAt: string;
  updatedAt: string;
  _count: { snapshots: number; tdds: number };
}

export default function DashboardPage() {
  const router = useRouter();
  const [projects, setProjects] = useState<ProjectData[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [dialogOpen, setDialogOpen] = useState(false);
  const [creating, setCreating] = useState(false);
  const [newName, setNewName] = useState('');
  const [newDesc, setNewDesc] = useState('');
  const [viewStyle, setViewStyle] = useState<'grid' | 'list'>('grid');
  const [editMode, setEditMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const fetchProjects = async () => {
    try {
      const res = await fetch('/api/projects');
      const data = await res.json();
      if (data.success) setProjects(data.data);
    } catch {
      // handle silently
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchProjects(); }, []);

  const handleCreate = async () => {
    if (!newName.trim()) return;
    setCreating(true);
    try {
      const res = await fetch('/api/projects', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: newName.trim(), description: newDesc.trim() || null }),
      });
      const data = await res.json();
      if (data.success) {
        setDialogOpen(false);
        setNewName('');
        setNewDesc('');
        router.push(`/projects/${data.data.id}`);
      }
    } catch {
      // handle silently
    } finally {
      setCreating(false);
    }
  };

  const filtered = projects.filter(
    (p) =>
      p.name.toLowerCase().includes(search.toLowerCase()) ||
      p.description?.toLowerCase().includes(search.toLowerCase()),
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
    else setSelectedIds(new Set(filtered.map((p) => p.id)));
  };

  const handleDeleteSelected = async () => {
    if (selectedIds.size === 0) return;
    setDeleting(true);
    try {
      await Promise.all(
        Array.from(selectedIds).map((id) =>
          fetch(`/api/projects/${id}`, { method: 'DELETE' }),
        ),
      );
      setDeleteDialogOpen(false);
      setSelectedIds(new Set());
      setEditMode(false);
      await fetchProjects();
    } catch {
      // handle silently
    } finally {
      setDeleting(false);
    }
  };

  return (
    <div className="max-w-6xl mx-auto space-y-8">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-brand-primary">Projects</h1>
          <p className="text-muted-foreground mt-1">
            Manage your documentation projects and generate TDDs
          </p>
        </div>
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogTrigger asChild>
            <Button size="lg">
              <Plus className="h-4 w-4" />
              New Project
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Create New Project</DialogTitle>
              <DialogDescription>
                Create a project to organize your codebase snapshots and documentation.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="project-name">Project Name</Label>
                <Input
                  id="project-name"
                  placeholder="My Application"
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="project-desc">Description (optional)</Label>
                <Textarea
                  id="project-desc"
                  placeholder="Brief description of the project..."
                  value={newDesc}
                  onChange={(e) => setNewDesc(e.target.value)}
                  rows={3}
                />
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setDialogOpen(false)}>Cancel</Button>
              <Button onClick={handleCreate} disabled={creating || !newName.trim()}>
                {creating ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Create Project'}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      {/* Search and view options */}
      <div className="flex flex-col sm:flex-row gap-4 sm:items-center sm:justify-between">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search projects..."
            className="pl-10"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <div className="flex items-center gap-2 flex-wrap">
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

      {/* Projects Grid or List */}
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
                  <Skeleton className="h-20" />
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
              {projects.length === 0 ? 'No projects yet' : 'No matching projects'}
            </h3>
            <p className="text-sm text-muted-foreground mb-6">
              {projects.length === 0
                ? 'Create your first project to get started with documentation generation.'
                : 'Try adjusting your search query.'}
            </p>
            {projects.length === 0 && (
              <Button onClick={() => setDialogOpen(true)}>
                <Plus className="h-4 w-4" />
                Create Project
              </Button>
            )}
          </CardContent>
        </Card>
      ) : viewStyle === 'list' ? (
        <div className="space-y-2">
          {filtered.map((project) => (
            <Card
              key={project.id}
              className={cn(
                'transition-shadow',
                editMode ? 'cursor-pointer' : 'cursor-pointer hover:shadow-md group',
                selectedIds.has(project.id) && 'ring-2 ring-brand-primary',
              )}
              onClick={() => {
                if (editMode) toggleSelect(project.id);
                else router.push(`/projects/${project.id}`);
              }}
            >
              <CardContent className="flex items-center gap-4 py-3 px-4">
                {editMode && (
                  <Checkbox
                    checked={selectedIds.has(project.id)}
                    onCheckedChange={() => toggleSelect(project.id)}
                    onClick={(e) => e.stopPropagation()}
                  />
                )}
                <div className="flex-1 min-w-0">
                  <p className="font-semibold group-hover:text-brand-primary transition-colors truncate">{project.name}</p>
                  {project.description && (
                    <p className="text-sm text-muted-foreground truncate">{project.description}</p>
                  )}
                </div>
                <div className="flex items-center gap-4 text-sm text-muted-foreground shrink-0">
                  <span>{project._count.snapshots} snapshot{project._count.snapshots !== 1 ? 's' : ''}</span>
                  <span>{project._count.tdds} TDD{project._count.tdds !== 1 ? 's' : ''}</span>
                  <span>{formatDate(project.updatedAt)}</span>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {filtered.map((project) => (
            <Card
              key={project.id}
              className={cn(
                'transition-shadow relative',
                editMode ? 'cursor-pointer' : 'hover:shadow-md cursor-pointer group',
                selectedIds.has(project.id) && 'ring-2 ring-brand-primary',
              )}
              onClick={() => {
                if (editMode) toggleSelect(project.id);
                else router.push(`/projects/${project.id}`);
              }}
            >
              {editMode && (
                <div className="absolute top-3 left-3 z-10" onClick={(e) => e.stopPropagation()}>
                  <Checkbox
                    checked={selectedIds.has(project.id)}
                    onCheckedChange={() => toggleSelect(project.id)}
                  />
                </div>
              )}
              <CardHeader className="pb-3">
                <div className="flex items-start justify-between">
                  <CardTitle className={cn('text-lg transition-colors', editMode ? '' : 'group-hover:text-brand-primary')}>
                    {project.name}
                  </CardTitle>
                </div>
                {project.description && (
                  <CardDescription className="line-clamp-2">{project.description}</CardDescription>
                )}
              </CardHeader>
              <CardContent>
                <div className="flex items-center gap-3 text-sm text-muted-foreground">
                  <div className="flex items-center gap-1.5">
                    <Upload className="h-3.5 w-3.5" />
                    <span>{project._count.snapshots} snapshot{project._count.snapshots !== 1 ? 's' : ''}</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <FileText className="h-3.5 w-3.5" />
                    <span>{project._count.tdds} TDD{project._count.tdds !== 1 ? 's' : ''}</span>
                  </div>
                </div>
                <p className="text-xs text-muted-foreground mt-3">
                  Updated {formatDate(project.updatedAt)}
                </p>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Delete selected confirmation */}
      <Dialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete selected projects</DialogTitle>
            <DialogDescription>
              Permanently delete {selectedIds.size} project{selectedIds.size !== 1 ? 's' : ''} and all their snapshots and documents? This cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteDialogOpen(false)}>Cancel</Button>
            <Button variant="destructive" onClick={handleDeleteSelected} disabled={deleting}>
              {deleting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
              Delete {selectedIds.size} project{selectedIds.size !== 1 ? 's' : ''}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
