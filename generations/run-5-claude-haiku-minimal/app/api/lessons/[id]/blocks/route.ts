import { NextRequest, NextResponse } from 'next/server';
import { query } from '@/lib/db';

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const lessonId = parseInt(params.id, 10);

    const blocksResult = await query(
      'SELECT id, block_type, content, order_index FROM lesson_blocks WHERE lesson_id = $1 ORDER BY order_index ASC',
      [lessonId]
    );

    const blocks = await Promise.all(
      blocksResult.rows.map(async (block) => {
        if (block.block_type === 'quiz') {
          const optionsResult = await query(
            'SELECT id, text, is_correct, order_index FROM quiz_options WHERE block_id = $1 ORDER BY order_index ASC',
            [block.id]
          );
          return { ...block, options: optionsResult.rows };
        }
        return block;
      })
    );

    return NextResponse.json(blocks, { status: 200 });
  } catch (error) {
    console.error('Fetch blocks error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
