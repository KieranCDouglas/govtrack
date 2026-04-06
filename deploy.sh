#!/bin/bash
# deploy.sh — build the client and deploy assets to repo root
# Usage: ./deploy.sh

set -e
REPO_ROOT="$(cd "$(dirname "$0")" && pwd)"
DIST="$REPO_ROOT/source/congress-tracker/dist/public/assets"
ASSETS="$REPO_ROOT/assets"
GITIGNORE="$REPO_ROOT/.gitignore"
HTML="$REPO_ROOT/index.html"

echo "→ Building client..."
cd "$REPO_ROOT/source/congress-tracker"
npm run build 2>&1 | grep -v "Could not resolve \"server/index.ts\"" | grep -v "^1 error$" | grep -v "Error: Build failed" || true
cd "$REPO_ROOT"

# Find new entry files
NEW_JS=$(ls "$DIST"/index-*.js 2>/dev/null | head -1)
NEW_CSS=$(ls "$DIST"/index-*.css 2>/dev/null | head -1)

if [ -z "$NEW_JS" ] || [ -z "$NEW_CSS" ]; then
  echo "✗ Build failed — no entry files found in $DIST"
  exit 1
fi

NEW_JS_FILE=$(basename "$NEW_JS")
NEW_CSS_FILE=$(basename "$NEW_CSS")

# Find old entry files currently whitelisted in .gitignore
OLD_JS_FILE=$(grep '!assets/index-.*\.js' "$GITIGNORE" | sed 's|!assets/||')
OLD_CSS_FILE=$(grep '!assets/index-.*\.css' "$GITIGNORE" | sed 's|!assets/||')

echo "→ JS:  $OLD_JS_FILE → $NEW_JS_FILE"
echo "→ CSS: $OLD_CSS_FILE → $NEW_CSS_FILE"

# Copy new assets
cp "$DIST"/$NEW_JS_FILE "$ASSETS/"
cp "$DIST"/$NEW_CSS_FILE "$ASSETS/"

# Remove old entry assets (if changed)
[ "$OLD_JS_FILE" != "$NEW_JS_FILE" ] && [ -f "$ASSETS/$OLD_JS_FILE" ] && rm "$ASSETS/$OLD_JS_FILE"
[ "$OLD_CSS_FILE" != "$NEW_CSS_FILE" ] && [ -f "$ASSETS/$OLD_CSS_FILE" ] && rm "$ASSETS/$OLD_CSS_FILE"

# Update index.html
sed -i '' "s|assets/$OLD_JS_FILE|assets/$NEW_JS_FILE|g" "$HTML"
sed -i '' "s|assets/$OLD_CSS_FILE|assets/$NEW_CSS_FILE|g" "$HTML"

# Update .gitignore whitelist
sed -i '' "s|!assets/$OLD_JS_FILE|!assets/$NEW_JS_FILE|" "$GITIGNORE"
sed -i '' "s|!assets/$OLD_CSS_FILE|!assets/$NEW_CSS_FILE|" "$GITIGNORE"

echo "✓ Done. Ready to commit:"
echo "  git add assets/ index.html .gitignore"
echo "  git commit -m \"build: update client assets\""
echo "  git push"
