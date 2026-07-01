'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

interface AdminActionsProps {
  submissionId: string;
}

export function AdminActions({ submissionId }: AdminActionsProps) {
  const router = useRouter();
  const [loading, setLoading] = useState<'approve' | 'reject' | null>(null);

  async function handleAction(action: 'approve' | 'reject') {
    setLoading(action);
    try {
      await fetch(`/api/admin/review-queue/${submissionId}/${action}`, {
        method: 'POST',
      });
      router.refresh();
    } finally {
      setLoading(null);
    }
  }

  return (
    <div className="flex items-center gap-2">
      <button
        onClick={() => handleAction('approve')}
        disabled={loading !== null}
        className="px-2 py-1 text-xs rounded bg-accent text-accent-foreground hover:opacity-90 disabled:opacity-40"
      >
        {loading === 'approve' ? '…' : 'Approve'}
      </button>
      <button
        onClick={() => handleAction('reject')}
        disabled={loading !== null}
        className="px-2 py-1 text-xs rounded border border-border text-muted-foreground hover:text-foreground disabled:opacity-40"
      >
        {loading === 'reject' ? '…' : 'Reject'}
      </button>
    </div>
  );
}
