'use client';

import { useState, useRef, useCallback, useEffect, useMemo } from 'react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import {
  Sparkles, Paperclip, X, Send, Loader2,
  CheckCircle2, AlertCircle, ChevronDown, ChevronUp,
  FileText, Undo2, Target, Layers,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { AI_EDIT_MAX_FILES } from '@damac/shared';

interface AiEditPanelProps {
  tddId: string;
  markdownContent: string;
  onContentUpdated: (newContent: string) => void;
  onUndoRequested: () => void;
  className?: string;
}

type EditPhase = 'idle' | 'streaming' | 'done' | 'error';

interface AttachedFile {
  id: string;
  file: File;
}

interface EditMeta {
  mode: 'section' | 'full';
  targetSection: string | null;
}

interface DocumentHeading {
  text: string;
  level: number;
  line: number;
}

function extractHeadings(markdown: string): DocumentHeading[] {
  if (!markdown) return [];
  const lines = markdown.split('\n');
  const headings: DocumentHeading[] = [];
  for (let i = 0; i < lines.length; i++) {
    const match = /^(#{1,6})\s+(.+?)\s*$/.exec(lines[i]);
    if (match) {
      headings.push({
        text: match[2].trim(),
        level: match[1].length,
        line: i,
      });
    }
  }
  return headings;
}

export function AiEditPanel({
  tddId,
  markdownContent,
  onContentUpdated,
  onUndoRequested,
  className,
}: AiEditPanelProps) {
  const [expanded, setExpanded] = useState(false);
  const [instruction, setInstruction] = useState('');
  const [attachedFiles, setAttachedFiles] = useState<AttachedFile[]>([]);
  const [phase, setPhase] = useState<EditPhase>('idle');
  const [errorMessage, setErrorMessage] = useState('');
  const [streamedTokens, setStreamedTokens] = useState(0);
  const [editMeta, setEditMeta] = useState<EditMeta | null>(null);
  const [selectedSection, setSelectedSection] = useState<string>('');
  const [showSectionPicker, setShowSectionPicker] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const abortRef = useRef<AbortController | null>(null);
  const sectionPickerRef = useRef<HTMLDivElement>(null);

  const headings = useMemo(() => extractHeadings(markdownContent), [markdownContent]);

  const topLevelHeadings = useMemo(() => {
    if (headings.length === 0) return [];
    const minLevel = Math.min(...headings.map((h) => h.level));
    return headings.filter((h) => h.level <= minLevel + 1);
  }, [headings]);

  useEffect(() => {
    if (expanded && textareaRef.current && phase === 'idle') {
      textareaRef.current.focus();
    }
  }, [expanded, phase]);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (sectionPickerRef.current && !sectionPickerRef.current.contains(e.target as Node)) {
        setShowSectionPicker(false);
      }
    }
    if (showSectionPicker) {
      document.addEventListener('mousedown', handleClickOutside);
      return () => document.removeEventListener('mousedown', handleClickOutside);
    }
  }, [showSectionPicker]);

  const handleFileSelect = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files) return;

    const remaining = AI_EDIT_MAX_FILES - attachedFiles.length;
    const newFiles = Array.from(files).slice(0, remaining).map((file) => ({
      id: crypto.randomUUID(),
      file,
    }));

    setAttachedFiles((prev) => [...prev, ...newFiles]);
    if (fileInputRef.current) fileInputRef.current.value = '';
  }, [attachedFiles.length]);

  const removeFile = useCallback((id: string) => {
    setAttachedFiles((prev) => prev.filter((f) => f.id !== id));
  }, []);

  const handleSubmit = useCallback(async () => {
    if (!instruction.trim() || phase === 'streaming') return;

    setPhase('streaming');
    setErrorMessage('');
    setStreamedTokens(0);
    setEditMeta(null);

    const formData = new FormData();
    formData.append('instruction', instruction.trim());

    if (selectedSection) {
      formData.append('targetSection', selectedSection);
    }

    for (const af of attachedFiles) {
      formData.append('files', af.file);
    }

    abortRef.current = new AbortController();

    try {
      const res = await fetch(`/api/tdds/${tddId}/ai-edit`, {
        method: 'POST',
        body: formData,
        signal: abortRef.current.signal,
      });

      if (!res.ok) {
        const data = await res.json().catch(() => null);
        throw new Error(data?.error || `Request failed (${res.status})`);
      }

      const reader = res.body?.getReader();
      if (!reader) throw new Error('No response stream');

      const decoder = new TextDecoder();
      let buffer = '';
      let tokenCount = 0;

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() || '';

        for (const line of lines) {
          if (!line.startsWith('data: ')) continue;
          try {
            const payload = JSON.parse(line.slice(6));

            if (payload.error) {
              throw new Error(payload.error);
            }

            if (payload.meta) {
              setEditMeta(payload.meta);
            }

            if (payload.token) {
              tokenCount++;
              if (tokenCount % 10 === 0) {
                setStreamedTokens(tokenCount);
              }
            }

            if (payload.done && payload.content) {
              onContentUpdated(payload.content);
              setPhase('done');
              setInstruction('');
              setAttachedFiles([]);
              setSelectedSection('');
              setTimeout(() => {
                setPhase('idle');
                setEditMeta(null);
              }, 4000);
              return;
            }
          } catch (parseError: any) {
            if (parseError.message && parseError.message !== 'Unexpected end of JSON input') {
              throw parseError;
            }
          }
        }
      }

      if (phase !== 'done') {
        setPhase('error');
        setErrorMessage('Stream ended without completion');
      }
    } catch (error: any) {
      if (error.name === 'AbortError') {
        setPhase('idle');
        return;
      }
      setPhase('error');
      setErrorMessage(error.message || 'AI edit failed');
    } finally {
      abortRef.current = null;
    }
  }, [instruction, attachedFiles, selectedSection, tddId, onContentUpdated, phase]);

  const handleCancel = useCallback(() => {
    abortRef.current?.abort();
    setPhase('idle');
    setEditMeta(null);
  }, []);

  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && (e.metaKey || e.ctrlKey) && instruction.trim() && phase === 'idle') {
      e.preventDefault();
      handleSubmit();
    }
  }, [instruction, phase, handleSubmit]);

  const formatFileSize = (bytes: number) => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  if (!expanded) {
    return (
      <button
        onClick={() => setExpanded(true)}
        className={cn(
          'w-full flex items-center gap-2.5 px-4 py-2.5 rounded-xl border border-dashed border-brand-accent/40',
          'bg-gradient-to-r from-brand-accent/5 to-transparent',
          'hover:border-brand-accent/70 hover:from-brand-accent/10',
          'transition-all duration-200 group',
          className,
        )}
      >
        <div className="flex items-center justify-center w-7 h-7 rounded-lg bg-brand-accent/15 group-hover:bg-brand-accent/25 transition-colors">
          <Sparkles className="h-3.5 w-3.5 text-brand-accent" />
        </div>
        <span className="text-sm font-medium text-muted-foreground group-hover:text-foreground transition-colors">
          AI Edit — target a section or describe changes
        </span>
        <span className="ml-auto text-xs text-muted-foreground/60 hidden sm:inline">
          Click to expand
        </span>
        <ChevronUp className="h-3.5 w-3.5 text-muted-foreground/50 group-hover:text-muted-foreground transition-colors" />
      </button>
    );
  }

  return (
    <div
      className={cn(
        'rounded-xl border bg-white shadow-sm overflow-hidden',
        'animate-in slide-in-from-bottom-2 duration-200',
        phase === 'done' && 'border-emerald-200',
        phase === 'error' && 'border-red-200',
        phase === 'streaming' && 'border-brand-accent/50',
        className,
      )}
    >
      {/* Header */}
      <div className="flex items-center gap-2 px-4 py-2.5 border-b bg-muted/30">
        <div className="flex items-center justify-center w-6 h-6 rounded-md bg-brand-accent/15">
          <Sparkles className="h-3 w-3 text-brand-accent" />
        </div>
        <span className="text-sm font-semibold text-foreground">AI Edit</span>

        {phase === 'streaming' && editMeta && (
          <Badge variant="outline" className="gap-1 text-[10px] border-brand-accent/30 text-brand-accent">
            {editMeta.mode === 'section' ? (
              <>
                <Target className="h-2.5 w-2.5" />
                Editing: {editMeta.targetSection}
              </>
            ) : (
              <>
                <Layers className="h-2.5 w-2.5" />
                Full document
              </>
            )}
          </Badge>
        )}

        {phase === 'streaming' && (
          <Badge variant="secondary" className="gap-1 text-[10px]">
            <Loader2 className="h-2.5 w-2.5 animate-spin" />
            Processing{streamedTokens > 0 ? ` (${streamedTokens} tokens)` : '...'}
          </Badge>
        )}
        {phase === 'done' && (
          <Badge variant="success" className="gap-1 text-[10px]">
            <CheckCircle2 className="h-2.5 w-2.5" />
            Applied{editMeta?.mode === 'section' ? ` to ${editMeta.targetSection}` : ''}
          </Badge>
        )}
        {phase === 'error' && (
          <Badge variant="destructive" className="gap-1 text-[10px]">
            <AlertCircle className="h-2.5 w-2.5" />
            Failed
          </Badge>
        )}

        <div className="flex-1" />

        {phase === 'done' && (
          <Button variant="ghost" size="sm" className="h-7 text-xs gap-1" onClick={onUndoRequested}>
            <Undo2 className="h-3 w-3" />
            Undo
          </Button>
        )}

        <button
          onClick={() => {
            if (phase === 'streaming') handleCancel();
            setExpanded(false);
          }}
          className="p-1 rounded-md hover:bg-muted transition-colors"
        >
          <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" />
        </button>
      </div>

      {/* Body */}
      <div className="p-4 space-y-3">
        {/* Error message */}
        {phase === 'error' && errorMessage && (
          <div className="flex items-start gap-2 text-sm text-red-700 bg-red-50 rounded-lg px-3 py-2">
            <AlertCircle className="h-4 w-4 mt-0.5 shrink-0" />
            <span>{errorMessage}</span>
          </div>
        )}

        {/* Section selector */}
        {topLevelHeadings.length > 0 && phase !== 'streaming' && (
          <div className="relative" ref={sectionPickerRef}>
            <button
              onClick={() => setShowSectionPicker(!showSectionPicker)}
              className={cn(
                'w-full flex items-center gap-2 px-3 py-2 rounded-lg border text-sm transition-colors text-left',
                selectedSection
                  ? 'border-brand-accent/40 bg-brand-accent/5 text-foreground'
                  : 'border-dashed border-muted-foreground/30 text-muted-foreground hover:border-muted-foreground/50',
              )}
            >
              <Target className="h-3.5 w-3.5 shrink-0" />
              {selectedSection ? (
                <span className="flex-1 truncate">
                  <span className="font-medium">Target:</span> {selectedSection}
                </span>
              ) : (
                <span className="flex-1">Select a section to edit (or leave blank for auto-detect)</span>
              )}
              {selectedSection && (
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    setSelectedSection('');
                  }}
                  className="p-0.5 rounded hover:bg-muted-foreground/10"
                >
                  <X className="h-3 w-3" />
                </button>
              )}
              <ChevronDown className={cn(
                'h-3.5 w-3.5 transition-transform',
                showSectionPicker && 'rotate-180',
              )} />
            </button>

            {showSectionPicker && (
              <div className="absolute z-50 top-full left-0 right-0 mt-1 bg-white border rounded-lg shadow-lg max-h-64 overflow-y-auto">
                <button
                  className={cn(
                    'w-full text-left px-3 py-2 text-sm hover:bg-muted/50 transition-colors border-b',
                    !selectedSection && 'bg-brand-accent/5 font-medium',
                  )}
                  onClick={() => {
                    setSelectedSection('');
                    setShowSectionPicker(false);
                  }}
                >
                  <span className="text-muted-foreground">Auto-detect from instruction</span>
                </button>
                {topLevelHeadings.map((heading) => (
                  <button
                    key={`${heading.line}-${heading.text}`}
                    className={cn(
                      'w-full text-left px-3 py-2 text-sm hover:bg-muted/50 transition-colors',
                      selectedSection === heading.text && 'bg-brand-accent/5 font-medium',
                    )}
                    onClick={() => {
                      setSelectedSection(heading.text);
                      setShowSectionPicker(false);
                    }}
                  >
                    <span style={{ paddingLeft: `${(heading.level - 1) * 12}px` }}>
                      {'#'.repeat(heading.level)} {heading.text}
                    </span>
                  </button>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Instruction textarea */}
        <div className="relative">
          <Textarea
            ref={textareaRef}
            value={instruction}
            onChange={(e) => setInstruction(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={selectedSection
              ? `Describe changes for "${selectedSection}"...\ne.g. "Add a new endpoint for user profile updates based on the attached OpenAPI spec"`
              : 'Describe what you\'d like to change...\ne.g. "Update the API Specifications section to match the attached OpenAPI file"'
            }
            className={cn(
              'min-h-[80px] max-h-[200px] resize-y text-sm pr-3',
              'focus-visible:ring-brand-accent/30',
              phase === 'streaming' && 'opacity-60 pointer-events-none',
            )}
            disabled={phase === 'streaming'}
          />
        </div>

        {/* Attached files */}
        {attachedFiles.length > 0 && (
          <div className="flex flex-wrap gap-1.5">
            {attachedFiles.map((af) => (
              <div
                key={af.id}
                className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-muted/60 border text-xs group"
              >
                <FileText className="h-3 w-3 text-muted-foreground shrink-0" />
                <span className="font-medium truncate max-w-[150px]">{af.file.name}</span>
                <span className="text-muted-foreground">{formatFileSize(af.file.size)}</span>
                {phase !== 'streaming' && (
                  <button
                    onClick={() => removeFile(af.id)}
                    className="p-0.5 rounded hover:bg-muted-foreground/10 transition-colors opacity-0 group-hover:opacity-100"
                  >
                    <X className="h-3 w-3 text-muted-foreground" />
                  </button>
                )}
              </div>
            ))}
          </div>
        )}

        {/* Actions */}
        <div className="flex items-center gap-2">
          <input
            ref={fileInputRef}
            type="file"
            multiple
            className="hidden"
            onChange={handleFileSelect}
            accept=".txt,.md,.json,.yaml,.yml,.xml,.csv,.ts,.tsx,.js,.jsx,.py,.java,.go,.rs,.rb,.php,.html,.css,.sql,.graphql,.env,.toml,.ini,.cfg,.conf,.properties,.log,.swagger,.openapi,.proto,.gql"
          />

          <Button
            variant="outline"
            size="sm"
            className="h-8 text-xs gap-1.5"
            onClick={() => fileInputRef.current?.click()}
            disabled={phase === 'streaming' || attachedFiles.length >= AI_EDIT_MAX_FILES}
          >
            <Paperclip className="h-3 w-3" />
            Attach{attachedFiles.length > 0 ? ` (${attachedFiles.length}/${AI_EDIT_MAX_FILES})` : ''}
          </Button>

          <div className="flex-1" />

          <span className="text-[10px] text-muted-foreground hidden sm:inline">
            {phase === 'idle' ? '⌘ + Enter to send' : ''}
          </span>

          {phase === 'streaming' ? (
            <Button
              variant="outline"
              size="sm"
              className="h-8 text-xs gap-1.5"
              onClick={handleCancel}
            >
              <X className="h-3 w-3" />
              Cancel
            </Button>
          ) : (
            <Button
              size="sm"
              className="h-8 text-xs gap-1.5 bg-brand-primary hover:bg-brand-primary/90"
              onClick={handleSubmit}
              disabled={!instruction.trim() || phase === 'done'}
            >
              <Send className="h-3 w-3" />
              Apply Changes
            </Button>
          )}
        </div>
      </div>

      {/* Streaming progress bar */}
      {phase === 'streaming' && (
        <div className="h-1 bg-muted overflow-hidden">
          <div className="h-full bg-brand-accent animate-pulse rounded-full" style={{ width: '100%' }} />
        </div>
      )}
    </div>
  );
}
