#!/usr/bin/env python3
"""One-off: rebuild apps/api/.env and .env.example from a single canonical
template. .env keeps the real values; .env.example gets placeholders.
Only prints masked info (key names + value lengths) to stdout.
"""
import re
import sys

ENV_PATH = "apps/api/.env"
EXAMPLE_PATH = "apps/api/.env.example"

# ── 1. Read real values from the current .env ─────────────────────────────
values: dict[str, str] = {}
with open(ENV_PATH, encoding="utf-8") as f:
    for line in f:
        line = line.rstrip("\n")
        if not line.strip() or line.lstrip().startswith("#"):
            continue
        m = re.match(r"^([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)$", line)
        if m:
            key = m.group(1)
            val = m.group(2).strip().strip('"').strip("'")
            values.setdefault(key, val)

# ── 2. Canonical key set (matches packages/shared/src/schemas/api/env.ts) ─
KEEP = [
    "NODE_ENV",
    "APP_NAME",
    "APP_URL",
    "PORT",
    "DATABASE_URL",
    "JWT_ACCESS_SECRET",
    "JWT_ACCESS_EXPIRY",
    "JWT_REFRESH_SECRET",
    "JWT_REFRESH_EXPIRY",
    "EMAIL_VERIFICATION_SECRET",
    "BCRYPT_SALT_ROUNDS",
    "RESEND_API_KEY",
    "EMAIL_FROM_ADDRESS",
    "RESEND_WEBHOOK_SECRET",
    "EMAIL_TEST_TO",
]

PLACEHOLDER: dict[str, str] = {
    "NODE_ENV": "development",
    "APP_NAME": "LinkHub",
    "APP_URL": "http://localhost:3000",
    "PORT": "8080",
    "DATABASE_URL": "postgresql://postgres:postgres@localhost:5432/hello_world",
    "JWT_ACCESS_SECRET": "change-me-access-secret-32-chars-minimum",
    "JWT_ACCESS_EXPIRY": "15m",
    "JWT_REFRESH_SECRET": "change-me-refresh-secret-32-chars-minimum",
    "JWT_REFRESH_EXPIRY": "7d",
    "EMAIL_VERIFICATION_SECRET": "change-me-email-verify-secret-32-chars",
    "BCRYPT_SALT_ROUNDS": "12",
    "RESEND_API_KEY": "re_xxxxxxxxxxxxxxxxxxxxxxxxxxxxx",
    "EMAIL_FROM_ADDRESS": "noreply@example.com",
    "RESEND_WEBHOOK_SECRET": "whsec_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx",
    "EMAIL_TEST_TO": "you@example.com",
}

CORS_DEFAULT = "http://localhost:3000,http://localhost:3001,http://localhost:3003"

# ── 3. Canonical template (identical for both files) ──────────────────────
def build(real: bool) -> str:
    v = values if real else PLACEHOLDER
    email_test_to_line = f"EMAIL_TEST_TO={v['EMAIL_TEST_TO']}" if real else "# EMAIL_TEST_TO=you@example.com"
    lines = [
        "# ============================================",
        "# apps/api/.env — Freebuff API environment",
        "# Copy this file to apps/api/.env and fill in real values.",
        "# NEVER commit the real .env (it is git-ignored).",
        "# ============================================",
        "",
        "# ── App ──────────────────────────────────────",
        f"NODE_ENV={v['NODE_ENV']}",
        f"APP_NAME={v['APP_NAME']}",
        f"APP_URL={v['APP_URL']}",
        f"PORT={v['PORT']}",
        "",
        "# Comma-separated list of allowed frontend origins",
        "# (add your deployed domains here, e.g. https://app.example.com)",
        f"CORS_ORIGINS={CORS_DEFAULT}",
        "",
        "# ── Database (PostgreSQL) ────────────────────",
        f"DATABASE_URL={v['DATABASE_URL']}",
        "",
        "# ── Auth / JWT ───────────────────────────────",
        "# Secrets must be at least 32 characters.",
        f"JWT_ACCESS_SECRET={v['JWT_ACCESS_SECRET']}",
        f"JWT_ACCESS_EXPIRY={v['JWT_ACCESS_EXPIRY']}",
        f"JWT_REFRESH_SECRET={v['JWT_REFRESH_SECRET']}",
        f"JWT_REFRESH_EXPIRY={v['JWT_REFRESH_EXPIRY']}",
        f"EMAIL_VERIFICATION_SECRET={v['EMAIL_VERIFICATION_SECRET']}",
        f"BCRYPT_SALT_ROUNDS={v['BCRYPT_SALT_ROUNDS']}",
        "",
        "# ── Email (Resend) ───────────────────────────",
        f"RESEND_API_KEY={v['RESEND_API_KEY']}",
        f"EMAIL_FROM_ADDRESS={v['EMAIL_FROM_ADDRESS']}",
        "",
        "# Send mode: send (real Resend) | log-only (print) | noop (skip).",
        "# EMAIL_MODE=send",
        "",
        "# Dev-only: redirect EVERY outbound email to one inbox.",
        email_test_to_line,
        "",
        "# Reply-to appended to every outbound email.",
        "# EMAIL_REPLY_TO=hello@example.com",
        "",
        "# Delivery tuning",
        "# EMAIL_MAX_ATTEMPTS=3",
        "# EMAIL_TIMEOUT_MS=10000",
        "# EMAIL_RATE_LIMIT_PER_MINUTE=0",
        "",
        "# Required to receive Resend delivery webhooks (email.delivered / bounced / …).",
        f"RESEND_WEBHOOK_SECRET={v['RESEND_WEBHOOK_SECRET']}",
        "",
    ]
    return "\n".join(lines)

# ── 4. Sanity: every kept key must exist in the real .env ─────────────────
missing = [k for k in KEEP if k not in values]
if missing:
    print(f"ERROR: current .env is missing real values for: {missing}", file=sys.stderr)
    sys.exit(1)

# ── 5. Write both files ────────────────────────────────────────────────────
with open(ENV_PATH, "w", encoding="utf-8") as f:
    f.write(build(real=True))
with open(EXAMPLE_PATH, "w", encoding="utf-8") as f:
    f.write(build(real=False))

# ── 6. Masked verification output ──────────────────────────────────────────
print("=== .env written (masked) ===")
for line in build(real=True).splitlines():
    if line and not line.startswith("#"):
        key, _, val = line.partition("=")
        print(f"  {key} = <len {len(val)}>")
print("=== .env.example written (masked) ===")
for line in build(real=False).splitlines():
    if line and not line.startswith("#") and not line.startswith("EMAIL_TEST"):
        key, _, val = line.partition("=")
        print(f"  {key} = <len {len(val)}>")
print("=== key-set diff (should be identical) ===")
real_keys = {ln.split("=")[0] for ln in build(real=True).splitlines() if ln and not ln.startswith("#")}
ex_keys = {ln.split("=")[0] for ln in build(real=False).splitlines() if ln and not ln.startswith("#")}
print("  only in .env:        ", sorted(real_keys - ex_keys))
print("  only in .env.example:", sorted(ex_keys - real_keys))
