import { defineConfig, type Plugin } from 'vite';
import react from '@vitejs/plugin-react';
import fs from 'node:fs';
import path from 'node:path';

// Where the book lives (never committed to git). In order of preference:
//   1. the DDIA_PDF environment variable,
//   2. a copy named book.pdf in this folder,
//   3. a path written on the first line of a file named .pdfpath in this folder.
function pdfCandidates(): string[] {
  const out = [process.env.DDIA_PDF, path.resolve(__dirname, 'book.pdf')];
  const pointer = path.resolve(__dirname, '.pdfpath');
  if (fs.existsSync(pointer)) out.push(fs.readFileSync(pointer, 'utf8').split(/\r?\n/)[0].trim());
  return out.filter(Boolean) as string[];
}

function findPdf(): string | null {
  for (const p of pdfCandidates()) if (fs.existsSync(p)) return p;
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
  // Relative base so the built site works from any sub-path (e.g. GitHub Pages /repo-name/).
  base: './',
  plugins: [react(), servePdf()],
  build: { chunkSizeWarningLimit: 2500 },
  server: { port: 5317, strictPort: true },
  preview: { port: 5317, strictPort: true },
  test: { environment: 'node' },
} as any);
