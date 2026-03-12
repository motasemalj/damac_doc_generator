'use client';

import { useState, useEffect, use, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import {
  ArrowLeft, Save, Loader2, CheckCircle2, AlertCircle,
  Star, GripVertical, Plus, Trash2, Copy,
  FileText, Shield, Database, GitBranch,
  Layout, BookOpen, ListChecks, BarChart3,
  Server, Code, Settings, Activity, AlertTriangle, Cpu,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import {
  getAvailableTemplateSections,
  parseTemplateSections,
  type TemplateSection,
} from '@/lib/template-sections';

const CATEGORY_CONFIG: Record<string, { label: string; color: string; bg: string }> = {
  cover: { label: 'Cover', color: 'text-purple-700', bg: 'bg-purple-50 border-purple-200' },
  overview: { label: 'Overview', color: 'text-blue-700', bg: 'bg-blue-50 border-blue-200' },
  specification: { label: 'Specification', color: 'text-emerald-700', bg: 'bg-emerald-50 border-emerald-200' },
  technical: { label: 'Technical', color: 'text-orange-700', bg: 'bg-orange-50 border-orange-200' },
  api: { label: 'API', color: 'text-rose-700', bg: 'bg-rose-50 border-rose-200' },
  methods: { label: 'Methods', color: 'text-cyan-700', bg: 'bg-cyan-50 border-cyan-200' },
  config: { label: 'Config', color: 'text-slate-700', bg: 'bg-slate-50 border-slate-200' },
};

const SECTION_ICONS: Record<string, any> = {
  cover_page: Layout, executive_summary: BookOpen, purpose_introduction: FileText,
  system_specification: ListChecks, functional_requirements: ListChecks, nonfunctional_requirements: BarChart3,
  architecture_overview: Cpu, process_flow: GitBranch, data_design: Database,
  security_access: Shield, error_handling: AlertTriangle, observability: Activity,
  deployment_runtime: Server, api_specification: Code, method_details: ListChecks, configuration: Settings,
};

export default function TemplateEditPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const router = useRouter();
  const [template, setTemplate] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [cloning, setCloning] = useState(false);
  const [saved, setSaved] = useState(false);
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [sections, setSections] = useState<TemplateSection[]>([]);
  const [draggedIdx, setDraggedIdx] = useState<number | null>(null);
  const [dragOverIdx, setDragOverIdx] = useState<number | null>(null);
  const [dragFromPalette, setDragFromPalette] = useState<string | null>(null);
  const allAvailableSections = useMemo(() => getAvailableTemplateSections(), []);

  useEffect(() => {
    fetch(`/api/templates/${id}`)
      .then((r) => r.json())
      .then((data) => {
        if (data.success) {
          setTemplate(data.data);
          setName(data.data.name);
          setDescription(data.data.description || '');
          setSections(
            parseTemplateSections(
              data.data.sectionsSchema,
              data.data.isDefault ? allAvailableSections : [],
            ),
          );
        }
      })
      .finally(() => setLoading(false));
  }, [allAvailableSections, id]);

  const handleSave = async () => {
    setSaving(true);
    try {
      const orderedSections = sections.map((s, i) => ({ ...s, order: i, enabled: true }));
      const res = await fetch(`/api/templates/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, description, sectionsSchema: orderedSections }),
      });
      const data = await res.json();
      if (data.success) {
        setSaved(true);
        setTimeout(() => setSaved(false), 2000);
      }
    } catch { /* handle silently */ }
    finally { setSaving(false); }
  };

  const handleCloneTemplate = async () => {
    setCloning(true);
    try {
      const res = await fetch('/api/templates', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ cloneFromId: id }),
      });
      const data = await res.json();
      if (data.success) {
        router.push(`/templates/${data.data.id}/edit`);
      }
    } catch {
      // handle silently
    } finally {
      setCloning(false);
    }
  };

  const addSection = (sectionId: string) => {
    const sectionTemplate = allAvailableSections.find((section) => section.id === sectionId);
    if (!sectionTemplate) return;

    setSections((prev) => {
      if (prev.some((section) => section.id === sectionId)) return prev;
      return [...prev, { ...sectionTemplate, order: prev.length, enabled: true }];
    });
  };

  const removeSection = (sectionId: string) => {
    setSections((prev) => prev.filter((s) => s.id !== sectionId).map((s, i) => ({ ...s, order: i })));
  };

  const handleDragStart = (idx: number) => { setDraggedIdx(idx); };
  const handleDragOver = (e: React.DragEvent, idx: number) => { e.preventDefault(); setDragOverIdx(idx); };
  const handleDrop = (e: React.DragEvent, idx: number) => {
    e.preventDefault();
    e.stopPropagation();

    if (dragFromPalette) {
      const sectionTemplate = allAvailableSections.find((section) => section.id === dragFromPalette);
      if (sectionTemplate) {
        setSections((prev) => {
          if (prev.some((section) => section.id === dragFromPalette)) return prev;

          const newSections = [...prev];
          newSections.splice(idx, 0, { ...sectionTemplate, order: idx, enabled: true });
          return newSections.map((section, index) => ({ ...section, order: index }));
        });
      }
      setDragFromPalette(null);
      setDragOverIdx(null);
      return;
    }
    if (draggedIdx === null || draggedIdx === idx) { setDraggedIdx(null); setDragOverIdx(null); return; }
    setSections((prev) => {
      const newSections = [...prev];
      const [moved] = newSections.splice(draggedIdx, 1);
      newSections.splice(idx, 0, moved);
      return newSections.map((section, index) => ({ ...section, order: index }));
    });
    setDraggedIdx(null);
    setDragOverIdx(null);
  };
  const handleDragEnd = () => { setDraggedIdx(null); setDragOverIdx(null); setDragFromPalette(null); };
  const handleDropOnDocument = (e: React.DragEvent) => {
    e.preventDefault();
    if (dragFromPalette) {
      addSection(dragFromPalette);
      setDragFromPalette(null);
    }
    setDragOverIdx(null);
  };

  const availableSections = allAvailableSections.filter((section) => !sections.some((active) => active.id === section.id));
  const isPaletteDragging = dragFromPalette !== null;
  const isReordering = draggedIdx !== null;

  if (loading) {
    return <div className="max-w-5xl mx-auto space-y-4"><Skeleton className="h-8 w-64" /><Skeleton className="h-[500px]" /></div>;
  }

  if (!template) {
    return (
      <div className="max-w-5xl mx-auto text-center py-16">
        <AlertCircle className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
        <h2 className="text-xl font-semibold mb-2">Template not found</h2>
        <Button variant="outline" onClick={() => router.push('/templates')}><ArrowLeft className="h-4 w-4" />Back to Templates</Button>
      </div>
    );
  }

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" onClick={() => router.push('/templates')}><ArrowLeft className="h-4 w-4" /></Button>
        <div className="flex-1 flex items-center gap-3">
          <h1 className="text-2xl font-bold text-brand-primary">Edit Template</h1>
          {template.isDefault && <Badge variant="secondary" className="gap-1"><Star className="h-3 w-3" />Default</Badge>}
        </div>
        <div className="flex items-center gap-2">
          {saved && <Badge variant="success" className="gap-1"><CheckCircle2 className="h-3 w-3" />Saved</Badge>}
          {template.canEdit ? (
            <Button onClick={handleSave} disabled={saving}>
              {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
              Save Template
            </Button>
          ) : (
            <Button onClick={handleCloneTemplate} disabled={cloning}>
              {cloning ? <Loader2 className="h-4 w-4 animate-spin" /> : <Copy className="h-4 w-4" />}
              Clone to Edit
            </Button>
          )}
        </div>
      </div>

      {/* Metadata */}
      <div className="bg-white border rounded-xl p-5">
        {!template.canEdit && (
          <div className="mb-4 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
            This template is read-only. Use &quot;Clone to Edit&quot; to create your own copy and customize sections.
          </div>
        )}
        <div className="grid gap-4 md:grid-cols-2">
          <div className="space-y-1.5">
            <Label className="text-xs text-muted-foreground">Template Name</Label>
            <Input value={name} onChange={(e) => setName(e.target.value)} disabled={!template.canEdit} />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs text-muted-foreground">Description</Label>
            <Input value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Optional description" disabled={!template.canEdit} />
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left: Available Sections (palette) */}
        <div className="lg:col-span-1">
          <div className="sticky top-24 space-y-3">
            <div className="flex items-center justify-between px-1">
              <h2 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Available Sections</h2>
              <Badge variant="outline" className="text-[10px]">{availableSections.length} left</Badge>
            </div>
            {availableSections.length === 0 ? (
              <div className="text-center py-8 border rounded-xl border-dashed">
                <p className="text-xs text-muted-foreground">All sections added</p>
              </div>
            ) : (
              <div className="space-y-1.5 max-h-[calc(100vh-16rem)] overflow-y-auto scrollbar-thin pr-1">
                {availableSections.map((section) => {
                  const Icon = SECTION_ICONS[section.id] || FileText;
                  const cat = CATEGORY_CONFIG[section.category] || CATEGORY_CONFIG.technical;
                  return (
                    <div
                      key={section.id}
                      draggable={!!template.canEdit}
                      onDragStart={() => setDragFromPalette(section.id)}
                      onDragEnd={handleDragEnd}
                      className={cn(
                        'bg-white border rounded-lg p-3 transition-all group',
                        !template.canEdit
                          ? 'opacity-60 cursor-not-allowed'
                          : 'cursor-grab active:cursor-grabbing hover:shadow-sm hover:border-brand-accent/40 hover:-translate-y-0.5',
                        dragFromPalette === section.id && 'border-brand-accent shadow-md ring-2 ring-brand-accent/20 scale-[0.98]',
                      )}
                    >
                      <div className="flex items-center gap-2.5">
                        <div className={cn('w-7 h-7 rounded flex items-center justify-center border', cat.bg)}>
                          <Icon className={cn('h-3.5 w-3.5', cat.color)} />
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-xs font-medium truncate">{section.title}</p>
                          <p className="text-[10px] text-muted-foreground truncate">{section.description}</p>
                        </div>
                        <button
                          onMouseDown={(event) => event.stopPropagation()}
                          onClick={(event) => {
                            event.stopPropagation();
                            addSection(section.id);
                          }}
                          disabled={!template.canEdit}
                          className="opacity-0 group-hover:opacity-100 p-1 rounded hover:bg-brand-accent/10 text-brand-accent transition-all"
                          title="Add to document"
                        >
                          <Plus className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        {/* Right: Document Sections (active, ordered) */}
        <div
          className={cn(
            'lg:col-span-2 transition-all',
            (isPaletteDragging || isReordering) && 'rounded-2xl ring-2 ring-brand-accent/15',
          )}
          onDragOver={(e) => e.preventDefault()}
          onDrop={handleDropOnDocument}
        >
          <div className="flex items-center justify-between gap-3 px-1 mb-3">
            <div className="flex items-center gap-2">
              <h2 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                Document Structure ({sections.length} sections)
              </h2>
              <Badge variant="outline" className="text-[10px]">
                {!template.canEdit ? 'Read only' : isReordering ? 'Reordering' : isPaletteDragging ? 'Drop to insert' : 'Drag to reorder'}
              </Badge>
            </div>
            <p className="text-[11px] text-muted-foreground hidden sm:block">
              {!template.canEdit ? 'Clone the template to customize section order.' : 'Drag rows to reorder or drag items in from the left.'}
            </p>
          </div>

          {sections.length === 0 ? (
            <div className={cn(
              'border-2 border-dashed rounded-xl p-12 text-center transition-all',
              isPaletteDragging && 'border-brand-accent bg-brand-accent/5',
            )}>
              <FileText className="h-10 w-10 text-muted-foreground/30 mx-auto mb-3" />
              <p className="text-sm text-muted-foreground mb-1">No sections added yet</p>
              <p className="text-xs text-muted-foreground">Drag sections from the left panel or click + to add them</p>
            </div>
          ) : (
            <div className={cn(
              'space-y-1.5 rounded-2xl p-2 transition-colors',
              (isPaletteDragging || isReordering) && 'bg-brand-accent/5',
            )}>
              {sections.map((section, idx) => {
                const Icon = SECTION_ICONS[section.id] || FileText;
                const cat = CATEGORY_CONFIG[section.category] || CATEGORY_CONFIG.technical;
                const isDragging = draggedIdx === idx;
                const isDragOver = dragOverIdx === idx && draggedIdx !== idx;

                return (
                  <div
                    key={`${section.id}:${idx}`}
                    draggable={!!template.canEdit}
                    onDragStart={() => handleDragStart(idx)}
                    onDragOver={(e) => handleDragOver(e, idx)}
                    onDrop={(e) => handleDrop(e, idx)}
                    onDragEnd={handleDragEnd}
                    className={cn(
                      'bg-white border rounded-xl transition-all duration-200 group',
                      template.canEdit && 'hover:shadow-sm hover:border-brand-accent/30',
                      isDragging && 'opacity-40 scale-[0.98] shadow-lg',
                      isDragOver && 'border-brand-accent shadow-md ring-2 ring-brand-accent/20 translate-y-[1px]',
                    )}
                  >
                    {isDragOver && (
                      <div className="h-1 rounded-t-xl bg-gradient-to-r from-brand-accent/40 via-brand-accent to-brand-accent/40" />
                    )}
                    <div className="flex items-center gap-3 px-4 py-3">
                      <div className={cn(
                        'text-muted-foreground/30 hover:text-muted-foreground transition-colors',
                        !template.canEdit ? 'cursor-not-allowed' : 'cursor-grab active:cursor-grabbing',
                      )}>
                        <GripVertical className="h-4 w-4" />
                      </div>

                      <span className="text-xs font-mono text-muted-foreground/40 w-5 text-right">{idx + 1}</span>

                      <div className={cn('w-8 h-8 rounded-lg flex items-center justify-center border', cat.bg)}>
                        <Icon className={cn('h-4 w-4', cat.color)} />
                      </div>

                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="font-medium text-sm">{section.title}</span>
                          <Badge variant="outline" className={cn('text-[10px] px-1.5 py-0 h-4', cat.color)}>{cat.label}</Badge>
                          {section.hasDiagram && <Badge variant="outline" className="text-[10px] px-1.5 py-0 h-4 text-indigo-600">Diagram</Badge>}
                          {section.hasTable && <Badge variant="outline" className="text-[10px] px-1.5 py-0 h-4 text-amber-600">Table</Badge>}
                        </div>
                        <p className="text-xs text-muted-foreground truncate mt-0.5">{section.description}</p>
                      </div>

                      <button
                        disabled={!template.canEdit}
                        onClick={() => removeSection(section.id)}
                        className="opacity-0 group-hover:opacity-100 p-1.5 rounded-md text-muted-foreground hover:text-red-500 hover:bg-red-50 transition-all"
                        title="Remove section"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
