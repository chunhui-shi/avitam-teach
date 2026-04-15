import { NextRequest, NextResponse } from 'next/server';
import { query } from '@/lib/db';
import { z } from 'zod';

const progressSchema = z.object({
  userId: z.number().int().positive(),
  lessonId: z.number().int().positive(),
});

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { userId, lessonId } = progressSchema.parse(body);

    const result = await query(
      'INSERT INTO progress (user_id, lesson_id, completed_at) VALUES ($1, $2, NOW()) ON CONFLICT (user_id, lesson_id) DO UPDATE SET completed_at = NOW() RETURNING id, user_id, lesson_id, completed_at',
      [userId, lessonId]
    );

    return NextResponse.json(result.rows[0], { status: 201 });
  } catch (error: any) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: error.errors }, { status: 400 });
    }
    console.error('Progress update error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function GET(request: NextRequest) {
  try {
    const userId = request.nextUrl.searchParams.get('userId');
    const courseId = request.nextUrl.searchParams.get('courseId');

    if (!userId || !courseId) {
      return NextResponse.json(
        { error: 'userId and courseId are required' },
        { status: 400 }
      );
    }

    const result = await query(
      `SELECT progress.* FROM progress
       JOIN lessons ON progress.lesson_id = lessons.id
       WHERE progress.user_id = $1 AND lessons.course_id = $2`,
      [parseInt(userId), parseInt(courseId)]
    );

    return NextResponse.json(result.rows, { status: 200 });
  } catch (error) {
    console.error('Fetch progress error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
