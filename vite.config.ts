import { defineConfig, type Plugin } from 'vite';
import react from '@vitejs/plugin-react';
import fs from 'node:fs';
import path from 'node:path';

// Where the book lives. Override with the DDIA_PDF environment variable,
// or drop a copy named book.pdf into this folder.
const PDF_CANDIDATES = [
  process.env.DDIA_PDF,
  path.resolve(__dirname, 'book.pdf'),
  'D:/Martin-Kleppmann---Designing-Data-Intensive-Applications_-O\u2019Reilly-Media-(2017).pdf',
].filter(Boolean) as string[];

function findPdf(): string | null {
  for (const p of PDF_CANDIDATES) if (fs.existsSync(p)) return p;
  return null;
}

// Serves the book at /book.pdf so lessons can link to exact pages (#page=N).
function servePdf(): Plugin {
  const handler = (req: any, res: any, next: any) => {
    if (!req.url || !req.url.startsWith('/book.pdf')) return next();
    const pdf = findPdf();
    if (!pdf) {
      res.statusCode = 404;
      res.setHeader('Content-Type', 'text/plain');
      res.end('Book PDF not found. Set DDIA_PDF to its path or copy it to ddia-course/book.pdf');
      return;
    }
    res.setHeader('Content-Type', 'application/pdf');
    fs.createReadStream(pdf).pipe(res);
  };
  return {
    name: 'serve-book-pdf',
    configureServer(server) { server.middlewares.use(handler); },
    configurePreviewServer(server) { server.middlewares.use(handler); },
  };
}

// A fixed port matters: progress is saved in the browser per address,
// so the course must always open at the same URL.
export default defineConfig({
  plugins: [react(), servePdf()],
  server: { port: 5317, strictPort: true },
  preview: { port: 5317, strictPort: true },
  test: { environment: 'node' },
} as any);
