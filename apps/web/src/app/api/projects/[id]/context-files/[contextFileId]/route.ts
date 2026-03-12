import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@damac/db';
import { requireAuth, auditLog } from '@/lib/auth';
import { getStorage } from '@/lib/storage';

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string; contextFileId: string }> },
) {
  try {
    const user = await requireAuth();
    const { id, contextFileId } = await params;

    const project = await prisma.project.findFirst({ where: { id, userId: user.id } });
    if (!project) {
      return NextResponse.json({ success: false, error: 'Project not found' }, { status: 404 });
    }

    const contextFile = await prisma.projectContextFile.findFirst({
      where: { id: contextFileId, projectId: project.id },
    });
    if (!contextFile) {
      return NextResponse.json({ success: false, error: 'Context file not found' }, { status: 404 });
    }

    await prisma.projectContextFile.delete({ where: { id: contextFile.id } });
    await auditLog(user.id, 'delete', 'project_context_file', contextFile.id, {
      projectId: project.id,
    });

    try {
      await getStorage().delete(contextFile.storagePath);
    } catch (storageError) {
      console.warn('Context file storage cleanup failed:', storageError);
    }

    return NextResponse.json({ success: true });
  } catch (error: any) {
    if (error.message === 'Unauthorized') {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }

    return NextResponse.json({ success: false, error: 'Internal server error' }, { status: 500 });
  }
}
