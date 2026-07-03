/**
 * A tiny, dependency-free, XSS-safe Markdown renderer for trusted-ish authored content
 * (Discovery Cards). It builds real React elements — never `dangerouslySetInnerHTML` — so no
 * markup can be injected, and link hrefs are sanitised to http(s)/mailto/relative only.
 *
 * Supported: ATX headings (#, ##, ###), paragraphs, unordered (-, *) and ordered (1.) lists,
 * fenced code blocks (```), thematic breaks (---), and inline **bold**, *italic* / _italic_,
 * `code`, and [links](url). Unmatched markers degrade to literal text. It is intentionally small,
 * not CommonMark-complete — the parser is pure and unit-tested so it can be verified without a
 * browser or a database.
 */

export type Inline =
  | { t: 'text'; v: string }
  | { t: 'strong'; v: string }
  | { t: 'em'; v: string }
  | { t: 'code'; v: string }
  | { t: 'link'; v: string; href: string };

export type Block =
  | { t: 'h'; level: 1 | 2 | 3; children: Inline[] }
  | { t: 'p'; children: Inline[] }
  | { t: 'ul'; items: Inline[][] }
  | { t: 'ol'; items: Inline[][] }
  | { t: 'code'; v: string }
  | { t: 'hr' };

/** Allow only safe link schemes; anything else (javascript:, data:, …) is rejected. */
export function safeHref(href: string): string | undefined {
  const h = href.trim();
  return /^(https?:\/\/|mailto:|\/|#)/i.test(h) ? h : undefined;
}

/** Split a run of text into inline tokens. Non-nesting and leftmost-match; safe by construction. */
export function parseInline(text: string): Inline[] {
  const out: Inline[] = [];
  const re = /`([^`]+)`|\*\*([^*]+)\*\*|\*([^*]+)\*|_([^_]+)_|\[([^\]]+)\]\(([^)\s]+)\)/g;
  let last = 0;
  let m: RegExpExecArray | null = re.exec(text);
  while (m !== null) {
    if (m.index > last) out.push({ t: 'text', v: text.slice(last, m.index) });
    if (m[1] !== undefined) out.push({ t: 'code', v: m[1] });
    else if (m[2] !== undefined) out.push({ t: 'strong', v: m[2] });
    else if (m[3] !== undefined) out.push({ t: 'em', v: m[3] });
    else if (m[4] !== undefined) out.push({ t: 'em', v: m[4] });
    else if (m[5] !== undefined) out.push({ t: 'link', v: m[5], href: m[6] ?? '' });
    last = re.lastIndex;
    m = re.exec(text);
  }
  if (last < text.length) out.push({ t: 'text', v: text.slice(last) });
  return out.length ? out : [{ t: 'text', v: text }];
}

/** Parse a Markdown document into a flat list of block nodes. Pure and total. */
export function parseMarkdown(md: string): Block[] {
  const lines = md.replace(/\r\n?/g, '\n').split('\n');
  const blocks: Block[] = [];
  let para: string[] = [];

  const flushPara = () => {
    if (para.length) {
      blocks.push({ t: 'p', children: parseInline(para.join(' ').trim()) });
      para = [];
    }
  };

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const trimmed = line.trim();

    // Fenced code block: collect until the closing fence.
    if (/^```/.test(trimmed)) {
      flushPara();
      const buf: string[] = [];
      i++;
      while (i < lines.length && !/^```/.test(lines[i].trim())) {
        buf.push(lines[i]);
        i++;
      }
      blocks.push({ t: 'code', v: buf.join('\n') });
      continue;
    }

    if (trimmed === '') {
      flushPara();
      continue;
    }

    // Thematic break.
    if (/^(-{3,}|\*{3,}|_{3,})$/.test(trimmed)) {
      flushPara();
      blocks.push({ t: 'hr' });
      continue;
    }

    // Headings.
    const h = /^(#{1,3})\s+(.*)$/.exec(trimmed);
    if (h) {
      flushPara();
      blocks.push({
        t: 'h',
        level: h[1].length as 1 | 2 | 3,
        children: parseInline(h[2].trim()),
      });
      continue;
    }

    // Unordered list: gather consecutive bullet lines.
    if (/^[-*]\s+/.test(trimmed)) {
      flushPara();
      const items: Inline[][] = [];
      while (i < lines.length && /^[-*]\s+/.test(lines[i].trim())) {
        items.push(parseInline(lines[i].trim().replace(/^[-*]\s+/, '')));
        i++;
      }
      i--;
      blocks.push({ t: 'ul', items });
      continue;
    }

    // Ordered list.
    if (/^\d+\.\s+/.test(trimmed)) {
      flushPara();
      const items: Inline[][] = [];
      while (i < lines.length && /^\d+\.\s+/.test(lines[i].trim())) {
        items.push(parseInline(lines[i].trim().replace(/^\d+\.\s+/, '')));
        i++;
      }
      i--;
      blocks.push({ t: 'ol', items });
      continue;
    }

    para.push(trimmed);
  }
  flushPara();
  return blocks;
}

function InlineRun({ nodes }: { nodes: Inline[] }) {
  return (
    <>
      {nodes.map((n, i) => {
        const key = `${n.t}-${i}`;
        if (n.t === 'strong')
          return (
            <strong key={key} className="font-semibold text-foreground">
              {n.v}
            </strong>
          );
        if (n.t === 'em') return <em key={key}>{n.v}</em>;
        if (n.t === 'code')
          return (
            <code
              key={key}
              className="font-mono text-[0.85em] text-accent bg-muted rounded px-1 py-0.5"
            >
              {n.v}
            </code>
          );
        if (n.t === 'link') {
          const href = safeHref(n.href);
          return href ? (
            <a
              key={key}
              href={href}
              target="_blank"
              rel="noopener noreferrer"
              className="text-accent hover:underline"
            >
              {n.v}
            </a>
          ) : (
            <span key={key}>{n.v}</span>
          );
        }
        return <span key={key}>{n.v}</span>;
      })}
    </>
  );
}

/** Render trusted-ish Markdown as styled React elements. */
export function Markdown({ source, className }: { source: string; className?: string }) {
  const blocks = parseMarkdown(source);
  return (
    <div className={`space-y-4 ${className ?? ''}`}>
      {blocks.map((b, i) => {
        const key = `${b.t}-${i}`;
        switch (b.t) {
          case 'h': {
            const cls =
              b.level === 1
                ? 'text-2xl font-bold tracking-tight'
                : b.level === 2
                  ? 'text-xl font-semibold mt-6'
                  : 'text-lg font-semibold mt-4';
            if (b.level === 1)
              return (
                <h1 key={key} className={cls}>
                  <InlineRun nodes={b.children} />
                </h1>
              );
            if (b.level === 2)
              return (
                <h2 key={key} className={cls}>
                  <InlineRun nodes={b.children} />
                </h2>
              );
            return (
              <h3 key={key} className={cls}>
                <InlineRun nodes={b.children} />
              </h3>
            );
          }
          case 'p':
            return (
              <p key={key} className="text-muted-foreground leading-relaxed">
                <InlineRun nodes={b.children} />
              </p>
            );
          case 'ul':
            return (
              <ul key={key} className="list-disc list-outside pl-5 space-y-1 text-muted-foreground">
                {b.items.map((it, j) => (
                  // biome-ignore lint/suspicious/noArrayIndexKey: static parsed list, never reordered
                  <li key={j}>
                    <InlineRun nodes={it} />
                  </li>
                ))}
              </ul>
            );
          case 'ol':
            return (
              <ol
                key={key}
                className="list-decimal list-outside pl-5 space-y-1 text-muted-foreground"
              >
                {b.items.map((it, j) => (
                  // biome-ignore lint/suspicious/noArrayIndexKey: static parsed list, never reordered
                  <li key={j}>
                    <InlineRun nodes={it} />
                  </li>
                ))}
              </ol>
            );
          case 'code':
            return (
              <pre
                key={key}
                className="overflow-x-auto rounded-md border border-border bg-muted/40 p-3 font-mono text-xs"
              >
                {b.v}
              </pre>
            );
          case 'hr':
            return <hr key={key} className="border-border" />;
        }
      })}
    </div>
  );
}
