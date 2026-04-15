import Link from 'next/link';

export default function HomePage() {
  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
      {/* Hero */}
      <div className="py-20 text-center">
        <h1 className="text-5xl font-bold text-gray-900 mb-6">
          Learn to Code with
          <span className="text-indigo-600"> AI-Powered</span> Lessons
        </h1>
        <p className="text-xl text-gray-600 mb-10 max-w-2xl mx-auto">
          Hands-on coding courses with interactive exercises, quizzes, and an AI teaching assistant
          that answers your questions in real time.
        </p>
        <div className="flex gap-4 justify-center">
          <Link
            href="/courses"
            className="bg-indigo-600 text-white px-8 py-3 rounded-lg text-lg font-medium hover:bg-indigo-700 transition-colors"
          >
            Browse Courses
          </Link>
          <Link
            href="/auth/register"
            className="border border-indigo-600 text-indigo-600 px-8 py-3 rounded-lg text-lg font-medium hover:bg-indigo-50 transition-colors"
          >
            Sign Up Free
          </Link>
        </div>
      </div>

      {/* Features */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-8 py-16 border-t border-gray-200">
        {[
          {
            icon: '💡',
            title: 'Interactive Lessons',
            desc: 'Mix of text, quizzes, and runnable code exercises — learn by doing.',
          },
          {
            icon: '🤖',
            title: 'AI Teaching Assistant',
            desc: 'Ask questions about any lesson and get instant, context-aware answers from Claude.',
          },
          {
            icon: '📈',
            title: 'Track Your Progress',
            desc: 'See exactly which lessons you\'ve completed and how well you scored on quizzes.',
          },
        ].map((f) => (
          <div key={f.title} className="text-center p-6">
            <div className="text-4xl mb-4">{f.icon}</div>
            <h3 className="text-xl font-semibold text-gray-900 mb-2">{f.title}</h3>
            <p className="text-gray-600">{f.desc}</p>
          </div>
        ))}
      </div>
    </div>
  );
}
