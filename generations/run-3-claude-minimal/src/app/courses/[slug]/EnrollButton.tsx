"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export default function EnrollButton({
  courseId,
  isFree,
}: {
  courseId: number;
  isFree: boolean;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function enroll() {
    setBusy(true);
    setErr(null);
    if (isFree) {
      const r = await fetch("/api/enroll", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ courseId }),
      });
      setBusy(false);
      if (!r.ok) {
        const j = await r.json().catch(() => ({}));
        setErr(j.error ?? "Failed to enroll");
        return;
      }
      router.refresh();
    } else {
      const r = await fetch("/api/checkout", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ courseId }),
      });
      const j = await r.json();
      setBusy(false);
      if (!r.ok || !j.url) {
        setErr(j.error ?? "Checkout failed");
        return;
      }
      window.location.href = j.url;
    }
  }

  return (
    <div>
      <button className="btn" disabled={busy} onClick={enroll}>
        {busy ? "Working…" : isFree ? "Enroll for free" : "Enroll (Stripe)"}
      </button>
      {err && <div className="error" style={{ marginTop: 6 }}>{err}</div>}
    </div>
  );
}
