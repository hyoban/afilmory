#!/bin/sh
set -eu

WORKSPACE_DIR=${AFILMORY_WORKSPACE_DIR:-/workspace}
SSR_PUBLIC_DIR=${AFILMORY_SSR_PUBLIC_DIR:-/app/apps/ssr/public}

export AFILMORY_LOCAL_PHOTOS_DIR=${AFILMORY_LOCAL_PHOTOS_DIR:-/data/photos}
export AFILMORY_LOCAL_PHOTO_TRASH=${AFILMORY_LOCAL_PHOTO_TRASH:-true}
export AFILMORY_MANIFEST_PATH=${AFILMORY_MANIFEST_PATH:-$WORKSPACE_DIR/apps/web/src/data/photos-manifest.json}
export AFILMORY_THUMBNAILS_DIR=${AFILMORY_THUMBNAILS_DIR:-$WORKSPACE_DIR/apps/web/public/thumbnails}

mkdir -p "$(dirname "$AFILMORY_MANIFEST_PATH")" "$AFILMORY_THUMBNAILS_DIR"
rm -rf "$SSR_PUBLIC_DIR/thumbnails"
ln -s "$AFILMORY_THUMBNAILS_DIR" "$SSR_PUBLIC_DIR/thumbnails"

if [ "${AFILMORY_REBUILD_MANIFEST_ON_START:-1}" != "0" ]; then
  cd "$WORKSPACE_DIR"
  /workspace/node_modules/.bin/tsx /workspace/packages/builder/src/cli.ts --no-ui ${AFILMORY_BUILD_MANIFEST_ARGS:-}
fi

exec node /app/apps/ssr/server.js
