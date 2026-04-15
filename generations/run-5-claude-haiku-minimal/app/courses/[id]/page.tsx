'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';

interface Lesson {
  id: number;
  title: string;
  content: string;
  order_index: number;
}

interface Course {
  id: number;
  title: string;
  description: string;
  lessons: Lesson[];
}

export default function CoursePage() {
  const params = useParams();
  const courseId = params.id as string;
  const [course, setCourse] = useState<Course | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch(`/api/courses/${courseId}`)
      .then((res) => res.json())
      .then((data) => {
        setCourse(data);
        setLoading(false);
      })
      .catch((err) => {
        console.error('Failed to load course:', err);
        setLoading(false);
      });
  }, [courseId]);

  if (loading) return <div className="text-center py-8">Loading course...</div>;
  if (!course) return <div className="text-center py-8">Course not found</div>;

  return (
    <div>
      <h1 className="text-4xl font-bold mb-4">{course.title}</h1>
      <p className="text-gray-600 mb-8">{course.description}</p>

      <div className="space-y-4">
        <h2 className="text-2xl font-bold">Lessons</h2>
        {course.lessons.length === 0 ? (
          <p className="text-gray-600">No lessons available yet</p>
        ) : (
          <ul className="space-y-3">
            {course.lessons.map((lesson) => (
              <li key={lesson.id} className="bg-white p-4 rounded-lg shadow-md hover:shadow-lg transition">
                <a
                  href={`/lessons/${lesson.id}`}
                  className="text-blue-600 hover:text-blue-700 font-semibold"
                >
                  {lesson.title}
                </a>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
