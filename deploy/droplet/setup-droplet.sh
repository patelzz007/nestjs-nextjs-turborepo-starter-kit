#!/usr/bin/env bash
# ============================================================================
# One-time preparation of a fresh Ubuntu 24.04 Droplet for the platform (ADR 075). Run as root, once:
#
#   curl -fsSLO https://raw.githubusercontent.com/<you>/<repo>/main/deploy/droplet/setup-droplet.sh
#   less setup-droplet.sh            # read it first
#   bash setup-droplet.sh <slug> <your-ssh-public-key-file>
#
# What it does (docs/technical/operations/digitalocean-deployment.md, steps 4–8):
#   - security updates on, automatic from now on; a firewall allowing only SSH, HTTP and HTTPS;
#   - a 4 GB swap file (builds and Next.js need headroom on small Droplets);
#   - the `platform` user (no password; your SSH key), which owns /srv/<slug> and runs pm2;
#   - Docker (data services), nginx, certbot, Node.js (pinned, checksum-verified), pnpm and pm2;
#   - the deploy layout and the Redis TLS certificate authority;
#   - SSH: keys only, no root login — only after the platform user's key is in place.
# It is idempotent: running it again skips what is done.
# ============================================================================
set -euo pipefail

SLUG="${1:?usage: setup-droplet.sh <slug> <ssh-public-key-file>}"
KEY_FILE="${2:?usage: setup-droplet.sh <slug> <ssh-public-key-file>}"
NODE_VERSION="${NODE_VERSION:-24.22.1}"
PM2_VERSION="${PM2_VERSION:-6}"
APP_USER="platform"
ROOT="/srv/${SLUG}"

[[ "$(id -u)" == "0" ]] || { echo "Run as root."; exit 1; }
[[ "$SLUG" =~ ^[a-z][a-z0-9-]{1,38}$ ]] || { echo "The slug must match project.json's slug."; exit 1; }
[[ -s "$KEY_FILE" ]] || { echo "No SSH public key at $KEY_FILE."; exit 1; }

echo "==> Packages and automatic security updates"
export DEBIAN_FRONTEND=noninteractive
apt-get update -q
apt-get upgrade -yq
apt-get install -yq ca-certificates curl git gnupg ufw fail2ban unattended-upgrades nginx certbot python3-certbot-nginx openssl xz-utils
dpkg-reconfigure -f noninteractive unattended-upgrades

echo "==> Firewall: SSH, HTTP, HTTPS only"
ufw default deny incoming
ufw default allow outgoing
ufw allow OpenSSH
ufw allow "Nginx Full"
ufw --force enable

echo "==> Swap"
if ! swapon --show | grep -q /swapfile; then
	fallocate -l 4G /swapfile
	chmod 600 /swapfile
	mkswap /swapfile
	swapon /swapfile
	grep -q '^/swapfile ' /etc/fstab || echo '/swapfile none swap sw 0 0' >> /etc/fstab
fi

echo "==> Docker (official apt repository)"
if ! command -v docker > /dev/null; then
	install -m 0755 -d /etc/apt/keyrings
	curl -fsSL https://download.docker.com/linux/ubuntu/gpg -o /etc/apt/keyrings/docker.asc
	chmod a+r /etc/apt/keyrings/docker.asc
	echo "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.asc] https://download.docker.com/linux/ubuntu $(. /etc/os-release && echo "$VERSION_CODENAME") stable" > /etc/apt/sources.list.d/docker.list
	apt-get update -q
	apt-get install -yq docker-ce docker-ce-cli containerd.io docker-compose-plugin
fi

