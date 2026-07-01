import Link from 'next/link';
import { Badge } from '@/components/ui/badge';

interface Trigger {
  submissionId: string;
  role: string;
  contributorId: string;
  contributorHandle: string;
}

export function ProvenanceGraph({
  triggers,
  discoveryTitle,
}: {
  triggers: Trigger[];
  discoveryTitle: string;
}) {
  const triggerSubs = triggers.filter((t) => t.role === 'trigger');
  const corroborators = triggers.filter((t) => t.role === 'corroboration');

  return (
    <div className="space-y-4 text-sm">
      <div>
        <div className="text-xs font-mono text-muted-foreground mb-2">TRIGGER</div>
        <div className="flex flex-wrap gap-2">
          {triggerSubs.map((t) => (
            <Link
              key={t.submissionId}
              href={`/submissions/${t.submissionId}`}
              className="border border-accent rounded px-2 py-1 hover:bg-accent/10"
            >
              @{t.contributorHandle}
            </Link>
          ))}
        </div>
      </div>
      <div>
        <div className="text-xs font-mono text-muted-foreground mb-2">
          CORROBORATORS ({corroborators.length})
        </div>
        <div className="flex flex-wrap gap-2">
          {corroborators.length === 0 ? (
            <Badge variant="muted">none recorded</Badge>
          ) : (
            corroborators.map((t) => (
              <Link
                key={t.submissionId}
                href={`/submissions/${t.submissionId}`}
                className="border border-border rounded px-2 py-1 hover:bg-muted"
              >
                @{t.contributorHandle}
              </Link>
            ))
          )}
        </div>
      </div>
      <p className="text-xs text-muted-foreground pt-2">
        "{discoveryTitle}" was promoted because {triggerSubs.length + corroborators.length}{' '}
        independent contributor{triggerSubs.length + corroborators.length === 1 ? '' : 's'} produced
        converging signals on disjoint input slices.
      </p>
    </div>
  );
}
