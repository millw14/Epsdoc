#!/bin/bash
set -e

echo "=== Note: Database will be downloaded at runtime from DB_URL ==="

echo "=== Installing root dependencies ==="
npm install

echo "=== Installing frontend dependencies ==="
cd network-ui
npm install

echo "=== Building frontend ==="
npm run build

echo "=== Verifying build ==="
if [ -d "dist" ]; then
  echo "✓ Frontend build successful at network-ui/dist"
  ls -la dist/
else
  echo "✗ Frontend build failed - dist directory not found"
  exit 1
fi

cd ..
echo "=== Build complete ==="
