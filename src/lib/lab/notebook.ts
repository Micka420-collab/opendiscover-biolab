/**
 * Lab notebook — the transparent, append-only reasoning trail of a campaign.
 *
 * Every hypothesis, plan, experiment, observation, and conclusion an autonomous
 * scientist agent produces is journalled here in order. It is the audit log that
 * makes an AI-run campaign inspectable and reproducible: a human can read exactly
 * what the agent thought, what it ran, and why it concluded what it did.
 */

export type NotebookKind =
  | 'hypothesis'
  | 'plan'
  | 'experiment'
  | 'observation'
  | 'analysis'
  | 'conclusion'
  | 'error';

export interface NotebookEntry {
  seq: number;
  kind: NotebookKind;
  content: string;
  data?: unknown;
  experimentId?: string;
  at: number; // logical step index, not wall-clock (determinism)
}

export class Notebook {
  private entries: NotebookEntry[] = [];

  constructor(private readonly onEntry?: (e: NotebookEntry) => void) {}

  add(kind: NotebookKind, content: string, data?: unknown, experimentId?: string): NotebookEntry {
    const entry: NotebookEntry = {
      seq: this.entries.length,
      kind,
      content,
      data,
      experimentId,
      at: this.entries.length,
    };
    this.entries.push(entry);
    this.onEntry?.(entry);
    return entry;
  }

  hypothesis(content: string, data?: unknown) {
    return this.add('hypothesis', content, data);
  }
  plan(content: string, data?: unknown) {
    return this.add('plan', content, data);
  }
  observation(content: string, data?: unknown, experimentId?: string) {
    return this.add('observation', content, data, experimentId);
  }
  conclusion(content: string, data?: unknown) {
    return this.add('conclusion', content, data);
  }
  error(content: string, data?: unknown) {
    return this.add('error', content, data);
  }

  all(): readonly NotebookEntry[] {
    return this.entries;
  }

  /** Render the notebook as Markdown for a campaign report. */
  toMarkdown(): string {
    const icon: Record<NotebookKind, string> = {
      hypothesis: '🔬',
      plan: '📋',
      experiment: '🧪',
      observation: '👁️',
      analysis: '📊',
      conclusion: '✅',
      error: '⚠️',
    };
    return this.entries.map((e) => `**${icon[e.kind]} ${e.kind}** — ${e.content}`).join('\n\n');
  }
}
