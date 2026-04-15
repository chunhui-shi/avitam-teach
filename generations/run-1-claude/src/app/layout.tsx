import type { Metadata } from "next";
import Link from "next/link";
import "./globals.css";
import { auth, signOut } from "@/auth";

export const metadata: Metadata = {
  title: "avitam-teach",
  description: "Learn by doing.",
};

export default async function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await auth();
  return (
    <html lang="en">
      <body className="min-h-screen bg-white text-neutral-900">
        <header className="border-b border-neutral-200">
          <nav className="max-w-5xl mx-auto flex items-center justify-between px-6 py-4">
            <Link href="/" className="font-semibold text-lg">
              avitam-teach
            </Link>
            <div className="flex gap-4 items-center text-sm">
              <Link href="/courses" className="hover:underline">
                Courses
              </Link>
              {session?.user ? (
                <>
                  <Link href="/progress" className="hover:underline">
                    My Progress
                  </Link>
                  <span className="text-neutral-500">{session.user.email}</span>
                  <form
                    action={async () => {
                      "use server";
                      await signOut({ redirectTo: "/" });
                    }}
                  >
                    <button
                      type="submit"
                      className="text-sm text-neutral-700 hover:underline"
                    >
                      Sign out
                    </button>
                  </form>
                </>
              ) : (
                <>
                  <Link href="/login" className="hover:underline">
                    Log in
                  </Link>
                  <Link
                    href="/signup"
                    className="rounded bg-neutral-900 text-white px-3 py-1.5"
                  >
                    Sign up
                  </Link>
                </>
              )}
            </div>
          </nav>
        </header>
        <main className="max-w-5xl mx-auto px-6 py-8">{children}</main>
      </body>
    </html>
  );
}
