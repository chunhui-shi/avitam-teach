import { NextRequest, NextResponse } from 'next/server';
import { query } from '@/lib/db';
import { Anthropic } from '@anthropic-ai/sdk';

const client = new Anthropic({
  apiKey: process.env.CLAUDE_API_KEY,
});

export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const body = await request.json();
    const { question } = body;

    if (!question || typeof question !== 'string') {
      return NextResponse.json({ error: 'Question is required' }, { status: 400 });
    }

    if (question.length > 2000) {
      return NextResponse.json(
        { error: 'Question exceeds maximum length (2000 chars)' },
        { status: 400 }
      );
    }

    const lessonId = parseInt(params.id, 10);

    const lessonResult = await query(
      'SELECT lessons.id, lessons.title, lessons.content, courses.title as course_title FROM lessons JOIN courses ON lessons.course_id = courses.id WHERE lessons.id = $1',
      [lessonId]
    );

    if (lessonResult.rows.length === 0) {
      return NextResponse.json({ error: 'Lesson not found' }, { status: 404 });
    }

    const lesson = lessonResult.rows[0];
    const lessonContext = `
Course: ${lesson.course_title}
Lesson: ${lesson.title}
Content: ${lesson.content || 'No additional content'}
`;

    const response = await client.messages.create({
      model: 'claude-3-5-sonnet-20241022',
      max_tokens: 1024,
      system: `You are a helpful teaching assistant for an online coding course. You help students understand lessons, debug code, and clarify concepts. Keep responses concise and encouraging. The current lesson context is:\n\n${lessonContext}`,
      messages: [
        {
          role: 'user',
          content: question,
        },
      ],
    });

    const assistantResponse =
      response.content[0].type === 'text'
        ? response.content[0].text
        : 'Unable to generate response';

    return NextResponse.json(
      {
        answer: assistantResponse,
        usage: {
          input_tokens: response.usage.input_tokens,
          output_tokens: response.usage.output_tokens,
        },
      },
      { status: 200 }
    );
  } catch (error: any) {
    console.error('Assistant error:', error);
    return NextResponse.json(
      { error: error.message || 'Internal server error' },
      { status: 500 }
    );
  }
}
