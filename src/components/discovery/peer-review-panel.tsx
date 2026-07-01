'use client';

import { useState, useTransition } from 'react';

interface Review {
  id: string;
  reviewer: string;
  verdict: string;
  comment: string;
  confidence: number;
  createdAt: string;
}

interface PeerReviewPanelProps {
  discoveryId: string;
  reviews: Review[];
  canReview: boolean;
}

const VERDICT_LABELS: Record<string, string> = {
  approved: 'Approved',
  disputed: 'Disputed',
  rejected_low_quality: 'Rejected',
};

const VERDICT_CLASSES: Record<string, string> = {
  approved: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900 dark:text-emerald-200',
  disputed: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200',
  rejected_low_quality: 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200',
};

function relativeDate(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const minutes = Math.floor(diff / 60000);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  return `${Math.floor(hours / 24)}d ago`;
}

export function PeerReviewPanel({
  discoveryId,
  reviews: initialReviews,
  canReview,
}: PeerReviewPanelProps) {
  const [reviews, setReviews] = useState<Review[]>(initialReviews);
  const [verdict, setVerdict] = useState<'approved' | 'disputed' | 'rejected_low_quality'>(
    'approved',
  );
  const [comment, setComment] = useState('');
  const [confidence, setConfidence] = useState(0.8);
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    startTransition(async () => {
      try {
        const res = await fetch(`/api/discoveries/${discoveryId}/peer-review`, {
          method: 'POST',
          body: JSON.stringify({ verdict, comment, confidence }),
          headers: { 'Content-Type': 'application/json' },
        });
        if (!res.ok) {
          const body = (await res.json()) as { error?: string };
          setError(body.error ?? 'Submission failed');
          return;
        }
        setSubmitted(true);
        setReviews((prev) => [
          {
            id: crypto.randomUUID(),
            reviewer: 'you',
            verdict,
            comment,
            confidence,
            createdAt: new Date().toISOString(),
          },
          ...prev,
        ]);
        setComment('');
        setConfidence(0.8);
      } catch {
        setError('Network error — please try again');
      }
    });
  }

  return (
    <div className="space-y-6">
      <h2 className="text-lg font-semibold">Peer Reviews</h2>

      {reviews.length === 0 && <p className="text-sm text-muted-foreground">No reviews yet.</p>}

      <ul className="space-y-4">
        {reviews.map((r) => (
          <li key={r.id} className="border border-border rounded-lg p-4 space-y-2">
            <div className="flex items-center gap-3 flex-wrap">
              <span
                className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${VERDICT_CLASSES[r.verdict] ?? 'bg-zinc-100 text-zinc-800'}`}
              >
                {VERDICT_LABELS[r.verdict] ?? r.verdict}
              </span>
              <span className="text-sm font-medium">@{r.reviewer}</span>
              <span className="text-xs text-muted-foreground ml-auto">
                {relativeDate(r.createdAt)}
              </span>
              <span className="text-xs text-muted-foreground">
                {Math.round(r.confidence * 100)}% confidence
              </span>
            </div>
            <p className="text-sm text-foreground">{r.comment}</p>
          </li>
        ))}
      </ul>

      {canReview && !submitted && (
        <form onSubmit={handleSubmit} className="border border-border rounded-lg p-4 space-y-4">
          <h3 className="font-medium text-sm">Submit your review</h3>

          <fieldset className="space-y-2">
            <legend className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
              Verdict
            </legend>
            <div className="flex gap-4 flex-wrap">
              {(['approved', 'disputed', 'rejected_low_quality'] as const).map((v) => (
                <label key={v} className="flex items-center gap-2 cursor-pointer text-sm">
                  <input
                    type="radio"
                    name="verdict"
                    value={v}
                    checked={verdict === v}
                    onChange={() => setVerdict(v)}
                    className="accent-emerald-500"
                  />
                  {VERDICT_LABELS[v]}
                </label>
              ))}
            </div>
          </fieldset>

          <div className="space-y-1">
            <label
              htmlFor="review-comment"
              className="text-xs font-medium text-muted-foreground uppercase tracking-wide block"
            >
              Comment
            </label>
            <textarea
              id="review-comment"
              value={comment}
              onChange={(e) => setComment(e.target.value)}
              minLength={10}
              maxLength={2000}
              rows={4}
              required
              placeholder="Describe your assessment (min 10 characters)..."
              className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring resize-none"
            />
          </div>

          <div className="space-y-1">
            <label
              htmlFor="review-confidence"
              className="text-xs font-medium text-muted-foreground uppercase tracking-wide block"
            >
              Confidence — {Math.round(confidence * 100)}%
            </label>
            <input
              id="review-confidence"
              type="range"
              min={0}
              max={1}
              step={0.01}
              value={confidence}
              onChange={(e) => setConfidence(Number(e.target.value))}
              className="w-full accent-emerald-500"
            />
          </div>

          {error && <p className="text-sm text-red-600 dark:text-red-400">{error}</p>}

          <button
            type="submit"
            disabled={isPending || comment.length < 10}
            className="inline-flex items-center justify-center rounded-md bg-emerald-600 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            {isPending ? 'Submitting…' : 'Submit review'}
          </button>
        </form>
      )}

      {submitted && (
        <p className="text-sm text-emerald-600 dark:text-emerald-400 font-medium">
          Review submitted successfully.
        </p>
      )}
    </div>
  );
}
