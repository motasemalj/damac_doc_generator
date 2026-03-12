import { NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth';
import { createPrivateCacheHeaders } from '@/lib/http-cache';

export async function GET() {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ success: false, error: 'Not authenticated' }, { status: 401 });
    }
    return NextResponse.json(
      { success: true, data: user },
      { headers: createPrivateCacheHeaders(30, 60) },
    );
  } catch {
    return NextResponse.json({ success: false, error: 'Internal server error' }, { status: 500 });
  }
}
