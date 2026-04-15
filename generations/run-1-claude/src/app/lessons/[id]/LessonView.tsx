"use client";
import { useState } from "react";
import type { LessonBlock } from "@/db/schema";

export default function LessonView({
  id,
  title,
  blocks,
}: {
  id: number;
  title: string;
  blocks: LessonBlock[];
}) {
  const [completed, setCompleted] = useState(false);

  async function markComplete() {
    await fetch(`/api/lessons/${id}/complete`, { method: "POST" });
    setCompleted(true);
  }

  return (
    <div className="flex flex-col gap-8 max-w-3xl">
      <h1 className="text-3xl font-semibold">{title}</h1>
      <div className="flex flex-col gap-6">
        {blocks.map((b, i) => (
          <Block key={i} block={b} lessonId={id} />
        ))}
      </div>
      <div className="border-t pt-6">
        <button
          onClick={markComplete}
          disabled={completed}
          className="rounded bg-neutral-900 text-white px-4 py-2 disabled:opacity-50"
        >
          {completed ? "Completed" : "Mark lesson complete"}
        </button>
      </div>
      <Assistant lessonId={id} />
    </div>
  );
}

function Block({ block, lessonId }: { block: LessonBlock; lessonId: number }) {
  if (block.type === "text") {
    return <TextBlock markdown={block.markdown} />;
  }
  if (block.type === "codebox") {
    return <CodeBox starter={block.starter} instructions={block.instructions} />;
  }
  if (block.type === "quiz") {
    return <QuizBlock question={block.question} options={block.options} />;
  }
  return null;
}

function TextBlock({ markdown }: { markdown: string }) {
  // Minimal markdown: paragraphs + fenced code blocks, no external deps.
  const parts = markdown.split(/```/);
  return (
    <div className="prose prose-neutral max-w-none">
      {parts.map((p, i) =>
        i % 2 === 1 ? (
          <pre
            key={i}
            className="bg-neutral-100 rounded p-3 text-sm overflow-x-auto"
          >
            <code>{p.replace(/^\w*\n/, "")}</code>
          </pre>
        ) : (
          <div key={i} className="whitespace-pre-wrap leading-relaxed">
            {p}
          </div>
        ),
      )}
    </div>
  );
}

function CodeBox({
  starter,
  instructions,
}: {
  starter: string;
  instructions?: string;
}) {
  const [code, setCode] = useState(starter);
  const [stdout, setStdout] = useState("");
  const [stderr, setStderr] = useState("");
  const [running, setRunning] = useState(false);

  async function run() {
    setRunning(true);
    setStdout("");
    setStderr("");
    const res = await fetch("/api/codebox/run", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ code }),
    });
    const body = await res.json().catch(() => ({}));
    setRunning(false);
    setStdout(body.stdout ?? "");
    setStderr(body.stderr ?? "");
  }

  return (
    <div className="border rounded-lg p-4 flex flex-col gap-3">
      {instructions && (
        <p className="text-sm text-neutral-700">{instructions}</p>
      )}
      <textarea
        value={code}
        onChange={(e) => setCode(e.target.value)}
        spellCheck={false}
        className="font-mono text-sm bg-neutral-50 border rounded p-3 h-40"
      />
      <div>
        <button
          onClick={run}
          disabled={running}
          className="rounded bg-neutral-900 text-white px-3 py-1.5 text-sm disabled:opacity-50"
        >
          {running ? "Running..." : "Run"}
        </button>
      </div>
      {stdout && (
        <pre className="bg-neutral-100 rounded p-3 text-sm whitespace-pre-wrap">
          {stdout}
        </pre>
      )}
      {stderr && (
        <pre className="bg-red-50 text-red-800 rounded p-3 text-sm whitespace-pre-wrap">
          {stderr}
        </pre>
      )}
    </div>
  );
}

function QuizBlock({
  question,
  options,
}: {
  question: string;
  options: string[];
}) {
  const [picked, setPicked] = useState<number | null>(null);
  return (
    <div className="border rounded-lg p-4 flex flex-col gap-3">
      <p className="font-medium">{question}</p>
      <ul className="flex flex-col gap-2">
        {options.map((o, i) => (
          <li key={i}>
            <label className="flex gap-2 items-center">
              <input
                type="radio"
                name={`q-${question}`}
                checked={picked === i}
                onChange={() => setPicked(i)}
              />
              <span>{o}</span>
            </label>
          </li>
        ))}
      </ul>
      {picked !== null && (
        <p className="text-sm text-neutral-600">
          Answer recorded locally. Submit quizzes aren&apos;t graded server-side
          in this MVP.
        </p>
      )}
    </div>
  );
}

function Assistant({ lessonId }: { lessonId: number }) {
  const [question, setQuestion] = useState("");
  const [answer, setAnswer] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function ask() {
    setLoading(true);
    setAnswer(null);
    const res = await fetch("/api/assistant", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ lesson_id: lessonId, question }),
    });
    const body = await res.json().catch(() => ({}));
    setLoading(false);
    setAnswer(body.answer ?? body.error ?? "(no response)");
  }

  return (
    <div className="border-t pt-6 flex flex-col gap-3">
      <h2 className="text-xl font-semibold">Ask the teaching assistant</h2>
      <textarea
        value={question}
        onChange={(e) => setQuestion(e.target.value)}
        placeholder="What part of this lesson is unclear?"
        className="border rounded p-3 text-sm h-24"
      />
      <div>
        <button
          onClick={ask}
          disabled={loading || !question.trim()}
          className="rounded bg-neutral-900 text-white px-3 py-1.5 text-sm disabled:opacity-50"
        >
          {loading ? "Thinking..." : "Ask"}
        </button>
      </div>
      {answer && (
        <div className="bg-neutral-50 border rounded p-3 text-sm whitespace-pre-wrap">
          {answer}
        </div>
      )}
    </div>
  );
}
