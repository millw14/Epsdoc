#!/bin/bash
set -e

echo "=== Checking database ==="
echo "DB_URL is: ${DB_URL:-NOT SET}"

if [ -n "$DB_URL" ]; then
  echo "Downloading database from: $DB_URL"
  
  # Check if URL ends with .zip
  if [[ "$DB_URL" == *.zip ]]; then
    echo "Detected zip file, downloading..."
    curl -L -v -o document_analysis.db.zip "$DB_URL" 2>&1 | head -50
    echo "Extracting database from zip..."
    unzip -o document_analysis.db.zip
    rm -f document_analysis.db.zip
  else
    echo "Downloading raw database file..."
    curl -L -v -o document_analysis.db "$DB_URL" 2>&1 | head -50
  fi
  
  # Verify download
  if [ -f "document_analysis.db" ]; then
    DB_SIZE=$(stat -c%s "document_analysis.db" 2>/dev/null || stat -f%z "document_analysis.db" 2>/dev/null)
    echo "✓ Database file size: $DB_SIZE bytes"
    
    # Check if it's a valid SQLite file (starts with "SQLite format 3")
    if head -c 16 document_analysis.db | grep -q "SQLite format 3"; then
      echo "✓ Database is a valid SQLite file"
    else
      echo "✗ ERROR: Downloaded file is NOT a valid SQLite database!"
      echo "First 100 bytes of file:"
      head -c 100 document_analysis.db
      echo ""
      exit 1
    fi
  else
    echo "✗ ERROR: Database file not found after download!"
    exit 1
  fi
else
  echo "⚠ DB_URL not set, checking existing file..."
  
  if [ -f "document_analysis.db" ]; then
    DB_SIZE=$(stat -c%s "document_analysis.db" 2>/dev/null || stat -f%z "document_analysis.db" 2>/dev/null)
    echo "Existing database size: $DB_SIZE bytes"
    
    # Check if it's an LFS pointer (small text file)
    if [ "$DB_SIZE" -lt 1000 ]; then
      echo "✗ ERROR: Database appears to be a Git LFS pointer, not the actual file!"
      echo "File contents:"
      cat document_analysis.db
      echo ""
      echo "Please set DB_URL environment variable to download the database."
      exit 1
    fi
  else
    echo "✗ ERROR: Database file not found!"
    echo "Please set DB_URL environment variable."
    exit 1
  fi
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
