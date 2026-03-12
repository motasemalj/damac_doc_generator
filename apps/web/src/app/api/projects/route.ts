import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@damac/db';
import { requireAuth, auditLog } from '@/lib/auth';
import { createPrivateCacheHeaders } from '@/lib/http-cache';

export async function GET() {
  try {
    const user = await requireAuth();
    const projects = await prisma.project.findMany({
      where: { userId: user.id },
      orderBy: { updatedAt: 'desc' },
      include: {
        _count: { select: { snapshots: true, tdds: true } },
      },
    });
    return NextResponse.json(
      { success: true, data: projects },
      { headers: createPrivateCacheHeaders(15, 45) },
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
    const { name, description } = body;

    if (!name || name.trim().length === 0) {
      return NextResponse.json({ success: false, error: 'Project name is required' }, { status: 400 });
    }

    const project = await prisma.project.create({
      data: {
        userId: user.id,
        name: name.trim(),
        description: description?.trim() || null,
      },
    });

    await auditLog(user.id, 'create', 'project', project.id);

    return NextResponse.json({ success: true, data: project });
  } catch (error: any) {
    if (error.message === 'Unauthorized') {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }
    return NextResponse.json({ success: false, error: 'Internal server error' }, { status: 500 });
  }
}
