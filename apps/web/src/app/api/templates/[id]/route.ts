import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@damac/db';
import { requireAuth, auditLog } from '@/lib/auth';
import { TemplateEngine, assembleSectionsToPrompt } from '@damac/core';
import type { TemplateSection } from '@damac/core';
import { createPrivateCacheHeaders } from '@/lib/http-cache';
import { getAvailableTemplateSections, normalizeTemplateSections, parseTemplateSections } from '@/lib/template-sections';

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await requireAuth();
    const { id } = await params;

    const template = await prisma.template.findFirst({
      where: {
        id,
        OR: [{ userId: user.id }, { userId: null }, { isDefault: true }],
      },
    });

    if (!template) {
      return NextResponse.json({ success: false, error: 'Template not found' }, { status: 404 });
    }

    const fallbackSections = template.isDefault ? getAvailableTemplateSections() : [];
    const normalizedSections = parseTemplateSections(template.sectionsSchema, fallbackSections);
    const canEdit = template.userId === user.id;

    return NextResponse.json(
      {
        success: true,
        data: {
          ...template,
          sectionsSchema: JSON.stringify(normalizedSections),
          canEdit,
        },
      },
      { headers: createPrivateCacheHeaders(30, 90) },
    );
  } catch (error: any) {
    if (error.message === 'Unauthorized') {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }
    return NextResponse.json({ success: false, error: 'Internal server error' }, { status: 500 });
  }
}

export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await requireAuth();
    const { id } = await params;
    const body = await req.json();

    const template = await prisma.template.findFirst({
      where: { id, userId: user.id },
    });
    if (!template) {
      return NextResponse.json({ success: false, error: 'Template not found or not owned by you' }, { status: 404 });
    }

    const updateData: any = {};
    if (body.name !== undefined) updateData.name = body.name.trim();
    if (body.description !== undefined) updateData.description = body.description?.trim() || null;

    if (body.sectionsSchema !== undefined) {
      const sections: TemplateSection[] = normalizeTemplateSections(body.sectionsSchema);
      updateData.sectionsSchema = JSON.stringify(sections);
      updateData.promptText = assembleSectionsToPrompt(sections);
      updateData.variablesSchema = JSON.stringify(
        TemplateEngine.buildVariablesSchema(updateData.promptText),
      );
    } else if (body.promptText !== undefined) {
      updateData.promptText = body.promptText;
      updateData.variablesSchema = JSON.stringify(
        TemplateEngine.buildVariablesSchema(body.promptText),
      );
    }

    const updated = await prisma.template.update({
      where: { id },
      data: updateData,
    });

    await auditLog(user.id, 'update', 'template', id);
    return NextResponse.json({ success: true, data: updated });
  } catch (error: any) {
    if (error.message === 'Unauthorized') {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }
    return NextResponse.json({ success: false, error: 'Internal server error' }, { status: 500 });
  }
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await requireAuth();
    const { id } = await params;

    const template = await prisma.template.findFirst({
      where: { id, userId: user.id, isDefault: false },
    });
    if (!template) {
      return NextResponse.json({ success: false, error: 'Template not found, not owned by you, or is a default template' }, { status: 404 });
    }

    await prisma.template.delete({ where: { id } });
    await auditLog(user.id, 'delete', 'template', id);

    return NextResponse.json({ success: true });
  } catch (error: any) {
    if (error.message === 'Unauthorized') {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }
    return NextResponse.json({ success: false, error: 'Internal server error' }, { status: 500 });
  }
}
