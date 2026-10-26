import { Marked } from 'marked';
import { memo, useMemo } from 'react';
import { pdfPage } from '../lib/parse';

const marked = new Marked({ gfm: true, breaks: false });

marked.use({
  renderer: {
    link({ href, title, tokens }) {
      const text = this.parser.parseInline(tokens);
      let url = href ?? '';
      let external = /^https?:/.test(url);
      const pdf = url.match(/^pdf:(\d+)$/);
      const raw = url.match(/^pdfp:(\d+)$/);
      if (pdf) { url = `/book.pdf#page=${pdfPage(Number(pdf[1]))}`; external = true; }
      else if (raw) { url = `/book.pdf#page=${raw[1]}`; external = true; }
      else if (url.startsWith('lesson:')) url = `#/lesson/${url.slice(7)}`;
      else if (url.startsWith('ex:')) url = `#/practice/${url.slice(3)}`;
      const t = title ? ` title="${title}"` : '';
      const target = external ? ' target="_blank" rel="noreferrer"' : '';
      return `<a href="${url}"${t}${target}>${text}${external && !pdf && !raw ? ' ↗' : ''}</a>`;
    },
  },
});

export function renderMarkdown(src: string): string {
  return marked.parse(src, { async: false }) as string;
}

export const Markdown = memo(function Markdown({ src, className = '' }: { src: string; className?: string }) {
  const html = useMemo(() => renderMarkdown(src), [src]);
  return <div className={`md ${className}`} dangerouslySetInnerHTML={{ __html: html }} />;
});

/** Inline markdown (no wrapping <p>) for quiz options. */
export function InlineMd({ src }: { src: string }) {
  const html = useMemo(() => marked.parseInline(src, { async: false }) as string, [src]);
  return <span dangerouslySetInnerHTML={{ __html: html }} />;
}
