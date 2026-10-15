#!/usr/bin/env python3
"""Start a cloudflared quick tunnel fully detached from the launching shell.

The double-fork + setsid trick creates a new session so the tunnel keeps
running after the terminal/shell that launched it exits. Quick tunnels are
ephemeral: every run gets a NEW `*.trycloudflare.com` URL (printed to the
log at /tmp/cloudflared.log and on stdout here).

Because the URL changes on EVERY run, this script also auto-wires the new
URL so webhooks keep working after a restart (laptop reboot, crash, manual
re-run):

1. The Resend delivery webhook endpoint is re-pointed to
   `<new-url>/notifications/email-webhook` via the Resend API (requires
   `RESEND_API_KEY` in `apps/api/.env`). Without this, `email.delivered`
   events silently die after every tunnel restart and statuses stick at
   "sent".

2. GitHub live pull-request updates are wired to `<new-url>/api/v1/github/webhook`
   (`pnpm --filter @workspace/api github:webhook-tunnel`): GITHUB_WEBHOOK_URL
   (and, if missing, GITHUB_WEBHOOK_SECRET) is written to apps/api/.env, and
   every repository already turned on is re-pointed on GitHub. Restart the API
   afterwards so it reads the new address.

None of the wiring is fatal: if a step fails (no API key, Resend down, …)
the tunnel still starts and the script prints the URL + the exact webhook
URL to paste manually in the Resend dashboard.
"""
from __future__ import annotations

import json
import os
import re
import subprocess
import sys
import time
import urllib.error
import urllib.request

