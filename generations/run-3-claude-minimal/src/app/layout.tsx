import "./globals.css";
import Link from "next/link";
import { currentUser } from "@/lib/auth";
import type { ReactNode } from "react";

export const metadata = {
  title: "Avitam Teach",
  description: "Learn to code with AI teaching assistants.",
};

export const dynamic = "force-dynamic";

export default async function RootLayout({ children }: { children: ReactNode }) {
  let user = null;
  try {
    user = await currentUser();
  } catch {
    user = null;
  }
  return (
    <html lang="en">
      <body>
        <header className="site-header">
          <div className="container header-row">
            <Link href="/" className="brand">
              Avitam Teach
            </Link>
            <nav className="nav">
              <Link href="/courses">Courses</Link>
              {user ? (
                <>
                  <Link href="/dashboard">Dashboard</Link>
                  <span className="muted">{user.email}</span>
                  <form action="/api/auth/logout" method="post" style={{ display: "inline" }}>
                    <button className="linklike" type="submit">
                      Log out
                    </button>
                  </form>
                </>
              ) : (
                <>
                  <Link href="/login">Log in</Link>
                  <Link href="/signup">Sign up</Link>
                </>
              )}
            </nav>
          </div>
        </header>
        <main className="container main">{children}</main>
        <footer className="site-footer container">
          <span className="muted">MVP build. Not for production.</span>
        </footer>
      </body>
    </html>
  );
}
