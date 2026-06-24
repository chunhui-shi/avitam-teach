'use client';

import { useState } from 'react';
import { QuizQuestion, QuizGradeResult } from '@/types';
import { Button } from '@/components/ui/Button';

interface QuizWidgetProps {
  questions: QuizQuestion[];
  lessonId: number;
  courseId: number;
  onComplete?: (score: number) => void;
}

export function QuizWidget({ questions, lessonId, courseId, onComplete }: QuizWidgetProps) {
  const [answers, setAnswers] = useState<Record<string, number>>({});
  const [submitted, setSubmitted] = useState(false);
  const [saving, setSaving] = useState(false);
  const [score, setScore] = useState<number | null>(null);
  // v4-designed: the questions no longer carry the answer key (the server
  // strips it). Correctness comes back from the grade endpoint after submitting.
  const [resultById, setResultById] = useState<
    Record<string, { correctIndex: number; wasCorrect: boolean }>
  >({});

  const handleSelect = (questionId: string, optionIndex: number) => {
    if (submitted) return;
    setAnswers(prev => ({ ...prev, [questionId]: optionIndex }));
  };

  const handleSubmit = async () => {
    if (Object.keys(answers).length < questions.length) return;

    setSaving(true);
    try {
      const res = await fetch(
        `/api/courses/${courseId}/lessons/${lessonId}/quiz/grade`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ answers }),
        }
      );
      if (!res.ok) throw new Error('grade failed');
      const data: QuizGradeResult = await res.json();

      const map: Record<string, { correctIndex: number; wasCorrect: boolean }> = {};
      for (const r of data.results) {
        map[r.id] = { correctIndex: r.correctIndex, wasCorrect: r.wasCorrect };
      }
      setResultById(map);
      setScore(data.score);
      setSubmitted(true);
      onComplete?.(data.score);
    } catch {
      // leave the quiz answerable on failure
    } finally {
      setSaving(false);
    }
  };

  const allAnswered = Object.keys(answers).length === questions.length;

  return (
    <div className="space-y-6">
      {questions.map((q, qi) => {
        const r = resultById[q.id];
        return (
          <div key={q.id} className="space-y-3">
            <p className="font-medium text-gray-900">
              {qi + 1}. {q.question}
            </p>
            <div className="space-y-2">
              {q.options.map((opt, oi) => {
                const selected = answers[q.id] === oi;
                const isCorrect = submitted && r && oi === r.correctIndex;
                const isWrong = submitted && selected && r && oi !== r.correctIndex;

                let optClass = 'border border-gray-200 rounded-lg px-4 py-3 text-sm cursor-pointer transition-colors';
                if (isCorrect) optClass += ' bg-green-50 border-green-500 text-green-800';
                else if (isWrong) optClass += ' bg-red-50 border-red-500 text-red-800';
                else if (selected) optClass += ' bg-indigo-50 border-indigo-500 text-indigo-800';
                else optClass += ' hover:bg-gray-50';

                return (
                  <div key={oi} className={optClass} onClick={() => handleSelect(q.id, oi)}>
                    <span className="font-medium mr-2">{String.fromCharCode(65 + oi)}.</span>
                    {opt}
                  </div>
                );
              })}
            </div>
          </div>
        );
      })}

      {!submitted ? (
        <Button onClick={handleSubmit} disabled={!allAnswered} loading={saving}>
          Submit Answers
        </Button>
      ) : (
        <div className={`p-4 rounded-lg ${score! >= 60 ? 'bg-green-50 border border-green-200' : 'bg-amber-50 border border-amber-200'}`}>
          <p className={`font-semibold ${score! >= 60 ? 'text-green-800' : 'text-amber-800'}`}>
            Score: {score}%
            {score! >= 60 ? ' — Great job!' : ' — Review the lesson and try again.'}
          </p>
        </div>
      )}
    </div>
  );
}
