#!/usr/bin/env bash
set -euo pipefail
release="${1:?release id required}"
[[ "$release" =~ ^[0-9]{8}-[0-9]{6}$ ]] || exit 2
base=/srv/no996-workbench-web
stage="$base/staging/$release"
[[ -L "$base/current" || -e "$base/current" ]] || { echo 'NO_CURRENT_RELEASE'; exit 3; }
[[ -f "$stage/artifact.tar.gz" && -f "$stage/artifact.sha256" ]] || { echo 'MISSING_ARTIFACT'; exit 4; }
prev="$(readlink -f "$base/current" 2>/dev/null || true)"
cd "$stage"
sha256sum -c "$stage/artifact.sha256"
mkdir -p "$base/releases/$release"
tar -xzf "$stage/artifact.tar.gz" -C "$base/releases/$release"
# Preserve the independently distributed extension if this build does not include it.
if [[ ! -f "$base/releases/$release/downloads/zhiyuan-extension.zip" && -f "$prev/downloads/zhiyuan-extension.zip" ]]; then
  mkdir -p "$base/releases/$release/downloads"
  cp -p "$prev/downloads/zhiyuan-extension.zip" "$base/releases/$release/downloads/zhiyuan-extension.zip"
fi
[[ -s "$base/releases/$release/index.html" ]]
chmod -R a+rX "$base/releases/$release"
ln -sfn "$base/releases/$release" "$base/current"
curl --retry 5 --retry-connrefused --retry-delay 1 --max-time 10 -fsS http://127.0.0.1:8897/ -o /dev/null
curl --retry 5 --retry-connrefused --retry-delay 1 --max-time 10 -fsS https://agent.no996ai.cn/login -o /dev/null
printf 'UPDATE_SUCCESS=%s\nPREV=%s\n' "$release" "$prev"