API_ENV_PATH = os.path.normpath(os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", ".env"))
TUNNEL_URL_PATTERN = re.compile(r"https://[a-z0-9-]+\.trycloudflare\.com")
WEBHOOK_PATH = "/notifications/email-webhook"
TUNNEL_LOG_PATH = "/tmp/cloudflared.log"
# A quick tunnel must not read ~/.cloudflared/config.yml: when a NAMED tunnel is configured there, its
# ingress rules apply to the quick tunnel too, and its catch-all answers every *.trycloudflare.com
# request with 404. The quick tunnel gets this empty config instead.
QUICK_TUNNEL_CONFIG_PATH = "/tmp/cloudflared-quick-tunnel.yml"
# Resend sits behind Cloudflare's edge, which 403s the default
# `Python-urllib/3.x` User-Agent — send a real one so the API call passes.
HTTP_USER_AGENT = "start-tunnel.py (email-dev)"


def read_env_file(path: str) -> dict[str, str]:
    """Parse a KEY=VALUE env file (comments and blanks skipped, no quoting)."""
    values: dict[str, str] = {}
    try:
        with open(path, encoding="utf-8") as env_file:
            for line in env_file:
                stripped: str = line.strip()
                if not stripped or stripped.startswith("#") or "=" not in stripped:
                    continue
                key, _, value = stripped.partition("=")
                values[key.strip()] = value.strip()
    except OSError:
        pass
    return values


def patch_resend_webhook(api_key: str, webhook_url: str) -> None:
    """Re-point the Resend delivery webhook to the new tunnel URL.

    Finds the webhook whose endpoint ends in /notifications/email-webhook,
    then PATCHes its URL. If no matching webhook exists it warns and skips
    (never touches an unrelated webhook). Non-fatal.
    """
    list_endpoint: str = "https://api.resend.com/webhooks"
    headers: dict[str, str] = {"Authorization": f"Bearer {api_key}", "User-Agent": HTTP_USER_AGENT}
    try:
        request = urllib.request.Request(list_endpoint, headers=headers)
        with urllib.request.urlopen(request, timeout=15) as response:
            payload: dict[str, object] = json.loads(response.read().decode("utf-8"))
    except urllib.error.HTTPError as error:
        reason: str = error.read().decode("utf-8", errors="replace")[:200]
        print(f"WARN: cannot list Resend webhooks (HTTP {error.code}) — {reason}. Paste this URL in the Resend dashboard: {webhook_url}", flush=True)
        return
    except (urllib.error.URLError, OSError, json.JSONDecodeError) as error:
        print(f"WARN: cannot list Resend webhooks — {error}. Paste this URL in the Resend dashboard: {webhook_url}", flush=True)
        return

    data: object = payload.get("data", [])
    webhooks: list[object] = data if isinstance(data, list) else []
    target: object | None = None
    for webhook in webhooks:
        if isinstance(webhook, dict):
            endpoint: object = webhook.get("endpoint")
            if isinstance(endpoint, str) and endpoint.endswith(WEBHOOK_PATH):
                target = webhook
                break
    if not isinstance(target, dict):
        print(f"WARN: no Resend webhook ending in {WEBHOOK_PATH} found — skipping auto re-point so an unrelated webhook is never touched. Paste this URL in the Resend dashboard: {webhook_url}", flush=True)
        return

    webhook_id: object = target.get("id")
    if not isinstance(webhook_id, str) or len(webhook_id) == 0:
        print(f"WARN: webhook has no id. Paste this URL in the Resend dashboard: {webhook_url}", flush=True)
        return

    patch_endpoint: str = f"{list_endpoint}/{webhook_id}"
    # ⚠ Resend's update-webhook API field is `endpoint`, NOT `url`. Sending
    # `url` returns 2xx but is silently IGNORED — the endpoint never changes
    # (verified 2026-08-12). This caused every auto re-point to silently fail.
    body: bytes = json.dumps({"endpoint": webhook_url}).encode("utf-8")
    patch_headers: dict[str, str] = {
        **headers,
        "Content-Type": "application/json",
    }
    try:
        patch_request = urllib.request.Request(patch_endpoint, data=body, headers=patch_headers, method="PATCH")
        with urllib.request.urlopen(patch_request, timeout=15) as response:
            response.read()
    except urllib.error.HTTPError as error:
        reason: str = error.read().decode("utf-8", errors="replace")[:200]
        print(f"WARN: could not update Resend webhook ({webhook_id}) — HTTP {error.code}: {reason}. Paste this URL in the Resend dashboard: {webhook_url}", flush=True)
        return
    except (urllib.error.URLError, OSError) as error:
        print(f"WARN: could not update Resend webhook ({webhook_id}) — {error}. Paste this URL in the Resend dashboard: {webhook_url}", flush=True)
        return
    print(f"Resend webhook re-pointed → {webhook_url}", flush=True)


def auto_wire(tracking_url: str) -> None:
    """Re-point the Resend delivery webhook to the freshly-registered URL."""
    env_values: dict[str, str] = read_env_file(API_ENV_PATH)
    api_key: str | None = env_values.get("RESEND_API_KEY")
    if api_key:
        patch_resend_webhook(api_key, f"{tracking_url}{WEBHOOK_PATH}")
    else:
        print(f"WARN: RESEND_API_KEY not found in {API_ENV_PATH} — skipping webhook re-point. Paste this URL in the Resend dashboard: {tracking_url}{WEBHOOK_PATH}", flush=True)


def wire_github_webhooks(tracking_url: str) -> None:
    """Point GitHub live updates at the new tunnel (github-webhook-tunnel.ts). Non-fatal."""
    api_dir: str = os.path.dirname(API_ENV_PATH)
    try:
        # Through a shell: `pnpm` may be a shell script without a shebang (version managers, shims),
        # which Python cannot exec directly. The URL is passed as an argument, never interpolated.
        result = subprocess.run(["/bin/sh", "-c", 'pnpm --silent github:webhook-tunnel "$1"', "sh", tracking_url], cwd=api_dir, timeout=120, check=False)
    except (OSError, subprocess.TimeoutExpired) as error:
        print(f"WARN: could not wire GitHub live updates — {error}. Run: pnpm --filter @workspace/api github:webhook-tunnel {tracking_url}", flush=True)
        return
    if result.returncode != 0:
        print(f"WARN: wiring GitHub live updates failed (exit {result.returncode}). Run: pnpm --filter @workspace/api github:webhook-tunnel {tracking_url}", flush=True)


def wait_for_tunnel_url(timeout_seconds: int = 30) -> str | None:
    """Poll the cloudflared log until a tunnel URL appears (newest match)."""
    deadline: float = time.time() + timeout_seconds
    while time.time() < deadline:
        try:
            with open(TUNNEL_LOG_PATH, encoding="utf-8") as log_file:
                content: str = log_file.read()
            matches = TUNNEL_URL_PATTERN.findall(content)
            if matches:
                return matches[-1]
        except FileNotFoundError:
            pass
        time.sleep(1)
    return None


def spawn_cloudflared() -> None:
    """Double-fork + setsid so the tunnel outlives the launching shell.

    Only the DETACHED children exit here (via os._exit so they never unwind
    the caller's stack); the ORIGINAL process returns to main() so it can
    wait for the URL and auto-wire the Resend webhook. Without this, the
    script exited inside this function and the webhook was never re-pointed
    after every tunnel restart — orphaning it on a dead URL.
    """
    pid: int = os.fork()
    if pid > 0:
        return
    os.setsid()
    pid2: int = os.fork()
    if pid2 > 0:
        os._exit(0)
    with open(QUICK_TUNNEL_CONFIG_PATH, "w", encoding="utf-8") as config_file:
        config_file.write("# Quick tunnel: no ingress rules — everything goes to --url.\n")
    subprocess.Popen(
        [
            "cloudflared",
            "--config",
            QUICK_TUNNEL_CONFIG_PATH,
            "tunnel",
            "--url",
            "http://localhost:8080",
            "--no-autoupdate",
            "--protocol",
            "http2",
            "--region",
            "us",
            "--logfile",
            TUNNEL_LOG_PATH,
        ],
        stdout=subprocess.DEVNULL,
        stderr=subprocess.DEVNULL,
        stdin=subprocess.DEVNULL,
        start_new_session=True,
    )
    os._exit(0)


def main() -> int:
    spawn_cloudflared()

    url: str | None = wait_for_tunnel_url()
    if url is None:
        print("Tunnel started but no URL registered within 30s — check /tmp/cloudflared.log", flush=True)
        return 1

    print(f"Tunnel URL: {url}", flush=True)
    print(f"Webhook URL: {url}{WEBHOOK_PATH}", flush=True)
    auto_wire(url)
    wire_github_webhooks(url)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
