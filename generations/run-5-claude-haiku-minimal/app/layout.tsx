import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'Avitam Teach - Learn to Code Online',
  description: 'A subscription-based online teaching platform for coding courses',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className="bg-gray-50">
        <header className="bg-white shadow-sm">
          <nav className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
            <div className="font-bold text-xl text-blue-600">Avitam Teach</div>
            <div className="flex gap-4">
              <a href="/courses" className="text-gray-600 hover:text-gray-900">
                Courses
              </a>
              <a href="/login" className="text-gray-600 hover:text-gray-900">
                Login
              </a>
              <a href="/signup" className="bg-blue-600 text-white px-4 py-2 rounded-md">
                Sign Up
              </a>
            </div>
          </nav>
        </header>
        <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">{children}</main>
      </body>
    </html>
  );
}
