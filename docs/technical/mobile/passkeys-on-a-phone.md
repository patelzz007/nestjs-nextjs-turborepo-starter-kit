---
title: "Passkeys on a phone in development"
description: "Why a passkey made on localhost can't sign in to the phone app, and the full setup to make phone passkeys work in development on your own domain through a Cloudflare tunnel: hostnames, the asset-links file on the domain itself, the API's settings, the app's API address. Written for bishenpatel.com; nothing here is applied yet."
order: 5
author: "Platform Team"
lastUpdated: 1793865600000
coverImage: "https://images.unsplash.com/photo-1512941937669-90a1b58e7e9c?w=1200&h=630&fit=crop"
tags: ["mobile", "passkeys", "webauthn", "android", "cloudflare", "development"]
---

# Passkeys on a phone in development

**Status (2026-11-05): written, not applied.** You chose to document it first. Until it is set up, passkeys work in the
browser apps on `localhost`, and the phone says "Your phone couldn't complete the passkey. Try again, or use another
sign in method." That message is right: nothing is broken, the phone is refusing on purpose.

## Why the phone refuses

A passkey belongs to one domain, its **RP ID** (ADR 080). In development the RP ID is `localhost` (the API's
`COOKIE_DOMAIN`, as no `WEBAUTHN_RP_ID` is set). Browsers allow `localhost`; a phone app never does. Android
offers a domain's passkeys to an app only when the domain itself says so, in
`https://<RP ID>/.well-known/assetlinks.json`, naming the app's package and the SHA-256 fingerprint of its
signing certificate. `localhost` and a LAN address can't serve that over real HTTPS, so:

- a passkey made at `http://localhost:3001` can **never** be used by the phone app, and
- the phone can't make one either, until the RP ID is a real domain.

What it takes: a real HTTPS domain for the RP ID, every app (web, admin, merchant) on that domain or under it (the
API refuses to start otherwise), and the asset-links file on the RP ID's own host.

## The values for this project

| What | Value |
|---|---|
| Domain (Cloudflare, nameservers `zariyah` / `dion`) | `bishenpatel.com` |
| Existing named tunnel | `email-webhook` (`16d038ce-…`), config `~/.cloudflared/config.yml` (source: `apps/api/scripts/cloudflared-email-webhook.yml`), already serving `webhooks.bishenpatel.com` → `localhost:8080` |
| Hostnames for development | `api.bishenpatel.com` → 8080, `app.bishenpatel.com` → 3000, `admin.bishenpatel.com` → 3001, `merchant.bishenpatel.com` → 3003 (your choice; production will use other names) |
| RP ID | `bishenpatel.com` (the only domain the four share) |
| Android package | `com.example.starter` |
| Signing certificate (EAS keystore) | `7F:74:63:C6:BE:F0:EF:56:07:0B:3C:0D:8F:0A:E0:7E:2A:9A:D7:63:25:6F:C2:75:B9:3F:C7:6F:12:05:EB:10` |

The fingerprint was read from the EAS preview APK (`apksigner verify --print-certs <apk>`, "SHA-256 digest"). Every
EAS build of this project signs with that keystore. A local build signs with the debug key, a different fingerprint:
add it too (comma-separated) if you'll use a local build for this.

**Today the apex and every subdomain show a Cloudflare "Website is Coming Soon" page (a wildcard).** A DNS record for
one name overrides the wildcard for that name only, so the four subdomains are free to point at the tunnel. The apex
is the one choice to make (step 3).

## Step by step

### 1. Point the four hostnames at the tunnel

Add them to the tunnel's ingress, above the catch-all (edit `apps/api/scripts/cloudflared-email-webhook.yml`, then
copy it to `~/.cloudflared/config.yml` as its header says):

```yaml
ingress:
  - hostname: webhooks.bishenpatel.com
    service: http://localhost:8080
  - hostname: api.bishenpatel.com
    service: http://localhost:8080
  - hostname: app.bishenpatel.com
    service: http://localhost:3000
  - hostname: admin.bishenpatel.com
    service: http://localhost:3001
  - hostname: merchant.bishenpatel.com
    service: http://localhost:3003
  - service: http_status:404
```

Create their DNS records (once; each is a proxied CNAME to the tunnel, which overrides the coming-soon wildcard for
that name only):

```bash
cloudflared tunnel route dns email-webhook api.bishenpatel.com
cloudflared tunnel route dns email-webhook app.bishenpatel.com
cloudflared tunnel route dns email-webhook admin.bishenpatel.com
cloudflared tunnel route dns email-webhook merchant.bishenpatel.com
```

Run it with your dev stack: `cloudflared tunnel run email-webhook`.

### 2. The API's settings (`apps/api/.env`)

Keep a copy of the current file first (`cp apps/api/.env apps/api/.env.localhost`), so going back is one copy.

