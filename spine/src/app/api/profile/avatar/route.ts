import { NextRequest, NextResponse } from 'next/server';
import { query } from '@/lib/db';
import { getSession } from '@/lib/auth';
import { rateLimited } from '@/lib/rate-limit';
import { sniffImageType } from '@/lib/image-validation';
import { storage } from '@/lib/storage';
import { User } from '@/types';

const MAX_BYTES = 5 * 1024 * 1024; // 5 MB

// Upload an avatar image, store it via the storage abstraction, and record the
// URL on the user. The route no longer knows where the bytes physically land —
// that's the storage layer's job (v4-designed).
export async function POST(req: NextRequest) {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
    }

    // Each upload writes a file to disk; cap uploads per user so the endpoint
    // can't be used to fill the disk.
    const limited = rateLimited(`avatar:${session.userId}`, 10, 60 * 60_000);
    if (limited) return limited;

    const form = await req.formData();
    const file = form.get('avatar');
    if (!file || typeof file === 'string') {
      return NextResponse.json({ error: 'No file uploaded' }, { status: 400 });
    }

    const bytes = Buffer.from(await file.arrayBuffer());
    if (bytes.length > MAX_BYTES) {
      return NextResponse.json({ error: 'Image must be 5 MB or smaller' }, { status: 400 });
    }

    // v3-secured: derive the type from the actual file bytes, not the
    // client-declared Content-Type. A request can claim image/png while sending
    // anything; store it only if the bytes really are a supported image, and
    // take the extension from what the bytes say — not from the request header.
    const ext = sniffImageType(bytes);
    if (!ext) {
      return NextResponse.json({ error: 'Unsupported or invalid image. Use PNG, JPEG, GIF, or WebP.' }, { status: 400 });
    }

    const filename = `${session.userId}-${Date.now()}.${ext}`;
    const avatarUrl = await storage.save(`avatars/${filename}`, bytes, `image/${ext}`);
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
