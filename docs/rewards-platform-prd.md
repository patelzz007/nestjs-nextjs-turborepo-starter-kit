---
title: "Rewards Platform — Phase 1 PRD"
tags: ["rewards", "prd", "planning", "roadmap"]
description: "Locked product requirements from grill rounds 1–7: consumer marketplace, merchant portal, referrals, and admin moderation for the Malaysia pilot."
order: 90
author: "Acme Inc."
lastUpdated: 1788134400000
coverImage: "https://images.unsplash.com/photo-1556742049-0cfed4f6a45d?auto=format&fit=crop&w=1600&q=80"
---

# Rewards Platform — Phase 1 PRD (Locked via Grill Rounds 1–7)

> **Status:** Planning artifact from product grill sessions. Not implemented in this repo yet.
> **API contract:** `docs/rewards-platform-openapi.yaml`
> **Pilot geography:** Malaysia — Kuala Lumpur + Melaka (dual-city, not single-city).
> **Monorepo target:** Extend `hello-world` (`apps/api`, `apps/web`, `apps/merchant`, `apps/admin`, `packages/shared`).

---

## 1. Product summary

A **multi-merchant rewards marketplace** where:

- Consumers browse/search rewards, **claim with SMS OTP**, and show a **one-time QR** (or backup code) at the store.
- Merchants create rewards (invite-only onboarding), pass **moderation or auto-publish after 24h**, and redeem via **POS API** or **POS Simulator** in `apps/merchant`.
- **Referrals** credit the referrer when the referee **redeems** (not on claim), granting a separate referrer reward **R′** from a **per-campaign pool**.
- Platform admin lives in **`apps/admin`** (moderation, KYB review, invites, monitoring).

**Phase 1 is free** — no billing code. Redemption counts may be tracked for future monetization.

---

## 2. Apps & domains

| App | Audience | Phase 1 scope |
|-----|----------|-----------------|
| `apps/web` | Consumers | Browse, search, claim+OTP, My Rewards, QR + backup code |
| `apps/merchant` | Owner, cashier | Reward CRUD, referral config, API keys (owner), redemptions list, **POS Simulator** |
| `apps/admin` | Platform admin | Invites, moderation queue, KYB review, auto-publish oversight |
| `apps/api` | All | NestJS REST API |

Extend existing auth: **User**, **RBAC**, **RLS** patterns from hello-world. **Merchant org + members** (owner | cashier). Same human may switch **consumer vs merchant** context; **self-redeem at own org allowed** (audit logged). **Same-org referral credit allowed** (growth, not fraud prevention).

---

## 3. Core user flows

### 3.1 Consumer claim

1. Sign up / login: **email + password** (no phone at signup).
2. Browse rewards: **text search + category**; optional **Google Places city/area** filter (session token; **no lat/lng stored in DB**).
3. Select reward → first claim prompts **phone number** → **Twilio SMS OTP** (6 digits, 5-minute TTL).
4. OTP verified → atomic: `quantity_reserved += 1`, `quantity_remaining -= 1`, create `Claim(pending)`, generate opaque token + **8-char backup code**.
5. Show **full-screen QR** + backup code; countdown to `claim_expires_at`.
6. **CAPTCHA** after **2 failed OTP** attempts.

### 3.2 Redemption (POS or Simulator)

1. `POST /v1/redemptions/validate` — preview only + **audit log** (`merchant.scan_qr`).
2. Merchant confirms → `POST /v1/redemptions/confirm` with `token`, `idempotencyKey`, headers `Authorization: Bearer <api_key>`, `X-Terminal-Id: <terminal_id>`.
3. First confirm: `Claim` pending → redeemed, insert `Redemption`. Second confirm same token: **409**.
4. **Strict idempotency:** same token + **different** `idempotencyKey` → **409** (sloppy integrator protection).

### 3.3 Merchant publish

