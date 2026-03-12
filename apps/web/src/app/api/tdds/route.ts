import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@damac/db';
import { requireAuth, auditLog } from '@/lib/auth';
import { createPrivateCacheHeaders } from '@/lib/http-cache';

export async function GET(req: NextRequest) {
  try {
    const user = await requireAuth();
    const { searchParams } = new URL(req.url);
    const source = searchParams.get('source');

    const where: any = {
      OR: [
        { userId: user.id },
        { project: { userId: user.id } },
      ],
    };

    if (source) {
      where.source = source;
    }

    const documents = await prisma.tddDocument.findMany({
      where,
      include: {
        project: { select: { id: true, name: true } },
      },
      orderBy: { updatedAt: 'desc' },
    });

    return NextResponse.json(
      { success: true, data: documents },
      { headers: createPrivateCacheHeaders(10, 30) },
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
    const { title, markdownContent, description } = body;

    if (!title?.trim()) {
      return NextResponse.json(
        { success: false, error: 'Title is required' },
        { status: 400 },
      );
    }

    if (!markdownContent?.trim()) {
      return NextResponse.json(
        { success: false, error: 'Markdown content is required' },
        { status: 400 },
      );
    }

    const tdd = await prisma.tddDocument.create({
      data: {
        userId: user.id,
        title: title.trim(),
        description: description?.trim() || null,
        markdownContent: markdownContent.trim(),
        source: 'custom',
      },
    });

    await auditLog(user.id, 'create', 'tdd', tdd.id, { source: 'custom' });

    return NextResponse.json({ success: true, data: tdd }, { status: 201 });
  } catch (error: any) {
    if (error.message === 'Unauthorized') {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }
    console.error('Create custom document error:', error);
    return NextResponse.json({ success: false, error: 'Internal server error' }, { status: 500 });
  }
}
