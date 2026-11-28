import React from 'react';

interface MarkdownNotesProps {
  text: string;
  activeLine: number | null;
  fontSize: number;
  onSelectLine?: (index: number) => void;
}

function renderInline(line: string): React.ReactNode[] {
  const parts: React.ReactNode[] = [];
  const regex = /(\*\*[^*]+\*\*|\*[^*]+\*|`[^`]+`)/g;
  let lastIndex = 0;
  let match: RegExpExecArray | null;
  let key = 0;

  while ((match = regex.exec(line)) !== null) {
    if (match.index > lastIndex) {
      parts.push(line.slice(lastIndex, match.index));
    }
    const token = match[0];
    if (token.startsWith('**') && token.endsWith('**')) {
      parts.push(<strong key={key++}>{token.slice(2, -2)}</strong>);
    } else if (token.startsWith('*') && token.endsWith('*')) {
      parts.push(<em key={key++}>{token.slice(1, -1)}</em>);
    } else if (token.startsWith('`') && token.endsWith('`')) {
      parts.push(
        <code key={key++} className="fs-md-code">
          {token.slice(1, -1)}
        </code>
      );
    }
    lastIndex = regex.lastIndex;
  }
  if (lastIndex < line.length) {
    parts.push(line.slice(lastIndex));
  }
  return parts;
}

export const MarkdownNotes: React.FC<MarkdownNotesProps> = ({
  text,
  activeLine,
  fontSize,
  onSelectLine,
}) => {
  const lines = text.split(/\r?\n/).filter((l) => l.trim().length > 0);
  if (lines.length === 0) {
    return (
      <div className="fs-md-empty" style={{ fontSize }}>
        Sem notas neste slide. Clique em Editar (E) para escrever em Markdown.
      </div>
    );
  }

  return (
    <div className="fs-md-view" style={{ fontSize }} dir="auto">
      {lines.map((line, idx) => {
        const isActive = activeLine === idx;
        const trimmed = line.trim();
        let content: React.ReactNode;
        let cls = 'fs-md-line';

        if (trimmed.startsWith('### ')) {
          cls += ' h3';
          content = renderInline(trimmed.slice(4));
        } else if (trimmed.startsWith('# ')) {
          cls += ' h1';
          content = renderInline(trimmed.slice(2));
        } else if (trimmed.startsWith('- ') || trimmed.startsWith('* ')) {
          cls += ' bullet';
          content = (
            <>
              <span className="fs-md-dot">•</span>
              <span>{renderInline(trimmed.slice(2))}</span>
            </>
          );
        } else {
          content = renderInline(trimmed);
        }

        return (
          <div
            key={idx}
            className={`${cls}${isActive ? ' guide-active' : ''}`}
            onClick={() => onSelectLine?.(idx)}
          >
            {content}
          </div>
        );
      })}
    </div>
  );
};
