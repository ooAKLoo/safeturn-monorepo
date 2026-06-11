#!/usr/bin/env bash
set -euo pipefail

archive="${1:-safeturn-release.tgz}"
staging_dir="$(mktemp -d)"
trap 'rm -rf "$staging_dir"' EXIT

mkdir -p \
  "$staging_dir/apps/server" \
  "$staging_dir/apps/admin-dashboard" \
  "$staging_dir/apps/rider-app" \
  "$staging_dir/apps/family-h5" \
  "$staging_dir/packages/shared"

cp package.json package-lock.json "$staging_dir/"

cp apps/server/package.json "$staging_dir/apps/server/"
cp apps/admin-dashboard/package.json "$staging_dir/apps/admin-dashboard/"
cp apps/rider-app/package.json "$staging_dir/apps/rider-app/"
cp apps/family-h5/package.json "$staging_dir/apps/family-h5/"
cp packages/shared/package.json "$staging_dir/packages/shared/"

cp -R apps/server/dist "$staging_dir/apps/server/dist"
cp -R apps/admin-dashboard/dist "$staging_dir/apps/admin-dashboard/dist"
cp -R apps/rider-app/dist "$staging_dir/apps/rider-app/dist"
cp -R apps/family-h5/dist "$staging_dir/apps/family-h5/dist"
cp -R packages/shared/dist "$staging_dir/packages/shared/dist"

tar -czf "$archive" -C "$staging_dir" .
