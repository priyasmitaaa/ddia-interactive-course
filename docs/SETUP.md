# Setup — on any device

There are two ways to use the course. You can use both: for example the hosted site on your phone and the local
install on your laptop. Move your progress between them with a backup file (see below).

| | Hosted site | Local install |
|---|---|---|
| Address | https://priyasmitaaa.github.io/ddia-interactive-course/ | http://localhost:5317 |
| Needs | Any modern browser | Node.js 18+ (and Python 3.10+ for exercises) |
| Lessons, visualizations, quizzes, review | ✓ | ✓ |
| Page links open your PDF at the right page | — (tells you the page instead) | ✓ |
| Run the Python exercises | on a computer with Python | ✓ |
| Works without internet | — | ✓ |

---

## 1. Local install, step by step

### Windows
1. Install **Node.js LTS** from https://nodejs.org (accept the defaults).
2. Install **Python 3.10+** from https://python.org. Tick **"Add python.exe to PATH"**.
3. Install **Git** from https://git-scm.com, or use GitHub Desktop, or download the repository as a ZIP from GitHub
   (*Code → Download ZIP*) and unzip it.
4. Get the course:
   ```
   git clone https://github.com/priyasmitaaa/ddia-interactive-course.git
   ```
5. Connect your PDF (section 2).
6. Double-click **`start-course.bat`** in the folder. The first run installs dependencies, which takes a minute. Your
   browser opens http://localhost:5317. Keep the black window open while you study, and close it to stop.

### macOS
1. Install Node.js LTS (https://nodejs.org) and Python 3.10+ (https://python.org, or `brew install node python`).
2. `git clone https://github.com/priyasmitaaa/ddia-interactive-course.git && cd ddia-interactive-course`
3. Connect your PDF (section 2).
4. `./start-course.sh`. If macOS says it isn't executable, run `chmod +x start-course.sh` once, or use `sh start-course.sh`.

### Linux
Same as macOS. Install `nodejs` (18+), `npm`, `python3` and `git` from your package manager, or use nvm for a
current Node.js.

### Without the launcher (any OS)
```
npm install      # once
npm start        # starts the course and opens the browser (npm run dev starts it without opening a tab)
```

> **Always study at http://localhost:5317.** The browser stores progress per address, so a different port means a
> different, empty progress. The port is fixed on purpose. If something else is using it, the course refuses to start
> rather than silently moving.

---

## 2. Connect your PDF (local install)

The course never contains the book. Point it at your own copy, the *Sixth Early Release* PDF, using **any one** of these:

- **Copy** the PDF into the course folder as **`book.pdf`**, or
- **Point to it**: create a text file named **`.pdfpath`** in the course folder whose first line is the full path, e.g.
  `C:/Users/you/Books/ddia.pdf` or `/Users/you/Books/ddia.pdf`, or
- **Environment variable**: set `DDIA_PDF` to the path before starting (`set DDIA_PDF=...` on Windows cmd,
  `export DDIA_PDF=...` on macOS/Linux).

`book.pdf`, `.pdfpath` and every `*.pdf` are git-ignored, so the book can't be committed by accident.

**Check it**: open http://localhost:5317/book.pdf. The PDF should appear. In any lesson, the page links under
*"Read in the book"* now open the exact page.

If you have a different edition, the lessons still work, but page numbers won't match. Use the section names in each
reading entry to find the right place.

---

## 3. Exercises (Python)

Every exercise is plain Python 3.10+ with only the standard library, so there's nothing to `pip install`. Run them from the
course folder, for example:

```
python practice/01-fault-injection/bank.py
python practice/45-capstone-minikv/test_minikv.py M1_Encoding
```

(On macOS/Linux you may need `python3` instead of `python`.) Each exercise page in the app shows the folder and the
exact command. Reference solutions are in `practice/_solutions/`. Try the exercise first.

---

## 4. Progress: where it lives and how to move it

- Progress is saved **automatically** in your browser: completed lessons, every answer, your review schedule and
  draft answers. There are no accounts and nothing is sent anywhere.
- **Back it up / move devices**: open **Progress → Download backup** to save a small `.json` file. On the other device
  (or browser, or the hosted site), open **Progress → Restore from backup…** and choose the file.
- Restoring **replaces** that browser's progress with the file's. Move it in one direction at a time, and back up
  regularly, for example at the end of each week, since clearing browser data erases local progress.
- Studying on two devices? Pick one as "home", and download/restore whenever you switch.

---

## 5. Updating the course

```
git pull          # get new lessons/fixes
npm install       # in case dependencies changed
```
Your progress isn't stored in the repository, so updating never touches it.

---

## 6. Troubleshooting

| Problem | Fix |
|---|---|
| `Port 5317 is already in use` | Another copy of the course is already running. Use that tab, or close the other window. |
| Page links say "PDF not found" | Check section 2. Open http://localhost:5317/book.pdf to test. Restart the course after adding `.pdfpath`. |
| My progress disappeared | You're probably on a different address, browser, or private window. Use http://localhost:5317, or restore a backup. |
| `node` / `npm` not found | Install Node.js LTS and open a **new** terminal (or reboot on Windows) so PATH updates. |
| `python` not found (Windows) | Reinstall Python with "Add to PATH" ticked, or use `py` instead of `python`. |
| An exercise "hangs" | Most finish in seconds. Labs with real threads take up to about a minute. Press Ctrl+C and check the README's "Run it". |

## Hosted site (GitHub Pages)

The workflow `.github/workflows/pages.yml` tests, builds and publishes the course on every push to `main`. It
**skips itself while the repository is private**, because GitHub Pages for private repositories needs a paid plan.
To turn the hosted site on:

1. On GitHub, open the repository → **Settings → General → Danger Zone → Change visibility → Public**. (Or keep it
   private if your plan includes Pages.)
2. **Settings → Pages → Build and deployment → Source: GitHub Actions.**
3. **Actions → Deploy course to GitHub Pages → Run workflow** (or push any commit).
4. After a minute the course is live at `https://priyasmitaaa.github.io/ddia-interactive-course/`.

The book PDF is never part of the repository or the site.

## 7. For developers

```
npm test                          # content validator + visualization logic + spaced repetition tests
npm run dev                       # then, in another terminal:
npm run e2e                       # browser end-to-end test (Chrome/Chromium; set CHROME_PATH if not found)
python tools/check_solutions.py   # run every reference solution
python tools/gen_curriculum.py    # regenerate docs/CURRICULUM.md after editing lessons
npm run build                     # static build in dist/ (deployed to GitHub Pages by .github/workflows/pages.yml)
```
