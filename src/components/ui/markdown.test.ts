import { describe, expect, it } from 'vitest';
import { type Block, parseInline, parseMarkdown, safeHref } from './markdown';

describe('safeHref', () => {
  it('allows http(s), mailto, and relative links', () => {
    expect(safeHref('https://x.com')).toBe('https://x.com');
    expect(safeHref('http://x.com')).toBe('http://x.com');
    expect(safeHref('mailto:a@b.com')).toBe('mailto:a@b.com');
    expect(safeHref('/lab')).toBe('/lab');
    expect(safeHref('#section')).toBe('#section');
  });
  it('rejects dangerous schemes', () => {
    expect(safeHref('javascript:alert(1)')).toBeUndefined();
    expect(safeHref('data:text/html,<script>')).toBeUndefined();
    expect(safeHref('vbscript:x')).toBeUndefined();
  });
});

describe('parseInline', () => {
  it('splits bold, italic, code and links', () => {
    expect(parseInline('a **b** c')).toEqual([
      { t: 'text', v: 'a ' },
      { t: 'strong', v: 'b' },
      { t: 'text', v: ' c' },
    ]);
    expect(parseInline('_i_ and *j*')).toEqual([
      { t: 'em', v: 'i' },
      { t: 'text', v: ' and ' },
      { t: 'em', v: 'j' },
    ]);
    expect(parseInline('use `run()` now')).toEqual([
      { t: 'text', v: 'use ' },
      { t: 'code', v: 'run()' },
      { t: 'text', v: ' now' },
    ]);
    expect(parseInline('see [the lab](/lab)')).toEqual([
      { t: 'text', v: 'see ' },
      { t: 'link', v: 'the lab', href: '/lab' },
    ]);
  });

  it('does not mistake ** for two single-* spans', () => {
    expect(parseInline('**bold**')).toEqual([{ t: 'strong', v: 'bold' }]);
  });

  it('leaves plain text (and unmatched markers) as literal text', () => {
    expect(parseInline('plain text')).toEqual([{ t: 'text', v: 'plain text' }]);
    expect(parseInline('a * b')).toEqual([{ t: 'text', v: 'a * b' }]);
  });
});

const kinds = (blocks: Block[]) => blocks.map((b) => b.t);

describe('parseMarkdown', () => {
  it('parses headings, paragraphs and blank-line separation', () => {
    const b = parseMarkdown('# Title\n\nA paragraph.\n\n## Sub\nmore text');
    expect(kinds(b)).toEqual(['h', 'p', 'h', 'p']);
    expect(b[0]).toMatchObject({ t: 'h', level: 1 });
    expect(b[2]).toMatchObject({ t: 'h', level: 2 });
  });

  it('joins wrapped paragraph lines with a space', () => {
    const b = parseMarkdown('line one\nline two');
    expect(b).toHaveLength(1);
    expect(b[0]).toMatchObject({ t: 'p' });
    expect(b[0]).toMatchObject({ children: [{ t: 'text', v: 'line one line two' }] });
  });

  it('parses unordered and ordered lists', () => {
    const ul = parseMarkdown('- a\n- b\n- c');
    expect(ul).toHaveLength(1);
    expect(ul[0]).toMatchObject({ t: 'ul' });
    expect((ul[0] as { items: unknown[] }).items).toHaveLength(3);

    const ol = parseMarkdown('1. first\n2. second');
    expect(ol[0]).toMatchObject({ t: 'ol' });
    expect((ol[0] as { items: unknown[] }).items).toHaveLength(2);
  });

  it('parses fenced code blocks verbatim and thematic breaks', () => {
    const b = parseMarkdown('```\nconst x = 1\n```\n\n---\n\ndone');
    expect(kinds(b)).toEqual(['code', 'hr', 'p']);
    expect(b[0]).toMatchObject({ t: 'code', v: 'const x = 1' });
  });

  it('is total — empty and whitespace input yield no blocks', () => {
    expect(parseMarkdown('')).toEqual([]);
    expect(parseMarkdown('   \n\n  ')).toEqual([]);
  });
});
