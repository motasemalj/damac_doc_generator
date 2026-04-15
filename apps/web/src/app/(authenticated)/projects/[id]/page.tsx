'use client';

import { useState, useEffect, useCallback, useRef, use } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Skeleton } from '@/components/ui/skeleton';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import {
  Dialog, DialogContent, DialogDescription, DialogFooter,
  DialogHeader, DialogTitle,
} from '@/components/ui/dialog';
import {
  Upload, FileText, ArrowLeft, Loader2, CheckCircle2,
  AlertCircle, File, Eye, Pencil, X, Trash2,
  Clock, FolderUp, FileCog, Files, Info,
} from 'lucide-react';
import { formatDate, formatBytes, formatDateTime, cn } from '@/lib/utils';

type GenPhase = 'idle' | 'preparing' | 'streaming' | 'saving' | 'done' | 'error';

export default function ProjectPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const router = useRouter();
  const [project, setProject] = useState<any>(null);
  const [templates, setTemplates] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const uploadInFlightRef = useRef(false);
  const uploadInputRef = useRef<HTMLInputElement>(null);
  const [recentSnapshotId, setRecentSnapshotId] = useState<string | null>(null);
  const [contextUploading, setContextUploading] = useState(false);
  const [contextUploadProgress, setContextUploadProgress] = useState(0);
  const contextUploadInFlightRef = useRef(false);
  const contextUploadInputRef = useRef<HTMLInputElement>(null);
  const [recentContextFileIds, setRecentContextFileIds] = useState<string[]>([]);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [snapshotDeleteId, setSnapshotDeleteId] = useState<string | null>(null);
  const [deletingSnapshotId, setDeletingSnapshotId] = useState<string | null>(null);
  const [contextFileDeleteId, setContextFileDeleteId] = useState<string | null>(null);
  const [deletingContextFileId, setDeletingContextFileId] = useState<string | null>(null);
  const [contextFileInstructions, setContextFileInstructions] = useState('');
  const [contextInstructionsLoaded, setContextInstructionsLoaded] = useState(false);
  const [contextInstructionsSaved, setContextInstructionsSaved] = useState(false);
  const contextInstructionsTimerRef = useRef<NodeJS.Timeout | null>(null);

  const [genPhase, setGenPhase] = useState<GenPhase>('idle');
  const [genTokenCount, setGenTokenCount] = useState(0);
  const [genElapsed, setGenElapsed] = useState(0);
  const [genTddId, setGenTddId] = useState('');
  const genStartRef = useRef<number>(0);
  const genTimerRef = useRef<NodeJS.Timeout | null>(null);

  const [selectedTemplate, setSelectedTemplate] = useState('');
  const [selectedSnapshot, setSelectedSnapshot] = useState('');
  const [generationNotes, setGenerationNotes] = useState('');
  const [error, setError] = useState('');

  const fetchProject = useCallback(async () => {
    try {
      const res = await fetch(`/api/projects/${id}`, { cache: 'no-store' });
      const data = await res.json();
      if (data.success) {
        setProject(data.data);
        if (!contextInstructionsLoaded) {
          setContextFileInstructions(data.data.contextFileInstructions || '');
          setContextInstructionsLoaded(true);
        }
        const snapshots = data.data.snapshots || [];
        if (snapshots.length === 0) {
          if (selectedSnapshot) setSelectedSnapshot('');
        } else if (!selectedSnapshot || !snapshots.some((snapshot: any) => snapshot.id === selectedSnapshot)) {
          setSelectedSnapshot(snapshots[0].id);
        }
      }
    } catch { /* */ }
    finally { setLoading(false); }
  }, [id, selectedSnapshot, contextInstructionsLoaded]);

  const fetchTemplates = useCallback(async () => {
    try {
      const res = await fetch('/api/templates', { cache: 'no-store' });
      const data = await res.json();
      if (data.success) {
        setTemplates(data.data);
        const def = data.data.find((t: any) => t.isDefault);
        if (def && !selectedTemplate) setSelectedTemplate(def.id);
      }
    } catch { /* */ }
  }, [selectedTemplate]);

  useEffect(() => { fetchProject(); fetchTemplates(); }, [fetchProject, fetchTemplates]);

  useEffect(() => {
    return () => {
      if (genTimerRef.current) clearInterval(genTimerRef.current);
    };
  }, []);

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || uploadInFlightRef.current || uploading) return;

    uploadInFlightRef.current = true;
    setUploading(true); setUploadProgress(0); setError('');
    const formData = new FormData();
    formData.append('file', file);
    const progressInterval = setInterval(() => { setUploadProgress((p) => Math.min(p + 10, 90)); }, 300);

    try {
      const res = await fetch(`/api/projects/${id}/snapshots`, { method: 'POST', body: formData });
      setUploadProgress(100);
      const data = await res.json();
      if (!data.success) { setError(data.error || 'Upload failed'); }
      else {
        setProject((prev: any) => {
          if (!prev) return prev;

          const existingSnapshots = Array.isArray(prev.snapshots) ? prev.snapshots : [];
          const dedupedSnapshots = existingSnapshots.filter((snapshot: any) => snapshot.id !== data.data.id);

          return {
            ...prev,
            snapshots: [data.data, ...dedupedSnapshots],
          };
        });
        setSelectedSnapshot(data.data.id);
        setRecentSnapshotId(data.data.id);
        setTimeout(() => setRecentSnapshotId((current) => (current === data.data.id ? null : current)), 2200);
        void fetchProject();
      }
    } catch { setError('Upload failed. Please try again.'); }
    finally {
      clearInterval(progressInterval);
      uploadInFlightRef.current = false;
      setUploading(false);
      if (uploadInputRef.current) uploadInputRef.current.value = '';
      setTimeout(() => setUploadProgress(0), 1000);
    }
  };

  const handleDeleteProject = async () => {
    setDeleting(true);
    try {
      const res = await fetch(`/api/projects/${id}`, { method: 'DELETE' });
      const data = await res.json();
      if (data.success) { router.push('/dashboard'); }
      else { setError(data.error || 'Failed to delete project'); }
    } catch { setError('Failed to delete project.'); }
    finally { setDeleting(false); setDeleteDialogOpen(false); }
  };

  const handleUploadContextFiles = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    if (files.length === 0 || contextUploadInFlightRef.current || contextUploading) return;

    contextUploadInFlightRef.current = true;
    setContextUploading(true);
    setContextUploadProgress(0);
    setError('');

    const formData = new FormData();
    files.forEach((file) => formData.append('files', file));
    const progressInterval = setInterval(() => {
      setContextUploadProgress((prev) => Math.min(prev + 12, 90));
    }, 250);

    try {
      const res = await fetch(`/api/projects/${id}/context-files`, { method: 'POST', body: formData });
      setContextUploadProgress(100);
      const data = await res.json();
      if (!data.success) {
        setError(data.error || 'Context file upload failed');
      } else {
        const uploadedIds = (data.data || []).map((file: any) => file.id);
        setProject((prev: any) => {
          if (!prev) return prev;

          const existingContextFiles = Array.isArray(prev.contextFiles) ? prev.contextFiles : [];
          const dedupedContextFiles = existingContextFiles.filter(
            (contextFile: any) => !uploadedIds.includes(contextFile.id),
          );

          return {
            ...prev,
            contextFiles: [...data.data, ...dedupedContextFiles],
          };
        });
        setRecentContextFileIds(uploadedIds);
        setTimeout(() => {
          setRecentContextFileIds((current) => current.filter((fileId) => !uploadedIds.includes(fileId)));
        }, 2200);
        void fetchProject();
      }
    } catch {
      setError('Context file upload failed. Please try again.');
    } finally {
      clearInterval(progressInterval);
      contextUploadInFlightRef.current = false;
      setContextUploading(false);
      if (contextUploadInputRef.current) contextUploadInputRef.current.value = '';
      setTimeout(() => setContextUploadProgress(0), 1000);
    }
  };

  useEffect(() => {
    if (!contextInstructionsLoaded) return;
    if (contextInstructionsTimerRef.current) clearTimeout(contextInstructionsTimerRef.current);
    contextInstructionsTimerRef.current = setTimeout(async () => {
      try {
        const res = await fetch(`/api/projects/${id}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ contextFileInstructions }),
        });
        const data = await res.json();
        if (data.success) {
          setContextInstructionsSaved(true);
          setTimeout(() => setContextInstructionsSaved(false), 2000);
        }
      } catch { /* silent autosave */ }
    }, 800);
    return () => {
      if (contextInstructionsTimerRef.current) clearTimeout(contextInstructionsTimerRef.current);
    };
  }, [contextFileInstructions, contextInstructionsLoaded, id]);

  const handleGenerate = async () => {
    if (!selectedSnapshot || !selectedTemplate) return;
    setGenPhase('preparing'); setGenTokenCount(0); setGenTddId('');
    setError('');
    genStartRef.current = Date.now(); setGenElapsed(0);
    genTimerRef.current = setInterval(() => { setGenElapsed(Math.floor((Date.now() - genStartRef.current) / 1000)); }, 1000);
    try {
      const res = await fetch('/api/tdds/generate', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ projectId: id, snapshotId: selectedSnapshot, templateId: selectedTemplate, generationNotes: generationNotes || undefined }),
      });
      if (!res.ok) { const errData = await res.json(); setError(errData.error || 'Generation failed'); setGenPhase('error'); if (genTimerRef.current) clearInterval(genTimerRef.current); return; }
      setGenPhase('streaming');
      const reader = res.body?.getReader();
      const decoder = new TextDecoder();
      let streamErrored = false;
      let pendingEventText = '';
      if (reader) {
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          pendingEventText += decoder.decode(value, { stream: true });
          const events = pendingEventText.split('\n\n');
          pendingEventText = events.pop() || '';

          for (const event of events) {
            const dataLine = event.split('\n').find((line) => line.startsWith('data: '));
            if (!dataLine) continue;

            try {
              const payload = JSON.parse(dataLine.replace('data: ', ''));
              if (payload.token) {
                setGenTokenCount((prev) => prev + 1);
              }
              if (payload.done && payload.tddId) { setGenTddId(payload.tddId); }
              if (payload.error) { setError(payload.error); setGenPhase('error'); streamErrored = true; }
            } catch { /* */ }
          }
        }
      }
      if (genTimerRef.current) clearInterval(genTimerRef.current);
      setGenElapsed(Math.floor((Date.now() - genStartRef.current) / 1000));
      if (!streamErrored) { setGenPhase('done'); await fetchProject(); }
    } catch {
      setError('Generation failed. Please try again.');
      setGenPhase('error');
      if (genTimerRef.current) clearInterval(genTimerRef.current);
    }
  };

  const handleDeleteSnapshot = async () => {
    if (!snapshotDeleteId) return;

    setDeletingSnapshotId(snapshotDeleteId);
    try {
      const res = await fetch(`/api/projects/${id}/snapshots/${snapshotDeleteId}`, { method: 'DELETE' });
      const data = await res.json();
      if (data.success) {
        if (selectedSnapshot === snapshotDeleteId) {
          setSelectedSnapshot('');
        }
        await fetchProject();
        setSnapshotDeleteId(null);
      } else {
        setError(data.error || 'Failed to delete snapshot');
      }
    } catch {
      setError('Failed to delete snapshot.');
    } finally {
      setDeletingSnapshotId(null);
    }
  };

  const handleDeleteContextFile = async () => {
    if (!contextFileDeleteId) return;

    setDeletingContextFileId(contextFileDeleteId);
    try {
      const res = await fetch(`/api/projects/${id}/context-files/${contextFileDeleteId}`, {
        method: 'DELETE',
      });
      const data = await res.json();
      if (data.success) {
        setProject((prev: any) => {
          if (!prev) return prev;
          return {
            ...prev,
            contextFiles: (prev.contextFiles || []).filter((file: any) => file.id !== contextFileDeleteId),
          };
        });
        setContextFileDeleteId(null);
      } else {
        setError(data.error || 'Failed to delete context file');
      }
    } catch {
      setError('Failed to delete context file.');
    } finally {
      setDeletingContextFileId(null);
    }
  };

  const dismissGeneration = () => { setGenPhase('idle'); setGenTokenCount(0); setGenTddId(''); };
  const formatElapsed = (s: number) => { const m = Math.floor(s / 60); return m > 0 ? `${m}m ${s % 60}s` : `${s}s`; };
  const isGenerating = genPhase === 'preparing' || genPhase === 'streaming' || genPhase === 'saving';
  const snapshotPendingDelete = project?.snapshots?.find((snapshot: any) => snapshot.id === snapshotDeleteId) || null;
  const contextFilePendingDelete = project?.contextFiles?.find((file: any) => file.id === contextFileDeleteId) || null;

  if (loading) {
    return (
      <div className="max-w-6xl mx-auto space-y-6">
        <Skeleton className="h-8 w-64" /><Skeleton className="h-4 w-96" />
        <div className="grid gap-6 md:grid-cols-2"><Skeleton className="h-48" /><Skeleton className="h-48" /></div>
      </div>
    );
  }

  if (!project) {
    return (
      <div className="max-w-6xl mx-auto text-center py-16">
        <AlertCircle className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
        <h2 className="text-xl font-semibold mb-2">Project not found</h2>
        <Button variant="outline" onClick={() => router.push('/dashboard')}><ArrowLeft className="h-4 w-4" />Back to Dashboard</Button>
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" onClick={() => router.push('/dashboard')}><ArrowLeft className="h-4 w-4" /></Button>
        <div className="flex-1">
          <h1 className="text-2xl font-bold text-brand-primary">{project.name}</h1>
          {project.description && <p className="text-sm text-muted-foreground mt-0.5">{project.description}</p>}
        </div>
        <Button variant="destructive" size="sm" className="shadow-sm" onClick={() => setDeleteDialogOpen(true)}>
          <Trash2 className="h-3.5 w-3.5" />
          Delete Project
        </Button>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 rounded-lg p-4 flex items-start gap-3">
          <AlertCircle className="h-5 w-5 mt-0.5 flex-shrink-0" /><p className="text-sm">{error}</p>
          <button onClick={() => setError('')} className="ml-auto text-red-400 hover:text-red-600"><X className="h-4 w-4" /></button>
        </div>
      )}

      {/* Generation Progress Banner */}
      {genPhase !== 'idle' && (
        <div className={cn(
          'rounded-xl border overflow-hidden transition-all',
          genPhase === 'done' ? 'border-emerald-200 bg-emerald-50/50' :
          genPhase === 'error' ? 'border-red-200 bg-red-50/50' :
          'border-blue-200 bg-blue-50/30',
        )}>
          <div className="px-5 py-4">
            <div className="flex items-center gap-3">
              {isGenerating && (
                <div className="w-10 h-10 rounded-full bg-blue-100 flex items-center justify-center">
                  <Loader2 className="h-5 w-5 text-blue-600 animate-spin" />
                </div>
              )}
              {genPhase === 'done' && (
                <div className="w-10 h-10 rounded-full bg-emerald-100 flex items-center justify-center">
                  <CheckCircle2 className="h-5 w-5 text-emerald-600" />
                </div>
              )}
              {genPhase === 'error' && (
                <div className="w-10 h-10 rounded-full bg-red-100 flex items-center justify-center">
                  <AlertCircle className="h-5 w-5 text-red-600" />
                </div>
              )}
              <div className="flex-1 min-w-0">
                <h3 className="font-semibold text-sm">
                  {genPhase === 'preparing' && 'Preparing generation...'}
                  {genPhase === 'streaming' && 'Generating document...'}
                  {genPhase === 'saving' && 'Saving document...'}
                  {genPhase === 'done' && 'Generation complete'}
                  {genPhase === 'error' && 'Generation failed'}
                </h3>
                <div className="flex items-center gap-4 text-xs text-muted-foreground mt-0.5">
                  <span className="flex items-center gap-1"><Clock className="h-3 w-3" />{formatElapsed(genElapsed)}</span>
                  {genTokenCount > 0 && <span>{genTokenCount.toLocaleString()} tokens</span>}
                </div>
              </div>
              <div className="flex items-center gap-2">
                {genPhase === 'done' && genTddId && (
                  <>
                    <Button size="sm" onClick={() => router.push(`/tdds/${genTddId}/view`)}><Eye className="h-3.5 w-3.5" />View</Button>
                    <Button size="sm" variant="outline" onClick={() => router.push(`/tdds/${genTddId}/edit`)}><Pencil className="h-3.5 w-3.5" />Edit</Button>
                  </>
                )}
                {(genPhase === 'done' || genPhase === 'error') && (
                  <button onClick={dismissGeneration} className="p-1.5 rounded-md hover:bg-black/5 transition-colors"><X className="h-4 w-4" /></button>
                )}
              </div>
            </div>
            {isGenerating && (
              <div className="mt-3 h-1.5 rounded-full bg-blue-100 overflow-hidden">
                <div className="h-full bg-blue-500 rounded-full generation-progress-bar" />
              </div>
            )}
          </div>
        </div>
      )}

      <Tabs defaultValue="overview" className="space-y-6">
        <TabsList>
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="documents">Documents ({project.tdds.length})</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="space-y-6">
          <div className="grid gap-6 md:grid-cols-2">
            {/* Upload */}
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="flex items-center gap-2 text-base">
                  <FolderUp className="h-4 w-4 text-blue-600" />
                  Upload Codebase
                </CardTitle>
                <CardDescription className="text-xs">Upload a ZIP file of your source code to create a new snapshot</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div className="border-2 border-dashed border-muted rounded-lg p-6 text-center hover:border-blue-300 transition-colors">
                    <input ref={uploadInputRef} type="file" accept=".zip" onChange={handleUpload} disabled={uploading} className="hidden" id="file-upload" />
                    <label htmlFor="file-upload" className={cn('cursor-pointer block', uploading && 'pointer-events-none opacity-70')}>
                      {uploading ? (
                        <div className="space-y-3">
                          <Loader2 className="h-8 w-8 animate-spin text-blue-500 mx-auto" />
                          <p className="text-sm text-muted-foreground">Uploading & extracting...</p>
                          <Progress value={uploadProgress} />
                        </div>
                      ) : (
                        <>
                          <Upload className="h-8 w-8 text-muted-foreground/40 mx-auto mb-2" />
                          <p className="text-sm font-medium">Click to upload ZIP file</p>
                          <p className="text-xs text-muted-foreground mt-1">Max 100MB</p>
                        </>
                      )}
                    </label>
                  </div>

                  <div className="border-t pt-4 space-y-3">
                    <div>
                      <h3 className="text-sm font-medium flex items-center gap-2">
                        <Files className="h-4 w-4 text-violet-600" />
                        Context files
                      </h3>
                      <p className="text-xs text-muted-foreground mt-1">
                        Upload API specs, database schemas, config files, requirements docs, or source code to provide the AI with authoritative reference material during generation. Each file is automatically classified and used to produce more accurate, data-driven documentation.
                      </p>
                    </div>

                    <div className="border border-dashed border-muted rounded-lg p-4 text-center hover:border-violet-300 transition-colors">
                      <input
                        ref={contextUploadInputRef}
                        type="file"
                        multiple
                        onChange={handleUploadContextFiles}
                        disabled={contextUploading}
                        className="hidden"
                        id="context-file-upload"
                      />
                      <label htmlFor="context-file-upload" className={cn('cursor-pointer block', contextUploading && 'pointer-events-none opacity-70')}>
                        {contextUploading ? (
                          <div className="space-y-3">
                            <Loader2 className="h-6 w-6 animate-spin text-violet-500 mx-auto" />
                            <p className="text-sm text-muted-foreground">Uploading context files...</p>
                            <Progress value={contextUploadProgress} />
                          </div>
                        ) : (
                          <>
                            <Files className="h-6 w-6 text-muted-foreground/40 mx-auto mb-2" />
                            <p className="text-sm font-medium">Upload context files</p>
                            <p className="text-xs text-muted-foreground mt-1">Text, markdown, config, and source-code files up to 10MB each</p>
                          </>
                        )}
                      </label>
                    </div>

                    {project.contextFiles?.length > 0 && (
                      <div className="space-y-2">
                        {project.contextFiles.map((contextFile: any) => {
                          const ext = (contextFile.originalFileName || '').split('.').pop()?.toLowerCase() || '';
                          const base = (contextFile.originalFileName || '').toLowerCase();
                          let fileTypeBadge = 'File';
                          let badgeClass = 'text-gray-600 border-gray-200 bg-gray-50';
                          if (base.includes('openapi') || base.includes('swagger')) {
                            fileTypeBadge = 'API Spec'; badgeClass = 'text-amber-700 border-amber-200 bg-amber-50';
                          } else if (ext === 'sql' || base.includes('schema') || base.includes('migration')) {
                            fileTypeBadge = 'Schema'; badgeClass = 'text-blue-700 border-blue-200 bg-blue-50';
                          } else if (ext === 'graphql' || ext === 'gql') {
                            fileTypeBadge = 'GraphQL'; badgeClass = 'text-pink-700 border-pink-200 bg-pink-50';
                          } else if (ext === 'proto') {
                            fileTypeBadge = 'Protobuf'; badgeClass = 'text-indigo-700 border-indigo-200 bg-indigo-50';
                          } else if (['ts', 'tsx', 'js', 'jsx', 'py', 'java', 'go', 'rs', 'rb', 'php', 'cs', 'kt', 'swift'].includes(ext)) {
                            fileTypeBadge = 'Source'; badgeClass = 'text-emerald-700 border-emerald-200 bg-emerald-50';
                          } else if (base.includes('docker')) {
                            fileTypeBadge = 'Docker'; badgeClass = 'text-sky-700 border-sky-200 bg-sky-50';
                          } else if (['package.json', 'cargo.toml', 'go.mod', 'requirements.txt', 'pom.xml'].some(n => base.includes(n)) || base.includes('build.gradle')) {
                            fileTypeBadge = 'Dependencies'; badgeClass = 'text-orange-700 border-orange-200 bg-orange-50';
                          } else if (ext === 'env' || base.includes('.env.')) {
                            fileTypeBadge = 'Env Config'; badgeClass = 'text-yellow-700 border-yellow-200 bg-yellow-50';
                          } else if (['md', 'mdx', 'txt'].includes(ext)) {
                            fileTypeBadge = 'Docs'; badgeClass = 'text-violet-700 border-violet-200 bg-violet-50';
                          } else if (['json', 'yaml', 'yml', 'toml', 'ini', 'cfg'].includes(ext)) {
                            fileTypeBadge = 'Config'; badgeClass = 'text-teal-700 border-teal-200 bg-teal-50';
                          }

                          return (
                            <div
                              key={contextFile.id}
                              className={cn(
                                'flex items-center gap-3 rounded-lg border px-3 py-2 transition-all duration-300',
                                recentContextFileIds.includes(contextFile.id) && 'border-violet-300 bg-violet-50/50 shadow-sm',
                              )}
                            >
                              <div className="w-8 h-8 rounded-lg bg-violet-50 flex items-center justify-center">
                                <FileText className="h-4 w-4 text-violet-600" />
                              </div>
                              <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-2">
                                  <p className="text-sm font-medium truncate">{contextFile.originalFileName}</p>
                                  <Badge variant="outline" className={cn('text-[10px] shrink-0', badgeClass)}>{fileTypeBadge}</Badge>
                                  {recentContextFileIds.includes(contextFile.id) && (
                                    <Badge variant="outline" className="text-[11px] text-violet-700 border-violet-200 bg-violet-100/70">New</Badge>
                                  )}
                                </div>
                                <p className="text-xs text-muted-foreground">
                                  {formatBytes(contextFile.fileSizeBytes)} &middot; {formatDateTime(contextFile.createdAt)}
                                </p>
                              </div>
                              <Button
                                variant="outline"
                                size="sm"
                                className="h-8 text-xs text-red-600 hover:text-red-700"
                                onClick={() => setContextFileDeleteId(contextFile.id)}
                                disabled={deletingContextFileId === contextFile.id}
                              >
                                {deletingContextFileId === contextFile.id ? <Loader2 className="h-3 w-3 animate-spin" /> : <Trash2 className="h-3 w-3" />}
                                Delete
                              </Button>
                            </div>
                          );
                        })}
                      </div>
                    )}

                    <div className="space-y-2 pt-1">
                      <div className="flex items-center justify-between">
                        <Label className="text-xs flex items-center gap-1.5">
                          <Info className="h-3 w-3 text-muted-foreground" />
                          Context file instructions (optional)
                        </Label>
                        {contextInstructionsSaved && (
                          <span className="text-xs text-emerald-600 flex items-center gap-1">
                            <CheckCircle2 className="h-3 w-3" /> Saved
                          </span>
                        )}
                      </div>
                      <Textarea
                        value={contextFileInstructions}
                        onChange={(e) => setContextFileInstructions(e.target.value)}
                        rows={3}
                        className="text-sm resize-none"
                      />
                      <p className="text-[11px] text-muted-foreground leading-relaxed">
                        These instructions are sent alongside your context files during TDD generation, guiding the AI on how to use each file. Leave blank for automatic classification.
                      </p>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Generate */}
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="flex items-center gap-2 text-base">
                  <FileCog className="h-4 w-4 text-emerald-600" />
                  Generate Document
                </CardTitle>
                <CardDescription className="text-xs">Generate a Technical Design Document from a snapshot</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label className="text-xs">Snapshot</Label>
                  <Select value={selectedSnapshot} onValueChange={setSelectedSnapshot}>
                    <SelectTrigger className="h-9 text-sm"><SelectValue placeholder="Select a snapshot" /></SelectTrigger>
                    <SelectContent>
                      {project.snapshots.map((s: any) => (<SelectItem key={s.id} value={s.id}>{s.originalFileName} ({formatDate(s.createdAt)})</SelectItem>))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label className="text-xs">Template</Label>
                  <Select value={selectedTemplate} onValueChange={setSelectedTemplate}>
                    <SelectTrigger className="h-9 text-sm"><SelectValue placeholder="Select a template" /></SelectTrigger>
                    <SelectContent>
                      {templates.map((t: any) => (<SelectItem key={t.id} value={t.id}>{t.name}{t.isDefault && ' (Default)'}</SelectItem>))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label className="text-xs">Notes (optional)</Label>
                  <Textarea placeholder="Focus areas, target audience..." value={generationNotes} onChange={(e) => setGenerationNotes(e.target.value)} rows={2} className="text-sm" />
                </div>
                <Button className="w-full" onClick={handleGenerate} disabled={isGenerating || !selectedSnapshot || !selectedTemplate}>
                  {isGenerating ? (<><Loader2 className="h-4 w-4 animate-spin" />Generating...</>) : (<><FileCog className="h-4 w-4" />Generate TDD</>)}
                </Button>
              </CardContent>
            </Card>
          </div>

          <section className="space-y-3">
            <div className="flex items-center justify-between gap-3">
              <div>
                <h2 className="text-lg font-semibold">Snapshots</h2>
                <p className="text-sm text-muted-foreground">Manage uploaded codebase snapshots used for document generation.</p>
              </div>
              <Badge variant="outline">{project.snapshots.length}</Badge>
            </div>

            {project.snapshots.length === 0 ? (
              <Card className="border-dashed"><CardContent className="flex flex-col items-center justify-center py-12">
                <FolderUp className="h-10 w-10 text-muted-foreground/30 mb-3" />
                <p className="text-muted-foreground text-sm">No snapshots yet. Upload a codebase ZIP to get started.</p>
              </CardContent></Card>
            ) : (
              <div className="space-y-2">
                {project.snapshots.map((snapshot: any) => (
                  <Card
                    key={snapshot.id}
                    className={cn(
                      'transition-all duration-300',
                      recentSnapshotId === snapshot.id && 'border-blue-300 bg-blue-50/40 shadow-sm',
                    )}
                  >
                    <CardContent className="flex items-center gap-4 py-3 px-4">
                      <div className="w-9 h-9 rounded-lg bg-blue-50 flex items-center justify-center"><File className="h-4 w-4 text-blue-600" /></div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <p className="font-medium text-sm truncate">{snapshot.originalFileName}</p>
                          {selectedSnapshot === snapshot.id && <Badge variant="secondary" className="text-[11px]">Selected</Badge>}
                          {recentSnapshotId === snapshot.id && <Badge variant="outline" className="text-[11px] text-blue-700 border-blue-200 bg-blue-100/70">New</Badge>}
                        </div>
                        <p className="text-xs text-muted-foreground">{formatBytes(snapshot.fileSizeBytes)} &middot; {snapshot.fileCount} files &middot; {formatDateTime(snapshot.createdAt)}</p>
                      </div>
                      <Badge variant="outline" className="text-xs font-mono">{snapshot.id.slice(0, 8)}</Badge>
                      <div className="flex items-center gap-2">
                        <Button variant={selectedSnapshot === snapshot.id ? 'secondary' : 'outline'} size="sm" className="h-8 text-xs" onClick={() => setSelectedSnapshot(snapshot.id)}>
                          {selectedSnapshot === snapshot.id ? 'Selected' : 'Use'}
                        </Button>
                        <Button variant="outline" size="sm" className="h-8 text-xs text-red-600 hover:text-red-700" onClick={() => setSnapshotDeleteId(snapshot.id)} disabled={deletingSnapshotId === snapshot.id}>
                          {deletingSnapshotId === snapshot.id ? <Loader2 className="h-3 w-3 animate-spin" /> : <Trash2 className="h-3 w-3" />}
                          Delete
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </section>
        </TabsContent>

        <TabsContent value="documents">
          {project.tdds.length === 0 ? (
            <Card className="border-dashed"><CardContent className="flex flex-col items-center justify-center py-12">
              <FileText className="h-10 w-10 text-muted-foreground/30 mb-3" />
              <p className="text-muted-foreground text-sm">No documents yet. Generate your first TDD above.</p>
            </CardContent></Card>
          ) : (
            <div className="space-y-2">
              {project.tdds.map((tdd: any) => (
                <Card key={tdd.id} className="hover:shadow-sm transition-shadow">
                  <CardContent className="flex items-center gap-4 py-3 px-4">
                    <div className="w-9 h-9 rounded-lg bg-emerald-50 flex items-center justify-center"><FileText className="h-4 w-4 text-emerald-600" /></div>
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-sm truncate">{tdd.title}</p>
                      <p className="text-xs text-muted-foreground">Template: {tdd.template?.name} &middot; {formatDateTime(tdd.updatedAt)}</p>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <Button variant="outline" size="sm" className="h-8 text-xs" onClick={() => router.push(`/tdds/${tdd.id}/view`)}><Eye className="h-3 w-3" />View</Button>
                      <Button variant="outline" size="sm" className="h-8 text-xs" onClick={() => router.push(`/tdds/${tdd.id}/edit`)}><Pencil className="h-3 w-3" />Edit</Button>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>
      </Tabs>

      {/* Delete Confirmation */}
      <Dialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete Project</DialogTitle>
            <DialogDescription>
              This will permanently delete <strong>{project.name}</strong> and all its snapshots, documents, and generation history. This action cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteDialogOpen(false)}>Cancel</Button>
            <Button variant="destructive" onClick={handleDeleteProject} disabled={deleting}>
              {deleting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
              Delete Project
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!snapshotDeleteId} onOpenChange={(open) => { if (!open && !deletingSnapshotId) setSnapshotDeleteId(null); }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete Snapshot</DialogTitle>
            <DialogDescription>
              This will permanently delete <strong>{snapshotPendingDelete?.originalFileName || 'this snapshot'}</strong> and any documents or generation history tied to it. This action cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setSnapshotDeleteId(null)} disabled={!!deletingSnapshotId}>Cancel</Button>
            <Button variant="destructive" onClick={handleDeleteSnapshot} disabled={!!deletingSnapshotId}>
              {deletingSnapshotId ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
              Delete Snapshot
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!contextFileDeleteId} onOpenChange={(open) => { if (!open && !deletingContextFileId) setContextFileDeleteId(null); }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete Context File</DialogTitle>
            <DialogDescription>
              This will permanently delete <strong>{contextFilePendingDelete?.originalFileName || 'this context file'}</strong>. It will no longer be considered during TDD generation.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setContextFileDeleteId(null)} disabled={!!deletingContextFileId}>Cancel</Button>
            <Button variant="destructive" onClick={handleDeleteContextFile} disabled={!!deletingContextFileId}>
              {deletingContextFileId ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
              Delete Context File
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
