#!/usr/bin/env bash
set -euo pipefail

archive="${RELEASE_ARCHIVE:-/tmp/safeturn-release.tgz}"
deploy_dir="${DEPLOY_DIR:-/opt/safeturn}"
service_name="${SERVICE_NAME:-safeturn-server}"
port="${PORT:-4000}"
release_id="${GITHUB_SHA:-$(date +%Y%m%d%H%M%S)}"
release_dir="$deploy_dir/releases/$release_id"

if ! command -v node >/dev/null 2>&1; then
  echo "node is required on the ECS host" >&2
  exit 1
fi

if ! command -v npm >/dev/null 2>&1; then
  echo "npm is required on the ECS host" >&2
  exit 1
fi

sudo mkdir -p "$deploy_dir/releases"
sudo chown -R "$(id -u):$(id -g)" "$deploy_dir"

mkdir -p "$release_dir"
tar -xzf "$archive" -C "$release_dir"

cd "$release_dir"
npm ci --omit=dev

node_bin="$(command -v node)"
service_user="$(id -un)"

cat > "/tmp/$service_name.service" <<SERVICE
[Unit]
Description=SafeTurn Node.js server
After=network.target

[Service]
Type=simple
WorkingDirectory=$deploy_dir/current
ExecStart=$node_bin apps/server/dist/index.js
Restart=always
RestartSec=5
User=$service_user
Environment=NODE_ENV=production
Environment=PORT=$port

[Install]
WantedBy=multi-user.target
SERVICE

sudo mv "/tmp/$service_name.service" "/etc/systemd/system/$service_name.service"
sudo systemctl daemon-reload

ln -sfn "$release_dir" "$deploy_dir/current.next"
mv -Tf "$deploy_dir/current.next" "$deploy_dir/current"

sudo systemctl enable "$service_name"
sudo systemctl restart "$service_name"
sudo systemctl --no-pager --full status "$service_name"
