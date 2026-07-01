'use client';

import { useRouter, useSearchParams } from 'next/navigation';
import { useCallback } from 'react';

const STATUSES = [
  { value: '', label: 'All statuses' },
  { value: 'provisional', label: 'Provisional' },
  { value: 'under_review', label: 'Under review' },
  { value: 'confirmed', label: 'Confirmed' },
  { value: 'disputed', label: 'Disputed' },
  { value: 'refuted', label: 'Refuted' },
  { value: 'retracted', label: 'Retracted' },
];

const SORT_OPTIONS = [
  { value: 'date', label: 'Most recent' },
  { value: 'score', label: 'Highest novelty' },
];

interface DiscoveryFiltersProps {
  domains: string[];
}

export function DiscoveryFilters({ domains }: DiscoveryFiltersProps) {
  const router = useRouter();
  const searchParams = useSearchParams();

  const updateParam = useCallback(
    (key: string, value: string) => {
      const params = new URLSearchParams(searchParams.toString());
      if (value) {
        params.set(key, value);
      } else {
        params.delete(key);
      }
      router.push(`/discoveries?${params.toString()}`);
    },
    [router, searchParams],
  );

  const current = {
    q: searchParams.get('q') ?? '',
    domain: searchParams.get('domain') ?? '',
    status: searchParams.get('status') ?? '',
    sort: searchParams.get('sort') ?? 'date',
  };

  return (
    <form
      method="GET"
      action="/discoveries"
      className="flex flex-wrap gap-3 items-center"
      onSubmit={(e) => {
        e.preventDefault();
        const fd = new FormData(e.currentTarget);
        const params = new URLSearchParams();
        for (const [k, v] of fd.entries()) {
          if (v && v !== 'date') params.set(k, v as string);
        }
        router.push(`/discoveries?${params.toString()}`);
      }}
    >
      <input
        type="search"
        name="q"
        defaultValue={current.q}
        placeholder="Search discoveries…"
        className="flex-1 min-w-[200px] rounded-md border border-border bg-background px-3 py-1.5 text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-accent"
      />

      <select
        name="domain"
        defaultValue={current.domain}
        onChange={(e) => updateParam('domain', e.target.value)}
        className="rounded-md border border-border bg-background px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-accent"
      >
        <option value="">All domains</option>
        {domains.map((d) => (
          <option key={d} value={d}>
            {d}
          </option>
        ))}
      </select>

      <select
        name="status"
        defaultValue={current.status}
        onChange={(e) => updateParam('status', e.target.value)}
        className="rounded-md border border-border bg-background px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-accent"
      >
        {STATUSES.map((s) => (
          <option key={s.value} value={s.value}>
            {s.label}
          </option>
        ))}
      </select>

      <select
        name="sort"
        defaultValue={current.sort}
        onChange={(e) => updateParam('sort', e.target.value)}
        className="rounded-md border border-border bg-background px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-accent"
      >
        {SORT_OPTIONS.map((s) => (
          <option key={s.value} value={s.value}>
            {s.label}
          </option>
        ))}
      </select>

      <button
        type="submit"
        className="rounded-md bg-accent px-4 py-1.5 text-sm font-medium text-accent-foreground hover:bg-accent/90 transition-colors"
      >
        Search
      </button>
    </form>
  );
}