```dotenv
API_PUBLIC_URL=https://api.bishenpatel.com
APP_URL=https://app.bishenpatel.com
ADMIN_APP_URL=https://admin.bishenpatel.com
MERCHANT_APP_URL=https://merchant.bishenpatel.com
CORS_ORIGINS=https://app.bishenpatel.com,https://admin.bishenpatel.com,https://merchant.bishenpatel.com
COOKIE_DOMAIN=bishenpatel.com
WEBAUTHN_RP_ID=bishenpatel.com
WEBAUTHN_ANDROID_PACKAGE_NAME=com.example.starter
WEBAUTHN_ANDROID_CERT_FINGERPRINTS=7F:74:63:C6:BE:F0:EF:56:07:0B:3C:0D:8F:0A:E0:7E:2A:9A:D7:63:25:6F:C2:75:B9:3F:C7:6F:12:05:EB:10
```

The API then refuses to start if any app URL isn't under `bishenpatel.com` (ADR 080), and allows the Android app's
origin (`android:apk-key-hash:…`) for each fingerprint. `GET https://api.bishenpatel.com/api/v1/auth/passkeys/app-associations`
shows the two association files it will serve.

### 3. The asset-links file on the apex

Android fetches `https://bishenpatel.com/.well-known/assetlinks.json`, on the RP ID's own host. The web app serves it
(`apps/web/app/.well-known/assetlinks.json/route.ts`, from the API's settings above); the apex has to reach it. Two
ways:

| Way | What | Effect on the coming-soon page |
|---|---|---|
| A Cloudflare Worker (recommended) | A Worker on the route `bishenpatel.com/.well-known/*` that answers with `fetch("https://app.bishenpatel.com" + path)` | Kept for every other path of the apex |
| The apex through the tunnel | `cloudflared tunnel route dns email-webhook bishenpatel.com`, and an ingress `hostname: bishenpatel.com` with `path: ^/\.well-known/` → `http://localhost:3000` above the catch-all | Replaced on the apex while the record exists (other paths get the catch-all 404) |

Check it from anywhere: `curl https://bishenpatel.com/.well-known/assetlinks.json` lists `com.example.starter` with
the fingerprint. Google's checker: `https://digitalassetlinks.googleapis.com/v1/statements:list?source.web.site=https://bishenpatel.com&relation=delegate_permission/common.get_login_creds`.

### 4. The web apps (`apps/web/.env`, `apps/admin/.env`, `apps/merchant/.env`)

`NEXT_PUBLIC_API_URL=https://api.bishenpatel.com` in each, and their own URLs (`NEXT_PUBLIC_APP_URL`,
`NEXT_PUBLIC_WEB_URL`, `NEXT_PUBLIC_ADMIN_URL`, `NEXT_PUBLIC_MERCHANT_URL`) to the `https://….bishenpatel.com` names.

The dev servers (`next dev`) refuse their development resources (hot reload, `/_next/*` in dev) to a host that isn't
`localhost` unless it is listed in `allowedDevOrigins` (`next.config.ts`). Either add the four hostnames there (a code
change, best read from an environment variable so `localhost` stays the default), or run the apps built
(`pnpm build`, then `next start`) behind the tunnel.

### 5. The phone app

`EXPO_PUBLIC_API_URL=https://api.bishenpatel.com` in the `preview` profile of `apps/mobile/eas.json` (and
`EXPO_PUBLIC_ALLOW_LAN_HTTP_API` can go: the API is HTTPS now). The address is JavaScript only, so an OTA update
carries it to the installed preview build ([over-the-air-updates.md, Step 5](./over-the-air-updates.md#step-5-publish-the-update),
with the new URL). Dropping `EXPO_PUBLIC_ALLOW_LAN_HTTP_API` changes the native config: that needs a new build.

`MOBILE_PASSKEY_DOMAIN=bishenpatel.com` matters for iOS only (the `webcredentials:` entitlement).

### 6. Make the passkey again

Passkeys made on `localhost` stay `localhost` passkeys. Restart `pnpm dev` (the new `.env`), open
`https://admin.bishenpatel.com`, sign in, and add a passkey (Account → Security → Passkeys): it belongs to
`bishenpatel.com` now. If it's a synced passkey (Google Password Manager), the phone offers it at sign-in; or add one
from the phone (Settings → Security → Passkeys).

## Going back to localhost

Restore the `.env` copies (`cp apps/api/.env.localhost apps/api/.env`, same for the apps), restart `pnpm dev`. The DNS
records can stay (they only point at your Mac's tunnel) or go: `cloudflared tunnel route dns` has no delete, so
remove them in the Cloudflare dashboard (DNS → the four CNAMEs, and the Worker route if you made one).

## Later, for production

Production will use its own hostnames and its own RP ID. A passkey belongs to its RP ID, so if production's RP ID is
also `bishenpatel.com`, a phone may *offer* a development passkey on the production sign-in; it won't sign in (the
production database doesn't know it). Giving production its own RP ID (its own domain) keeps the two apart.
