import { NextResponse } from 'next/server';
import { storage } from '@/lib/storage';

const imageTypes: Record<string, string> = {
  png: 'image/png', jpg: 'image/jpeg', jpeg: 'image/jpeg',
  gif: 'image/gif', webp: 'image/webp',
};

export async function GET(_req: Request, { params }: { params: { key: string[] } }) {
  const key = params.key.join('/');
  if (!key.startsWith('avatars/') || key.includes('..')) {
    return NextResponse.json({ error: 'Asset not found' }, { status: 404 });
  }
  const contentType = imageTypes[key.split('.').pop()?.toLowerCase() || ''];
  if (!contentType) return NextResponse.json({ error: 'Asset not found' }, { status: 404 });
  try {
    const bytes = await storage.read(key);
    return new NextResponse(new Uint8Array(bytes), { headers: {
      'content-type': contentType,
      'cache-control': 'public, max-age=3600',
      'x-content-type-options': 'nosniff',
    } });
  } catch {
    return NextResponse.json({ error: 'Asset not found' }, { status: 404 });
  }
}
