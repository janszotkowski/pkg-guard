#!/usr/bin/env bash
# Sets up a fresh Ubuntu server (a Hetzner CX23 is enough) to run the whole site behind a Cloudflare Tunnel. Run it as
# root on the server; it asks for the domain and the tunnel token, and can be run again (it keeps what is already set).
#
#   curl -fsSL https://raw.githubusercontent.com/janszotkowski/weighme/main/deploy/setup.sh -o setup.sh
#   bash setup.sh
#
# DEPLOY.md walks through everything around it (the server, the domain, the tunnel).
set -euo pipefail

REPO_URL="${REPO_URL:-https://github.com/janszotkowski/weighme.git}"
APP_DIR="${APP_DIR:-/opt/weighme}"

say() { printf '\n\033[1;34m==> %s\033[0m\n' "$*"; }
fail() {
    printf '\n\033[1;31m%s\033[0m\n' "$*" >&2
    exit 1
}

[[ "$(id -u)" -eq 0 ]] || fail "Run this as root (log in with: ssh root@<server address>)."
grep -qi ubuntu /etc/os-release || fail "This script is written for Ubuntu."
[[ -t 0 ]] || fail "Download the script and run it with 'bash setup.sh': it asks questions, which a pipe cannot answer."

export DEBIAN_FRONTEND=noninteractive

say "Updating the system and installing Docker, git, a firewall and security updates"
apt-get update -q
apt-get upgrade -yq
# Docker from Ubuntu's own archive: no third-party repository to trust, and it follows the release.
apt-get install -yq ca-certificates curl git openssl ufw fail2ban unattended-upgrades docker.io docker-compose-v2 docker-buildx
systemctl enable --now docker
# Security updates install themselves every day.
dpkg-reconfigure -fnoninteractive unattended-upgrades

# Building the frontend image and bundling a large package both use a lot of memory for a while: swap keeps a 4 GB server from running out.
if ! swapon --show | grep -q .; then
    say "Adding 2 GB of swap"
    fallocate -l 2G /swapfile
    chmod 600 /swapfile
    mkswap /swapfile >/dev/null
    swapon /swapfile
    grep -q '^/swapfile ' /etc/fstab || echo '/swapfile none swap sw 0 0' >>/etc/fstab
fi

# Only SSH comes in: the site's traffic arrives through the tunnel, which the server opens itself, outwards.
# fail2ban blocks addresses that keep guessing the SSH password.
say "Firewall: only SSH is allowed in"
ufw allow OpenSSH >/dev/null
ufw --force enable >/dev/null
systemctl enable --now fail2ban

# With a key in place, SSH accepts keys only: no password to guess, for root or anyone. The file sorts before Ubuntu's
# and cloud-init's (sshd keeps the first value it reads), so they cannot turn passwords back on.
if [[ -s /root/.ssh/authorized_keys ]]; then
    say "SSH: keys only, passwords off"
    hardening=/etc/ssh/sshd_config.d/00-hardening.conf
    cat >"$hardening" <<'EOF'
# Written by weighme's deploy/setup.sh: log in with an SSH key only.
PasswordAuthentication no
KbdInteractiveAuthentication no
PermitRootLogin prohibit-password
EOF
    mkdir -p /run/sshd
    if ! sshd -t; then
        rm -f "$hardening"
        fail "The SSH settings did not pass 'sshd -t', so they were removed and SSH is unchanged."
    fi
    # Ubuntu starts ssh on the first connection: when it is not running, the next start reads the new settings.
    systemctl try-reload-or-restart ssh
else
    printf '\n\033[1;31m%s\n%s\033[0m\n' \
        "WARNING: /root/.ssh/authorized_keys is empty, so SSH still accepts the root password." \
        "Add your SSH key (DEPLOY.md, step 1) and run this script again to turn passwords off." >&2
fi

say "Getting the code into $APP_DIR"
if [[ -d "$APP_DIR/.git" ]]; then
    git -C "$APP_DIR" pull --ff-only
else
    git clone "$REPO_URL" "$APP_DIR"
fi
cd "$APP_DIR"

if [[ -f .env ]]; then
    say "Keeping the settings already in $APP_DIR/.env"
else
    say "Settings"
    read -rp "Domain of the site (for example pkg.example.com or example.com): " domain
    domain="${domain#http://}"
    domain="${domain#https://}"
    domain="${domain%%/*}"
    domain_re='^[A-Za-z0-9]([A-Za-z0-9-]*[A-Za-z0-9])?(\.[A-Za-z0-9]([A-Za-z0-9-]*[A-Za-z0-9])?)+$'
    [[ "$domain" =~ $domain_re ]] || fail "That is not a domain: '$domain'."
    # Cloudflare's free certificate covers one level of subdomains (*.example.com), so the API of pkg.example.com
    # is pkg-api.example.com, not api.pkg.example.com.
    labels="${domain//[^.]/}"
    if [[ ${#labels} -ge 2 ]]; then default_api="${domain%%.*}-api.${domain#*.}"; else default_api="api.$domain"; fi
    read -rp "Address of the API [$default_api]: " api
    api="${api:-$default_api}"
    api="${api#http://}"
    api="${api#https://}"
    api="${api%%/*}"
    [[ "$api" =~ $domain_re ]] || fail "That is not a domain: '$api'."
    read -rsp "Token of the Cloudflare Tunnel (the long text after --token; it is not shown as you paste): " tunnel_token
    echo
    tunnel_token="${tunnel_token#*--token }"
    tunnel_token="${tunnel_token//[[:space:]]/}"
    [[ ${#tunnel_token} -ge 50 ]] || fail "That token looks too short: copy the whole text after --token."
    # Made before the file is written: a failure inside the here-document below would leave the secret empty.
    internal_token="$(openssl rand -hex 32)"
    worker_token="$(openssl rand -hex 32)"
    [[ ${#internal_token} -eq 64 && ${#worker_token} -eq 64 ]] || fail "Could not generate the tokens (is openssl installed?)."

    umask 077
    cat >.env <<EOF
# Read by docker compose. Secrets: never share this file or commit it.
COMPOSE_PROFILES=app,tunnel
SITE_URL=https://$domain
API_URL=https://$api
ALLOW_INDEXING=true
INTERNAL_API_TOKEN=$internal_token
WORKER_TOKEN=$worker_token
BACKEND_URL=http://api:4100
TUNNEL_TOKEN=$tunnel_token
CLIENT_IP_HEADER=cf-connecting-ip
EOF
    umask 022
    echo "Saved to $APP_DIR/.env"
fi
# Only root reads the secrets, also in a .env written by hand or by an older version of this script.
chmod 600 .env

say "Building and starting the site (the first build takes a few minutes)"
APP_VERSION="$(git rev-parse --short HEAD)" docker compose up -d --build

site="$(grep '^SITE_URL=' .env | cut -d= -f2-)"
api="$(grep '^API_URL=' .env | cut -d= -f2-)"
say "Done"
cat <<EOF
The site is starting. In the Cloudflare Tunnel, the two public hostnames must point here:

  ${site#https://}  ->  HTTP  frontend:3100
  ${api#https://}  ->  HTTP  api:4100

Then open $site and look up a package: the first measurement of each takes a few seconds.

  docker compose ps                 what is running (run in $APP_DIR)
  docker compose logs -f api worker    what the API and the worker are doing (Ctrl+C stops watching, not the site)
  bash deploy/update.sh             install a new version
EOF
