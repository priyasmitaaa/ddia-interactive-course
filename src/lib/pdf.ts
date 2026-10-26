import { pdfPage } from './parse';

/**
 * Links into the book. When the course runs locally (npm run dev / start-course), the dev server serves the PDF at
 * ./book.pdf. On a static deployment (e.g. GitHub Pages) the copyrighted PDF is NOT hosted, so links can't open it;
 * a click then explains which page to open in your own copy instead.
 */
export const bookHref = (pdfPageNumber: number) => `${import.meta.env.BASE_URL}book.pdf#page=${pdfPageNumber}`;
export const bookHrefPrinted = (printed: number) => bookHref(pdfPage(printed));

let available: boolean | null = null;
let probe: Promise<boolean> | null = null;

export function checkPdf(): Promise<boolean> {
  if (available !== null) return Promise.resolve(available);
  probe ??= fetch(`${import.meta.env.BASE_URL}book.pdf`, { method: 'HEAD' })
    .then((r) => r.ok && (r.headers.get('content-type') ?? '').includes('pdf'))
    .catch(() => false)
    .then((ok) => (available = ok));
  return probe;
}

/** Install once: intercept clicks on book links when the PDF isn't reachable from this site. */
export function installPdfLinkGuard() {
  if (typeof document === 'undefined') return;
  checkPdf();
  document.addEventListener('click', (e) => {
    const a = (e.target as HTMLElement | null)?.closest?.('a[href*="book.pdf#page="]') as HTMLAnchorElement | null;
    if (!a || available !== false) return;
    e.preventDefault();
    const page = Number(a.getAttribute('href')!.split('#page=')[1]);
    alert(`The book PDF isn't connected on this site (it is never uploaded, for copyright reasons).\n\n` +
      `Open your own copy at PDF page ${page} (printed page ${page - 22}).\n\n` +
      `To make these links open the PDF directly, run the course locally (see SETUP in the README).`);
  }, true);
}
