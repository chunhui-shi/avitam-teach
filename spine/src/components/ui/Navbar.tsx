'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState } from 'react';

interface NavbarProps {
  user?: { name: string; email: string; role?: string; avatar_url?: string | null } | null;
}

function initials(name: string): string {
  return name.split(' ').map(p => p[0]).slice(0, 2).join('').toUpperCase();
}

export function Navbar({ user }: NavbarProps) {
  const router = useRouter();
  const [loggingOut, setLoggingOut] = useState(false);

  const handleLogout = async () => {
    setLoggingOut(true);
    await fetch('/api/auth/logout', { method: 'POST' });
    router.push('/');
    router.refresh();
    setLoggingOut(false);
  };

  return (
    <nav className="bg-white border-b border-gray-200 sticky top-0 z-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between items-center h-16">
          <div className="flex items-center gap-8">
            <Link href="/" className="text-xl font-bold text-indigo-600">
              Avitam Teach
            </Link>
            <Link href="/courses" className="text-sm text-gray-600 hover:text-gray-900">
              Courses
            </Link>
            {user && (
              <Link href="/dashboard" className="text-sm text-gray-600 hover:text-gray-900">
                My Learning
              </Link>
            )}
            {user && (user.role === 'instructor' || user.role === 'admin') && (
              <Link href="/instructor" className="text-sm text-gray-600 hover:text-gray-900">
                Instructor
              </Link>
            )}
            {user && user.role === 'admin' && (
              <Link href="/admin" className="text-sm text-gray-600 hover:text-gray-900">
                Admin
              </Link>
            )}
          </div>
          <div className="flex items-center gap-4">
            {user ? (
              <>
                <Link href="/profile" className="flex items-center gap-2 group">
                  {user.avatar_url ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={user.avatar_url} alt={user.name} className="w-8 h-8 rounded-full object-cover" />
                  ) : (
                    <span className="w-8 h-8 rounded-full bg-indigo-100 text-indigo-700 flex items-center justify-center text-xs font-semibold">
                      {initials(user.name)}
                    </span>
                  )}
                  <span className="text-sm text-gray-600 group-hover:text-gray-900">{user.name}</span>
                </Link>
                <button
                  onClick={handleLogout}
                  disabled={loggingOut}
                  className="text-sm text-gray-600 hover:text-gray-900 disabled:opacity-50"
                >
                  Sign Out
                </button>
              </>
            ) : (
              <>
                <Link href="/auth/login" className="text-sm text-gray-600 hover:text-gray-900">
                  Sign In
                </Link>
                <Link
                  href="/auth/register"
                  className="bg-indigo-600 text-white px-4 py-2 rounded-lg text-sm hover:bg-indigo-700 transition-colors"
                >
                  Get Started
                </Link>
              </>
            )}
          </div>
        </div>
      </div>
    </nav>
  );
}
