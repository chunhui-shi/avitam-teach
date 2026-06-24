import { NextRequest, NextResponse } from 'next/server';
import { writeFile } from 'fs/promises';
import path from 'path';
import { queryOne } from '@/lib/db';
import { getSession } from '@/lib/auth';
import { User } from '@/types';

const allowedTypes = new Map([
  ['image/jpeg', 'jpg'],
  ['image/png', 'png'],
  ['image/gif', 'gif'],
  ['image/webp', 'webp'],
]);

export async function POST(req: NextRequest) {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
    }

    const formData = await req.formData();
    const file = formData.get('avatar');
    if (!(file instanceof File)) {
      return NextResponse.json({ error: 'Avatar image is required' }, { status: 400 });
    }

    const extension = allowedTypes.get(file.type);
    if (!extension) {
      return NextResponse.json({ error: 'Use a JPEG, PNG, GIF, or WebP image' }, { status: 400 });
    }

    if (file.size > 2 * 1024 * 1024) {
      return NextResponse.json({ error: 'Avatar must be 2MB or smaller' }, { status: 400 });
    }

    const bytes = await file.arrayBuffer();
    const buffer = Buffer.from(bytes);
    const filename = `user-${session.userId}-${Date.now()}.${extension}`;
    const uploadPath = path.join(process.cwd(), 'public', 'uploads', 'avatars', filename);
    await writeFile(uploadPath, buffer);

    const avatarUrl = `/uploads/avatars/${filename}`;
    const user = await queryOne<User>(`
      UPDATE users
      SET avatar_url = $1
      WHERE id = $2
      RETURNING id, email, name, role, bio, avatar_url, stripe_customer_id, created_at
    `, [avatarUrl, session.userId]);

    return NextResponse.json({ user, avatarUrl });
  } catch (err) {
    console.error('Avatar upload error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
