export default function Home() {
  return (
    <div className="space-y-8">
      <div className="text-center py-12">
        <h1 className="text-5xl font-bold text-gray-900 mb-4">
          Learn to Code with Avitam Teach
        </h1>
        <p className="text-xl text-gray-600 mb-8">
          Master coding skills with interactive lessons, quizzes, and AI-powered assistance
        </p>
        <div className="flex gap-4 justify-center">
          <a
            href="/courses"
            className="bg-blue-600 text-white px-6 py-3 rounded-lg font-semibold hover:bg-blue-700"
          >
            Browse Courses
          </a>
          <a
            href="/signup"
            className="bg-gray-200 text-gray-900 px-6 py-3 rounded-lg font-semibold hover:bg-gray-300"
          >
            Get Started
          </a>
        </div>
      </div>

      <div className="grid grid-cols-3 gap-6">
        <div className="bg-white p-6 rounded-lg shadow-md">
          <h3 className="text-lg font-semibold mb-2">Interactive Lessons</h3>
          <p className="text-gray-600">
            Learn through engaging lessons with text, quizzes, and runnable code exercises
          </p>
        </div>
        <div className="bg-white p-6 rounded-lg shadow-md">
          <h3 className="text-lg font-semibold mb-2">AI Teaching Assistant</h3>
          <p className="text-gray-600">
            Get instant help from Claude AI with questions about lesson content
          </p>
        </div>
        <div className="bg-white p-6 rounded-lg shadow-md">
          <h3 className="text-lg font-semibold mb-2">Track Progress</h3>
          <p className="text-gray-600">
            Monitor your learning journey with completion tracking and quiz results
          </p>
        </div>
      </div>
    </div>
  );
}
