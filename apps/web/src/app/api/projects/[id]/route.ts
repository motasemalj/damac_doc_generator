import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@damac/db';
import { requireAuth } from '@/lib/auth';
import { createNoStoreHeaders } from '@/lib/http-cache';

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await requireAuth();
    const { id } = await params;
    const project = await prisma.project.findFirst({
      where: { id, userId: user.id },
      include: {
        snapshots: { orderBy: { createdAt: 'desc' } },
        contextFiles: { orderBy: { createdAt: 'desc' } },
        tdds: {
          orderBy: { updatedAt: 'desc' },
          include: { template: { select: { name: true } } },
        },
        jobs: { orderBy: { createdAt: 'desc' }, take: 10 },
      },
    });

    if (!project) {
      return NextResponse.json({ success: false, error: 'Project not found' }, { status: 404 });
    }

    return NextResponse.json(
      { success: true, data: project },
      { headers: createNoStoreHeaders() },
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

    const project = await prisma.project.findFirst({ where: { id, userId: user.id } });
    if (!project) {
      return NextResponse.json({ success: false, error: 'Project not found' }, { status: 404 });
    }

    const updated = await prisma.project.update({
      where: { id },
      data: {
        name: body.name?.trim() || project.name,
        description: body.description?.trim() ?? project.description,
        contextFileInstructions: body.contextFileInstructions !== undefined
          ? (body.contextFileInstructions?.trim() || null)
          : undefined,
      },
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

    const project = await prisma.project.findFirst({ where: { id, userId: user.id } });
    if (!project) {
      return NextResponse.json({ success: false, error: 'Project not found' }, { status: 404 });
    }

    await prisma.project.delete({ where: { id } });
    return NextResponse.json({ success: true });
  } catch (error: any) {
    if (error.message === 'Unauthorized') {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }
    return NextResponse.json({ success: false, error: 'Internal server error' }, { status: 500 });
  }
}