1. `draft` → `pending_review` on publish request.
2. **Admin approve** → `published` OR **auto-publish after 24h** if no action.
3. **Notify admin + merchant** on auto-publish.
4. KYB fields collected at onboarding; **no auto-block** on publish in Phase 1.

### 3.4 Referral

1. Referrals **on by default** per reward; merchant must set **referral pool** or **disable**.
2. When referrals enabled, system **auto-clones R → R′** (merchant edits R′ title only); `referrer_reward_id` set automatically.
3. Share link: `?ref={attribution_token}` on reward URL; **7-day** cookie attribution window.
4. Referee B redeems consumer reward R.
3. If referral not blocked (device/IP heuristic) and `referral_pool_remaining > 0`:
   - Decrement pool
   - Auto-create `Claim(pending)` on **R′** for referrer A
   - **Email (Resend) + in-app** notification (DB + bell UI, unread count) to A
4. R′ claim expires **30 days** after credit. Pool empty → B still redeems; A gets nothing.
5. **Terms + Privacy** must be accepted before **first claim** (not signup-only).

**Referral blocks (Phase 1):**

- Same device fingerprint or IP within **7 days** → block credit
- **Same-org referral allowed** (owner can refer friends to own store)

**Device fingerprint:** FingerprintJS client → hash stored server-side.

---

## 4. State machines

### Reward status

```
draft → pending_review → published (admin approve)
                      → published (auto after 24h, NOTIFY admin + merchant)
published → expired (expiry_date)
published → disabled (admin/merchant)
```

### Claim status

```
pending → redeemed (POS confirm, first time)
pending → expired (claim_expires_at passed → release inventory)
```

**No `validated` status** (dropped).

**claim_expires_at:**

```
min(claimed_at + 7 days, reward.expiry_date)
```

### Inventory on claim / expire / redeem

| Event | quantity_remaining | quantity_reserved |
|-------|-------------------|-------------------|
| Claim (after OTP) | −1 | +1 |
| Expire pending claim | +1 | −1 |
| Redeem | no change | −1 |

`quantity_remaining` excludes reserved quantity. Assert `quantity_remaining >= 0` on claim.

### Referral pool (on parent reward R)

| Event | referral_pool_remaining |
|-------|-------------------------|
| Referrer credited | −1 (if > 0) |
| Create reward | set from required `referral_pool_total` |

---

## 5. Data model (Prisma-oriented)

### User

| Field | Notes |
|-------|-------|
| id | |
| email | unique |
| password_hash | |
| phone | nullable until first claim |
| phone_verified_at | nullable |
| full_name | |
| status | active \| suspended |
| created_at, last_login_at | |

### MerchantOrg

| Field | Notes |
|-------|-------|
| id | |
| business_name, legal_name | |
| category | |
| address_text | no lat/lng in Phase 1 |
| city | KL or Melaka (pilot) |
| kyb_status | pending \| approved \| rejected |
| kyb_fields | JSON |
| status | onboarding \| active \| suspended |
| contact_email, contact_phone | |

### MerchantMember

| Field | Notes |
|-------|-------|
| user_id, org_id | |
| role | owner \| cashier |

**Cashier Phase 1:** view redemptions + POS Simulator scan. **Owner:** API keys, CRUD, staff.

### MerchantApiKey

| Field | Notes |
|-------|-------|
| org_id | |
| key_hash | never store plaintext |
| name | |
| revoked_at | nullable |
| created_by_user_id | |

### MerchantTerminal (optional audit)

| Field | Notes |
|-------|-------|
| org_id | |
| terminal_id | external string from POS header |
| label | |

### Reward (consumer reward R)

