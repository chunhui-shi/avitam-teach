import { createHash, randomUUID } from 'crypto';
import { NextRequest, NextResponse } from 'next/server';
import { authorizeCourseManagement } from '@/lib/authz';
import { query, queryOne } from '@/lib/db';
import { enqueueIngestion } from '@/lib/ingestion';
import { validateMaterialBytes } from '@/lib/material-validation';
import { rateLimited } from '@/lib/rate-limit';
import { storage } from '@/lib/storage';
import type { CourseMaterial } from '@/types';

const MAX_MATERIAL_BYTES = 10 * 1024 * 1024;

export async function GET(
  req: NextRequest,
  { params }: { params: { courseId: string } }
) {
  const courseId = Number(params.courseId);
  if (!Number.isInteger(courseId)) {
    return NextResponse.json({ error: 'Invalid course ID' }, { status: 400 });
  }
  const authz = await authorizeCourseManagement(courseId);
  if (!authz.ok) {
    return NextResponse.json({ error: authz.error }, { status: authz.status });
  }
  const materials = await query<CourseMaterial>(`
    SELECT id, course_id, uploaded_by, title, filename, content_type,
           status, error_message, created_at, updated_at
    FROM course_materials
    WHERE course_id = $1
    ORDER BY created_at DESC
  `, [courseId]);
  return NextResponse.json({ materials });
}

export async function POST(
  req: NextRequest,
  { params }: { params: { courseId: string } }
) {
  const courseId = Number(params.courseId);
  if (!Number.isInteger(courseId)) {
    return NextResponse.json({ error: 'Invalid course ID' }, { status: 400 });
  }
  const authz = await authorizeCourseManagement(courseId);
  if (!authz.ok) {
    return NextResponse.json({ error: authz.error }, { status: authz.status });
  }
  const limited = rateLimited(`material-upload:${authz.user.id}`, 20, 60 * 60_000);
  if (limited) return limited;

  const form = await req.formData();
  const file = form.get('material');
  const requestedTitle = form.get('title');
  if (!file || typeof file === 'string') {
    return NextResponse.json({ error: 'No material uploaded' }, { status: 400 });
  }
  const bytes = Buffer.from(await file.arrayBuffer());
  if (bytes.length === 0 || bytes.length > MAX_MATERIAL_BYTES) {
    return NextResponse.json({ error: 'Material must be between 1 byte and 10 MB' }, { status: 400 });
  }
  const contentType = validateMaterialBytes(bytes, file.type);
  if (!contentType) {
    return NextResponse.json(
      { error: 'Unsupported or invalid material. Use UTF-8 text, Markdown, or PDF.' },
      { status: 400 }
    );
  }

  const digest = createHash('sha256').update(bytes).digest('hex');
  const duplicate = await queryOne<CourseMaterial>(`
    SELECT id, course_id, uploaded_by, title, filename, content_type,
           status, error_message, created_at, updated_at
    FROM course_materials WHERE course_id = $1 AND content_sha256 = $2
  `, [courseId, digest]);
  if (duplicate) {
    return NextResponse.json({ material: duplicate, duplicate: true });
  }

  const title = (typeof requestedTitle === 'string' && requestedTitle.trim()
    ? requestedTitle.trim()
    : file.name.replace(/\.[^.]+$/, '')).slice(0, 200);
  const filename = file.name.replace(/[\r\n]/g, ' ').slice(0, 255) || 'material';
  const storageKey = `courses/${courseId}/materials/${randomUUID()}`;
  await storage.save(storageKey, bytes, contentType);

  try {
    const [material] = await query<CourseMaterial>(`
      INSERT INTO course_materials
        (course_id, uploaded_by, title, filename, content_type, storage_key, content_sha256)
      VALUES ($1, $2, $3, $4, $5, $6, $7)
      RETURNING id, course_id, uploaded_by, title, filename, content_type,
                status, error_message, created_at, updated_at
    `, [courseId, authz.user.id, title, filename, contentType, storageKey, digest]);
    await enqueueIngestion(courseId, 'material', material.id);
    return NextResponse.json({ material }, { status: 201 });
  } catch (err) {
    await storage.remove(storageKey);
    throw err;
  }
}
