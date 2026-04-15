'use client';

import Link from 'next/link';
import { Course } from '@/types';
import { formatPrice } from '@/lib/utils';

interface CourseCardProps {
  course: Course;
}

export function CourseCard({ course }: CourseCardProps) {
  return (
    <div className="bg-white rounded-xl border border-gray-200 overflow-hidden hover:shadow-md transition-shadow">
      <div className="h-40 bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center">
        <span className="text-white text-4xl">📚</span>
      </div>
      <div className="p-5">
        <div className="flex items-start justify-between mb-2">
          <h3 className="font-semibold text-gray-900 text-lg leading-tight">
            {course.title}
          </h3>
          <span className={`ml-2 text-sm font-medium shrink-0 ${course.price_cents === 0 ? 'text-green-600' : 'text-indigo-600'}`}>
            {formatPrice(course.price_cents)}
          </span>
        </div>
        <p className="text-sm text-gray-600 mb-4 line-clamp-2">
          {course.description}
        </p>
        <div className="flex items-center justify-between">
          <span className="text-xs text-gray-500">
            {course.lesson_count ?? 0} lessons
          </span>
          {course.enrolled ? (
            <Link
              href={`/courses/${course.id}`}
              className="text-sm font-medium text-indigo-600 hover:text-indigo-700"
            >
              Continue →
            </Link>
          ) : (
            <Link
              href={`/courses/${course.id}`}
              className="bg-indigo-600 text-white px-4 py-1.5 rounded-lg text-sm hover:bg-indigo-700 transition-colors"
            >
              {course.price_cents === 0 ? 'Enroll Free' : 'View Course'}
            </Link>
          )}
        </div>
      </div>
    </div>
  );
}
