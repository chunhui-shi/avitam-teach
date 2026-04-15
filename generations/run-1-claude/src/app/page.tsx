import Link from "next/link";

export default function HomePage() {
  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-4xl font-bold">Learn by doing.</h1>
      <p className="text-lg text-neutral-700 max-w-2xl">
        avitam-teach is a subscription-based online platform where you work
        through courses that mix prose, quizzes, and runnable code exercises,
        with a per-lesson AI teaching assistant on call.
      </p>
      <div className="flex gap-3">
        <Link
          href="/courses"
          className="rounded bg-neutral-900 text-white px-4 py-2"
        >
          Browse courses
        </Link>
        <Link href="/signup" className="rounded border px-4 py-2">
          Create account
        </Link>
      </div>
    </div>
  );
}
