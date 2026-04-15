import { NextRequest, NextResponse } from 'next/server';
import { query } from '@/lib/db';

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const courseId = parseInt(params.id, 10);

    const courseResult = await query('SELECT * FROM courses WHERE id = $1', [courseId]);
    if (courseResult.rows.length === 0) {
      return NextResponse.json({ error: 'Course not found' }, { status: 404 });
    }

    const lessonsResult = await query(
      'SELECT id, title, content, order_index FROM lessons WHERE course_id = $1 ORDER BY order_index ASC',
      [courseId]
    );

    return NextResponse.json(
      {
        ...courseResult.rows[0],
        lessons: lessonsResult.rows,
      },
      { status: 200 }
    );
  } catch (error) {
    console.error('Fetch course error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
