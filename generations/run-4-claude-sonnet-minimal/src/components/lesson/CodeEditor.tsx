'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/Button';

interface CodeEditorProps {
  initialCode: string;
  language: string;
  lessonId: number;
  courseId: number;
  onComplete?: () => void;
}

interface ExecutionResult {
  output: string[];
  errors: string[];
  runtimeError: string | null;
  result?: string;
}

export function CodeEditor({ initialCode, language, lessonId, courseId, onComplete }: CodeEditorProps) {
  const [code, setCode] = useState(initialCode);
  const [running, setRunning] = useState(false);
  const [saving, setSaving] = useState(false);
  const [result, setResult] = useState<ExecutionResult | null>(null);
  const [completed, setCompleted] = useState(false);

  const runCode = async () => {
    setRunning(true);
    setResult(null);
    try {
      const res = await fetch('/api/execute', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code }),
      });
      const data = await res.json();
      setResult(data);
    } catch {
      setResult({ output: [], errors: ['Failed to run code'], runtimeError: null });
    } finally {
      setRunning(false);
    }
  };

  const markComplete = async () => {
    setSaving(true);
    try {
      await fetch(`/api/courses/${courseId}/lessons/${lessonId}/progress`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          completed: true,
          code_submission: code,
        }),
      });
      setCompleted(true);
      onComplete?.();
    } catch {
      // silently fail
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-4">
      <div className="border border-gray-200 rounded-lg overflow-hidden">
        <div className="bg-gray-800 text-gray-300 text-xs px-4 py-2 flex items-center justify-between">
          <span>{language}</span>
          <span className="text-gray-500">Edit code below</span>
        </div>
        <textarea
          value={code}
          onChange={(e) => setCode(e.target.value)}
          className="w-full bg-gray-900 text-gray-100 p-4 font-mono text-sm focus:outline-none resize-none"
          rows={12}
          spellCheck={false}
        />
      </div>

      <div className="flex gap-3">
        <Button onClick={runCode} loading={running}>
          ▶ Run Code
        </Button>
        {result && !completed && (
          <Button variant="outline" onClick={markComplete} loading={saving}>
            Mark Complete
          </Button>
        )}
        {completed && (
          <span className="text-green-600 text-sm font-medium flex items-center gap-1">
            ✓ Completed
          </span>
        )}
      </div>

      {result && (
        <div className="border border-gray-200 rounded-lg overflow-hidden">
          <div className="bg-gray-100 text-gray-700 text-xs px-4 py-2 font-medium">Output</div>
          <div className="bg-gray-900 p-4 font-mono text-sm">
            {result.output.map((line, i) => (
              <div key={i} className="text-green-400">{line}</div>
            ))}
            {result.errors.map((line, i) => (
              <div key={i} className="text-yellow-400">{line}</div>
            ))}
            {result.runtimeError && (
              <div className="text-red-400">Error: {result.runtimeError}</div>
            )}
            {result.output.length === 0 && result.errors.length === 0 && !result.runtimeError && (
              <div className="text-gray-500">No output</div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
