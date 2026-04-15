import Link from "next/link";
import { BookOpen, Sparkles, Code2 } from "lucide-react";

export default function Home() {
  return (
    <div className="bg-white">
      <div className="relative isolate px-6 pt-14 lg:px-8">
        <div className="mx-auto max-w-2xl py-32 sm:py-48 lg:py-56 text-center">
          <h1 className="text-4xl font-bold tracking-tight text-gray-900 sm:text-6xl">
            Master Coding with <span className="text-blue-600">AI Assistance</span>
          </h1>
          <p className="mt-6 text-lg leading-8 text-gray-600">
            Interactive lessons, real-time code execution, and a personal AI tutor
            powered by Claude. Start your journey today.
          </p>
          <div className="mt-10 flex items-center justify-center gap-x-6">
            <Link
              href="/courses"
              className="rounded-md bg-blue-600 px-3.5 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-blue-500 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600"
            >
              Browse Courses
            </Link>
            <Link href="/about" className="text-sm font-semibold leading-6 text-gray-900">
              Learn more <span aria-hidden="true">→</span>
            </Link>
          </div>
        </div>
      </div>

      <div className="mx-auto max-w-7xl px-6 lg:px-8 pb-24">
        <div className="mx-auto grid max-w-2xl grid-cols-1 gap-x-8 gap-y-16 sm:gap-y-20 lg:mx-0 lg:max-w-none lg:grid-cols-3">
          <div className="flex flex-col items-center text-center">
            <div className="rounded-lg bg-blue-100 p-3 mb-4">
              <Code2 className="h-6 w-6 text-blue-600" />
            </div>
            <h3 className="text-lg font-semibold text-gray-900">Interactive Lessons</h3>
            <p className="mt-2 text-sm text-gray-600">
              Learn by doing with runnable code exercises right in your browser.
            </p>
          </div>
          <div className="flex flex-col items-center text-center">
            <div className="rounded-lg bg-purple-100 p-3 mb-4">
              <Sparkles className="h-6 w-6 text-purple-600" />
            </div>
            <h3 className="text-lg font-semibold text-gray-900">AI Tutor</h3>
            <p className="mt-2 text-sm text-gray-600">
              Stuck? Claude is here to help you understand every concept.
            </p>
          </div>
          <div className="flex flex-col items-center text-center">
            <div className="rounded-lg bg-green-100 p-3 mb-4">
              <BookOpen className="h-6 w-6 text-green-600" />
            </div>
            <h3 className="text-lg font-semibold text-gray-900">Quality Content</h3>
            <p className="mt-2 text-sm text-gray-600">
              Curated coding courses for all skill levels, from beginner to advanced.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
