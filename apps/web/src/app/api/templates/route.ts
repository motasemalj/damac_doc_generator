import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@damac/db';
import { requireAuth, auditLog } from '@/lib/auth';
import { validateTemplateName } from '@damac/shared';
import { TemplateEngine, getDefaultSections, assembleSectionsToPrompt } from '@damac/core';
import type { TemplateSection } from '@damac/core';
import { createPrivateCacheHeaders } from '@/lib/http-cache';
import { normalizeTemplateSections } from '@/lib/template-sections';

export async function GET() {
  try {
    const user = await requireAuth();
    const templates = await prisma.template.findMany({
      where: {
        OR: [
          { userId: user.id },
          { userId: null },
          { isDefault: true },
        ],
      },
      orderBy: [{ isDefault: 'desc' }, { updatedAt: 'desc' }],
    });
    return NextResponse.json(
      { success: true, data: templates },
      { headers: createPrivateCacheHeaders(30, 90) },
    );
  } catch (error: any) {
    if (error.message === 'Unauthorized') {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }
    return NextResponse.json({ success: false, error: 'Internal server error' }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const user = await requireAuth();
    const body = await req.json();
    const { name, description, cloneFromId, startFromDefault } = body;

    if (cloneFromId) {
      const source = await prisma.template.findFirst({ where: { id: cloneFromId } });
      if (!source) {
        return NextResponse.json({ success: false, error: 'Source template not found' }, { status: 404 });
      }
      let normalizedSections: TemplateSection[] = [];
      try {
        normalizedSections = normalizeTemplateSections(
          source.sectionsSchema ? JSON.parse(source.sectionsSchema) : [],
        );
      } catch {
        normalizedSections = [];
      }
      const promptText = assembleSectionsToPrompt(normalizedSections);
      const varsSchema = TemplateEngine.buildVariablesSchema(promptText);

      const cloned = await prisma.template.create({
        data: {
          userId: user.id,
          name: `${source.name} (Copy)`,
          description: source.description,
          promptText,
          variablesSchema: JSON.stringify(varsSchema),
          sectionsSchema: JSON.stringify(normalizedSections),
        },
      });
      await auditLog(user.id, 'clone', 'template', cloned.id);
      return NextResponse.json({ success: true, data: cloned });
    }

    const nameValid = validateTemplateName(name || 'New Template');
    if (!nameValid.valid) {
      return NextResponse.json({ success: false, error: nameValid.message }, { status: 400 });
    }

    const sections: TemplateSection[] = startFromDefault !== false
      ? getDefaultSections()
      : [];
    const promptText = assembleSectionsToPrompt(sections);
    const varsSchema = TemplateEngine.buildVariablesSchema(promptText);

    const template = await prisma.template.create({
      data: {
        userId: user.id,
        name: (name || 'New Template').trim(),
        description: description?.trim() || null,
        promptText,
        variablesSchema: JSON.stringify(varsSchema),
        sectionsSchema: JSON.stringify(sections),
      },
    });

    await auditLog(user.id, 'create', 'template', template.id);
    return NextResponse.json({ success: true, data: template });
  } catch (error: any) {
    if (error.message === 'Unauthorized') {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }
    return NextResponse.json({ success: false, error: 'Internal server error' }, { status: 500 });
  }
}
