import { NextRequest, NextResponse } from 'next/server';

export async function POST(request: NextRequest) {
  const response = NextResponse.json({ message: 'Logout successful' }, { status: 200 });
  response.cookies.delete('auth_token');
  return response;
}
