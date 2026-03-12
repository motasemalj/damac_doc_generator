import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@damac/db';
import { requireAuth, auditLog } from '@/lib/auth';
import { getStorage } from '@/lib/storage';

export async function DELETE(
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
      where: { id: snapshotId, projectId: project.id },
    });
    if (!snapshot) {
      return NextResponse.json({ success: false, error: 'Snapshot not found' }, { status: 404 });
    }

    await prisma.snapshot.delete({ where: { id: snapshot.id } });
    await auditLog(user.id, 'delete', 'snapshot', snapshot.id, { projectId: project.id });

    try {
      await getStorage().delete(snapshot.storagePath);
    } catch (storageError) {
      console.warn('Snapshot storage cleanup failed:', storageError);
    }

    return NextResponse.json({ success: true });
  } catch (error: any) {
    if (error.message === 'Unauthorized') {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }

    return NextResponse.json({ success: false, error: 'Internal server error' }, { status: 500 });
  }
}
