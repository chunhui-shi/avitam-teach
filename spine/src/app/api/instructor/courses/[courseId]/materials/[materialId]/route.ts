import { NextRequest, NextResponse } from 'next/server';
import pool, { queryOne } from '@/lib/db';
import { authorizeCourseManagement } from '@/lib/authz';
import { enqueueIngestion } from '@/lib/ingestion';
import { storage } from '@/lib/storage';

function ids(params: { courseId: string; materialId: string }) {
  return { courseId: Number(params.courseId), materialId: Number(params.materialId) };
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: { courseId: string; materialId: string } }
) {
  const { courseId, materialId } = ids(params);
  if (!Number.isInteger(courseId) || !Number.isInteger(materialId)) {
    return NextResponse.json({ error: 'Invalid ID' }, { status: 400 });
  }
  const authz = await authorizeCourseManagement(courseId);
  if (!authz.ok) {
    return NextResponse.json({ error: authz.error }, { status: authz.status });
  }
  const material = await queryOne(
    'SELECT id FROM course_materials WHERE id = $1 AND course_id = $2',
    [materialId, courseId]
  );
  if (!material) return NextResponse.json({ error: 'Material not found' }, { status: 404 });
  await enqueueIngestion(courseId, 'material', materialId);
  return NextResponse.json({ status: 'pending' });
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: { courseId: string; materialId: string } }
) {
  const { courseId, materialId } = ids(params);
  if (!Number.isInteger(courseId) || !Number.isInteger(materialId)) {
    return NextResponse.json({ error: 'Invalid ID' }, { status: 400 });
  }
  const authz = await authorizeCourseManagement(courseId);
  if (!authz.ok) {
    return NextResponse.json({ error: authz.error }, { status: authz.status });
  }
  const material = await queryOne<{ storage_key: string }>(
    'SELECT storage_key FROM course_materials WHERE id = $1 AND course_id = $2',
    [materialId, courseId]
  );
  if (!material) return NextResponse.json({ error: 'Material not found' }, { status: 404 });

  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    await client.query(
      "DELETE FROM knowledge_chunks WHERE source_type = 'material' AND source_id = $1",
      [materialId]
    );
    await client.query(
      "DELETE FROM ingestion_jobs WHERE source_type = 'material' AND source_id = $1",
      [materialId]
    );
    await client.query(
      'DELETE FROM course_materials WHERE id = $1 AND course_id = $2',
      [materialId, courseId]
    );
    await client.query('COMMIT');
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
  try {
    await storage.remove(material.storage_key);
  } catch (err) {
    // The database is authoritative for retrieval. A failed object cleanup is
    // an orphan to sweep, not a reason to resurrect deleted course content.
    console.error('Material object cleanup failed:', err);
  }
  return new NextResponse(null, { status: 204 });
}
