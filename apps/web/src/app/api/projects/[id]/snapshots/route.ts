import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@damac/db';
import { requireAuth, auditLog } from '@/lib/auth';
import { getStorage } from '@/lib/storage';
import { validateUploadFile } from '@damac/shared';
import AdmZip from 'adm-zip';
import * as path from 'path';
import * as fs from 'fs';
import { v4 as uuidv4 } from 'uuid';

const activeProjectUploads = new Set<string>();

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  let uploadLockKey: string | null = null;

  try {
    const user = await requireAuth();
    const { id } = await params;

    const project = await prisma.project.findFirst({ where: { id, userId: user.id } });
    if (!project) {
      return NextResponse.json({ success: false, error: 'Project not found' }, { status: 404 });
    }

    uploadLockKey = `${user.id}:${project.id}`;
    if (activeProjectUploads.has(uploadLockKey)) {
      return NextResponse.json(
        { success: false, error: 'An upload is already in progress for this project' },
        { status: 409 },
      );
    }

    activeProjectUploads.add(uploadLockKey);

    const formData = await req.formData();
    const file = formData.get('file') as File | null;

    if (!file) {
      return NextResponse.json({ success: false, error: 'No file provided' }, { status: 400 });
    }

    const validation = validateUploadFile(file.name, file.size);
    if (!validation.valid) {
      return NextResponse.json({ success: false, error: validation.message }, { status: 400 });
    }

    const buffer = Buffer.from(await file.arrayBuffer());
    const storage = getStorage();
    const snapshotId = uuidv4();
    const storageKey = `snapshots/${project.id}/${snapshotId}`;

    await storage.save(`${storageKey}/archive.zip`, buffer);

    let fileCount = 0;
    try {
      const zip = new AdmZip(buffer);
      const entries = zip.getEntries();
      const extractDir = path.join(storage.getBasePath(), storageKey, 'extracted');
      fs.mkdirSync(extractDir, { recursive: true });

      for (const entry of entries) {
        if (entry.isDirectory) continue;
        const entryPath = path.join(extractDir, entry.entryName);
        const entryDir = path.dirname(entryPath);

        const normalizedPath = path.normalize(entryPath);
        if (!normalizedPath.startsWith(extractDir)) continue;

        fs.mkdirSync(entryDir, { recursive: true });
        fs.writeFileSync(entryPath, entry.getData());
        fileCount++;
      }
    } catch (zipError: any) {
      return NextResponse.json({ success: false, error: 'Failed to extract ZIP file: ' + zipError.message }, { status: 400 });
    }

    const snapshot = await prisma.snapshot.create({
      data: {
        id: snapshotId,
        projectId: project.id,
        storagePath: storageKey,
        originalFileName: file.name,
        fileSizeBytes: file.size,
        fileCount,
      },
    });

    await auditLog(user.id, 'upload', 'snapshot', snapshot.id, {
      projectId: project.id,
      fileName: file.name,
      fileSize: file.size,
    });

    return NextResponse.json({ success: true, data: snapshot });
  } catch (error: any) {
    if (error.message === 'Unauthorized') {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }
    console.error('Upload error:', error);
    return NextResponse.json({ success: false, error: 'Internal server error' }, { status: 500 });
  } finally {
    if (uploadLockKey) activeProjectUploads.delete(uploadLockKey);
  }
}
