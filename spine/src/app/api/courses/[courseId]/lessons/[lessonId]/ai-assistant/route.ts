import { NextRequest, NextResponse } from 'next/server';
import Anthropic from '@anthropic-ai/sdk';
import { queryOne } from '@/lib/db';
import { getSession } from '@/lib/auth';
import { rateLimited } from '@/lib/rate-limit';
import { Lesson, Enrollment } from '@/types';

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
});

export async function POST(
  req: NextRequest,
  { params }: { params: { courseId: string; lessonId: string } }
) {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
    }

    // Every call hits a paid model, so an unthrottled endpoint is a cost bomb.
    // Here, rate limiting is a correctness property, not just abuse protection.
    const limited = rateLimited(`ai-assistant:${session.userId}`, 20, 60_000);
    if (limited) return limited;

    const courseId = parseInt(params.courseId);
    const lessonId = parseInt(params.lessonId);

    if (isNaN(courseId) || isNaN(lessonId)) {
      return NextResponse.json({ error: 'Invalid ID' }, { status: 400 });
    }

    // Verify enrollment for paid courses
    const course = await queryOne<{ price_cents: number; title: string }>(
      'SELECT price_cents, title FROM courses WHERE id = $1 AND published = true',
      [courseId]
    );

    if (!course) {
      return NextResponse.json({ error: 'Course not found' }, { status: 404 });
    }

    if (course.price_cents > 0) {
      const enrollment = await queryOne<Enrollment>(
        'SELECT id FROM enrollments WHERE user_id = $1 AND course_id = $2',
        [session.userId, courseId]
      );
      if (!enrollment) {
        return NextResponse.json({ error: 'Enrollment required' }, { status: 403 });
      }
    }

    const lesson = await queryOne<Lesson>(
      'SELECT * FROM lessons WHERE id = $1 AND course_id = $2',
      [lessonId, courseId]
    );

    if (!lesson) {
      return NextResponse.json({ error: 'Lesson not found' }, { status: 404 });
    }

    const { question, history } = await req.json();

    if (!question || typeof question !== 'string') {
      return NextResponse.json({ error: 'Question is required' }, { status: 400 });
    }

    // Sanitize question length
    const sanitizedQuestion = question.substring(0, 2000);

    const systemPrompt = `You are an AI teaching assistant for the course "${course.title}".

The student is currently on the lesson: "${lesson.title}".

Lesson content:
${lesson.content.substring(0, 3000)}

${lesson.lesson_type === 'code' && lesson.code_starter ? `Starter code:\n\`\`\`${lesson.code_language}\n${lesson.code_starter}\n\`\`\`` : ''}

Your role:
- Answer questions about this specific lesson clearly and concisely
- Help students understand concepts without giving away full solutions to coding exercises
- Encourage students when they make progress
- If asked about unrelated topics, gently redirect to the lesson material
- Keep responses focused and under 300 words unless a longer explanation is truly needed`;

    // Build message history (last 6 turns max to keep context manageable)
    const messageHistory = Array.isArray(history) ? history.slice(-6) : [];
    const messages: Anthropic.MessageParam[] = [
      ...messageHistory.map((m: { role: string; content: string }) => ({
        role: m.role as 'user' | 'assistant',
        content: m.content,
      })),
      { role: 'user', content: sanitizedQuestion },
    ];

    const response = await anthropic.messages.create({
      model: 'claude-3-5-haiku-20241022',
      max_tokens: 512,
      system: systemPrompt,
      messages,
    });

    const answer = response.content[0].type === 'text' ? response.content[0].text : '';

    return NextResponse.json({ answer });
  } catch (err) {
    console.error('AI assistant error:', err);
    return NextResponse.json({ error: 'Failed to get AI response' }, { status: 500 });
  }
}
