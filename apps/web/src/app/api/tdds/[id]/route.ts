import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@damac/db';
import { requireAuth, auditLog } from '@/lib/auth';
import { createPrivateCacheHeaders } from '@/lib/http-cache';

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await requireAuth();
    const { id } = await params;

    const tdd = await prisma.tddDocument.findFirst({
      where: {
        id,
        OR: [
          { userId: user.id },
          { project: { userId: user.id } },
        ],
      },
      include: {
        project: { select: { id: true, name: true } },
        snapshot: { select: { id: true, originalFileName: true, createdAt: true } },
        template: { select: { id: true, name: true } },
        revisions: { orderBy: { createdAt: 'desc' }, take: 20 },
      },
    });

    if (!tdd) {
      return NextResponse.json({ success: false, error: 'TDD not found' }, { status: 404 });
    }

    return NextResponse.json(
      { success: true, data: tdd },
      { headers: createPrivateCacheHeaders(15, 45) },
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

    const tdd = await prisma.tddDocument.findFirst({
      where: {
        id,
        OR: [
          { userId: user.id },
          { project: { userId: user.id } },
        ],
      },
    });
    if (!tdd) {
      return NextResponse.json({ success: false, error: 'TDD not found' }, { status: 404 });
    }

    const updateData: any = {};
    if (body.title !== undefined) updateData.title = body.title;
    if (body.description !== undefined) updateData.description = body.description;
    if (body.tags !== undefined) updateData.tags = JSON.stringify(body.tags);
    if (body.markdownContent !== undefined) updateData.markdownContent = body.markdownContent;

    const updated = await prisma.tddDocument.update({
      where: { id },
      data: updateData,
    });

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

    const tdd = await prisma.tddDocument.findFirst({
      where: {
        id,
        OR: [
          { userId: user.id },
          { project: { userId: user.id } },
        ],
      },
    });
    if (!tdd) {
      return NextResponse.json({ success: false, error: 'TDD not found' }, { status: 404 });
    }

    await prisma.tddDocument.delete({ where: { id } });
    await auditLog(user.id, 'delete', 'tdd', id);

    return NextResponse.json({ success: true });
  } catch (error: any) {
    if (error.message === 'Unauthorized') {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }
    return NextResponse.json({ success: false, error: 'Internal server error' }, { status: 500 });
  }
}
