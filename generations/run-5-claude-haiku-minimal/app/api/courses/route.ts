import { NextRequest, NextResponse } from 'next/server';
import { query } from '@/lib/db';
import { z } from 'zod';

const courseSchema = z.object({
  title: z.string().min(1).max(255),
  description: z.string().optional(),
  price_cents: z.number().int().min(0).optional(),
  is_free: z.boolean().optional(),
});

export async function GET(request: NextRequest) {
  try {
    const result = await query(
      'SELECT id, title, description, price_cents, is_free, created_at FROM courses ORDER BY created_at DESC'
    );
    return NextResponse.json(result.rows, { status: 200 });
  } catch (error) {
    console.error('Fetch courses error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { title, description, price_cents, is_free } = courseSchema.parse(body);

    const result = await query(
      'INSERT INTO courses (title, description, price_cents, is_free) VALUES ($1, $2, $3, $4) RETURNING id, title, description, price_cents, is_free',
      [title, description || null, price_cents || 0, is_free || false]
    );

    return NextResponse.json(result.rows[0], { status: 201 });
  } catch (error: any) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: error.errors }, { status: 400 });
    }
    console.error('Create course error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
