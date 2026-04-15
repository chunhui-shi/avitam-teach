'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/Button';
import { formatPrice } from '@/lib/utils';

interface EnrollButtonProps {
  courseId: number;
  priceCents: number;
}

export function EnrollButton({ courseId, priceCents }: EnrollButtonProps) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();

  const handleEnroll = async () => {
    setLoading(true);
    setError(null);

    try {
      if (priceCents === 0) {
        // Free enrollment
        const res = await fetch('/api/enrollments', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ courseId }),
        });
        const data = await res.json();

        if (res.status === 401) {
          router.push('/auth/login');
          return;
        }
        if (!res.ok) {
          setError(data.error || 'Enrollment failed');
          return;
        }
        router.refresh();
      } else {
        // Paid: redirect to Stripe checkout
        const res = await fetch('/api/stripe/checkout', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ courseId }),
        });
        const data = await res.json();

        if (res.status === 401) {
          router.push('/auth/login');
          return;
        }
        if (!res.ok) {
          setError(data.error || 'Checkout failed');
          return;
        }
        window.location.href = data.url;
      }
    } catch {
      setError('Something went wrong. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-2">
      <Button onClick={handleEnroll} loading={loading} size="lg">
        {priceCents === 0 ? 'Enroll for Free' : `Enroll for ${formatPrice(priceCents)}`}
      </Button>
      {error && <p className="text-sm text-red-600">{error}</p>}
    </div>
  );
}
