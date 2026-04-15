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
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onClick() {
    setLoading(true);
    setError(null);
    const res = await fetch("/api/enroll", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ courseId }),
    });
    const body = await res.json().catch(() => ({}));
    setLoading(false);
    if (!res.ok) {
      setError(body?.error ?? "Failed to enroll");
      return;
    }
    if (body.checkoutUrl) {
      window.location.href = body.checkoutUrl;
      return;
    }
    router.refresh();
  }

  return (
    <div>
      <button
        onClick={onClick}
        disabled={loading}
        className="rounded bg-neutral-900 text-white px-4 py-2 disabled:opacity-50"
      >
        {loading ? "Enrolling..." : isFree ? "Enroll (free)" : "Enroll — pay"}
      </button>
      {error && <p className="text-red-600 text-sm mt-2">{error}</p>}
    </div>
  );
}
