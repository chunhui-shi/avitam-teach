import { beforeEach, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';

const state = vi.hoisted(() => ({
  authz: null as null | Record<string, unknown>,
  saved: [] as string[],
  removed: [] as string[],
  enqueued: [] as { courseId: number; sourceId: number }[],
}));

vi.mock('@/lib/authz', () => ({
  authorizeCourseManagement: async () => state.authz,
}));
vi.mock('@/lib/storage', () => ({
  storage: {
    save: async (key: string) => { state.saved.push(key); return `/uploads/${key}`; },
    read: async () => Buffer.alloc(0),
    remove: async (key: string) => { state.removed.push(key); },
  },
}));
vi.mock('@/lib/ingestion', () => ({
  enqueueIngestion: async (courseId: number, _type: string, sourceId: number) => {
    state.enqueued.push({ courseId, sourceId });
  },
}));

import { POST } from '@/app/api/instructor/courses/[courseId]/materials/route';
import { DELETE } from '@/app/api/instructor/courses/[courseId]/materials/[materialId]/route';
import { resetDb, seedCourse, seedUser, testPool } from './helpers/db';

describe('instructor course materials', () => {
  beforeEach(async () => {
    await resetDb();
    state.saved = [];
    state.removed = [];
    state.enqueued = [];
  });

  it('rejects a student before reading an upload', async () => {
    state.authz = { ok: false, status: 403, error: 'Instructor or admin role required' };
    const res = await POST(new NextRequest('http://localhost/materials', { method: 'POST' }), {
      params: { courseId: '1' },
    });
    expect(res.status).toBe(403);
    expect(state.saved).toHaveLength(0);
  });

  it('stores one copy, records pending state, and queues ingestion', async () => {
    const instructor = await seedUser({ role: 'instructor' });
    const course = await seedCourse({ instructor_id: instructor.id });
    state.authz = {
      ok: true,
      user: { id: instructor.id, role: 'instructor' },
      course: { id: course.id },
    };
    const form = new FormData();
    form.set('title', 'Closure reference');
    form.set('material', new Blob(['# Closures\nLexical scope.'], { type: 'text/markdown' }), 'closures.md');

    const upload = () => POST(new NextRequest('http://localhost/materials', {
      method: 'POST', body: form,
    }), { params: { courseId: String(course.id) } });

    const first = await upload();
    expect(first.status).toBe(201);
    const firstBody = await first.json();
    expect(firstBody.material.status).toBe('pending');
    expect(state.saved).toHaveLength(1);
    expect(state.enqueued).toHaveLength(1);

    const secondForm = new FormData();
    secondForm.set('material', new Blob(['# Closures\nLexical scope.'], { type: 'text/markdown' }), 'copy.md');
    const second = await POST(new NextRequest('http://localhost/materials', {
      method: 'POST', body: secondForm,
    }), { params: { courseId: String(course.id) } });
    expect(second.status).toBe(200);
    expect((await second.json()).duplicate).toBe(true);
    expect(state.saved).toHaveLength(1);
  });

  it('removes indexed chunks, the material row, and its stored object', async () => {
    const instructor = await seedUser({ role: 'instructor' });
    const course = await seedCourse({ instructor_id: instructor.id });
    state.authz = { ok: true, user: { id: instructor.id }, course: { id: course.id } };
    const { rows } = await testPool.query(`
      INSERT INTO course_materials
        (course_id, uploaded_by, title, filename, content_type, storage_key, content_sha256)
      VALUES ($1, $2, 'Notes', 'notes.txt', 'text/plain', 'private/notes', 'digest')
      RETURNING id
    `, [course.id, instructor.id]);
    const materialId = rows[0].id;

    const res = await DELETE(new NextRequest('http://localhost/material', { method: 'DELETE' }), {
      params: { courseId: String(course.id), materialId: String(materialId) },
    });
    expect(res.status).toBe(204);
    expect(state.removed).toEqual(['private/notes']);
    const remaining = await testPool.query('SELECT 1 FROM course_materials WHERE id = $1', [materialId]);
    expect(remaining.rowCount).toBe(0);
  });
});