| Field | Notes |
|-------|-------|
| merchant_org_id | |
| title, description | |
| reward_type | discount \| free_item only in Phase 1 |
| rules | JSON (min_spend, etc.) |
| quantity_total | |
| quantity_remaining | |
| quantity_reserved | |
| start_date, expiry_date | |
| status | draft \| pending_review \| published \| expired \| disabled |
| redemption_count, claim_count | |
| metadata | images URLs Phase 1.5 |
| referrals_enabled | default true |
| referral_pool_total | **required if referrals_enabled** |
| referral_pool_remaining | |
| referrer_reward_id | FK → Reward R′ |
| claim_count, redemption_count | |

### Reward R′ (referrer reward)

Separate `Reward` row linked as referrer target. Same schema. **30-day expiry** applied to auto-claims on R′.

### Claim

| Field | Notes |
|-------|-------|
| user_id, reward_id | |
| referral_id | nullable |
| redemption_token_hash | SHA-256(opaque token) |
| backup_code_hash | SHA-256(8-char code) |
| status | pending \| redeemed \| expired |
| claimed_at, claim_expires_at | |
| redeemed_at | nullable |

### Redemption

| Field | Notes |
|-------|-------|
| claim_id | |
| merchant_org_id | |
| user_id | |
| terminal_id | from header |
| redemption_method | scan \| manual (backup code) |
| idempotency_key | |
| redeemed_at | |

### Referral

| Field | Notes |
|-------|-------|
| referrer_user_id, referee_user_id | |
| reward_id | parent R |
| attribution_token | link/QR tracking |
| status | pending \| credited \| blocked |
| referee_device_hash, referee_ip | |
| credited_at | nullable |

### OtpChallenge

| Field | Notes |
|-------|-------|
| user_id, phone | |
| purpose | claim |
| code_hash | |
| expires_at | 5 min from issue |
| attempts | |
| failed_attempts | CAPTCHA after 2 |

### AuditEvent

| Field | Notes |
|-------|-------|
| actor_user_id | nullable |
| org_id | nullable |
| action | e.g. merchant.scan_qr, self_redeem, referral.blocked |
| metadata | JSON |
| created_at | |

### Notification

| Field | Notes |
|-------|-------|
| user_id | |
| type | e.g. referrer_reward_credited |
| title, body | |
| read_at | nullable |
| metadata | JSON (claim_id, reward_id) |
| created_at | |

### UserLegalAcceptance

| Field | Notes |
|-------|-------|
| user_id | |
| terms_version, privacy_version | |
| accepted_at | before first claim |

---

## 6. API surface (Phase 1)

### Auth (extend existing)

- `POST /auth/signup`, `POST /auth/login`, `GET /auth/me`
- Mode switch: consumer vs merchant member context

### Consumer

| Method | Path | Auth |
|--------|------|------|
| GET | `/v1/rewards` | optional user |
| GET | `/v1/rewards/:id` | optional user |
| POST | `/v1/claims/otp` | user JWT |
| POST | `/v1/claims` | user JWT + OTP |
| GET | `/v1/claims` | user JWT (My Rewards) |
| GET | `/v1/claims/:id/qr` | user JWT |
| GET | `/v1/notifications` | user JWT |
| POST | `/v1/notifications/read` | user JWT |
| POST | `/v1/legal/accept` | user JWT (before first claim) |

### Merchant dashboard

| Method | Path | Auth |
|--------|------|------|
| CRUD | `/v1/merchant/rewards` | merchant member |
| POST | `/v1/merchant/rewards/:id/publish` | owner |
| CRUD | `/v1/merchant/api-keys` | owner |
| GET | `/v1/merchant/redemptions` | owner, cashier |

### POS (public integrator + Simulator)

Headers: `Authorization: Bearer <api_key>`, `X-Terminal-Id: <terminal_id>`

| Method | Path | Body |
|--------|------|------|
| POST | `/v1/redemptions/validate` | `{ "token" }` or `{ "backupCode" }` |
| POST | `/v1/redemptions/confirm` | `{ "token" \| "backupCode", "idempotencyKey" }` |

**Validate:** read-only state except **audit log** write.

**Confirm responses:**

