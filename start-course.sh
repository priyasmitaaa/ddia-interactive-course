#!/usr/bin/env sh
# Start the DDIA course on macOS or Linux:   ./start-course.sh   (or: sh start-course.sh)
# Opens http://localhost:5317. First run installs dependencies (needs Node.js 18+ from https://nodejs.org).
cd "$(dirname "$0")" || exit 1
if ! command -v node >/dev/null 2>&1; then
  echo "Node.js is not installed. Install the LTS version from https://nodejs.org and run this again."
  exit 1
fi
if [ ! -d node_modules ]; then
  echo "Installing dependencies - this happens only once..."
  npm install || exit 1
fi
echo "Starting the course at http://localhost:5317  (press Ctrl+C to stop)"
npm start
