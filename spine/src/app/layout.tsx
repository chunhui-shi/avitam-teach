import type { Metadata } from 'next';
import { Inter } from 'next/font/google';
import './globals.css';
import { Navbar } from '@/components/ui/Navbar';
import { getSession } from '@/lib/auth';
import { queryOne } from '@/lib/db';
import { User } from '@/types';

const inter = Inter({ subsets: ['latin'] });

export const metadata: Metadata = {
  title: 'Avitam Teach — Learn to Code',
  description: 'Online coding courses with AI-powered teaching assistants',
};

export default async function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  let user: { name: string; email: string; role: string; avatarUrl: string | null } | null = null;

  try {
    const session = await getSession();
    if (session) {
      const dbUser = await queryOne<User>(
        'SELECT name, email, role, avatar_url FROM users WHERE id = $1',
        [session.userId]
      );
      if (dbUser) {
        user = { name: dbUser.name, email: dbUser.email, role: dbUser.role, avatarUrl: dbUser.avatar_url };
      }
    }
  } catch {
    // DB not available during build or no session
  }

  return (
    <html lang="en">
      <body className={inter.className}>
        <Navbar user={user} />
        <main className="min-h-screen bg-gray-50">
          {children}
        </main>
      </body>
    </html>
  );
}
