#!/bin/bash
set -e

echo "=== Fetching Git LFS files ==="
if command -v git-lfs &> /dev/null || command -v git lfs &> /dev/null; then
  git lfs install || true
  git lfs pull || true
  echo "✓ Git LFS files fetched"
else
  echo "! Git LFS not available, skipping"
fi

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
