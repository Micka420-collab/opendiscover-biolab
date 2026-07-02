/**
 * Shared Open Graph card renderer for `next/og` `ImageResponse`.
 *
 * Both the file-convention images (`opengraph-image.tsx`) and the dynamic
 * per-run route (`/api/lab/og`) build their 1200×630 social card from this one
 * function, so the two never drift. Everything is inline-styled — `ImageResponse`
 * supports only a flexbox subset of CSS, not Tailwind classes.
 */

import type { ReactElement } from 'react';

export const OG_SIZE = { width: 1200, height: 630 } as const;
export const OG_CONTENT_TYPE = 'image/png';

const BG = '#09090b';
const PANEL = '#111113';
const TEXT = '#fafafa';
const MUTED = '#a1a1aa';
const ACCENT = '#22c55e';
const BORDER = '#27272a';

export interface CardOptions {
  /** Big headline — engine title, challenge name, or the site tagline. */
  title: string;
  /** Small eyebrow above the title (domain, "Daily challenge", …). */
  eyebrow?: string;
  /** One-line supporting text under the title. */
  subtitle?: string;
  /** Highlighted headline metric, e.g. `{ label: 'Productivity', value: '0.42 g/L/h' }`. */
  metric?: { label: string; value: string };
  /** Reproducibility hash (shown truncated as proof of determinism). */
  hash?: string;
}

/** Build the React element passed to `new ImageResponse(...)`. */
export function experimentCard(opts: CardOptions): ReactElement {
  const { title, eyebrow, subtitle, metric, hash } = opts;
  return (
    <div
      style={{
        width: '100%',
        height: '100%',
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'space-between',
        background: BG,
        color: TEXT,
        padding: 64,
        fontFamily: 'sans-serif',
      }}
    >
      {/* brand row */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
        <div style={{ width: 18, height: 18, borderRadius: 9, background: ACCENT }} />
        <div style={{ fontSize: 26, fontWeight: 700 }}>OpenDiscover BioLab</div>
        <div style={{ fontSize: 22, color: MUTED }}>· deterministic in-silico lab</div>
      </div>

      {/* main */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
        {eyebrow ? (
          <div
            style={{
              fontSize: 24,
              letterSpacing: 3,
              textTransform: 'uppercase',
              color: ACCENT,
            }}
          >
            {eyebrow}
          </div>
        ) : null}
        <div style={{ fontSize: 68, fontWeight: 800, lineHeight: 1.05 }}>{title}</div>
        {subtitle ? (
          <div style={{ fontSize: 30, color: MUTED, maxWidth: 960 }}>{subtitle}</div>
        ) : null}
        {metric ? (
          <div
            style={{
              display: 'flex',
              flexDirection: 'column',
              gap: 4,
              marginTop: 8,
              padding: '20px 26px',
              background: PANEL,
              border: `1px solid ${BORDER}`,
              borderRadius: 16,
              alignSelf: 'flex-start',
            }}
          >
            <div style={{ fontSize: 22, color: MUTED }}>{metric.label}</div>
            <div style={{ fontSize: 46, fontWeight: 700, color: ACCENT }}>{metric.value}</div>
          </div>
        ) : null}
      </div>

      {/* footer */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div style={{ fontSize: 24, color: MUTED }}>Run it yourself · reproduces byte-for-byte</div>
        {hash ? (
          <div style={{ fontSize: 22, color: MUTED, fontFamily: 'monospace' }}>
            {`hash ${hash.slice(0, 16)}…`}
          </div>
        ) : null}
      </div>
    </div>
  );
}
