import { NextRequest, NextResponse } from 'next/server';
import { query } from '@/lib/db';
import { z } from 'zod';

const submitSchema = z.object({
  userId: z.number().int().positive(),
  blockId: z.number().int().positive(),
  selectedOptionId: z.number().int().positive(),
});

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { userId, blockId, selectedOptionId } = submitSchema.parse(body);

    const optionResult = await query(
      'SELECT is_correct FROM quiz_options WHERE id = $1 AND block_id = $2',
      [selectedOptionId, blockId]
    );

    if (optionResult.rows.length === 0) {
      return NextResponse.json({ error: 'Option not found' }, { status: 404 });
    }

    const isCorrect = optionResult.rows[0].is_correct;

    const result = await query(
      'INSERT INTO quiz_answers (user_id, block_id, selected_option_id, is_correct) VALUES ($1, $2, $3, $4) ON CONFLICT (user_id, block_id) DO UPDATE SET selected_option_id = $3, is_correct = $4 RETURNING id, is_correct',
      [userId, blockId, selectedOptionId, isCorrect]
    );

    return NextResponse.json(
      {
        result: result.rows[0],
        isCorrect,
      },
      { status: 201 }
    );
  } catch (error: any) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: error.errors }, { status: 400 });
    }
    console.error('Quiz submission error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
