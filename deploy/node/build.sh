#!/usr/bin/env bash
# Assembles the Node.js upload zip from website/.
#
# website/ is not duplicated in git — it is copied in at build time, so the
# 15 MB hero video is stored once in the repo.
set -euo pipefail

here="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
root="$(cd "$here/../.." && pwd)"
stage="$here/dist/nearmatch-node"

rm -rf "$here/dist"
mkdir -p "$stage/public"

cp "$here/package.json" "$here/server.js" "$here/README.md" "$stage/"
cp -r "$root/website/." "$stage/public/"

# Config for hosts this bundle is not for. server.js covers these rules.
rm -f "$stage/public/vercel.json" "$stage/public/_headers" \
      "$stage/public/_redirects" "$stage/public/.htaccess"

# Zipped from inside the stage dir so package.json lands at the archive root.
( cd "$stage" && zip -rq "$here/dist/nearmatch-node.zip" . -x 'node_modules/*' 'package-lock.json' )

echo "Built $here/dist/nearmatch-node.zip"
unzip -l "$here/dist/nearmatch-node.zip"
