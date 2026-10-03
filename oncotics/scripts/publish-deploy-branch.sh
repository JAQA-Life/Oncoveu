#!/bin/bash
# Publishes the built site (oncotics/public_html, including any deployed vendor assets) as the ROOT of a
# separate Git branch, so Hostinger hPanel → Advanced → Git can pull it straight into public_html.
# The branch contains only the website files: no source code, no node_modules, no OHIF monorepo.
#   Usage: oncotics/scripts/publish-deploy-branch.sh [branch]   (default: hostinger-deploy)
# Each run adds one commit on top of the existing branch (normal push, no force), so Hostinger's
# pull always fast-forwards.
set -euo pipefail
cd "$(dirname "$0")/.."
BRANCH="${1:-hostinger-deploy}"
[ -f public_html/index.html ] || { echo "Run scripts/build-site.sh first." >&2; exit 1; }
REMOTE="$(git remote get-url origin)"
NAME="$(git config user.name || echo 'Oncotics deploy')"; EMAIL="$(git config user.email || echo 'deploy@oncotics.com')"
SRC_COMMIT="$(git rev-parse --short HEAD)"
TMP="$(mktemp -d)"; trap 'rm -rf "$TMP"' EXIT
if git ls-remote --exit-code --heads "$REMOTE" "$BRANCH" >/dev/null 2>&1; then
  git clone -q --depth 1 --branch "$BRANCH" "$REMOTE" "$TMP/site"
else
  git init -q "$TMP/site"; git -C "$TMP/site" checkout -q -b "$BRANCH"
fi
# Mirror public_html into the branch (removes files that no longer exist; keeps .git).
find "$TMP/site" -mindepth 1 -maxdepth 1 ! -name .git -exec rm -rf {} +
cp -R public_html/. "$TMP/site/"
find "$TMP/site" -name '*.map' -delete
cd "$TMP/site"
git add -A
if git diff --cached --quiet; then echo "No changes to publish."; exit 0; fi
git -c user.name="$NAME" -c user.email="$EMAIL" commit -q -m "Deploy oncotics.com build from $SRC_COMMIT"
git push -q "$REMOTE" "HEAD:refs/heads/$BRANCH"
echo "Published $(git rev-parse --short HEAD) to $BRANCH"
