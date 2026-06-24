import { NextRequest, NextResponse } from 'next/server';
import { writeFile, mkdir } from 'fs/promises';
import path from 'path';
import { query } from '@/lib/db';
import { getSession } from '@/lib/auth';
import { User } from '@/types';

const ALLOWED: Record<string, string> = {
  'image/png': 'png',
  'image/jpeg': 'jpg',
  'image/jpg': 'jpg',
  'image/gif': 'gif',
  'image/webp': 'webp',
};

const MAX_BYTES = 5 * 1024 * 1024; // 5 MB

// Upload an avatar image, store it on disk, and record the URL on the user.
export async function POST(req: NextRequest) {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
    }

    const form = await req.formData();
    const file = form.get('avatar');
    if (!file || typeof file === 'string') {
      return NextResponse.json({ error: 'No file uploaded' }, { status: 400 });
    }

    const ext = ALLOWED[file.type];
    if (!ext) {
      return NextResponse.json({ error: 'Unsupported image type. Use PNG, JPEG, GIF, or WebP.' }, { status: 400 });
    }
    if (file.size > MAX_BYTES) {
      return NextResponse.json({ error: 'Image must be 5 MB or smaller' }, { status: 400 });
    }

    const bytes = Buffer.from(await file.arrayBuffer());
    const dir = path.join(process.cwd(), 'public', 'uploads', 'avatars');
    await mkdir(dir, { recursive: true });

    const filename = `${session.userId}-${Date.now()}.${ext}`;
    await writeFile(path.join(dir, filename), bytes);

    const avatarUrl = `/uploads/avatars/${filename}`;
    const users = await query<User>(`
      UPDATE users SET avatar_url = $1 WHERE id = $2
      RETURNING id, email, name, role, display_name, bio, avatar_url, created_at
    `, [avatarUrl, session.userId]);

    return NextResponse.json({ avatar_url: avatarUrl, user: users[0] });
  } catch (err) {
    console.error('Avatar upload error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