- 200 first success
- 409 already redeemed / token+key mismatch
- 422 expired / wrong merchant / invalid token

### Admin

| Method | Path | Notes |
|--------|------|-------|
| POST | `/v1/admin/invites` | merchant invite |
| GET | `/v1/admin/rewards/pending` | moderation queue |
| POST | `/v1/admin/rewards/:id/approve` | |
| POST | `/v1/admin/rewards/:id/reject` | |
| PATCH | `/v1/admin/merchants/:id/kyb` | |

---

## 7. QR & backup code

- **Opaque token** (32+ bytes CSPRNG), URL-safe; QR encodes token or deep link.
- Store **SHA-256** only in DB.
- **8-character backup code:** uppercase `A–Z` + `2–9`, exclude `0/O/1/I`.
- **Max 5 failed backup attempts per claim** → lock 15 minutes.
- **One-time use** via atomic `pending → redeemed`; replay → 409.
- No JWT in QR payload.

### Reward images (Phase 1)

**Stock placeholders by category** — no merchant uploads.

---

## 8. Integrations

| Service | Use | Phase 1 |
|---------|-----|---------|
| **Twilio** | SMS OTP at claim | Malaysia numbers |
| **Resend** | Transactional email | claim, redeem, referrer credit |
| **Google Places** | City/area autocomplete filter | session token, no DB geo |
| **FingerprintJS** | Referral device heuristic | consumer web |

### Email templates (Resend)

1. Claim confirmed
2. Redemption confirmed
3. Referrer reward credited (+ in-app notification)

---

## 9. Environments & infrastructure

| Env | Purpose |
|-----|---------|
| **local** | dev; rate limits **in-memory** |
| **staging** | Twilio/Places test keys, **POS Simulator mandatory** pre-prod gate; Redis rate limits |
| **production** | KL + Melaka pilot; Redis rate limits |

**Cron / jobs:** **BullMQ + Redis** — auto-publish, claim expiry, R′ expiry, email retries.

**Monitoring:** structured logs + **Sentry** (defer Prometheus/Grafana).

**Merchant onboarding:** admin invite email → **onboarding wizard** (business info + KYB fields).

---

## 10. Feature flags (ENV)

```bash
REFERRALS_ENABLED=true
AUTO_PUBLISH_HOURS=24
SMS_CLAIM_OTP_ENABLED=true
CAPTCHA_AFTER_OTP_FAILURES=2
```

---

## 11. Events (Phase 1 — log to table)

**User:** signup, login, view_reward, claim_reward, redeem_reward

**Merchant:** create_reward, publish_reward, scan_qr (validate audit), redeem_reward, api_key_created, api_key_revoked

**Admin:** approve_reward, reject_reward, kyb_review, invite_merchant

**System:** reward.auto_published, reward.claim_expired, referral.credited, referral.blocked, reward.low_quantity

---

## 12. RBAC summary

| Role | Capabilities |
|------|----------------|
| Consumer | browse, claim, view own claims |
| Cashier | view redemptions, POS Simulator |
| Owner | + reward CRUD, publish, API keys, invite cashier |
| Platform admin | invites, moderation, KYB, platform flags |

---

## 13. Phase 1 reward types

| reward_type | Redemptions per claim |
|-------------|----------------------|
| discount | 1 |
| free_item | 1 |

Defer: cashback, points (need ledger).

---

## 14. Disaster recovery

**RPO ≤ 24h, RTO ≤ 24h** — daily backups, managed Postgres. Document runbooks before pilot.

---

## 15. Out of scope (Phase 1)

- Native mobile apps (responsive web)
- PWA install prompt
- GPS “near me” / lat/lng in DB
- Public partner OAuth for third-party claim
- Stripe / billing
- Points/cashback ledger
- Multi-level referrals
- Real POS vendor integration (parallel track; **Simulator ships in Phase 1**)
- LaunchDarkly / DB feature flags
- Auto-block on KYB for publish

