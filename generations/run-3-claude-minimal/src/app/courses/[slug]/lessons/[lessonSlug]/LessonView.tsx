"use client";

import { useState, useRef, useEffect } from "react";
import type { LessonBlock } from "@/lib/types";

type Msg = { role: "user" | "assistant"; content: string };

export default function LessonView({
  lesson,
  initialMessages,
}: {
  lesson: { id: number; title: string; content: LessonBlock[] };
  initialMessages: Msg[];
}) {
  return (
    <div>
      {lesson.content.map((block, i) => (
        <BlockView key={i} block={block} />
      ))}
      <h2>Ask the teaching assistant</h2>
      <p className="muted" style={{ fontSize: 13 }}>
        Powered by Claude. Questions are scoped to this lesson.
      </p>
      <Assistant lessonId={lesson.id} initialMessages={initialMessages} />
    </div>
  );
}

function BlockView({ block }: { block: LessonBlock }) {
  if (block.type === "text") {
    return (
      <div className="card">
        <MarkdownLite text={block.markdown} />
      </div>
    );
  }
  if (block.type === "quiz") {
    return <QuizView block={block} />;
  }
  if (block.type === "code") {
    return <CodeView block={block} />;
  }
  return null;
}

// Minimal markdown: paragraphs, `inline code`, **bold**, headings. Safe — escapes first.
function MarkdownLite({ text }: { text: string }) {
  const esc = (s: string) =>
    s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  const html = esc(text)
    .replace(/^### (.*)$/gm, "<h3>$1</h3>")
    .replace(/^## (.*)$/gm, "<h2>$1</h2>")
    .replace(/`([^`]+)`/g, "<code>$1</code>")
    .replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>")
    .replace(/\n\n/g, "</p><p>");
  return <div dangerouslySetInnerHTML={{ __html: `<p>${html}</p>` }} />;
}

function QuizView({
  block,
}: {
  block: Extract<LessonBlock, { type: "quiz" }>;
}) {
  const [selected, setSelected] = useState<number | null>(null);
  const [submitted, setSubmitted] = useState(false);
  const correct = selected === block.answer_index;

  return (
    <div className="card">
      <h3 style={{ marginTop: 0 }}>Quiz: {block.question}</h3>
      {block.options.map((opt, i) => {
        let cls = "quiz-option";
        if (submitted) {
          if (i === block.answer_index) cls += " correct";
          else if (i === selected) cls += " incorrect";
        } else if (i === selected) {
          cls += " selected";
        }
        return (
          <label key={i} className={cls}>
            <input
              type="radio"
              name={`q-${block.question.slice(0, 10)}`}
              style={{ marginRight: 8 }}
              disabled={submitted}
              checked={selected === i}
              onChange={() => setSelected(i)}
            />
            {opt}
          </label>
        );
      })}
      {!submitted ? (
        <button
          className="btn"
          disabled={selected === null}
          onClick={() => setSubmitted(true)}
          style={{ marginTop: 8 }}
        >
          Check answer
        </button>
      ) : (
        <div style={{ marginTop: 8 }}>
          <p className={correct ? "success" : "error"}>
            {correct ? "Correct!" : "Not quite."}
          </p>
          {block.explanation && <p className="muted">{block.explanation}</p>}
          <button
            className="btn secondary"
            onClick={() => {
              setSelected(null);
              setSubmitted(false);
            }}
          >
            Try again
          </button>
        </div>
      )}
    </div>
  );
}

function CodeView({
  block,
}: {
  block: Extract<LessonBlock, { type: "code" }>;
}) {
  const [code, setCode] = useState(block.starter);
  const [output, setOutput] = useState<string>("");
  const [results, setResults] = useState<
    { name: string; pass: boolean; error?: string }[] | null
  >(null);
  const [running, setRunning] = useState(false);

  function runCode() {
    setRunning(true);
    setOutput("");
    setResults(null);
    try {
      const logs: string[] = [];
      const fakeConsole = {
        log: (...args: unknown[]) =>
          logs.push(args.map((a) => stringify(a)).join(" ")),
        error: (...args: unknown[]) =>
          logs.push("[error] " + args.map((a) => stringify(a)).join(" ")),
        warn: (...args: unknown[]) =>
          logs.push("[warn] " + args.map((a) => stringify(a)).join(" ")),
      };
      const userFn = new Function("console", code);
      userFn(fakeConsole);

      const testResults = block.tests.map((t) => {
        try {
          // Tests can reference functions defined in user code via in-scope eval.
          // We wrap user code and test together in one Function for shared scope.
          const full = new Function(
            "console",
            `${code}\n;(function(){\n${t.code}\n})();`
          );
          full(fakeConsole);
          return { name: t.name, pass: true };
        } catch (err) {
          return {
            name: t.name,
            pass: false,
            error: err instanceof Error ? err.message : String(err),
          };
        }
      });
      setResults(testResults);
      setOutput(logs.join("\n"));
    } catch (err) {
      setOutput(
        "Runtime error: " + (err instanceof Error ? err.message : String(err))
      );
    } finally {
      setRunning(false);
    }
  }

  function reset() {
    setCode(block.starter);
    setOutput("");
    setResults(null);
  }

  return (
    <div className="card">
      <h3 style={{ marginTop: 0 }}>Exercise</h3>
      <p>{block.prompt}</p>
      <textarea
        value={code}
        onChange={(e) => setCode(e.target.value)}
        rows={Math.max(6, code.split("\n").length + 1)}
        spellCheck={false}
        maxLength={20000}
      />
      <div className="row" style={{ marginTop: 8 }}>
        <button className="btn" onClick={runCode} disabled={running}>
          {running ? "Running…" : "Run & test"}
        </button>
        <button className="btn secondary" onClick={reset}>
          Reset
        </button>
      </div>
      <h4 style={{ marginBottom: 4 }}>Output</h4>
      <div className="output-pane">{output || "\u00A0"}</div>
      {results && (
        <>
          <h4 style={{ marginBottom: 4 }}>Tests</h4>
          {results.map((r, i) => (
            <div key={i} className={`test-row ${r.pass ? "pass" : "fail"}`}>
              {r.pass ? "PASS" : "FAIL"} — {r.name}
              {r.error && <div style={{ marginTop: 4 }}>{r.error}</div>}
            </div>
          ))}
        </>
      )}
    </div>
  );
}

function stringify(v: unknown): string {
  if (typeof v === "string") return v;
  try {
    return JSON.stringify(v);
  } catch {
    return String(v);
  }
}

function Assistant({
  lessonId,
  initialMessages,
}: {
  lessonId: number;
  initialMessages: Msg[];
}) {
  const [messages, setMessages] = useState<Msg[]>(initialMessages);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const chatRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    chatRef.current?.scrollTo({ top: chatRef.current.scrollHeight });
  }, [messages]);

  async function send() {
    const text = input.trim();
    if (!text || busy) return;
    setErr(null);
    const next = [...messages, { role: "user" as const, content: text }];
    setMessages(next);
    setInput("");
    setBusy(true);
    try {
      const r = await fetch("/api/assistant", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ lessonId, message: text }),
      });
      const j = await r.json();
      if (!r.ok) {
        setErr(j.error ?? "Assistant error");
        setMessages(messages); // rollback
      } else {
        setMessages([...next, { role: "assistant", content: j.reply }]);
      }
    } catch (e) {
      setErr("Network error");
      setMessages(messages);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div>
      <div className="chat" ref={chatRef}>
        {messages.length === 0 && (
          <div className="muted" style={{ fontSize: 13, padding: 8 }}>
            No messages yet. Ask a question about this lesson.
          </div>
        )}
        {messages.map((m, i) => (
          <div key={i} className={`msg ${m.role}`}>
            {m.content}
          </div>
        ))}
      </div>
      <div className="row" style={{ marginTop: 8 }}>
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Ask a question about this lesson…"
          maxLength={2000}
          onKeyDown={(e) => {
            if (e.key === "Enter") send();
          }}
        />
        <button className="btn" onClick={send} disabled={busy || !input.trim()}>
          {busy ? "…" : "Send"}
        </button>
      </div>
      {err && <div className="error" style={{ marginTop: 6 }}>{err}</div>}
    </div>
  );
}
