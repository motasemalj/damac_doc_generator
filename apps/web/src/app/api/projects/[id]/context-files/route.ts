import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@damac/db';
import { requireAuth, auditLog } from '@/lib/auth';
import { getStorage } from '@/lib/storage';
import { extractContextText, validateContextFile } from '@/lib/context-files';

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await requireAuth();
    const { id } = await params;

    const project = await prisma.project.findFirst({ where: { id, userId: user.id } });
    if (!project) {
      return NextResponse.json({ success: false, error: 'Project not found' }, { status: 404 });
    }

    const formData = await req.formData();
    const files = formData.getAll('files').filter((entry): entry is File => entry instanceof File);

    if (files.length === 0) {
      return NextResponse.json({ success: false, error: 'No files provided' }, { status: 400 });
    }

    const storage = getStorage();
    const uploadedFiles = [];

    for (const file of files) {
      const validation = validateContextFile(file.name, file.size, file.type);
      if (!validation.valid) {
        return NextResponse.json({ success: false, error: `${file.name}: ${validation.message}` }, { status: 400 });
      }

      const buffer = Buffer.from(await file.arrayBuffer());
      const storagePath = `context-files/${project.id}/${Date.now()}-${file.name.replace(/\s+/g, '_')}`;
      await storage.save(storagePath, buffer);

      const created = await prisma.projectContextFile.create({
        data: {
          projectId: project.id,
          storagePath,
          originalFileName: file.name,
          mimeType: file.type || null,
          fileSizeBytes: file.size,
          extractedText: extractContextText(buffer),
        },
      });

      await auditLog(user.id, 'upload', 'project_context_file', created.id, {
        projectId: project.id,
        fileName: file.name,
        fileSize: file.size,
      });

      uploadedFiles.push(created);
    }

    return NextResponse.json({
      success: true,
      data: uploadedFiles,
    });
  } catch (error: any) {
    if (error.message === 'Unauthorized') {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }
    console.error('Context file upload error:', error);
    return NextResponse.json({ success: false, error: 'Internal server error' }, { status: 500 });
  }
}
