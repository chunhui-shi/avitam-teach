"use client";

import { useState } from "react";
import { CheckCircle, AlertCircle, Play, Check } from "lucide-react";
import axios from "axios";
import { useRouter } from "next/navigation";

interface LessonContentProps {
  lesson: {
    id: string;
    type: "TEXT" | "MCQ" | "CODE";
    content?: string;
    mcq?: {
      question: string;
      options: string[];
      correctIndex: number;
    };
    codeExercise?: {
      starterCode: string;
      testCode: string;
      solution: string;
    };
  };
}

export default function LessonContent({ lesson }: LessonContentProps) {
  const router = useRouter();
  const [isCompleting, setIsCompleting] = useState(false);

  const onComplete = async () => {
    try {
      setIsCompleting(true);
      await axios.post("/api/courses/progress", {
        lessonId: lesson.id,
      });
      router.refresh();
    } catch (error) {
      console.error(error);
    } finally {
      setIsCompleting(false);
    }
  };

  let content;
  switch (lesson.type) {
    case "TEXT":
      content = <div className="prose max-w-none text-gray-800">{lesson.content}</div>;
      break;
    case "MCQ":
      content = <MCQLesson mcq={lesson.mcq!} />;
      break;
    case "CODE":
      content = <CodeLesson codeExercise={lesson.codeExercise!} />;
      break;
    default:
      content = null;
  }

  return (
    <div className="space-y-8">
      {content}
      <div className="pt-8 border-t border-gray-200">
        <button
          onClick={onComplete}
          disabled={isCompleting}
          className="flex items-center px-6 py-2 bg-green-600 text-white rounded-md hover:bg-green-700 disabled:opacity-50 transition"
        >
          {isCompleting ? (
            "Saving..."
          ) : (
            <>
              <Check className="h-5 w-5 mr-2" />
              Complete Lesson
            </>
          )}
        </button>
      </div>
    </div>
  );
}

function MCQLesson({ mcq }: { mcq: NonNullable<LessonContentProps["lesson"]["mcq"]> }) {
  const [selected, setSelected] = useState<number | null>(null);
  const [isCorrect, setIsCorrect] = useState<boolean | null>(null);

  const onCheck = () => {
    if (selected === null) return;
    setIsCorrect(selected === mcq.correctIndex);
  };

  return (
    <div className="bg-white p-6 rounded-lg border border-gray-200 shadow-sm">
      <h3 className="text-lg font-medium text-gray-900 mb-6">{mcq.question}</h3>
      <div className="space-y-3">
        {mcq.options.map((option, idx) => (
          <button
            key={idx}
            onClick={() => {
              setSelected(idx);
              setIsCorrect(null);
            }}
            className={`w-full text-left p-4 rounded-md border transition ${
              selected === idx
                ? "border-blue-500 bg-blue-50 ring-1 ring-blue-500"
                : "border-gray-200 hover:bg-gray-50"
            }`}
          >
            {option}
          </button>
        ))}
      </div>
      <div className="mt-8 flex items-center justify-between">
        <button
          onClick={onCheck}
          disabled={selected === null}
          className="px-6 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50"
        >
          Check Answer
        </button>
        {isCorrect === true && (
          <div className="flex items-center text-green-600 font-medium">
            <CheckCircle className="h-5 w-5 mr-2" />
            Correct! Well done.
          </div>
        )}
        {isCorrect === false && (
          <div className="flex items-center text-red-600 font-medium">
            <AlertCircle className="h-5 w-5 mr-2" />
            Try again!
          </div>
        )}
      </div>
    </div>
  );
}

function CodeLesson({ codeExercise }: { codeExercise: NonNullable<LessonContentProps["lesson"]["codeExercise"]> }) {
  const [code, setCode] = useState(codeExercise.starterCode);
  const [output, setOutput] = useState<string>("");
  const [status, setStatus] = useState<"idle" | "success" | "error">("idle");

  const runCode = () => {
    try {
      // Basic sandbox for demonstration
      const sandbox = {
        assert: (condition: boolean) => {
          if (!condition) throw new Error("Assertion failed");
        },
      };

      const fn = new Function("assert", `${code}\n${codeExercise.testCode}`);
      fn(sandbox.assert);
      
      setOutput("Tests passed!");
      setStatus("success");
    } catch (err: any) {
      setOutput(err.message || "Execution error");
      setStatus("error");
    }
  };

  return (
    <div className="space-y-6">
      <div className="bg-gray-900 rounded-lg overflow-hidden border border-gray-700">
        <div className="flex items-center justify-between px-4 py-2 bg-gray-800 border-b border-gray-700">
          <span className="text-xs font-mono text-gray-400">script.js</span>
          <button
            onClick={runCode}
            className="flex items-center px-3 py-1 bg-green-600 hover:bg-green-500 text-white text-xs font-medium rounded transition"
          >
            <Play className="h-3 w-3 mr-1" />
            Run Tests
          </button>
        </div>
        <textarea
          value={code}
          onChange={(e) => setCode(e.target.value)}
          className="w-full h-64 p-4 bg-gray-900 text-gray-100 font-mono text-sm focus:outline-none resize-none"
          spellCheck={false}
        />
      </div>

      {output && (
        <div
          className={`p-4 rounded-md border ${
            status === "success"
              ? "bg-green-50 border-green-200 text-green-700"
              : "bg-red-50 border-red-200 text-red-700"
          }`}
        >
          <div className="flex items-start">
            {status === "success" ? (
              <CheckCircle className="h-5 w-5 mr-2 mt-0.5" />
            ) : (
              <AlertCircle className="h-5 w-5 mr-2 mt-0.5" />
            )}
            <div>
              <p className="font-mono text-sm">{output}</p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
