'use client';

import { useEffect, useState } from 'react';

interface Course {
  id: number;
  title: string;
  description: string;
  price_cents: number;
  is_free: boolean;
}

export default function CoursesPage() {
  const [courses, setCourses] = useState<Course[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch('/api/courses')
      .then((res) => res.json())
      .then((data) => {
        setCourses(data);
        setLoading(false);
      })
      .catch((err) => {
        console.error('Failed to load courses:', err);
        setLoading(false);
      });
  }, []);

  if (loading) return <div className="text-center py-8">Loading courses...</div>;

  return (
    <div>
      <h1 className="text-4xl font-bold mb-8">Available Courses</h1>

      {courses.length === 0 ? (
        <div className="text-center py-12 bg-gray-100 rounded-lg">
          <p className="text-gray-600">No courses available yet.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {courses.map((course) => (
            <div key={course.id} className="bg-white rounded-lg shadow-md overflow-hidden hover:shadow-lg transition">
              <div className="p-6">
                <h2 className="text-xl font-bold mb-2">{course.title}</h2>
                <p className="text-gray-600 mb-4">{course.description}</p>
                <div className="flex justify-between items-center">
                  <span className="font-semibold">
                    {course.is_free ? (
                      <span className="text-green-600">Free</span>
                    ) : (
                      <span>${(course.price_cents / 100).toFixed(2)}</span>
                    )}
                  </span>
                  <a
                    href={`/courses/${course.id}`}
                    className="bg-blue-600 text-white px-4 py-2 rounded-md hover:bg-blue-700"
                  >
                    View Course
                  </a>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
