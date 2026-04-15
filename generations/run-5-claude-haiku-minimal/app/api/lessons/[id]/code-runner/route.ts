import { NextRequest, NextResponse } from 'next/server';

export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const body = await request.json();
    const { code } = body;

    if (!code || typeof code !== 'string') {
      return NextResponse.json({ error: 'Code is required' }, { status: 400 });
    }

    if (code.length > 5000) {
      return NextResponse.json(
        { error: 'Code exceeds maximum length (5000 chars)' },
        { status: 400 }
      );
    }

    const output: string[] = [];
    const errors: string[] = [];

    const originalLog = console.log;
    const originalError = console.error;

    try {
      const captureLog = (...args: any[]) => {
        output.push(args.map((a) => String(a)).join(' '));
      };

      const captureError = (...args: any[]) => {
        errors.push(args.map((a) => String(a)).join(' '));
      };

      console.log = captureLog;
      console.error = captureError;

      const AsyncFunction = Object.getPrototypeOf(async function () {}).constructor;
      const fn = new AsyncFunction(code);
      await fn();

      console.log = originalLog;
      console.error = originalError;

      return NextResponse.json(
        {
          output: output.join('\n'),
          errors: errors.join('\n'),
          success: true,
        },
        { status: 200 }
      );
    } catch (execError: any) {
      console.log = originalLog;
      console.error = originalError;

      return NextResponse.json(
        {
          output: output.join('\n'),
          errors: execError.message || 'Execution error',
          success: false,
        },
        { status: 200 }
      );
    }
  } catch (error) {
    console.error('Code runner error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
