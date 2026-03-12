import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@damac/db';
import { requireAuth } from '@/lib/auth';
import { createPrivateCacheHeaders } from '@/lib/http-cache';

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
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

    const revision = await prisma.tddRevision.create({
      data: {
        tddDocumentId: id,
        markdownContent: tdd.markdownContent,
        message: body.message || null,
      },
    });

    return NextResponse.json({ success: true, data: revision });
  } catch (error: any) {
    if (error.message === 'Unauthorized') {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }
    return NextResponse.json({ success: false, error: 'Internal server error' }, { status: 500 });
  }
}

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
      select: {
        revisions: {
          orderBy: { createdAt: 'desc' },
        },
      },
    });
    if (!tdd) {
      return NextResponse.json({ success: false, error: 'TDD not found' }, { status: 404 });
    }

    return NextResponse.json(
      { success: true, data: tdd.revisions },
      { headers: createPrivateCacheHeaders(15, 45) },
    );
  } catch (error: any) {
    if (error.message === 'Unauthorized') {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }
    return NextResponse.json({ success: false, error: 'Internal server error' }, { status: 500 });
  }
}
