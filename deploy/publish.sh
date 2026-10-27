#!/usr/bin/env bash
set -euo pipefail
release="${1:?release id required}"
[[ "$release" =~ ^[0-9]{8}-[0-9]{6}$ ]] || exit 2
base=/srv/no996-workbench-web
stage="$base/staging/$release"
conf=/etc/nginx/sites-available/agent.no996ai.cn
link=/etc/nginx/sites-enabled/agent.no996ai.cn
# First deployment deliberately refuses to replace any pre-existing site.
[[ ! -e "$conf" && ! -e "$link" && ! -L "$link" && ! -e "$base/current" ]] || { echo 'EXISTING_WORKBENCH_SITE_REQUIRES_REVIEW'; exit 3; }
[[ -z "$(ss -H -ltn 'sport = :8897')" ]] || { echo 'PORT_8897_OCCUPIED'; exit 4; }
command -v certbot >/dev/null
sha256sum /etc/nginx/nginx.conf > "$stage/other-sites.sha256"
for file in /etc/nginx/sites-available/*; do
  [[ -f "$file" ]] && sha256sum "$file" >> "$stage/other-sites.sha256"
done
sha256sum /opt/no996ai-portal/dist/index.html >> "$stage/other-sites.sha256"
curl --max-time 10 -fsS https://no996ai.cn/ -o /dev/null
cd "$stage"
sha256sum -c "$stage/artifact.sha256"
mkdir -p "$base/releases/$release" "$base/acme/.well-known/acme-challenge"
tar -xzf "$stage/artifact.tar.gz" -C "$base/releases/$release"
[[ -s "$base/releases/$release/index.html" ]]
chmod -R a+rX "$base/releases/$release"
changed=0
rollback() {
  code=$?
  if [[ "$code" != 0 && "$changed" == 1 ]]; then
    echo 'ROLLBACK_NEW_WORKBENCH_SITE'
    rm -f "$link" "$conf" "$base/current"
    nginx -t && systemctl reload nginx || true
  fi
  exit "$code"
}
trap rollback EXIT
changed=1
cat > "$conf" <<'HTTP'
server {
    listen 80;
    listen [::]:80;
    server_name agent.no996ai.cn;
    location ^~ /.well-known/acme-challenge/ {
        root /srv/no996-workbench-web/acme;
        try_files $uri =404;
    }
    location / { return 503; }
}
HTTP
ln -s "$conf" "$link"
nginx -t
systemctl reload nginx
if [[ ! -f /etc/letsencrypt/live/agent.no996ai.cn/fullchain.pem ]]; then
  timeout --kill-after=10s 110s certbot certonly --webroot \
    -w "$base/acme" -d agent.no996ai.cn \
    --non-interactive --agree-tos --register-unsafely-without-email \
    --deploy-hook 'nginx -t && systemctl reload nginx'
fi
cp "$stage/nginx-agent.conf" "$conf"
ln -s "$base/releases/$release" "$base/current"
nginx -t
systemctl reload nginx
curl --retry 5 --retry-connrefused --retry-delay 1 --max-time 10 -fsS http://127.0.0.1:8897/ -o /dev/null
curl --retry 5 --retry-connrefused --retry-delay 1 --max-time 10 -fsS https://agent.no996ai.cn/login -o /dev/null
sha256sum -c "$stage/other-sites.sha256"
curl --max-time 10 -fsS https://no996ai.cn/ -o /dev/null
printf 'DEPLOYMENT_SUCCESS=%s\nOTHER_SITE_FILES_UNCHANGED\n' "$release"
trap - EXIT
