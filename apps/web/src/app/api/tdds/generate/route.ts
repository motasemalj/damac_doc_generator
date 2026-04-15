import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@damac/db';
import { requireAuth, auditLog } from '@/lib/auth';
import {
  GenerationService,
  TemplateEngine,
  assembleSectionsToPrompt,
  getDefaultSections,
  normalizeGeneratedMarkdown,
} from '@damac/core';
import type { TemplateSection } from '@damac/core';
import { createNoStoreHeaders } from '@/lib/http-cache';
import { getSnapshotSummaryPromptText } from '@/lib/snapshot-cache';
import { buildContextFilesPromptText } from '@/lib/context-files';
import { normalizeTemplateSections } from '@/lib/template-sections';

export const maxDuration = 300;

function stripMarkdownWrapper(raw: string): string {
  let s = raw.trim();
  const m = s.match(/^```(?:markdown|md)?\s*\n([\s\S]*?)\n\s*```\s*$/);
  if (m) return m[1].trim();
  if (/^```(?:markdown|md)?\s*$/m.test(s.split('\n')[0])) {
    s = s.replace(/^```(?:markdown|md)?\s*\n/, '');
    if (s.endsWith('\n```')) s = s.slice(0, -4);
    else if (s.endsWith('```')) s = s.slice(0, -3);
  }
  return s.trim();
}

function resolveTemplatePrompt(template: { isDefault: boolean; promptText: string; sectionsSchema: string | null }): string {
  try {
    const parsed = template.sectionsSchema ? JSON.parse(template.sectionsSchema) as TemplateSection[] : [];
    const sections = normalizeTemplateSections(parsed);
    if (sections.length > 0) {
      return assembleSectionsToPrompt(sections);
    }
  } catch {
    if (!template.isDefault) {
      return template.promptText;
    }
  }

  if (!template.isDefault) {
    return template.promptText;
  }

  try {
    const parsed = template.sectionsSchema ? JSON.parse(template.sectionsSchema) as TemplateSection[] : [];
    const sections = Array.isArray(parsed) && parsed.length > 0 ? parsed : getDefaultSections();
    return assembleSectionsToPrompt(sections);
  } catch {
    return assembleSectionsToPrompt(getDefaultSections());
  }
}

export async function POST(req: NextRequest) {
  try {
    const user = await requireAuth();
    const body = await req.json();
    const { projectId, snapshotId, templateId, generationNotes, variables } = body;

    if (!projectId || !snapshotId || !templateId) {
      return NextResponse.json(
        { success: false, error: 'projectId, snapshotId, and templateId are required' },
        { status: 400 },
      );
    }

    const project = await prisma.project.findFirst({ where: { id: projectId, userId: user.id } });
    if (!project) {
      return NextResponse.json({ success: false, error: 'Project not found' }, { status: 404 });
    }

    const snapshot = await prisma.snapshot.findFirst({ where: { id: snapshotId, projectId } });
    if (!snapshot) {
      return NextResponse.json({ success: false, error: 'Snapshot not found' }, { status: 404 });
    }

    const template = await prisma.template.findFirst({ where: { id: templateId } });
    if (!template) {
      return NextResponse.json({ success: false, error: 'Template not found' }, { status: 404 });
    }

    const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);
    const recentJobs = await prisma.generationJob.count({
      where: {
        projectId,
        createdAt: { gte: oneHourAgo },
        status: { in: ['running', 'completed'] },
      },
    });
    if (recentJobs >= 10) {
      return NextResponse.json(
        { success: false, error: 'Rate limit: max 10 generations per project per hour' },
        { status: 429 },
      );
    }

    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) {
      return NextResponse.json(
        { success: false, error: 'OpenAI API key not configured' },
        { status: 500 },
      );
    }

    const job = await prisma.generationJob.create({
      data: {
        projectId,
        snapshotId,
        templateId,
        status: 'running',
        generationNotes: generationNotes || null,
        startedAt: new Date(),
      },
    });

    const contextFiles = await prisma.projectContextFile.findMany({
      where: { projectId },
      orderBy: { createdAt: 'desc' },
    });
    const codebaseSummary = [
      await getSnapshotSummaryPromptText(snapshot.storagePath),
      buildContextFilesPromptText(contextFiles, project.contextFileInstructions),
    ].filter(Boolean).join('\n\n');

    const vars: Record<string, string> = { ...(variables || {}) };
    if (generationNotes) {
      vars['OPTIONAL_NOTES'] = `\n\nAdditional Notes from the requester:\n${generationNotes}`;
    }
    const { result: templatePrompt } = TemplateEngine.render(resolveTemplatePrompt(template), vars);

    const genService = new GenerationService({
      apiKey,
      model: process.env.OPENAI_MODEL || undefined,
    });

    const encoder = new TextEncoder();
    let fullContent = '';
    let tokensIn = 0;
    let tokensOut = 0;

    const stream = new ReadableStream({
      async start(controller) {
        try {
          const gen = genService.generateStream({
            systemPrompt: '',
            codebaseSummary,
            templatePrompt,
          });

          while (true) {
            const result = await gen.next();
            if (result.done) {
              tokensIn = result.value.tokensIn;
              tokensOut = result.value.tokensOut;
              break;
            }
            fullContent += result.value;
            controller.enqueue(encoder.encode(`data: ${JSON.stringify({ token: result.value })}\n\n`));
          }

          const cleanedContent = normalizeGeneratedMarkdown(stripMarkdownWrapper(fullContent));

          const tdd = await prisma.tddDocument.create({
            data: {
              projectId,
              snapshotId,
              templateId,
              title: `TDD - ${project.name}`,
              markdownContent: cleanedContent,
              generationNotes: generationNotes || null,
            },
          });

          await prisma.generationJob.update({
            where: { id: job.id },
            data: {
              status: 'completed',
              tddDocumentId: tdd.id,
              finishedAt: new Date(),
              tokensIn,
              tokensOut,
            },
          });

          await auditLog(user.id, 'generate', 'tdd', tdd.id, {
            projectId,
            snapshotId,
            templateId,
            tokensIn,
            tokensOut,
          });

          controller.enqueue(
            encoder.encode(`data: ${JSON.stringify({ done: true, tddId: tdd.id })}\n\n`),
          );
          controller.close();
        } catch (error: any) {
          await prisma.generationJob.update({
            where: { id: job.id },
            data: {
              status: 'failed',
              finishedAt: new Date(),
              errorMessage: error.message || 'Unknown error',
            },
          });

          controller.enqueue(
            encoder.encode(`data: ${JSON.stringify({ error: error.message })}\n\n`),
          );
          controller.close();
        }
      },
    });

    return new NextResponse(stream, {
      headers: {
        'Content-Type': 'text/event-stream',
        Connection: 'keep-alive',
        ...createNoStoreHeaders(),
      },
    });
  } catch (error: any) {
    if (error.message === 'Unauthorized') {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }
    console.error('Generation error:', error);
    return NextResponse.json({ success: false, error: 'Internal server error' }, { status: 500 });
  }
}
