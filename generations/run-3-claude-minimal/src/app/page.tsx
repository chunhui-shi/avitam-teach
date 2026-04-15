import Link from "next/link";

export default function HomePage() {
  return (
    <div>
      <h1>Learn to code with an AI teaching assistant at your side.</h1>
      <p className="muted" style={{ fontSize: 17, maxWidth: 640 }}>
        Browse interactive coding courses, work through lessons mixing reading, quizzes,
        and runnable JavaScript exercises, and ask Claude questions whenever you&apos;re stuck.
      </p>
      <div className="row" style={{ marginTop: 24 }}>
        <Link className="btn" href="/courses">Browse courses</Link>
        <Link className="btn secondary" href="/signup">Create an account</Link>
      </div>
    </div>
  );
}