---

## 16. Success criteria (pilot)

- 2 merchants (KL + Melaka), invite-only
- Consumers claim with SMS OTP and redeem via Simulator or POS API
- Referral E2E: redeem → pool decrement → R′ auto-claim → notify A
- Zero double-redemption under concurrent confirm (tests required)
- Staging gate: Simulator validate + confirm before prod
- 3 transactional emails + in-app referrer notification

---

## 17. Malaysia pilot notes

- **Cities:** Kuala Lumpur, Melaka — dual-city filter default or city picker
- **SMS:** Twilio Malaysia regulatory registration before prod
- **Privacy:** PDPA — SMS, fingerprint, referral attribution in Privacy Policy
- **Currency display:** MYR (convention; no payments in Phase 1)

---

## 18. Open parallel track

**POS vendor integration** — no vendor signed yet. Phase 1 ships **REST API + POS Simulator** as reference implementation. Vendor plugin follows same validate/confirm contract.

---

## 19. Week 1 engineering order

1. Prisma schema + migrations (entities above)
2. Inventory math tests (claim / expire / redeem)
3. Claim + OTP (Twilio sandbox) + QR token generation
4. Redemption validate/confirm + idempotency
5. Reward CRUD + publish + auto-publish cron
6. Staging + Simulator UI
7. Referral on redeem + pool + R′ auto-claim
8. Resend templates
9. Admin moderation + invites

---

## 20. Round 7 decisions (summary)

| Topic | Decision |
|-------|----------|
| In-app notifications | DB table + bell + unread count |
| R′ creation | Auto-clone R when referrals enabled |
| Backup code | 8 char, no ambiguous chars; 5 fails → 15 min lock |
| Referral share | `?ref=` query param, 7-day cookie |
| Images | Category placeholders only |
| Crons | BullMQ + Redis |
| Legal | Accept Terms + Privacy before first claim |
| Rate limits | In-memory local; Redis dev/staging/prod |
| Monitoring | Structured logs + Sentry |

---

## 22. Prisma schema

**Location:** `apps/api/prisma/schema.prisma` (rewards section appended to existing schema).

**Run migration:**

```bash
cd apps/api && pnpm db:migrate:create
# name: rewards_platform_phase1
pnpm db:migrate
```

RLS policies for new tables must be added in migration SQL (see `docs/prisma.md` §10).

**Zod:** `packages/shared/src/schemas/domain/rewards.ts` (exported from `@workspace/shared`).

**Seed:** `apps/api/prisma/seed/rewards.ts` — run via `pnpm db:seed` after migrate + `pnpm db:rls`.

---

## 21. Round 8 decisions (engineering defaults)

| Question | Decision |
|----------|----------|
| R′ inventory on auto-clone | **Mirror parent pool** — R′ gets `quantity_total` / `quantity_remaining` = `referral_pool_total` at clone; sync when pool updated on draft R. Pool decrement is still the business gate before credit; R′ inventory uses same reserve-on-claim math for auto-claims. **Not unlimited.** |
| Persist `ref` at signup | **Yes** — store `pending_attribution_token` on User at signup (from `?ref=` or cookie). Create `Referral(pending)` when B claims matching reward; clear token after bind. Cookies alone fail in mobile in-app browsers. |
| BullMQ jobs + retries | Queues: `rewards.auto-publish`, `claims.expire-pending`, `claims.expire-referrer`, `email.send`. Retries: **email 5 attempts** (exponential backoff); **expiry jobs 3 attempts** (idempotent); **auto-publish 3 attempts**. Failed jobs → BullMQ failed set + **Sentry error** on terminal failure. |
| Sentry | **One Sentry project**, separate by `environment` (`local`, `staging`, `production`). Same DSN with env tag for Phase 1; split projects only if staging alert noise becomes a problem. |

---

*Generated from grill rounds 1–7. Update this doc when decisions change.*
