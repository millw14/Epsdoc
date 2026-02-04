#!/bin/bash
set -e

echo "=== Downloading database ==="
if [ -n "$DB_URL" ]; then
  echo "Downloading database from DB_URL..."
  
  # Check if URL ends with .zip
  if [[ "$DB_URL" == *.zip ]]; then
    curl -L -o document_analysis.db.zip "$DB_URL"
    echo "Extracting database from zip..."
    unzip -o document_analysis.db.zip
    rm -f document_analysis.db.zip
  else
    curl -L -o document_analysis.db "$DB_URL"
  fi
  
  echo "✓ Database downloaded"
elif [ ! -f "document_analysis.db" ] || [ $(stat -c%s "document_analysis.db" 2>/dev/null || stat -f%z "document_analysis.db" 2>/dev/null) -lt 1000000 ]; then
  echo "⚠ Warning: Database file missing or is an LFS pointer."
  echo "Set DB_URL environment variable to download the database."
  echo "You can host the database on:"
  echo "  - GitHub Releases (as .zip)"
  echo "  - Google Drive (use direct download link)"
  echo "  - Any file hosting service with direct download URL"
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
