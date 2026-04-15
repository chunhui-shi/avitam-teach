import { NextResponse } from "next/server";
import vm from "node:vm";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Runs student JavaScript via Node's vm.runInNewContext. This is NOT a
// security sandbox — see GENERATION_NOTES.md. It captures console output
// and enforces a wall-clock timeout.
export async function POST(req: Request) {
  const body = await req.json().catch(() => ({}));
  const code = typeof body?.code === "string" ? body.code : "";
  if (!code) {
    return NextResponse.json({ error: "Missing code" }, { status: 400 });
  }
  if (code.length > 20000) {
    return NextResponse.json({ error: "Code too long" }, { status: 400 });
  }

  const stdoutChunks: string[] = [];
  const stderrChunks: string[] = [];
  const fakeConsole = {
    log: (...args: unknown[]) => {
      stdoutChunks.push(args.map((a) => stringify(a)).join(" "));
    },
    error: (...args: unknown[]) => {
      stderrChunks.push(args.map((a) => stringify(a)).join(" "));
    },
    warn: (...args: unknown[]) => {
      stderrChunks.push(args.map((a) => stringify(a)).join(" "));
    },
    info: (...args: unknown[]) => {
      stdoutChunks.push(args.map((a) => stringify(a)).join(" "));
    },
  };

  const sandbox: Record<string, unknown> = {
    console: fakeConsole,
  };

  try {
    const script = new vm.Script(code, { filename: "codebox.js" });
    const context = vm.createContext(sandbox);
    script.runInContext(context, { timeout: 1000 });
    return NextResponse.json({
      stdout: stdoutChunks.join("\n"),
      stderr: stderrChunks.join("\n"),
      ok: true,
    });
  } catch (err: unknown) {
    const msg = err instanceof Error ? `${err.name}: ${err.message}` : String(err);
    return NextResponse.json({
      stdout: stdoutChunks.join("\n"),
      stderr: [stderrChunks.join("\n"), msg].filter(Boolean).join("\n"),
      ok: false,
    });
  }
}

function stringify(v: unknown): string {
  if (typeof v === "string") return v;
  try {
    return JSON.stringify(v);
  } catch {
    return String(v);
  }
}
