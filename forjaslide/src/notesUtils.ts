/**
 * Utilities for speaker notes: .note.md sidecar format (compatible with TeXora),
 * .pdfpc import, and lightweight Markdown rendering.
 */

export function parseNoteMd(src: string): Record<number, string> {
  const out: Record<number, string> = {};
  let cur: number | null = null;
  let buf: string[] = [];

  for (const rawLine of src.split(/\r?\n/)) {
    const trimmed = rawLine.trim();
    if (trimmed.startsWith('## Slide ')) {
      const rest = trimmed.slice('## Slide '.length).trim();
      const num = parseInt(rest.split(/\s+/)[0], 10);
      if (!Number.isNaN(num) && num > 0) {
        if (cur !== null) {
          const text = buf.join('\n').trim();
          if (text) out[cur] = text;
        }
        cur = num;
        buf = [];
        continue;
      }
    }
    if (cur !== null) {
      buf.push(rawLine);
    }
  }

  if (cur !== null) {
    const text = buf.join('\n').trim();
    if (text) out[cur] = text;
  }

  return out;
}

export function serializeNoteMd(notes: Record<number, string>): string {
  const pages = Object.keys(notes)
    .map((k) => Number(k))
    .filter((n) => !Number.isNaN(n) && n > 0 && (notes[n] || '').trim().length > 0)
    .sort((a, b) => a - b);

  const lines: string[] = ['# Speaker notes (ForjaSlide)', ''];
  for (const p of pages) {
    lines.push(`## Slide ${p}`);
    lines.push(notes[p].trim());
    lines.push('');
  }
  return lines.join('\n');
}

/**
 * Parses .pdfpc files (`[notes]` section with `### N` headers).
 */
export function parsePdfpcNotes(src: string): Record<number, string> {
  const out: Record<number, string> = {};
  const lines = src.split(/\r?\n/);
  let inNotes = false;
  let cur: number | null = null;
  let buf: string[] = [];

  for (const line of lines) {
    const t = line.trim();
    if (t.startsWith('[') && t.endsWith(']')) {
      if (inNotes && cur !== null) {
        const text = buf.join('\n').trim();
        if (text) out[cur] = text;
      }
      inNotes = t.toLowerCase() === '[notes]';
      cur = null;
      buf = [];
      continue;
    }
    if (!inNotes) continue;

    if (t.startsWith('### ')) {
      const num = parseInt(t.slice(4).trim(), 10);
      if (!Number.isNaN(num) && num > 0) {
        if (cur !== null) {
          const text = buf.join('\n').trim();
          if (text) out[cur] = text;
        }
        cur = num;
        buf = [];
        continue;
      }
    }

    if (cur !== null) {
      buf.push(line);
    }
  }

  if (inNotes && cur !== null) {
    const text = buf.join('\n').trim();
    if (text) out[cur] = text;
  }

  return out;
}

export function splitNoteLines(text: string): string[] {
  if (!text.trim()) return [];
  return text.split(/\r?\n/).filter((l) => l.trim().length > 0);
}
