import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@damac/db';
import { requireAuth } from '@/lib/auth';
import { getSnapshotTree } from '@/lib/snapshot-cache';

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string; snapshotId: string }> },
) {
  try {
    const user = await requireAuth();
    const { id, snapshotId } = await params;

    const project = await prisma.project.findFirst({ where: { id, userId: user.id } });
    if (!project) {
      return NextResponse.json({ success: false, error: 'Project not found' }, { status: 404 });
    }

    const snapshot = await prisma.snapshot.findFirst({
      where: { id: snapshotId, projectId: id },
    });
    if (!snapshot) {
      return NextResponse.json({ success: false, error: 'Snapshot not found' }, { status: 404 });
    }

    const tree = await getSnapshotTree(snapshot.storagePath);

    return NextResponse.json({ success: true, data: tree });
  } catch (error: any) {
    if (error.message === 'Unauthorized') {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }
    return NextResponse.json({ success: false, error: 'Internal server error' }, { status: 500 });
  }
}