echo "==> Node.js ${NODE_VERSION} (checksum-verified)"
if [[ "$(node --version 2> /dev/null || true)" != "v${NODE_VERSION}" ]]; then
	arch="$(dpkg --print-architecture | sed 's/amd64/x64/')"
	tarball="node-v${NODE_VERSION}-linux-${arch}.tar.xz"
	workdir="$(mktemp -d)"
	curl -fsSL "https://nodejs.org/dist/v${NODE_VERSION}/${tarball}" -o "${workdir}/${tarball}"
	curl -fsSL "https://nodejs.org/dist/v${NODE_VERSION}/SHASUMS256.txt" -o "${workdir}/SHASUMS256.txt"
	(cd "$workdir" && grep " ${tarball}\$" SHASUMS256.txt | sha256sum -c -)
	tar -xJf "${workdir}/${tarball}" -C /usr/local --strip-components=1
	rm -rf "$workdir"
fi
corepack enable
npm install -g "pm2@${PM2_VERSION}"

echo "==> The ${APP_USER} user"
if ! id "$APP_USER" > /dev/null 2>&1; then
	adduser --disabled-password --gecos "" "$APP_USER"
fi
usermod -aG docker "$APP_USER"
install -d -m 700 -o "$APP_USER" -g "$APP_USER" "/home/${APP_USER}/.ssh"
touch "/home/${APP_USER}/.ssh/authorized_keys"
grep -qxF "$(cat "$KEY_FILE")" "/home/${APP_USER}/.ssh/authorized_keys" || cat "$KEY_FILE" >> "/home/${APP_USER}/.ssh/authorized_keys"
chown "$APP_USER:$APP_USER" "/home/${APP_USER}/.ssh/authorized_keys"
chmod 600 "/home/${APP_USER}/.ssh/authorized_keys"

echo "==> Deploy layout under ${ROOT}"
install -d -o "$APP_USER" -g "$APP_USER" "$ROOT" "$ROOT/releases" "$ROOT/bin" "$ROOT/shared" "$ROOT/shared/data" "$ROOT/shared/storage"
install -d -m 700 -o "$APP_USER" -g "$APP_USER" "$ROOT/shared/env"

echo "==> Redis TLS: a private CA and the server certificate"
TLS="$ROOT/shared/tls"
install -d -m 750 -o "$APP_USER" -g "$APP_USER" "$TLS"
if [[ ! -f "$TLS/ca.crt" ]]; then
	openssl req -x509 -newkey rsa:4096 -nodes -days 3650 -subj "/CN=${SLUG} data services CA" -keyout "$TLS/ca.key" -out "$TLS/ca.crt"
	openssl req -newkey rsa:2048 -nodes -subj "/CN=127.0.0.1" -keyout "$TLS/redis.key" -out "$TLS/redis.csr"
	printf 'subjectAltName=IP:127.0.0.1,DNS:localhost\n' > "$TLS/redis.ext"
	openssl x509 -req -in "$TLS/redis.csr" -CA "$TLS/ca.crt" -CAkey "$TLS/ca.key" -CAcreateserial -days 825 -extfile "$TLS/redis.ext" -out "$TLS/redis.crt"
	rm -f "$TLS/redis.csr" "$TLS/redis.ext"
	chmod 600 "$TLS/ca.key"
	# The Redis container runs as uid 999 and must read its key.
	chown 999:"$APP_USER" "$TLS/redis.key"
	chmod 640 "$TLS/redis.key"
	chown "$APP_USER:$APP_USER" "$TLS/ca.crt" "$TLS/redis.crt" "$TLS/ca.key"
fi

echo "==> pm2 starts on boot as ${APP_USER}"
env PATH="$PATH:/usr/local/bin" pm2 startup systemd -u "$APP_USER" --hp "/home/${APP_USER}" > /dev/null

echo "==> SSH: keys only, no root login"
cat > /etc/ssh/sshd_config.d/60-platform.conf <<'SSHD'
PasswordAuthentication no
KbdInteractiveAuthentication no
PermitRootLogin no
SSHD
systemctl reload ssh

echo
echo "Done. Next: sign in as ${APP_USER} (ssh ${APP_USER}@<droplet-ip>) and continue at step 8 of the guide."
