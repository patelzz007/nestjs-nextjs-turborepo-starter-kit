---
title: "Auth Roadmap"
description: "Ideas and design decisions for improving authentication, authorization, and multi-tenancy — plus the 30-point hardening deep-dive and the A→Z authentication flow."
order: 9
author: "Acme Inc."
lastUpdated: "2026-08-05"
coverImage: "https://images.unsplash.com/photo-1526374965328-7f61d4dc18c5?auto=format&fit=crop&w=1600&q=80"
---

# Auth Roadmap

> [!NOTE] Ideas and design decisions for improving authentication, authorization, and multi-tenancy.
>
> **Jump to:** [📊 Status at a glance](#-status-at-a-glance) · [A. Security hardening](#a-security-hardening-api-core) · [B. API & protocol](#b-api--protocol) · [C. Client & apps](#c-client--apps) · [🆕 Beyond the 30](#-beyond-the-30--additional-enhancements) · [🧸 The auth flow A→Z](#-the-authentication-flow-from-a-to-z-explained-like-im-5)

---

## 🛠 15 Improvements (refine what exists)

### 1. Passwordless / Magic Link Login

Add a `POST /auth/magic-link` endpoint that emails a one-time sign-in link. User clicks → auto-authenticated. Great UX for users who hate passwords.

### 2. OAuth 2.0 / Social Login (Google, GitHub, Apple)

Let users authenticate with existing accounts. Reduces signup friction. Apple is mandatory for iOS apps; Google/GitHub covers most web users.

Implementation pattern:

- New `provider` and `providerId` fields on `User` (schema already has these — unused)
- `POST /auth/oauth/:provider` — redirects to provider
- `GET /auth/oauth/:provider/callback` — handles the callback, creates/links account

### 3. WebAuthn / Passkeys (Passwordless)

Replace passwords entirely with platform biometrics (Face ID, Touch ID, Windows Hello). Uses [`@simplewebauthn/server`](https://github.com/MasterKale/SimpleWebAuthn). Future-proof and phishing-resistant.

### 4. Session Revocation Dashboard (Admin)

Full admin UI showing ALL active sessions across ALL users. SuperAdmin can terminate any session remotely. Useful for security incidents.

### 5. Geographic Login Alerts

When a login occurs from a new country/city, email the user: _"Was this you? New login from Tokyo, Japan."_ Paired with a suspicious login flag.

### 6. Device Fingerprinting

Hash browser/device characteristics (user-agent, screen resolution, timezone) to recognize trusted devices. Skip 2FA on known devices.

### 7. Password Expiry Policy

Force password rotation every N days (configurable per role via RBAC). Admin sets policy; users get warning emails before expiry.

### 8. Idle Session Timeout

Auto-logout users after X minutes of inactivity. Configurable per role (e.g., Admin: 30min, SuperAdmin: 15min). Uses a "last activity" timestamp + periodic check.

### 9. Concurrent Session Limit

Limit how many devices a user can be logged in on simultaneously (e.g., 3 sessions max). Oldest session gets invalidated when limit is exceeded.

### 10. IP Whitelist / Allowlist

Restrict login to specific IP ranges for admin/SuperAdmin accounts. Useful for internal enterprise deployments.

### 11. Audit Trail for Auth Events

Log every auth action (login success/failure, password change, 2FA setup, impersonation) to a dedicated `audit_log` table. Essential for SOC2/compliance.

### 12. CAPTCHA / Turnstile Integration

Add [Cloudflare Turnstile](https://www.cloudflare.com/products/turnstile/) or Google reCAPTCHA v3 to login/signup forms. Block automated brute force at the network level (not just app-level rate limiting).

### 13. Password Breach Detection (Have I Been Pwned)

Check passwords against the [HIBP API](https://haveibeenpwned.com/API/v3) during signup/password change. Prevent users from using compromised passwords.

### 14. WebAuthn Backup Codes

When enabling passkeys, generate 10 one-time backup codes. User can use a backup code to log in if they lose their device. Each code is single-use.

### 15. Rate Limit Dashboard

Admin panel showing current rate limit state: which users are throttled, remaining requests, reset timers. Useful for debugging "I can't log in" complaints.

---

## 🚀 15 New Features (expand auth capabilities)

### 1. Two-Factor Authentication (TOTP)

Support authenticator apps (Google Auth, Authy, 1Password). QR code enrollment → 6-digit code verification at login. Use [`otplib`](https://github.com/yeojz/otplib).

### 2. SMS / Phone Verification

Collect and verify phone numbers via OTP. Useful for account recovery and high-risk operations.

### 3. API Token Management UI

Let users create/manage/revoke API tokens with granular scopes (read-only, write, admin). Current seed generates keys, but there's no user-facing UI.

### 4. Role-Based Session Duration

Different max session lengths per role: User = 7 days, Admin = 1 day, SuperAdmin = 4 hours. Refresh token TTL becomes role-aware.

### 5. Emergency Access / Break Glass

SuperAdmin can temporarily escalate a support agent's role for 24 hours (logged, requires justification, sends email alert). For critical production incidents.

### 6. Step-Up Authentication

Require BOTH password AND biometric for high-risk actions (deleting users, changing RBAC). TOTP verification for sensitive operations.

### 7. Account Deletion Flow (GDPR)

Full "right to be forgotten" pipeline: user requests deletion → grace period (30 days) → soft delete → permanent purge after 90 days. Required for GDPR compliance.

### 8. Suspicious Login Detection

Heuristic scoring: new IP + new device + new location + unusual time = high score. High-score logins trigger email alert + require email verification to proceed.

### 9. SCIM Provisioning

Enterprise feature: automatically create/update/delete users when they're added/removed from the company's IdP (Okta, Azure AD, Google Workspace). Required for B2B enterprise sales.

### 10. Invite-Only Signup

Admin generates invite links (with expiry). Only invited emails can sign up. Common for beta/SaaS products. Links are single-use + time-bound.

### 11. Remember Me / Trust This Device

Login page has "Remember this device for 30 days" checkbox. Sets a long-lived device cookie that bypasses 2FA on future logins from the same device.

### 12. Account Linking (Merge)

Link multiple auth methods to one account: Google OAuth + password + passkey. User can use any method to log in and access the same data.

### 13. JWKS Endpoint / Public Key Rotation

Serve public keys at `/.well-known/jwks.json`. Support key rotation without invalidating existing tokens. Required if third-party services validate your JWTs.

### 14. Login History Page

User-facing page showing last 50 logins with: timestamp, IP, device, location, success/failure. Empowers users to spot unauthorized access.

### 15. Multi-Tenant Organization (detailed below)

Full org-scoped data isolation with shared user base.

---

## 🏢 Multi-Tenancy Design

### Core Principle: Always Multi-Tenant at the DB Level

The backend is **always multi-tenant by design**. Single-tenancy is simply the case where there's exactly one organization. You never maintain two code paths.

### Data Model

```prisma title="schema.prisma"
model Organization {
  id        String   @id @default(uuid())
  name      String   @db.VarChar(200)
  slug      String   @unique @db.VarChar(100)   // "joes-burger" or "acme-corp"
  isActive  Boolean  @default(true)
  plan      Plan     @default(FREE)
  settings  Json?                              // Per-org config
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt

  users User[]
  urls  Url[]
  tags  Tag[]
  // ... other tenant-scoped models
}

model User {
  id             String    @id @default(uuid())
  organizationId String    @map("organization_id")    // ← Required FK — always set
  organization   Organization @relation(fields: [organizationId], references: [id])

  email        String      @unique
  fullName     String
  passwordHash String
  // ... existing fields ...
  // NOTE: email is unique globally. If you want per-org unique emails,
  // change to: @@unique([organizationId, email])
}
```

Every tenant-scoped data table gets `organizationId`:

```prisma title="schema.prisma"
model Url {
  id             String  @id @default(uuid())
  organizationId String  @map("organization_id")    // ← Direct FK for perf
  userId         String  @map("user_id")
  organization   Organization @relation(fields: [organizationId], references: [id])
  user           User        @relation(fields: [userId], references: [id])
  // ...
}
```

### ⚠️ The "Default Org" Problem — And Why We Don't Use It

**Bad approach (don't do this):**

```typescript
// ❌ Never hardcode "default"
if (!tenantConfig.enabled) {
	request.organizationId = "default"; // ← All data tagged "default" forever
}
```

**Why it's bad:** If you start with a single tenant (Joe's Burger), all URLs, API keys, clicks get `organization_id = "default"`. Two years later, if you add multi-tenancy for a second restaurant, you can't split "default" into "Joe's" vs "Bob's" — it's all mixed together. Reports are meaningless.

**Correct approach — Real org name from day one:**

```env title=".env"
# .env  ← Set this during project setup
DEFAULT_ORG_NAME=Joe's Burger
DEFAULT_ORG_SLUG=joes-burger
```

Or prompt during seed:

```bash
$ pnpm run seed
> Enter your organization name: Joe's Burger
> Enter your organization slug: joes-burger
```

```typescript
// seed.ts
const orgName = process.env.DEFAULT_ORG_NAME || "Default";
const org = await prisma.organization.create({
	data: { name: orgName, slug: slugify(orgName) },
});
```

This way, even a single-tenant POS has a **real org name**. All data is tagged `"Joe's Burger"` from the start. If you later add a second restaurant, the reports are perfectly clean:

```sql
-- Reports work correctly from day one
SELECT organization_id, COUNT(*) FROM urls GROUP BY organization_id;
-- Result: joes-burger | 1523
```

### Middleware: How Orgs Are Injected

```typescript
// tenant.middleware.ts
@Injectable()
export class TenantMiddleware implements NestInterceptor {
	intercept(context: ExecutionContext, next: CallHandler) {
		const req = context.switchToHttp().getRequest();
		const orgSlug = tenantConfig.enabled
			? req.headers["x-organization-slug"] // Multi-tenant: from header
			: process.env.DEFAULT_ORG_SLUG; // Single-tenant: from env

		req.organizationSlug = orgSlug;
		return next.handle();
	}
}
```

### Prisma Middleware: Auto-Scoping

```typescript
prisma.$use(async (params, next) => {
	const orgId = getCurrentOrganizationId(); // from AsyncLocalStorage

	if (TENANT_MODELS.includes(params.model!)) {
		if (params.action === "create") {
			params.args.data.organizationId = orgId;
		}
		if (params.action.startsWith("find") || params.action === "aggregate") {
			params.args.where = { ...params.args.where, organizationId: orgId };
		}
	}
	return next(params);
});
```

### Developer Experience Comparison

| Activity           | Joe's Burger (1 org)                          | Acme Corp (N orgs)                            |
| ------------------ | --------------------------------------------- | --------------------------------------------- |
| **First setup**    | Set `DEFAULT_ORG_NAME=Joe's Burger` in `.env` | Set `TENANCY_ENABLED=true`                    |
| **Seed**           | Creates 1 org with real name                  | Creates N orgs from config                    |
| **Backend code**   | Same `prisma.url.findMany()`                  | Identical code                                |
| **Middleware**     | Reads `DEFAULT_ORG_SLUG` from env             | Reads `x-organization-slug` header            |
| **Frontend**       | No org picker, straight to dashboard          | Org picker on login + switch in sidebar       |
| **Reports**        | `GROUP BY organization_id` → "Joe's Burger"   | `GROUP BY organization_id` → "Acme Corp" etc. |
| **Migration path** | Already tagged with real name                 | Already tagged with real name                 |

### Migration: Adding Org to Existing Data

Since this repo already has seeded data, here's the migration plan:

**Step 1:** Create `Organization` table + add `organizationId` FK to `User` (nullable initially)

**Step 2:** Backfill:

```sql
INSERT INTO organizations (id, name, slug)
VALUES (gen_random_uuid(), 'Legacy', 'legacy');

UPDATE users SET organization_id = (SELECT id FROM organizations WHERE slug = 'legacy');
UPDATE urls SET organization_id = u.organization_id FROM users u WHERE urls.user_id = u.id;
-- ... same for api_keys, tags, clicks, etc.

ALTER TABLE users ALTER COLUMN organization_id SET NOT NULL;
```

**Step 3:** Update seed to create an org with the name from env:

```typescript
const orgName = process.env.DEFAULT_ORG_NAME || "Legacy";
```

### Summary

```
                ┌─────────────────────────────────┐
                │         THIS REPO                │
                │  (always has organizations)      │
                └──────┬────────────────┬─────────┘
                       │                │
              ┌────────▼─────┐   ┌──────▼──────────┐
              │ Single-Tenant │   │  Multi-Tenant    │
              │ 1 org         │   │ N orgs           │
              │ Real name     │   │ Real names       │
              │ from .env     │   │ from header      │
              └────────────── ┘   └──────── ─────────┘
                       │                   │
              Same code • Same schema • Same API
```

The key insight: **never hardcode "default"**. Always use a real org name, even in single-tenant mode. This keeps your data clean, your reports useful, and your migration path open.

---

## 🔐 Secrets Management (Live Config Store)

### The Problem

Environment variables (`RESEND_API_KEY`, `JWT_ACCESS_SECRET`, etc.) are read at process startup from `.env` or the actual environment. If someone compromises the Resend account, the only way to rotate the key is to redeploy the entire application. There's no UI to view or change them.

### Solution: Database-Backed Secrets with Encryption at Rest

```
                    ┌──────────────────────┐
                    │   Admin Panel         │
                    │  SuperAdmin UI        │
                    └────────┬─────────────┘
                             │ PATCH /admin/secrets/:key
                             ▼
┌──────────────────────────────────────────────────┐
│                SecretsController                  │
│  GET  /admin/secrets       → list all (masked)   │
│  GET  /admin/secrets/:key  → view decrypted      │
│  PATCH /admin/secrets/:key → update value        │
│  POST /admin/secrets/:key/re-encrypt → re-key    │
└──────────────────────┬───────────────────────────┘
                       │
                       ▼
┌──────────────────────────────────────────────────┐
│                SecretsService                     │
│  - read from DB → decrypt → return               │
│  - encrypt → write to DB                         │
│  - audit log every change                        │
│  - update in-memory cache (no restart needed)    │
└──────────────────────┬───────────────────────────┘
                       │
          ┌────────────┴────────────┐
          ▼                         ▼
┌────────────────────┐    ┌──────────────────────────┐
│  secrets table      │    │  process.env             │
│  (encrypted at rest)│    │  (fallback/override)     │
│  ────────────────   │    │                          │
│  RESEND_API_KEY     │    │  RESEND_API_KEY=xxx      │
│  [encrypted]        │    │  JWT_ACCESS_SECRET=yyy   │
│  ────────────────   │    └──────────────────────────┘
│  JWT_ACCESS_SECRET  │
│  [encrypted]        │
└────────────────────┘
```

### Data Model

```prisma title="schema.prisma"
model Secret {
  id          String   @id @default(uuid())
  key         String   @unique @db.VarChar(200)  // "RESEND_API_KEY"
  value       String   @db.Text                  // encrypted value (hex)
  iv          String   @db.Text                  // AES-GCM IV
  tag         String   @db.Text                  // AES-GCM auth tag
  hint        String?  @db.VarChar(20)           // first 4 chars, e.g. "re_5a"
  isEncrypted Boolean  @default(true)
  isMasked    Boolean  @default(true)            // show **** by default
  updatedBy   String?  @map("updated_by")       // user ID who last changed it
  updatedAt   DateTime @updatedAt
  createdAt   DateTime @default(now())

  @@map("secrets")
}

model SecretAuditLog {
  id        String   @id @default(uuid())
  secretKey String   @map("secret_key")       // "RESEND_API_KEY"
  action    String                             // "VIEWED" | "UPDATED" | "ROTATED"
  actorId   String   @map("actor_id")
  createdAt DateTime @default(now())

  @@index([secretKey])
  @@index([actorId])
  @@index([createdAt])
  @@map("secret_audit_logs")
}
```

### Encryption Layer

```typescript
// secrets.service.ts
@Injectable()
export class SecretsService {
	private readonly algorithm = "aes-256-gcm";

	// Master key is NEVER stored in DB — it stays in process.env
	private get masterKey(): Buffer {
		return crypto.scryptSync(process.env.SECRETS_MASTER_KEY ?? "change-me-in-production", "static-salt", 32);
	}

	public encrypt(plaintext: string): { encrypted: string; iv: string; tag: string } {
		const iv = crypto.randomBytes(16);
		const cipher = crypto.createCipheriv(this.algorithm, this.masterKey, iv);
		let encrypted = cipher.update(plaintext, "utf8", "hex");
		encrypted += cipher.final("hex");
		return { encrypted, iv: iv.toString("hex"), tag: cipher.getAuthTag().toString("hex") };
	}

	public decrypt(encrypted: string, iv: string, tag: string): string {
		const decipher = crypto.createDecipheriv(this.algorithm, this.masterKey, Buffer.from(iv, "hex"));
		decipher.setAuthTag(Buffer.from(tag, "hex"));
		let decrypted = decipher.update(encrypted, "hex", "utf8");
		decrypted += decipher.final("utf8");
		return decrypted;
	}
}
```

### Config Resolution Chain

The existing `TypedConfigService` stays **synchronous** — no changes needed in any service that injects it. An in-memory cache is populated from the DB on startup and hot-reloaded when the admin updates a value.

```typescript
@Injectable()
export class TypedConfigService implements OnModuleInit {
	private cache = new Map<string, string>();

	async onModuleInit() {
		// Load all DB secrets into cache on startup
		const dbSecrets = await this.prisma.secret.findMany();
		for (const s of dbSecrets) {
			this.cache.set(s.key, this.decrypt(s.value, s.iv, s.tag));
		}
	}

	// Called by SecretsService after admin update → no restart needed
	public refreshSecret(key: string, decryptedValue: string): void {
		this.cache.set(key, decryptedValue);
	}

	// Same synchronous getter — all existing services are unaffected
	public get resendApiKey(): string {
		return this.cache.get("RESEND_API_KEY") ?? process.env.RESEND_API_KEY ?? "";
	}

	public get jwtAccessSecret(): string {
		return this.cache.get("JWT_ACCESS_SECRET") ?? process.env.JWT_ACCESS_SECRET ?? "access-secret-change-me";
	}

	// ... all other getters follow the same pattern
}
```

### Admin UI Mockup

```
┌──────────────────────────────────────────────────────┐
│  🔐 Secrets Management               [Audit Log ▼]  │
├──────────────────────────────────────────────────────┤
│                                                      │
│  ┌──────────────────────────────────────────────┐    │
│  │ RESEND_API_KEY              ********         │    │
│  │ Updated 2 days ago by superadmin             │    │
│  │                              [View] [Rotate] │    │
│  └──────────────────────────────────────────────┘    │
│                                                      │
│  ┌──────────────────────────────────────────────┐    │
│  │ JWT_ACCESS_SECRET             ********       │    │
│  │ Updated 30 days ago by superadmin            │    │
│  │                              [View] [Rotate] │    │
│  └──────────────────────────────────────────────┘    │
│                                                      │
│  ┌──────────────────────────────────────────────┐    │
│  │ EMAIL_FROM_ADDRESS        noreply@my....     │    │
│  │ From .env (not in DB)                        │    │
│  │                              [Add to DB]     │    │
│  └──────────────────────────────────────────────┘    │
└──────────────────────────────────────────────────────┘
```

- **Masked view**: Shows `****` by default or first 4 chars as a hint
- **View**: Requires SuperAdmin re-auth (enter password) → shows plaintext for 30 seconds
- **Rotate**: Generates a new random value (for JWT secrets) or opens an input field (for API keys)
- **Audit Log**: Every view and update is logged with timestamp + actor ID

### API Endpoints

| Method  | Endpoint                         | Description                      |
| ------- | -------------------------------- | -------------------------------- |
| `GET`   | `/admin/secrets`                 | List all secrets (masked values) |
| `GET`   | `/admin/secrets/:key`            | Get single secret (decrypted)    |
| `PATCH` | `/admin/secrets/:key`            | Update secret value              |
| `POST`  | `/admin/secrets/:key/re-encrypt` | Re-encrypt with new master key   |
| `GET`   | `/admin/secrets/audit-log`       | View change history              |

All endpoints are `@SuperAdminOnly()`.

### Security Considerations

| Concern                            | Mitigation                                                                 |
| ---------------------------------- | -------------------------------------------------------------------------- |
| **Master key compromise**          | Single point of failure. Rotate by re-encrypting all secrets with new key  |
| **DB dump leaks encrypted values** | AES-256-GCM is computationally infeasible to crack without master key      |
| **Rogue admin views secrets**      | Re-auth required to view plaintext. All views logged                       |
| **Master key in .env**             | Same threat model as existing `RESEND_API_KEY` in `.env` — no regression   |
| **Cache poisoning**                | Only `SecretsService` writes to cache, only admin endpoints trigger writes |

### Migration: Existing Env Vars → DB Secrets

```typescript
// seed or migration script
const SYNC_KEYS = ["RESEND_API_KEY", "EMAIL_FROM_ADDRESS", "JWT_ACCESS_SECRET"];

for (const key of SYNC_KEYS) {
	const envValue = process.env[key];
	if (envValue) {
		const { encrypted, iv, tag } = secretsService.encrypt(envValue);
		await prisma.secret.upsert({
			where: { key },
			update: { value: encrypted, iv, tag },
			create: { key, value: encrypted, iv, tag, hint: envValue.slice(0, 4) },
		});
	}
}
```

This makes the deployment process: push code → set env vars → run seed → secrets are in DB. Admin can then change them from the UI without redeploying.

---

## 🧱 30 Boilerplate Features (make the template "whole")

### 1. Subscription & Billing (Stripe)

Full subscription lifecycle: plans → checkout → webhooks → usage metering → invoices. Sync Stripe products with the DB `plan` field on User. Handle trialing, active, past_due, canceled states.

**Schema:** `Subscription`, `Invoice`, `Price` models.
**Endpoints:** `POST /billing/checkout` → redirects to Stripe → webhook handles `checkout.session.completed`.

### 2. File Uploads & Media Storage

Upload avatars, images, documents to S3-compatible storage (AWS S3, Cloudflare R2, MinIO). Signed URLs for secure access. Resize images on upload via Sharp.

**Schema:** `Media` model (url, mimeType, size, userId).
**Endpoints:** `POST /uploads` → returns signed URL.

### 3. Background Jobs / Queue

Process long-running tasks (email sending, report generation, data sync) asynchronously. Use BullMQ with Redis. Dashboard to view failed/retried jobs.

**Pattern:** `@Processor('email')` + `@Process()` decorators.
**UI:** Bull Board for queue monitoring.

### 4. Real-Time Notifications (WebSockets / SSE)

Push live updates to the frontend: "Someone just clicked your link", "Your export is ready". Use NestJS Gateways with Socket.IO. Room-based (per user, per org).

**Schema:** `Notification` model (type, payload, readAt).
**Endpoints:** Socket.IO events, not REST.

### 5. Full-Text Search

Search URLs, tags, users, logs instantly. Use PostgreSQL `tsvector` + `tsquery` (no extra infra) or MeiliSearch for typo-tolerant search.

**Migration:** Add `GIN INDEX` on searchable columns.
**Endpoints:** `GET /search?q=keyword` → unified results.

### 6. Webhook System

Let users register webhook URLs that get called when events happen (url.created, click.recorded). Retry with exponential backoff. Signature verification.

**Schema:** `Webhook` + `WebhookEvent` models.
**Endpoints:** `POST /webhooks` → register; `GET /webhooks/:id/logs` → delivery history.

### 7. Data Export / Import

Export URLs, clicks, logs as CSV or Excel. Import bulk URLs via CSV upload. Async processing with background jobs + email notification when done.

**Endpoints:** `POST /exports` → triggers job; `GET /exports/:id/download` → signed URL.

### 8. Usage Tracking & Metering

Track API calls, storage used, active users per org. Enforce plan limits at the middleware level. Send warning emails at 80% / 100% usage.

**Schema:** `UsageRecord` model (orgId, metric, value, period).
**Middleware:** Checks limit before every create operation.

### 9. Feature Flags

Toggle features on/off per org or globally without redeploying. A/B test new features with a percentage rollout.

**Schema:** `FeatureFlag` model (key, enabled, orgId?, percentage?).
**Service:** `FeatureFlagService.isEnabled('new-dashboard', orgId)`.

### 10. Audit Log (Full System)

Log every CRUD operation across the entire app: who did what, when, and the before/after state. Required for SOC 2.

**Schema:** `AuditLog` model (actorId, action, resource, resourceId, before, after, ipAddress).
**Middleware:** Prisma `$use` hook that auto-logs all mutations.

### 11. Activity Feed

User-facing timeline showing relevant events: "You created URL abc", "Alice joined the team", "Your export is ready". Like GitHub's dashboard feed.

**Endpoints:** `GET /feed` → paginated activity items.

### 12. Email Template Previews

Store email templates in the DB (HTML + text). Admin can edit and preview them without redeploying. Variables like `{{appName}}`, `{{userName}}`.

**Schema:** `EmailTemplate` model (key, subject, htmlBody, textBody).
**UI:** Preview pane showing rendered template.

### 13. In-App Notification Center

Bell icon UI component. Dropdown shows recent unread notifications. Mark as read, mark all as read, paginated history page.

**Schema:** Connected to the Notification model above.
**Endpoints:** `PATCH /notifications/:id/read`, `GET /notifications`.

### 14. Internationalization (i18n)

Backend error messages, email templates, and Swagger descriptions in multiple languages. NestJS i18n module for backend; next-intl or react-i18next for frontend.

**Pattern:** `@I18nLang()` decorator + JSON translation files.

### 15. Dark Mode / Theme System

Persistent theme preference (light / dark / system). CSS variables driven by tailwind classes. Saved in user preferences.

**Schema:** `User.preferences` JSON field.
**Cookie:** Theme preference accessible server-side for SSR.

### 16. Responsive Admin Dashboard Template

Pre-built admin pages: dashboard stats, user management, audit log viewer, settings. Mobile-responsive sidebar, data tables with sorting/filtering.

**Tech:** shadcn/ui Sidebar component + TanStack Table.

### 17. Onboarding Wizard

First-time user flow: create profile → create first URL → invite team → done. Track completion steps per user.

**Schema:** `User.onboardingCompleted` + `User.onboardingStep` fields.
**Endpoints:** `GET /onboarding/status`, `PATCH /onboarding/step`.

### 18. API Versioning Strategy

`/api/v1/urls`, `/api/v2/urls` — maintain backward compatibility. Version middleware reads `Accept-version` header or URL prefix.

**Pattern:** NestJS `setGlobalPrefix('api/v1')` + versioned controllers.

### 19. Health Check Dashboard

Full system health: DB connection, Redis, S3, external APIs (Resend, Stripe). Latency history, uptime percentage, last 100 checks.

**Endpoints:** `GET /health` → extends current endpoint with deps.
**UI:** Admin panel with green/red indicators.

### 20. Error Tracking & Reporting

Catch unhandled exceptions, group by stack trace, show frequency and affected users. Store in `ErrorGroup` table for dashboard viewing.

**Schema:** `ErrorGroup` + `ErrorEvent` models (already partially exists in `Log` model).
**Interceptor:** Global exception filter that captures + groups errors.

### 21. Performance Monitoring

Track endpoint response times (p50, p95, p99), DB query times, external API call times. Store as time-series metrics for dashboard charts.

**Interceptor:** `@Monitor()` decorator that records duration.
**Schema:** `Metric` model (name, value, tags, timestamp).

### 22. Database Backup & Restore

Automated backup scripts (pg_dump to S3). Scheduled via cron. Restore from backup URL. L計 migration rollback strategy.

**Scripts:** `pnpm run db:backup`, `pnpm run db:restore`.

### 23. Docker Compose for Local Dev

One-command startup: PostgreSQL + Redis + API + Web + Admin. No manual setup needed.

**Files:** `docker-compose.yml`, `Dockerfile.api`, `Dockerfile.web`.

### 24. CI/CD Pipeline Templates

GitHub Actions workflows for: lint → typecheck → test → build → deploy. Preview deployments for PRs.

**Files:** `.github/workflows/ci.yml`, `.github/workflows/deploy.yml`.

### 25. E2E Test Suite (Playwright)

End-to-end tests for critical flows: signup → login → create url → logout. Auth cookie setup for authenticated pages.

**Pattern:** `tests/e2e/auth.spec.ts`, `tests/e2e/urls.spec.ts`.

### 26. Unit Test Patterns & Factories

Test factories for User, URL, ApiKey — reusable across all tests. Mock Prisma with `@nestjs/testing` + in-memory PostgreSQL.

**Factories:** `createUserFactory(overrides?)`, `createUrlFactory()`.

### 27. OpenAPI Client SDK Generation

Generate TypeScript client from Swagger JSON. Published as `@workspace/api-client`. Type-safe API calls for the frontend.

**Tool:** `openapi-typescript-codegen` or `openapi-generator`.

### 28. Data Seeding Scripts

Modular seed files: `seed/users.ts`, `seed/urls.ts`, `seed/analytics.ts`. Each independently runnable. Reset specific modules without full reseed.

**Commands:** `pnpm run seed:users`, `pnpm run seed:analytics`.

### 29. Documentation Site

Standalone docs site (Nextra or Docusaurus) with API reference, architecture decisions, deployment guide, and contributing guide.

**Structure:** `docs/` as a separate Next.js app in the monorepo.

### 30. Changelog / Release Notes

Auto-generated changelog from conventional commits. Release workflow that tags + publishes + posts to Slack/Discord.

**Tool:** `changesets` or `standard-version`.

---

## Priority Matrix

Deciding what to build first? Here's a rough priority by impact vs effort:

| Quadrant                            | Features                                                                              |
| ----------------------------------- | ------------------------------------------------------------------------------------- |
| **⚡ High impact, Low effort**      | E2E tests, CI/CD, Docker Compose, Feature flags, Health dashboard                     |
| **🎯 High impact, Medium effort**   | File uploads, Audit log, In-app notifications, Subscription billing, Full-text search |
| **🏗️ Medium impact, Medium effort** | Webhooks, Data export, Activity feed, Email templates, OpenAPI client SDK             |
| **🚀 High impact, High effort**     | Real-time notifications, i18n, Background jobs, Performance monitoring                |

----------------------------------------------------- Update after API integration -----------------------------------------------------

# Auth System Roadmap

> [!NOTE] Last updated: July 30, 2026
> Auth architecture: JWT access + refresh tokens, httpOnly cookie isolation (web vs admin), RBAC permissions

---

## 15 Enhancements (improving what exists)

### 1. Rate-limit recovery headers on login

**Problem:** When login is rate-limited, the client has no idea when to retry.
**Enhancement:** Return `Retry-After` header on 429 ThrottlerException. The login form could show "Too many attempts. Try again in X seconds."

### 2. Soft logout (invalidate session without clearing cookies)

**Problem:** Logout clears cookies immediately. If the API call fails (network blip), the user
still gets logged out on the frontend but the session remains valid on the backend.
**Enhancement:** Add a "soft logout" path — clear client state first, then fire-and-forget the
API call. If the API call fails, the session expires naturally.

### 3. Expose session metadata on the `/auth/me` response

**Problem:** `/auth/me` currently returns only user data. The client can't tell which device
this session belongs to.
**Enhancement:** Include `sessionId`, `deviceInfo`, `ipAddress`, `createdAt` alongside the user
profile. The hello page / dashboard could show "This session started 2h ago from Chrome on macOS."

### 4. Add `scope` / `purpose` claim to refresh tokens

**Problem:** Refresh tokens are all-purpose. If a refresh token leaks, it can be used to
obtain new access tokens from anywhere.
**Enhancement:** Bind the refresh token to its intended use (e.g., `purpose: "session_refresh"`).
Future enhancements could restrict refresh scope (e.g., a refresh token obtained from the web
app can only be refreshed from the web app).

### 5. Add session-level `lastUsedAt` to the session list

**Problem:** The sessions list shows `createdAt` and `expiresAt` but not `lastUsedAt`. Users
can't tell which sessions are active vs stale.
**Enhancement:** Update `lastUsedAt` on each token refresh. Show it in the sessions endpoint.

### 6. Invalidate all sessions on password change

**Problem:** Currently, changing the password only revokes refresh tokens. The user's existing
API requests with still-valid access tokens continue to work until they expire.
**Enhancement:** Add an `tokenVersion` field to the User model. Increment it on password change.
Include the version in JWT claims. The AuthGuard checks it on every request and rejects stale
tokens immediately.

### 7. Add email change flow

**Problem:** No way to change the email address. Users who need to update their email must
contact an admin.
**Enhancement:** Add a `PATCH /auth/email` endpoint that requires current password + email
verification of the new address (same token mechanism as signup verification).

### 8. Step-up authentication for sensitive operations

**Problem:** Admin operations (user unlock, impersonate) rely solely on the access token.
If the access token is compromised, an attacker can perform any admin action.
**Enhancement:** Require re-authentication (current password) for sensitive operations.
Add a `step_up_at` claim to the JWT that records when the user last confirmed their identity.

### 9. Add login history (audit trail)

**Problem:** The impersonation module has audit logs, but regular login/logout events
are not persisted beyond application logs.
**Enhancement:** Create a `LoginAuditLog` model. Log every login attempt (success/failure),
logout, and token refresh with IP, device, and user ID.

### 10. Add device fingerprinting to sessions

**Problem:** Sessions are identified by `deviceInfo` (user-agent string) which is easy to
spoof.
**Enhancement:** Generate a device fingerprint hash on the frontend (screen dimensions, timezone,
installed fonts — via a library like `fingerprintjs`). Send it as a header. Store it alongside
the session. Flag sessions with mismatched fingerprints.

### 11. Make cookie names configurable via env vars

**Problem:** Cookie names are hardcoded in constants. Deploying with different cookie names
for different environments (staging vs production) requires code changes.
**Enhancement:** Read cookie name overrides from environment variables
(`ACCESS_TOKEN_COOKIE_NAME`, `REFRESH_TOKEN_COOKIE_NAME`, etc.) with the hardcoded defaults
as fallback.

### 12. Add consistent error codes to all auth exceptions

**Problem:** Some exceptions return error codes (`ACCESS_TOKEN_MISSING`, `REFRESH_TOKEN_INVALID`)
while others only return a human-readable `message`. Frontend error handling must parse strings.
**Enhancement:** Add a structured `error` field to every auth-related exception. Define an enum
of all possible auth error codes. Document them in Swagger.

### 13. Add JWT revocation list for emergency

**Problem:** If a breach is detected, there's no way to revoke tokens other than waiting
for them to expire or dropping the database.
**Enhancement:** Add a `TokenBlacklist` model (JWT `jti` + `expiresAt`). Check it in the
AuthGuard on every request. Add a `POST /auth/revoke-all` SuperAdmin endpoint.

### 14. Move refresh token rotation to a Prisma transaction

**Problem:** `refreshToken` in `auth.service.ts` updates the token record, but the update
and the reuse-detection check aren't wrapped in a transaction. A race condition could allow
two concurrent refreshes from the same token.
**Enhancement:** Wrap the update + reuse check in `prisma.$transaction()`. Add
`$transaction` isolation for concurrent refresh scenarios.

### 15. Add JWT audience / issuer validation

**Problem:** The application doesn't set `aud` or `iss` claims on generated tokens. A token
generated for one environment could theoretically be used on another.
**Enhancement:** Set `audience` and `issuer` in `JwtModule.register()` and validate them
in both `verifyAccessToken` and `verifyRefreshToken`.

---

## 15 New Features (extending capability)

### 1. Multi-tenant organization isolation

**Feature:** Add an `Organization` model with `orgId` FK on the `User` model. All data
queries filter by `orgId`. The AuthService reads the user's org on login and includes
`orgId` in the JWT claims.
**API shape:** `GET /auth/orgs/switch/:orgId` (switch active org for cross-org users)

### 2. WebAuthn / Passkey authentication

**Feature:** Add FIDO2 WebAuthn as a passwordless login option. Register passkeys on
the `/auth/webauthn/register` endpoint. Login via `/auth/webauthn/authenticate`.
**Backend:** Store `credentialId`, `publicKey`, and `counter` per user. Verify signatures
using the WebAuthn spec.
**Frontend:** Use `@simplewebauthn/browser` for credential creation and assertion.

### 3. TOTP two-factor authentication (2FA)

**Feature:** Add optional TOTP-based 2FA. Users enable it via `/auth/2fa/setup` (returns
a `otpauth://` URI and QR code). Login with 2FA sends a short-lived `2fa_token` on
password verification, then the client completes login with `/auth/login/2fa`.
**Backend:** Store TOTP secret encrypted in the database. Verify codes with `otplib`.

### 4. Backup codes for 2FA recovery

**Feature:** When enabling 2FA, generate 8 one-time backup codes (hashed with bcrypt).
Store them alongside the TOTP secret. A `?use_backup_code` flag on the 2FA endpoint
consumes and invalidates the code.
**Frontend:** Show backup codes once after setup. Warn the user to save them securely.

### 5. OAuth2 / Social login (Google, GitHub, Microsoft)

**Feature:** Add Passport.js strategies for Google, GitHub, and Microsoft. After OAuth
callback, either link to an existing account (if the email matches) or create a new user.
**API shape:** `GET /auth/oauth/:provider`, `GET /auth/oauth/:provider/callback`

### 6. Account linking (merge OAuth + password accounts)

**Feature:** Allow users with the same verified email to link their OAuth and password
accounts. After linking, they can log in with either method.
**API shape:** `POST /auth/link/oauth` (authenticated), `POST /auth/unlink/:provider`

### 7. API key management for programmatic access

**Feature:** Allow users to generate long-lived API keys for headless access. Keys have
their own rate limits and scope restrictions. Stored as bcrypt hashes.
**API shape:** `POST /api-keys`, `GET /api-keys`, `DELETE /api-keys/:id`
**Auth:** A dedicated `ApiKeyGuard` that reads the key from `Authorization: Bearer <key>`
and attaches the same `AccessTokenPayload` to the request.

### 8. Session management UI (web + admin)

**Feature:** Build a session management page showing all active sessions with device info,
IP, last used time, and "Revoke" button. Also add "Revoke all other sessions" (keep current).
**API shape:** `GET /auth/sessions`, `DELETE /auth/sessions/:id`, `DELETE /auth/sessions/others`

### 9. Email template management

**Feature:** Move email templates (verification, password reset, account locked, etc.) to
a database table or file-based system so they can be customized without code changes.
**API shape:** `GET /admin/email-templates`, `PATCH /admin/email-templates/:name`
**Backend:** Read templates from the database. Support Handlebars or EJS for variable
interpolation.

### 10. IP allowlisting for admin access

**Feature:** Allow SuperAdmins to define a list of trusted IPs / CIDR ranges for admin panel
access. Logins from outside the allowlist are rejected with a specific error code.
**API shape:** `POST /admin/ip-allowlist`, `GET /admin/ip-allowlist`
**Enforcement:** A guard that checks `request.ip` against the allowlist before allowing
admin routes.

### 11. Concurrent session limit configuration

**Feature:** Allow per-role or per-user configuration of max concurrent sessions. When a
user exceeds the limit, the oldest session is automatically revoked (log out least recently
used device).
**API shape:** `PATCH /admin/users/:id/session-limit`
**Enforcement:** Check in `login()` after creating a new refresh token — if count exceeds
limit, soft-delete the oldest token.

### 12. Account deletion flow (GDPR)

**Feature:** Add a self-service account deletion flow. User requests deletion → account is
flagged `isDeleted` → 30-day grace period → permanent anonymization via a cron job.
**API shape:** `POST /auth/delete-account`, `POST /auth/cancel-deletion`
**Backend:** A scheduled job that processes users with `deletedAt + 30 days < now()`.

### 13. Password breach detection (haveibeenpwned)

**Feature:** On signup and password change, hash the password with SHA-1 and check the
first 5 characters against the HaveIBeenPwned API (k-anonymity model). Reject commonly
compromised passwords.
**Enhancement:** This is purely a backend change — no new API shape needed. The `k-anonymity`
model never sends the full password hash to the external API.

### 14. Idle session timeout

**Feature:** Automatically log out sessions that have been idle for a configurable period
(e.g., 30 minutes for web, 15 minutes for admin). Track `lastActivityAt` on the session.
**Frontend:** Send periodic heartbeat pings to `/auth/heartbeat` while the user is active.
**Backend:** A guard that checks `lastActivityAt` and rejects requests past the threshold.

### 15. Rate-limited email notifications (cooldown)

**Feature:** Prevent email floods by enforcing a per-user cooldown on notification emails.
If a user triggers 5 account-locked alerts in an hour (e.g., brute force from multiple IPs),
only send the first email. Subsequent alerts are logged but not emailed.
**Backend:** A `NotificationCooldownService` that checks `EmailAuditLog` before sending.
The cooldown window and max-per-window are configurable via env vars.

---

----------------------------------------------------- Shipped: Auth hardening batch (August 2026) -----------------------------------------------------

# ✅ Auth Hardening — 5 Features Shipped

> [!NOTE] Five items from the roadmap above were designed, implemented, and shipped together as the
> **auth hardening batch**. This section is the source of truth for how they were built — the
> implementation notes, the files involved, and the do's and don'ts that keep the machinery
> from regressing.
>
> Deep-dive companion: [Token Refresh — How It Works](./token-refresh.md) covers the two
> refresh layers (proxy + client), the dead-session/transient-failure handling, and the
> observability story these features plug into.

---

### 26. Auth error-code mapping + i18n-ready catalog (P1)

**What:** A single, shared, typed catalog of canonical auth error codes that the API emits and
both frontends map to friendly, locale-ready messages. Also preserves the lockout payload
(`lockedUntil` / `remainingSeconds`) on `ACCOUNT_LOCKED` so the UI can render a live countdown.

**How it was implemented:**

- `packages/shared/src/schemas/auth-errors.ts` — `AuthErrorCodeSchema` (a zod enum of the 15
  canonical codes: `INVALID_CREDENTIALS`, `ACCOUNT_LOCKED`, `ADMIN_ACCESS_REQUIRED`,
  `EMAIL_NOT_VERIFIED`, `ACCESS_TOKEN_*`, `REFRESH_TOKEN_*`, `TOKEN_THEFT_DETECTED`,
  `USER_NOT_FOUND`, `ACCOUNT_IS_INACTIVE`, `ACCOUNT_DELETED`, `SUPER_ADMIN_REQUIRED`) plus a
  `LockedErrorCodeSchema` literal. Backend and both frontends import from the same package, so
  the set can never drift.
- `packages/shared/src/schemas/message.ts` — `ErrorResponseSchema` (`.strict()`) gained
  **optional** `lockedUntil` / `remainingSeconds` fields so `ACCOUNT_LOCKED` payloads pass
  strict validation.
- `apps/api/src/modules/auth/auth.service.ts` — the login path now throws structured errors:
  `ACCOUNT_LOCKED` (with `lockedUntil` + `remainingSeconds` when `user.lockedUntil > now`) and
  `INVALID_CREDENTIALS` for bad credentials.
- `packages/client/src/lib/use-api.ts` — a real `ApiError` class that preserves `error` (the
  canonical code), `statusCode`, and the lockout fields. Previously these were flattened into a
  generic `Error` and the code was lost.
- `packages/client/src/lib/auth-errors.ts` — `resolveAuthErrorMessage(error, locale = "en")`
  (catalog lookup → server message → generic fallback), `isAccountLockedError()` (type guard
  that narrows to a lockout-payload error), `extractAuthErrorMessage()`.
- Both login forms (web + admin) call `resolveAuthErrorMessage` and, when
  `isAccountLockedError`, render `<LockoutCountdown>` instead of a static message.

**✅ Do:**

- Key user-facing wording on the **stable `error` code**, never on the server's raw `message`
  (server copy is technical and inconsistent).
- Add a new locale by adding **one catalog object** to `AUTH_MESSAGE_CATALOGS` — the resolver
  already takes a `locale` param, so nothing downstream changes.
- Keep the catalog type complete: `AuthMessageCatalog` is `Record<AuthErrorCode, string>`, so
  TypeScript forces an entry for every code.

**❌ Don't:**

- Don't surface raw server strings as the primary UX text — keep the friendly catalog as the
  single place the apps own the wording.
- Don't swallow `ApiError` back into a plain `Error` in request paths — that's what discards
  the code and lockout payload this feature exists to preserve.

---

### 27. Password UX affordances (P3)

**What:** Richer password fields on both login forms: show/hide toggle, caps-lock warning, a
0–4 strength meter with a checklist, and a live lockout countdown for locked accounts.

**How it was implemented:**

- `packages/ui/src/components/form/password-input.tsx` — show/hide toggle (eye icon) + caps-lock
  warning driven by `getModifierState("CapsLock")` on keydown.
- `packages/ui/src/components/form/password-strength-meter.tsx` — a meter bar + label + unmet-
  criteria checklist.
- `packages/ui/src/components/form/lockout-countdown.tsx` — live "retry in MM:SS" countdown fed by
  the `remainingSeconds` on an `ACCOUNT_LOCKED` error.
- `packages/client/src/lib/password.ts` — `passwordStrength()` pure helper (tested) that scores
  0–4 by how many of five criteria are met. The criteria **deliberately mirror** `strongPassword`
  in the shared package (length 8+, upper, lower, digit, special) so UI feedback and server
  validation can never disagree.
- Wired into the web and admin login forms (fields + meter + countdown).

**✅ Do:**

- Keep the UI scoring rules byte-identical to the server's validation rules — a meter that
  says "Strong" for a password the API rejects is a UX bug.
- Treat an empty password as score 0 and derive `percent = score * 25` for a stable bar width.

**❌ Don't:**

- Don't disable the browser's password manager by fighting `autoComplete` — keep
  `autoComplete="current-password"` and render the toggle as an overlay control.
- Don't store or log the raw password in the strength helper — it must stay a pure,
  side-effect-free function.

---

### 28. Client refresh cooldown (P2)

**What:** When the API is unreachable, the client's 401-refresh pipeline previously fired on
**every** new 401. Now a **transient** refresh failure (network error / 5xx) is memoized for
30s, so a dead API isn't hammered — while a genuinely dead session is **never** suppressed.

**How it was implemented:**

- `packages/client/src/lib/use-api.ts` — `RefreshResult` became a tri-state
  `"ok" | "expired" | "transient"` so the pipeline can tell a dead API from a dead session.
  `performRefresh` (in `auth.tsx`) maps response/error into one of the three.
- `createRefreshCooldown(refresh, cooldownMs = 30_000)` wraps the raw refresh: a
  `"transient"` result arms a 30s window during which calls short-circuit to `false` (no
  network call, no retry — and importantly **no logout**). `"expired"` clears the window and
  still returns `false` so the caller's unauthorized path (clear state + redirect) runs
  normally. A success resets the window.
- The wrapper instance lives in a `useRef` (`cooldownRefreshRef.current ??= ...`) so it is
  stable across renders and `useApi`'s memo never re-creates it.
- Single-flight is preserved by the existing `refreshPromiseRef.current ??=` pattern —
  concurrent 401s still share one refresh call.

**✅ Do:**

- Cooldown **only** `"transient"` failures. A dead session must always redirect — that's the
  difference between a temporary blip and a real logout.
- Reset the cooldown on success so a healthy session is never throttled.
- Keep the wrapper in a ref so the `useApi` memo deps stay stable.

**❌ Don't:**

- Don't treat a 401 on `/auth/refresh` as transient — `"expired"` is a dead session and must
  flow through `handleUnauthorized` (clear cache + redirect).
- Don't build a second cooldown for the proxy and the client separately without documenting
  the interaction — see #29's caveat below.

---

### 29. Proxy refresh cooldown (P2)

**What:** Same idea as #28, but for the server-side refresh in the route proxies. A transient
proxy-refresh failure (API down / 5xx) is memoized for **60s**, so repeated navigations inside
that window skip the refresh call entirely — this is what killed the `ECONNREFUSED` log spam
seen when the API is down and the user keeps navigating.

**How it was implemented:**

- `packages/client/src/lib/proxy-refresh.ts` — `createProxyRefreshCooldown(refreshAttempt,
  cooldownMs = PROXY_REFRESH_COOLDOWN_MS /* 60_000 */)`. Inside the window it short-circuits
  to `{ ok: false, status: 0, skipped: true }` (no network call).
- Instantiated **once at module scope** in both `apps/web/proxy.ts` and `apps/admin/proxy.ts` —
  the returned function owns the closure state, so the memoized failure survives across
  requests in the server process (that's what makes it effective for real navigations).
- The proxy logs the new `cooldown-active` outcome (`[proxy:*] ... transient failure recently
  — refresh skipped (cooldown)`) and serves the stale page — matching the existing
  `transient-failure` fall-through that deliberately does **not** log the user out.
- A success, a dead session (401/403), or a fresh login resets the window.

**✅ Do:**

- Instantiate the cooldown at **module scope** — a per-request instance would reset on every
  navigation and the cooldown would never engage.
- Never memoize a 401/403 refresh response: a dead session must clear cookies and redirect on
  **every** navigation until the user re-logs-in (that's what breaks the stale-cookie bounce
  loop).

**❌ Don't:**

- Don't expect to see this in the browser Network tab — the proxy refresh is server-to-server.
  It's observable via the `[proxy:web]` / `[proxy:admin]` lines in the server console.
- ⚠️ **Caveat (documented trade-off):** the web (`:3000`) and admin (`:3001`) proxies share
  one Next.js server process but keep **separate cooldown instances**. If the API were flaky
  enough to fail for only one client type, that app's proxy refresh is suppressed for up to
  60s while the other keeps retrying. Self-heals on the next success or after the window
  elapses. (See `docs/token-refresh.md` §6.)

---

### 30. Auth hydration + cache sync (P2)

**What:** Three related fixes: (a) an `isInitializing` state that kills the login-form flash on
page reload, (b) all React Query caches are cleared on logout **and** every unauthorized so no
stale user data survives a session change, and (c) cross-tab sync so logging out in one tab
logs out every tab sharing the same cookie set.

**How it was implemented:**

- **Hydration** — `packages/client/src/lib/auth.tsx` exposes `isInitializing`, implemented as a
  tiny external store read via `useSyncExternalStore` (the canonical hydration pattern: no
  `setState`-in-effect, SSR-safe). The store tracks a module-level `clientMounted` flag that
  starts `false` — on the server **and** the client's first render — so `getServerSnapshot`
  and `getSnapshot` agree (no hydration mismatch). `isInitializing` is the **negation** of
  that flag: `true` during SSR + the first client render, `false` once mounted. The mount
  effect flips the flag to `true` and **notifies the store's subscribers** — the notification
  is what makes `useSyncExternalStore` re-render. ⚠️ Gotcha: the flag must start `false` and
  flip to `true` (a no-op `subscribe`, or starting the snapshot at `true`, leaves the
  hydration spinner stuck forever because React never sees a change). Consumers gate on it —
  the admin login page, web login page, and web `/hello` page render a spinner during the
  window instead of flashing the form/content.
- **Cache clear** — `queryClient.clear()` runs in `logout` **and** in `handleUnauthorized`, so
  a 401-refresh failure also wipes user data (previously a dead session could leave the
  previous user's queries cached).
- **Cross-tab sync** — `packages/client/src/lib/auth-sync.ts` provides `createAuthChannel(name)`,
  a thin wrapper over `BroadcastChannel`. Each `AuthProvider` owns one channel per auth context
  (web vs admin cookie set, keyed by `cookieNames.accessToken`), broadcasts **only state
  changes** (`"logged-out"` / `"logged-in"` — never tokens), and closes its channel on
  unmount. Receiving `"logged-out"` runs the same `handleUnauthorized` path (clear cache +
  redirect). Degrades to no-ops where `BroadcastChannel` is unavailable (SSR, jsdom, old
  browsers).
- `resetAuthHydrationForTests()` test helper resets the module-scoped hydration flag between
  tests.

**✅ Do:**

- Broadcast **state changes only** — never access or refresh tokens over the channel (other
  tabs might listen; and tokens live in httpOnly cookies precisely so JS never touches them).
- Give each provider its **own channel** and close it on unmount — a shared singleton channel
  leaks stale listeners across mounts/tabs/tests (this bit us in the tests).
- Use `useSyncExternalStore` (not setState-in-effect) for the hydration flag — it's what keeps
  it SSR-consistent and React-Compiler-clean.

**❌ Don't:**

- Don't use a module-singleton channel cache — each call must create an independent channel so
  real tabs (and tests) get clean delivery semantics.
- Don't forget the SSR snapshot: `getServerSnapshot` must return the "initializing" value, or
  the server HTML shows the form and hydration flashes it.

---

**Test coverage:** the batch is locked down by unit tests in `packages/client` (auth, auth-sync,
proxy-refresh, password, use-api), `apps/web` (proxy), `apps/admin` (proxy), plus the
real-docs frontmatter test in `apps/admin/lib/docs/markdown.test.ts`.

---

----------------------------------------------------- 
The 30-point auth hardening plan (deep dive) -----------------------------------------------------

# 🔐 Auth Hardening — 30-Item Deep-Dive

> [!NOTE] **Status legend:** ✅ **Done** (shipped + tested) · 🟡 **Partial** (exists in some form, gaps remain) · ⬜ **Pending** (not started)
>
> This section expands the 30-point list (A. Security · B. API & Protocol · C. Client & Apps)
> into implementation-ready specs. Each item states the **goal**, the **current state as verified
> against the code today**, the concrete **implementation plan** (files + mechanism), and
> **✅ do / ❌ don't** guardrails. Everything below was cross-checked against
> `apps/api/src`, `packages/client/src/lib`, and the two route proxies — treat the
> "current state" lines as ground truth, not guesses.
>
> Items **26–30 are already shipped** (see the *Auth Hardening — 5 Features Shipped* section
> above for the full build notes); their specs here are kept short and point back there.

---

## 📊 Status at a glance

| # | Item | Priority | Status |
| - | ---- | -------- | ------ |
| 1 | Helmet + security headers | P1 | ⬜ Pending |
| 2 | Hash algorithm & cost audit | P1 | 🟡 Partial (bcrypt cost ≥ 12 ✓; argon2id pending) |
| 3 | Token-version invalidation | P1 | ⬜ Pending |
| 4 | `lastLoginAt` / `lastLoginIp` tracking | P2 | 🟡 Partial (IP/device captured on `RefreshToken`; not on `User`) |
| 5 | Atomic rotation + expiry pruning | P1 | 🟡 Partial (login-time pruning ✓; no cron; rotation not `updateMany`-atomic) |
| 6 | Verify-gate reset + email changes | P1 | ⬜ Pending |
| 7 | Timing-safe uniform auth responses | P1 | 🟡 Partial (dummy hash + identical messages ✓; no constant delay) |
| 8 | Exponential-backoff lockout | P1 | 🟡 Partial (fixed 15-min lock ✓; no escalation, no combined throttle key) |
| 9 | Stricter admin throttle + SuperAdmin allowlist | P2 | 🟡 Partial (throttles exist; no allowlist) |
| 10 | Password policy + breach check | P2 | 🟡 Partial (`strongPassword` schema ✓; no HIBP / common-password blocklist) |
| 11 | Email-abuse controls | P2 | 🟡 Partial (throttled; no per-user cooldown / disposable-domain list) |
| 12 | Impersonation hardening | P1 | 🟡 Partial (no-superadmin-target ✓, audit ✓; no re-auth gate, no `imp` claim) |
| 13 | JWT claims hardening (alg/iss/aud/jti) | P1 | ⬜ Pending |
| 14 | Opt-in Remember-me cookie | P2 | ⬜ Pending |
| 15 | Dedicated auth audit log | P1 | 🟡 Partial (`Log` model exists; no dedicated `auth_audit_log` table) |
| 16 | Sessions + login-history pages | P1 | 🟡 Partial (`GET /auth/sessions` ✓; no UI) |
| 17 | Device/IP-change detection on refresh | P2 | 🟡 Partial (fields stored ✓; no diffing/anomaly alert) |
| 18 | Concurrent session cap | P2 | ✅ Done (login-time cleanup keeps newest 5) |
| 19 | Document cookies in OpenAPI | P3 | 🟡 Partial (`withCredentials` in Swagger ✓; no `@ApiCookieAuth`) |
| 20 | Idempotency keys on auth POSTs | P2 | ⬜ Pending |
| 21 | Rate-limit observability | P2 | ⬜ Pending |
| 22 | Email/reset-token hygiene | P2 | 🟡 Partial (single-use + 1h TTL + invalidation ✓; no verify-gate) |
| 23 | Paginate `/auth/admin/users` + `/auth/sessions` | P2 | ⬜ Pending |
| 24 | Structured JSON logging + request IDs | P2 | 🟡 Partial (`CorrelationIdMiddleware` + `Log` model ✓; no pino) |
| 25 | Deactivation kills sessions | P1 | 🟡 Partial (login/refresh check `isActive` ✓; guard + token purge missing) |
| 26 | Auth error-code mapping + i18n | P1 | ✅ Done (shipped) |
| 27 | Password UX affordances | P3 | ✅ Done (shipped) |
| 28 | Client refresh cooldown | P2 | ✅ Done (shipped) |
| 29 | Proxy refresh cooldown | P2 | ✅ Done (shipped) |
| 30 | Auth hydration + cache sync | P2 | ✅ Done (shipped) |
| 31+ | **Beyond the 30** — see the extra section below | — | Mixed |

**Bottom line:** 5 shipped (26–30) + 1 effectively done (18) · ~12 partial · ~12 pending.

---

## A. Security hardening (API core)

### 1. Helmet + security headers (P1) — ⬜ Pending

**Goal:** Send a baseline of HTTP security headers (CSP, HSTS, `X-Content-Type-Options`, `Referrer-Policy`, `X-Frame-Options`) on every API response.

**Current state (verified):** `apps/api/src/main.ts` calls `enableCors` + `cookieParser` but never applies Helmet. There is no CSP, HSTS, `nosniff`, or frame-ancestors policy anywhere.

**Implementation plan:**

1. `pnpm --filter @workspace/api add helmet` (and `@types/helmet` if needed).
2. In `main.ts`, before `enableCors`: `app.use(helmet({ ... }))`.
3. Tune the defaults for a cookie-based API — the two that matter:
   - `crossOriginResourcePolicy: { policy: "cross-origin" }` — otherwise fonts/images loaded by the web/admin origins get blocked.
   - `contentSecurityPolicy: false` **for the `/docs` Swagger route only** — Swagger injects inline scripts/styles; a strict CSP breaks it. Either use a per-route conditional or set a permissive CSP that still bans `unsafe-inline` script-src where possible.
4. Add a `Referrer-Policy: no-referrer` (default from Helmet) and `Strict-Transport-Security` via `hsts` (auto-enabled when the request is HTTPS).

**✅ Do:** test Swagger + both apps after enabling — CSP is the #1 thing that silently breaks the UI.
**❌ Don't:** set `helmet()` with zero options blindly; the default `crossOriginResourcePolicy: same-origin` will break cross-origin image/font loading between `:3000`/`:3001` and `:8080`.

---

### 2. Hash algorithm & cost audit (P1) — 🟡 Partial

**Goal:** Confirm the password hash is expensive enough and make the cost tunable without redeploys.

**Current state (verified):** `crypto.service.ts` uses **bcrypt** with `saltRounds` read from `TypedConfigService.bcryptSaltRounds`, which defaults to **12** and is env-driven (`BCRYPT_SALT_ROUNDS`) — so the "cost ≥ 12, env-tunable" ask is already satisfied. There is no `argon2id` path.

**Implementation plan:**

1. **Keep bcrypt at 12** as the default — it's already configurable. Log the cost at boot so ops can see it (`LOG` a `bcryptCost` metadata on startup).
2. **Optional argon2id migration** (only if GPU/ASIC resistance becomes a requirement): add `argon2` as a dependency, add an `Argon2CryptoService` with `type: "argon2id"`, `memoryCost: 65536`, `timeCost: 3`, `parallelism: 1`, and **verify** on compare by re-hashing with argon2 and comparing. Add a `PASSWORD_HASH_ALGORITHM=bcrypt|argon2id` env switch.
3. **The non-negotiable part:** *never* store plaintext or a hashable form; only bcrypt/argon2 output. Existing hashes must keep working — argon2 adoption requires either a re-hash-on-login strategy (hash with argon2 on next successful login and write back) or a one-time migration job.

**✅ Do:** keep `bcrypt` cost at **12** (current default) or higher; document that 10 is the *minimum* for prod.
**❌ Don't:** roll your own KDF, or compare hashes with plain `===` (always `cryptoService.compare` — it's constant-time-ish via bcrypt).

---

### 3. Token-version invalidation (P1) — ⬜ Pending

**Goal:** Kill every session the instant a password changes / is reset / roles change — without waiting for refresh-token expiry.

**Current state (verified):** the `User` model has **no `tokenVersion`**. `resetPassword` soft-deletes all `RefreshToken` rows (revokes refresh), but any already-issued **access tokens stay valid until their 15-minute expiry** — the exact gap this item closes.

**Implementation plan:**

1. **Schema:** add `tokenVersion Int @default(0)` to `User` (+ migration).
2. **JWT:** include `tokenVersion` in `AccessTokenPayload` (`token.service.ts`). **⚠ Must also add the claim to `AccessTokenPayloadSchema`** — the zod verify-parse (`verifyAccessToken`) strips unknown claims, so a schema-only-forgetting-JWT change would silently drop the claim in every decoded token.
3. **Guard:** in `AuthGuard.canActivate`, after `verifyAccessToken`, fetch the user's `tokenVersion` and reject when `payload.tokenVersion !== user.tokenVersion` (`ACCESS_TOKEN_STALE` error code, 401). Add the same check to `refreshToken()` in the service.
4. **Bump points:** `resetPassword` (already revokes tokens — also `increment: 1`), a new self-service `PATCH /auth/password` (item 31 in Beyond-the-30), admin role/permission changes (RBAC service), and account deactivation (item 25).

**✅ Do:** bump `tokenVersion` in the **same transaction** as the password/role change.
**❌ Don't:** put `tokenVersion` in the *refresh* token only — the access token is the one that needs killing immediately.

---

### 4. Track `lastLoginAt` / `lastLoginIp` (P2) — 🟡 Partial

**Goal:** Persist the last successful login time + IP on the user so login-history, geographic alerts, and idle-timeout features have data to power.

**Current state (verified):** `login()` already receives `ipAddress` + `deviceInfo` and stores them on the **new `RefreshToken` row** (each session has its own device/IP), but the `User` row has no `lastLoginAt`/`lastLoginIp`.

**Implementation plan:**

1. **Schema:** add `lastLoginAt DateTime?` + `lastLoginIp String? @db.VarChar(45)` to `User`.
2. In `login()`, on success, update the user in the same transaction as the refresh-token create: `data: { lastLoginAt: new Date(), lastLoginIp: ipAddress ?? null }`.
3. Expose on `UserResponse` / `/auth/me` (map `user.lastLoginAt`), and in the `AdminUserDetail` list so SuperAdmins see it.

**✅ Do:** write it on every successful login — including refresh-rotation (the user is still "active").
**❌ Don't:** expose it as `createdAt` confusion — the two must be visually distinct in the UI.

---

### 5. Atomic rotation + expiry pruning (P1) — 🟡 Partial

**Goal:** Make refresh-token rotation race-proof (two parallel refreshes can't both win) and prune expired rows on a schedule, not just on login.

**Current state (verified):**

- `refreshToken()` does `findUnique` → `cryptoService.compare` (reuse detection) → `update` — a **read-then-write race**: two concurrent refreshes with the same token can both pass the compare before either writes, producing two valid sessions.
- Pruning exists **twice** but only on-demand: `cleanupExpiredTokens()` (soft-deletes expired + keeps newest 5) runs at login; `TaskScheduleService` cron only cleans `passwordResetToken`s (hourly), **not** refresh tokens.

**Implementation plan:**

1. **Atomic rotate:** replace the `update` with `updateMany({ where: { id: jti, userId, isDeleted: false }, data: { token: newHash, expiresAt, deviceInfo, ipAddress } })` and check `result.count === 1` — if 0, someone else rotated first → treat as reuse/theft (or at least 401). Keep the `cryptoService.compare` reuse check *before* it for the theft-detection path.
2. **Cron pruning:** in `task-schedule.service.ts`, add a second `@Cron(EVERY_HOUR)` (or `EVERY_6_HOURS`) job: `updateMany({ where: { OR: [expired, excess-per-user] }, data: { isDeleted: true, deletedAt: now } })`.
3. Keep the client + proxy single-flighting as a defense-in-depth (already shipped — #28/#29); the `updateMany` guard makes the DB the final arbiter.

**✅ Do:** verify `updateMany.count === 1` and throw `TOKEN_THEFT_DETECTED` (revoke-all) on 0 — that's the atomicity the current code lacks.
**❌ Don't:** rely on the client/proxy single-flight alone; they're best-effort, the DB condition is the guarantee.

---

### 6. Verify-gate password reset + email changes (P1) — ⬜ Pending

**Goal:** Don't issue password resets to unverified accounts, and re-verify a *new* email before it replaces the old one.

**Current state (verified):** `forgotPassword()` sends a reset link to any active, non-deleted account **regardless of `emailVerifiedAt`**. There is **no email-change endpoint at all** (`PATCH /auth/email` doesn't exist; the old roadmap listed it as a future enhancement). `resetPassword()` has no verify-gate.

**Implementation plan:**

1. **Forgot-password gate:** in `forgotPassword()`, if `user.emailVerifiedAt === null` → still return the identical success message (anti-enumeration, item 7) but skip the email, and log a `VERIFY_EMAIL_FIRST` audit event.
2. **Email change flow (new endpoint):**
   - `PATCH /auth/email` — authenticated. Body: `{ newEmail, password }`. Validates current password, then generates a *new-email* verification token (dedicated secret, like the signup token) addressed to the **new** address.
   - `POST /auth/verify-email-change/:token` — public. Marks `emailVerifiedAt` + swaps `email` in one transaction. Bump `tokenVersion` (item 3) to kill sessions tied to the old email.
   - Add `pendingEmail String? @db.VarChar(100)` to `User`.
3. Add a `purpose: "email_change"` claim to the verification-token payloads and check it in `verifyEmailToken` (today it only checks `purpose === "email_verification"`).

**✅ Do:** keep the "same response for every input" rule on forgot-password — the gate must not leak whether an account exists or is verified.
**❌ Don't:** let the new email take effect until its token is consumed — the old email must keep working during the switch window.

---

### 7. Timing-safe, uniform auth responses (P1) — 🟡 Partial

**Goal:** Make it impossible to probe account existence via response shape, timing, or status codes.

**Current state (verified):** the code is already well along:

- `login()` runs `cryptoService.hash("dummy-password-to-prevent-timing-attack")` and compares against it when the user doesn't exist — **timing equalization exists** ✓.
- `forgotPassword()` and `resendVerificationEmail()` return **identical messages** regardless of existence ✓.
- `login()` with `X-Client-Type: admin` returns `ADMIN_ACCESS_REQUIRED` (403) when the user doesn't exist — that **does** leak existence to an attacker probing admin accounts (a deliberate UX trade-off worth revisiting).

**Implementation plan:**

1. **Constant delay:** add a small fixed delay (~200–400ms) on the *unknown-email* path of `login`/`forgotPassword` so timing differentials (dummy-hash already covers the compare; DB lookup latency still differs) are neutralized. Use `await new Promise((r) => setTimeout(r, FIXED_DELAY_MS))` with the delay applied to *every* login path for consistency.
2. **Revisit admin 403:** decide whether the admin login should also return `INVALID_CREDENTIALS` (uniform) vs the current `ADMIN_ACCESS_REQUIRED`. Recommendation: keep the distinct code (better UX for legit admins) but only return it when the *email exists and password matched* — i.e. do the full auth first, then gate on admin access. Today the existence leak comes from checking the user *before* the password.

**✅ Do:** make every auth-failure path take roughly the same wall-clock time.
**❌ Don't:** remove the dummy hash or the identical forgot-password message — they're load-bearing anti-enumeration.

---

### 8. Exponential-backoff lockout (P1) — 🟡 Partial

**Goal:** Escalating lockout windows (5 → 10 → 30 min) instead of a flat 15 minutes, reset on success, email on lock, and throttle keyed by IP+email combined.

**Current state (verified):** `login()` has a **fixed** `LOCK_DURATION_MS = 15 * 60 * 1000` after 5 failed attempts (`MAX_FAILED_ATTEMPTS = 5`), resets counters on success, and emails the user on lockout (`sendAccountLockedEmail`) — all ✓. The `@Throttle` decorators on the controller are **IP-based only** (default key), not email-keyed.

**Implementation plan:**

1. **Escalating window:** replace the fixed duration with a table keyed by `failedLoginAttempts` — e.g. attempts 5–7 → 5 min, 8–9 → 10 min, 10+ → 30 min. Store the *current tier* by reading `failedLoginAttempts` (already on the row). `lockedUntil = now + tier(attempts)`.
2. **Combined throttle key:** configure the Throttler guard to use a custom `getTracker` that hashes `(req.ip, req.body.email)` — a distributed bot hitting many emails from one IP gets limited per-IP, and a distributed attack on one email from many IPs gets limited per-email.
3. **Lockout email already exists** ✓ — extend it with the remaining minutes (the payload already carries `remainingSeconds`, which the client renders as a countdown via `LockoutCountdown` — item 27).
4. Add the lockout event to the auth audit log (item 15) with `{ email, ip, attempts, windowMinutes }`.

**✅ Do:** keep `remainingSeconds` in the `ACCOUNT_LOCKED` payload — the UI countdown depends on it.
**❌ Don't:** let the `@Throttle` 401/429 responses bypass the account lockout — they're complementary layers, not substitutes.

---

### 9. Stricter admin-auth throttle + SuperAdmin IP allowlist (P2) — 🟡 Partial

**Goal:** Admin login gets tighter limits than web, and SuperAdmin access can be restricted to trusted IPs.

**Current state (verified):** admin login uses the *same* `@Throttle({ strict: { ttl: 60000, limit: 5 } })` as web. There is **no IP allowlist** anywhere.

**Implementation plan:**

1. **Tighter admin throttle:** add a dedicated throttle name — e.g. `@Throttle({ admin: { ttl: 60000, limit: 3 } })` — on `login` when `X-Client-Type: admin` (or a second decorator on a dedicated admin-login path). Register the `admin` bucket in the ThrottlerModule config.
2. **SuperAdmin allowlist:** a `SUPERADMIN_IP_ALLOWLIST` env var (comma-separated IPs/CIDRs) checked in a small guard or in `login()` when the user `isSuperAdmin`. Reject with a clear `SUPERADMIN_IP_NOT_ALLOWED` code. Keep it **off by default** (empty = allow all) so local dev isn't blocked.
3. Consider CIDR parsing (a tiny helper or `ipaddr.js`) — exact-match IPs only is a footgun for office ranges.

**✅ Do:** keep the allowlist an *additional* layer on top of auth, never a replacement.
**❌ Don't:** hardcode IPs in code — env/config only, and document the env var in `.env.example`.

---

### 10. Password policy + breach check (P2) — 🟡 Partial

**Goal:** Enforce strong passwords at signup/reset, and reject passwords known to be breached or trivially common.

**Current state (verified):** the shared `strongPassword` zod schema enforces length 8+, upper, lower, digit, special — and the client's `passwordStrength()` mirrors it byte-for-byte (item 27) ✓. **No HIBP integration** and **no common-password blocklist** exist.

**Implementation plan:**

1. **HIBP k-anonymity (roadmap #13):** on `signup` + `resetPassword`, hash the password with SHA-1 (upper hex), send the first 5 chars to `https://api.pwnedpasswords.com/range/{prefix}`, and check the suffix in the returned list. Only the *prefix* leaves the server — never the hash, never the password. Cache responses (the prefix set is small) and treat HIBP outages as non-fatal (log + allow).
2. **Common-password blocklist:** ship a small local set (~100k most common passwords, npm `@namviek/common-passwords` or a vendored list) checked before the HIBP call — instant win, zero network.
3. Surface the failure as a structured error code (`WEAK_PASSWORD`, `BREACHED_PASSWORD`) so the client maps it to friendly text (item 26's catalog).

**✅ Do:** run the HIBP check on **password change** too, not just signup.
**❌ Don't:** block signup if the HIBP API is down — fail open with a log; availability beats strictness here.

---

### 11. Email-abuse controls (P2) — 🟡 Partial

**Goal:** Stop attackers from abusing `resend-verification` / `forgot-password` to spam a victim's inbox, and block signups from disposable domains.

**Current state (verified):** both endpoints are `@Throttle`-limited per IP (3/min), but there's **no per-user cooldown** — a bot can rotate IPs and hit the same email repeatedly. No disposable-domain check exists at signup.

**Implementation plan:**

1. **Per-user cooldown:** a tiny `lastEmailSentAt` on `User` (or a `KeyValueStore`-style table keyed by `email:verification` / `email:reset`). If `now - lastEmailSentAt < 60s` → still return the identical success message, skip the send, log `EMAIL_COOLDOWN`. This is the *only* way to fight distributed-IP spam on a single victim address.
2. **Disposable-domain blocklist:** check `email.split("@")[1]` against a small local set (e.g. npm `disposable-email-domains`) at signup → reject with `DISPOSABLE_EMAIL_NOT_ALLOWED`. Fail-open on list-load errors.
3. Consider a **per-user max emails/day** counter (e.g. 5) to bound blast radius even with cooldowns.

**✅ Do:** keep the identical response even when suppressing the send — the cooldown must not become an enumeration oracle.
**❌ Don't:** block *all* mail.ws-style throwaway providers in prod if the product targets consumers — make it configurable (`DISPOSABLE_EMAIL_BLOCKLIST_ENABLED`).

---

### 12. Impersonation hardening (P1) — 🟡 Partial

**Goal:** Make SuperAdmin impersonation audited, non-escalating, and tamper-evident.

**Current state (verified):** mostly solid already: cannot impersonate another SuperAdmin ✓, `ImpersonationAuditLog` records START **and** STOP with IP + user-agent ✓, the impersonation token is 15-min with `isImpersonating: true` + `originalUserId` ✓. Gaps: no **re-auth before starting**, and no dedicated `imp` claim (only `isImpersonating`).

**Implementation plan:**

1. **Re-auth gate:** before `POST /auth/impersonate/:userId`, require the SuperAdmin's current password (or a TOTP, when 2FA lands) in the request body — a compromised idle admin session shouldn't grant impersonation.
2. **`imp` claim (rename/hardening):** keep `isImpersonating` but also emit a compact `imp: <originalUserId>` claim so guards can do a *single-claim* check; add a guard that **blocks impersonation tokens from calling SuperAdmin-only endpoints** (an impersonated session must not be able to escalate back).
3. **Audit both events already exists** ✓ — extend the STOP log to include the target's last action (or just keep it minimal; current is fine).
4. Add an **impersonation banner** on the admin client so it's visually obvious a session is impersonated (see Beyond-the-30).

**✅ Do:** make the re-auth mandatory — it's the difference between "misclick" and "breach" for an already-authed admin tab.
**❌ Don't:** let an impersonated token pass `@SuperAdminOnly()` — the whole point of impersonation is *viewing* a user's world, not holding admin keys.

---

### 13. JWT claims hardening (P1) — ⬜ Pending

**Goal:** Pin the signing algorithm, bind tokens to a per-app audience, and give every access token a `jti` for tracing/revocation.

**Current state (verified):** `JwtModule.register({ global: true })` with **no options**; `token.service.ts` signs with `{ secret, expiresIn }` only. No `algorithm`, no `issuer`/`audience`, no `jti` on access tokens. Default `jsonwebtoken` behavior accepts the header's algorithm (`alg: none` attacks are mitigated by lib defaults, but explicit pinning is best practice).

**Implementation plan:**

1. **Pin the algorithm:** `algorithm: "HS256"` in every `signAsync`/`verifyAsync` call. (This repo signs HS256 everywhere; pinning prevents an attacker who can influence `alg` from downgrading.)
2. **Issuer + audience per app:**
   - Access tokens: `issuer: config.jwtIssuer` (e.g. `https://api.example.com`), `audience: "web"` for web tokens.
   - Admin access tokens: `audience: "admin"` — set at login when `clientType === "admin"` (the `login` endpoint already knows the client type).
   - Both `verifyAccessToken`/`verifyRefreshToken` pass `{ issuer, audience }` to `verifyAsync` so a web token **replayed against admin-only endpoints fails verification**. (Note: the access cookie set is already isolated web-vs-admin via `adminAccessToken`; this makes the *JWT itself* unusable cross-app — belt and braces.)
3. **Access-token `jti`:** add `jti: randomUUID()` per sign; surface it in logs for request tracing (item 24) and enable future revoke-lists (item 40 in Beyond-the-30).
4. **Refresh tokens:** `audience: "web" | "admin"` matching how they were issued, plus the existing `tokenType: "refresh"` and `jti` (already there) — verify all three in `RefreshTokenGuard`.

**✅ Do:** add `algorithm` + `issuer` + `audience` to **every** `signAsync`/`verifyAsync` — including the email-verification tokens.
**❌ Don't:** hardcode audience strings in the service — read from `TypedConfigService` (env: `JWT_ISSUER`), so the values differ per environment.

---

### 14. Opt-in Remember-me cookie (P2) — ⬜ Pending

**Goal:** Keep session cookies (die on browser close) as the default, but support a `rememberMe` flag that extends the refresh cookie to 30 days.

**Current state (verified):** `cookie.config.ts` sets no `maxAge`/`expires` — both cookies are session cookies ✓ (the intended default). The `login` DTO has no `rememberMe` field.

**Implementation plan:**

1. **DTO:** add `rememberMe?: boolean` to `LoginDto` (zod `z.boolean().optional()`).
2. **Cookie options:** when `rememberMe` is true, set the refresh cookie with `maxAge: 30 * 24 * 60 * 60` (and the access cookie as today — still session-scoped, refreshed anyway). The `SetAuthCookiesInterceptor` already takes `CookieOptions` — thread the flag through `AuthCookieOptions`.
3. **Client:** add a "Remember me" checkbox to both login forms (web + admin); pass it in the mutation body. Persist the *choice* in `localStorage` (never the token) so the checkbox restores on reload.
4. **Proxy + client refresh flows need no change** — they forward/rotate the cookie exactly as the API sends it (`applyRotatedCookies` already faithfully forwards `maxAge`/`expires`, verified in `proxy-refresh.ts`).

**✅ Do:** treat `rememberMe` as refresh-cookie-lifetime only — the access token stays short-lived regardless.
**❌ Don't:** store the remember-me flag server-side per user — it's a per-browser choice, not an account attribute.

---

## B. API & protocol

### 15. Dedicated auth audit log (P1) — 🟡 Partial

**Goal:** A queryable, SOC2-friendly table of every auth event: login success/failure, refresh, logout-all, lockout, password change, impersonation.

**Current state (verified):** there's a generic `Log` model (level/message/metadata, used via `LogService.info/warn`) and an `ImpersonationAuditLog` for impersonation only. Auth events go to the generic log — not structured per event, not easily filterable by event type.

**Implementation plan:**

1. **Schema:** add an `AuthAuditLog` model:

   ```prisma
   model AuthAuditLog {
     id          String   @id @default(uuid())
     userId      String?  @map("user_id")
     email       String?  @db.VarChar(100)
     event       String   // "LOGIN_SUCCESS" | "LOGIN_FAILURE" | "REFRESH" | "LOGOUT" | "LOGOUT_ALL" | "LOCKOUT" | "PASSWORD_RESET" | "IMPERSONATION_START" | "IMPERSONATION_STOP"
     ipAddress   String?  @map("ip_address") @db.VarChar(45)
     deviceInfo  String?  @map("device_info") @db.VarChar(255)
     metadata    Json?
     createdAt   DateTime @default(now())

     @@index([userId])
     @@index([event])
     @@index([createdAt])
     @@map("auth_audit_logs")
   }
   ```

2. **Write points:** `login()` (success + every failure branch incl. lockout), `refreshToken()` (success + theft detection), `logout`/`logoutAll`, `forgotPassword`/`resetPassword`, impersonation start/stop.
3. **Read API:** `GET /auth/audit-log` — SuperAdmin, paginated (item 23), filterable by `userId` + `event` + date range.
4. Keep the existing `LogService` calls for operational logs — the audit table is the *structured* record.

**✅ Do:** never store the password/refresh-token raw values — metadata carries ids/ips/events only.
**❌ Don't:** log the refresh token JWT itself — `tokenId` (jti) is enough to correlate.

---

### 16. Sessions + login-history pages (P1) — 🟡 Partial

**Goal:** A UI to see active sessions (device/IP/last-used) and revoke a single session by `jti`; plus a login-history view powered by item 15.

**Current state (verified):** `GET /auth/sessions` exists and returns `id` (the refresh-token jti), `deviceInfo`, `ipAddress`, `createdAt`, `expiresAt`. **No revoke endpoint, no UI.** The admin seed already defines menu paths for this.

**Implementation plan:**

1. **API (missing bits):**
   - `DELETE /auth/sessions/:id` — authenticated, soft-deletes the refresh token if it belongs to the caller (mirrors `logoutDevice`).
   - `DELETE /auth/sessions/others` — revoke all but the current jti (needs the current jti, which `@GetUser("jti")` provides on an access-token session... add `jti` to `AccessTokenPayload` first — item 13).
   - Add `lastUsedAt` to the session list (bump on each refresh — item 32 in Beyond-the-30).
2. **Admin UI:** a `/settings/sessions` page (admin panel already has the shell + menu config) with the device list, a revoke button per row, and "revoke others".
3. **Web UI:** a lighter user-facing sessions page under `/settings/sessions` (same endpoints).
4. **Login history:** a `GET /auth/login-history` reading item 15's table, shown as a timeline (timestamp · IP · device · success/failure).

**✅ Do:** make revoke show a confirm and optimistically remove the row (then refetch).
**❌ Don't:** expose other users' sessions — every query must be scoped to the caller (or be SuperAdmin-only).

---

### 17. Device/IP-change detection on refresh (P2) — 🟡 Partial

**Goal:** Flag refreshes that come from a different device/IP than the session was created on — the classic stolen-refresh-token signature.

**Current state (verified):** `refreshToken()` already stores `deviceInfo`/`ipAddress` on each rotation ✓ but never compares them to the previous values.

**Implementation plan:**

1. **Compare on refresh:** fetch the previous `deviceInfo`/`ipAddress` from the stored record before rotating; if the new `ipAddress` differs from the old one (and old wasn't null/Unknown), log an `IP_CHANGE` audit event (item 15) and — configurable — trigger a lockout/email (item 8's email infra).
2. **Same for device:** a different `deviceInfo` on refresh from the same session is suspicious; flag it.
3. **Not a hard block by default:** geo/device changes happen legitimately (mobile networks, NAT). Default = flag + alert; make `AUTH_FLAG_IP_CHANGE_ONLY=true` semantics configurable.
4. Tie into item 33 (Beyond-the-30): a `X-Device-Fingerprint` header makes this far more reliable than user-agent.

**✅ Do:** store the *previous* values in the audit metadata so analysts see old vs new.
**❌ Don't:** auto-revoke on every IP change — that's a support ticket generator for users on mobile data.

---

### 18. Concurrent session cap (P2) — ✅ Done

**Goal:** Max N active refresh tokens per user, evicting the oldest.

**Current state (verified):** `cleanupExpiredTokens(userId)` — called on **every login** — soft-deletes expired rows **and** keeps only the newest 5 (`skip: 5` pattern). So the cap exists and evicts the oldest. What's missing is making the number configurable.

**Implementation plan (finish line):**

1. Make `5` an env-tunable `MAX_CONCURRENT_SESSIONS` (default 5) read via `TypedConfigService`.
2. Add the eviction event to the audit log (item 15) so "oldest session dropped" is visible in login history.
3. Surface the cap in the sessions page UI (item 16): "You have 3 of 5 active sessions".

**✅ Do:** keep eviction on **login** (that's when a new session arrives and the oldest must go).
**❌ Don't:** raise the cap without also making refresh-token cleanup idempotent — the cron (item 5) and login cleanup must agree on the same constant.

---

### 19. Document cookies in OpenAPI (P3) — 🟡 Partial

**Goal:** Swagger should reflect that auth happens via `Set-Cookie`, so generated clients send cookies correctly.

**Current state (verified):** Swagger is configured with `addBearerAuth()` + `swaggerOptions: { withCredentials: true }` — so the UI *sends* cookies when you click "Try it out" (the query-param `client_type=admin` hack exists for the admin cookie set). But there's no `@ApiCookieAuth` on the auth routes and no response-header docs for the `Set-Cookie` calls.

**Implementation plan:**

1. `DocumentBuilder().addCookieAuth("accessToken")` (and document `adminAccessToken` in the description) so endpoints show a cookie lock icon.
2. Add `@ApiResponse` headers to `login`/`refresh` documenting `Set-Cookie` (names + httpOnly + sameSite + lifetime).
3. Keep `withCredentials: true` and add a note in the Swagger description: "Login/refresh/logout authenticate via httpOnly cookies; the API also accepts a Bearer token for programmatic use."

**✅ Do:** document both cookie names (web vs admin) — clients hitting the admin API must know which cookie to send.
**❌ Don't:** remove `addBearerAuth` — the Swagger UI's own token input depends on it.

---

### 20. Idempotency keys on auth POSTs (P2) — ⬜ Pending

**Goal:** A client retry of `login`/`signup`/`forgot-password` must not create duplicate accounts, duplicate emails, or duplicate sessions.

**Current state (verified):** no `Idempotency-Key` handling anywhere. Retries are protected only by uniqueness constraints (`email @unique`) — which throw 409 for signup (acceptable) but `login`/`forgot-password` are naturally idempotent in effect yet still re-send emails / re-issue tokens on double-fire.

**Implementation plan:**

1. **Middleware/guard:** read `Idempotency-Key` (UUID) from the header. Look up `(key, userId-or-anon)` in a small `IdempotencyRecord` table: if present, replay the stored response; if absent, run the handler and store `{ key, response, createdAt }` (TTL ~15 min, then prune via item 5's cron).
2. **Signup double-click:** the 409 path already prevents duplicates; the idempotency layer just makes the *response* identical instead of an error on the second click.
3. **Client:** the `useApi` mutation layer adds the header when the caller passes an idempotency key (or auto-generates one per mutation invocation via `crypto.randomUUID()`).

**✅ Do:** key by `(header, body-hash-or-email)` so different users don't collide on the same key.
**❌ Don't:** store full response bodies forever — TTL + prune, or store a status-code + minimal body.

---

### 21. Rate-limit observability (P2) — ⬜ Pending

**Goal:** Emit `X-RateLimit-Remaining` / `X-RateLimit-Reset` headers on auth endpoints and give SuperAdmins a throttle-state endpoint ("why can't I log in?").

**Current state (verified):** `@Throttle` decorators exist but the Throttler's default behavior doesn't emit standard headers (the NestJS Throttler `ThrottlerModule` can with `tracker` + custom guards; nothing emits them today). No state endpoint.

**Implementation plan:**

1. **Headers:** add a small `ThrottlerGuard` override that reads `req.throttler.storage` (or the in-memory store) and sets `X-RateLimit-Remaining` + `X-RateLimit-Reset` on responses for throttled endpoints (login/signup/forgot-password/reset-password).
2. **State endpoint:** `GET /admin/throttle-state?email=...` — SuperAdmin-only — returns `{ remaining, resetAt, hits }` per bucket (parse the storage for the email/IP keys).
3. **Client:** the login form shows a friendly "too many attempts — try again in Xs" from the `Retry-After`/reset header instead of a generic error (ties into item 26's catalog + `LockoutCountdown` UX).

**✅ Do:** return `Retry-After` (seconds) on the 429 — it's the machine-readable retry hint.
**❌ Don't:** expose throttle state for arbitrary emails to non-SuperAdmins — it leaks login behavior.

---

### 22. Email/reset-token hygiene (P2) — 🟡 Partial

**Goal:** Verify/reset tokens must be single-use, tight-TTL, and invalidated when the email gets verified through another path.

**Current state (verified):** `forgotPassword()` already: uses a random 64-hex token (not JWT — hashed via bcrypt in the DB) ✓, 1-hour TTL ✓, marks `usedAt` on consumption (single-use) ✓, and invalidates previous unused tokens (`updateMany` expires them) ✓. The email-verification JWT (24h) is single-use-by-design but not tracked; there's no invalidation when the email is verified by another path.

**Implementation plan (remaining bits):**

1. **Track email-verification tokens:** add a `token`/`consumedAt`-style row or a `usedAt` on a `EmailVerificationToken` model so a leaked 24h verification JWT can't verify twice (the email is already idempotent via `emailVerifiedAt`, but tracking is cleaner for audit).
2. **Tighten TTLs:** verification JWT 24h → 6h (still generous for a signup email, shrinks the attack window). Make it config (`EMAIL_VERIFICATION_TTL`).
3. **Cross-path invalidation:** when an email becomes verified via any route (verify-email, or the new email-change flow in item 6), immediately expire any outstanding *password-reset* tokens for that account.

**✅ Do:** keep tokens hashed at rest (bcrypt) — a DB dump must not yield usable reset tokens.
**❌ Don't:** let the reset token be guessable — keep `crypto.randomBytes(32)` (already the case), never a timestamp-seeded value.

---

### 23. Paginate `/auth/admin/users` + `/auth/sessions` (P2) — ⬜ Pending

**Goal:** Cursor pagination + search before these endpoints scale.

**Current state (verified):** `getAdminUsersList()` returns `findMany` with **no limit** — unbounded. `getSessions()` is per-user (bounded in practice) but still unfiltered.

**Implementation plan:**

1. **Users list:** add `cursor` + `limit` (default 50, max 100) query params; use Prisma cursor pagination (`findMany({ take, skip, cursor })` on `id`); add optional `search` on `email`/`fullName` (`contains`, `mode: "insensitive"`).
2. **Response shape:** keep the wrapped-array envelope but add `meta: { nextCursor, hasMore }` (extend `createWrappedArrayDto` or a dedicated paginated wrapper).
3. **Sessions:** cursor-paginate `getSessions` for the admin view of all sessions (item 16) — for the per-user web page, a `limit` + `take` is enough.
4. **Client:** the admin users table (TanStack Table already present in the panel) wires `onFetchMore` from `nextCursor`.

**✅ Do:** use **cursor** pagination (stable under inserts) — offset pagination drifts on active systems.
**❌ Don't:** allow `limit` above 100 without a guard — unbounded `take` reintroduces the exact problem being fixed.

---

### 24. Structured JSON logging + request IDs (P2) — 🟡 Partial

**Goal:** Emit `{ requestId, userId, event }` JSON logs so proxy-refresh lines, auth events, and throttle hits correlate in one place.

**Current state (verified):** `CorrelationIdMiddleware` exists (applies `X-Request-ID` → `correlationId`, stored on the `Log` model) ✓, and `LogService` writes structured-ish rows with `correlationId`/`userId`/`metadata` ✓. No `nestjs-pino`; logs go to the DB via `LogService`, and the proxy logs via `console.warn` (not correlated).

**Implementation plan:**

1. **Wire the proxy into the same correlation:** the proxy already logs `[proxy:web]` lines — add the incoming `requestId` (from the browser request, which Next propagates) to the log line so proxy refresh ↔ API audit correlate. The API already stamps `X-Request-ID`; have the client send it forward.
2. **Keep DB logging, add console JSON:** add a `nestjs-pino` (or a tiny JSON logger middleware) that mirrors the `LogService` rows as `{ level, requestId, userId, event, msg }` JSON lines for prod log aggregation — DB stays the audit source of truth, stdout becomes the ops stream.
3. **Event naming:** standardize an `event` string per auth action (reuse the item 15 event vocabulary) so grep/aggregation is uniform.

**✅ Do:** reuse the existing `correlationId` (already on `Log`) as the join key across API + proxy + client.
**❌ Don't:** log full tokens or passwords — ids and event names only (same rule as item 15).

---

### 25. Deactivation kills sessions (P1) — 🟡 Partial

**Goal:** `isActive: false` must be enforced at the **AuthGuard** (not just login) and deactivation must delete every refresh token.

**Current state (verified):** `login()` rejects inactive users ✓, and `refreshToken()` checks `user.isActive` ✓. But the global `AuthGuard` only verifies the JWT — an already-issued access token for a deactivated account keeps working until expiry. No admin endpoint deletes refresh tokens on deactivation.

**Implementation plan:**

1. **Guard check:** in `AuthGuard.canActivate`, after verify, `findUnique` the user and reject when `!isActive || isDeleted` (error `ACCOUNT_IS_INACTIVE`, 401). Cache the lookup (a small in-memory TTL cache keyed by userId) so the guard stays fast — every authed request hits this.
2. **Deactivate endpoint:** in the admin user-management flow, wrap the `isActive` update + `refreshToken.updateMany({ isDeleted: true })` in one transaction.
3. **tokenVersion tie-in:** bump `tokenVersion` (item 3) on deactivation so *already-issued* access tokens are also invalidated immediately — belt-and-braces with the guard check.

**✅ Do:** pair the guard check with a `tokenVersion` bump — the guard alone still accepts tokens issued *before* deactivation within their 15-min window.
**❌ Don't:** do a DB hit per request without caching — the guard is on every authenticated call; a naive lookup doubles auth latency.

---

## C. Client & apps

### 26–30. Already shipped ✅

Items **26** (error-code mapping + i18n), **27** (password UX), **28** (client refresh cooldown), **29** (proxy refresh cooldown), and **30** (auth hydration + cache sync) are **done and tested** — full build notes, do's and don'ts live in the *Auth Hardening — 5 Features Shipped* section above. Quick pointers:

| # | Where to look |
| - | ------------- |
| 26 | `packages/shared/src/schemas/auth-errors.ts` · `packages/client/src/lib/auth-errors.ts` |
| 27 | `packages/ui/src/components/{password-input,password-strength-meter,lockout-countdown}.tsx` |
| 28 | `createRefreshCooldown` in `packages/client/src/lib/use-api.ts` |
| 29 | `createProxyRefreshCooldown` in `packages/client/src/lib/proxy-refresh.ts` |
| 30 | `isInitializing` + `createAuthChannel` in `packages/client/src/lib/{auth.tsx,auth-sync.ts}` |

---

## 🆕 Beyond the 30 — additional enhancements

> [!NOTE] Extra ideas (items 31–43) that would further harden or round out the auth story. Same format: goal, current state, plan, do/don't.

### 31. Self-service password change (P1) — ⬜ Pending

**Goal:** `PATCH /auth/password` — a logged-in user changes their password with the *current* password, gets re-auth semantics (bump `tokenVersion`), and all other sessions die.

**Why it's here:** today there is **no way for a user to change their password** while logged in — only `forgot-password` (which requires email access) and SuperAdmin admin actions exist. This is a glaring UX + security gap.

**Plan:**

1. `PATCH /auth/password` — authed, body `{ currentPassword, newPassword }` (zod-validated, `strongPassword` from item 10).
2. Verify `currentPassword` via `cryptoService.compare`; then `passwordHash = hash(newPassword)` + `tokenVersion: { increment: 1 }` in one transaction (item 3 kills all sessions).
3. Revoke all refresh tokens (except maybe the current session — simpler: all; the user re-logs-in or the client re-issues via the fresh access token + new refresh).
4. Emit `PASSWORD_CHANGED` to the audit log (item 15) + optional notification email. Wire the form into the admin/web settings pages.

**✅ Do:** require the current password — a stolen session must not be able to silently hijack the account.
**❌ Don't:** return 200 for a wrong `currentPassword` — 401 with `INVALID_CREDENTIALS`, and throttle this endpoint.

---

### 32. Session `lastUsedAt` (P2) — ⬜ Pending

**Goal:** Show when a session was last active so stale sessions are visible and evictable (item 18) by LRU rather than FIFO.

**Plan:** add `lastUsedAt DateTime?` to `RefreshToken`; set it in `refreshToken()` rotation; return it from `getSessions`; sort "most recently used first" in the sessions UI; let item 18's eviction prefer the least-recently-used over the oldest-created.

**✅ Do:** update it on **rotation** (that's the "this session is alive" signal).
**❌ Don't:** update it on *access-token* validation per request — that's a write per request for no user-visible gain.

---

### 33. Device fingerprint header (P2) — ⬜ Pending

**Goal:** A `X-Device-Fingerprint` header (hashed UA + screen + timezone + canvas hash via `fingerprintjs`) so sessions carry a stable, spoof-resistant device id — the foundation for item 17 anomaly detection, Remember-me device recognition, and "new device" login emails.

**Plan:**

1. Client computes a fingerprint once per browser (persisted in `localStorage`, rotated on change), sends it as `X-Device-Fingerprint` on login/refresh.
2. API stores it on `RefreshToken` (`deviceFingerprint String? @db.VarChar(128)`) and on the audit rows.
3. Login from a new fingerprint (vs. the user's known set) triggers a "new device" email + optional flag.

**✅ Do:** hash it client-side before sending — never a raw canvas string over the wire.
**❌ Don't:** treat a fingerprint mismatch as a hard block — browsers/OS updates legitimately change it.

---

### 34. `GET /auth/me` session metadata (P2) — ⬜ Pending

**Goal:** `/auth/me` also returns `sessionId` (access-token `jti`), `deviceInfo`, `ipAddress`, `createdAt`, `lastUsedAt` so the UI can say "This session started 2h ago from Chrome on macOS."

**Plan:** add `jti` to `AccessTokenPayload` (item 13), read the matching `RefreshToken` row, return a `session` object on the me response (optional `include=session` query to keep the default payload slim).

---

### 35. WebAuthn / passkeys (P3) — ⬜ Pending

**Goal:** Passwordless login via platform biometrics (`@simplewebauthn/server` + `@simplewebauthn/browser`). Original roadmap feature #3 — surfaced here because it pairs with TOTP (below) as the MFA story.

**Plan:** `User.webauthnCredentials` table; registration + authentication ceremonies; passkeys as the *second* factor first (login → passkey) rather than a full password replacement.

---

### 36. TOTP two-factor (P3) — ⬜ Pending

**Goal:** Optional authenticator-app 2FA (original roadmap feature #1). `POST /auth/2fa/setup` returns an `otpauth://` URI + QR; login becomes password → `2fa_token` → TOTP. Backup codes (10 one-time hashes) at enrollment.

**Plan:** `User.totpSecret` (encrypted), `POST /auth/login/2fa` consuming the short-lived `2fa_token`, backup-code verification path, and a `requires2fa` flag surfaced to the login form.

---

### 37. Step-up re-auth for sensitive ops (P2) — ⬜ Pending

**Goal:** SuperAdmin actions (unlock user, impersonate — item 12, role changes) require a fresh password/TOTP confirmation, recorded as `stepUpAt` on the JWT so guards can require "stepped-up within 5 min".

**Plan:** a `stepUpAt` claim, a `POST /auth/step-up` endpoint returning a short-lived step-up JWT, and a `@RequireStepUp()` guard on the sensitive endpoints.

---

### 38. Admin sessions-overview + login-history UI (P2) — ⬜ Pending

**Goal:** The SuperAdmin-facing version of item 16: see **all** users' active sessions (with search by email), revoke remotely, and a system-wide login-history feed. Original roadmap feature #4.

---

### 39. Cross-app single sign-on (P3) — ⬜ Pending

**Goal:** Today web and admin are **deliberately isolated** (separate cookie sets). Add an opt-in SSO mode: a web session can mint a short-lived admin grant (or vice-versa) so logging into one app opens the other without a second password — gated behind `SSO_ENABLED` and an admin-only claim.

---

### 40. JWT revoke-list (P3) — ⬜ Pending

**Goal:** An emergency `POST /auth/revoke-all` that blacklists outstanding access tokens by `jti` (item 13) in a `TokenBlacklist` table checked by the guard — for breach response, on top of the tokenVersion mechanism.

---

### 41. Rate-limit headers on the proxy too (P3) — ⬜ Pending

**Goal:** The route proxies (which hit `/auth/refresh` server-side) should honor `Retry-After` from the API so the 60s cooldown (item 29) aligns with the API's actual throttle window instead of a hardcoded 60s.

---

### 42. Admin impersonation banner (P3) — ⬜ Pending

**Goal:** A persistent, non-dismissable banner when the session `isImpersonating` (claim already exists ✓) — "You are acting as X · Return to your account" — so a SuperAdmin never forgets they're in an impersonated session.

---

### 43. Login-splash observability (P2) — ⬜ Pending

**Goal:** Emit a `LOGIN_ATTEMPT` event with `{ email-hashed, ip, clientType, outcome }` on **every** login attempt (item 15 table) so SOC can answer "was this user targeted?" without storing raw emails.

---

> [!WARNING] **Everything above is pending.** Suggested order: 31 → 15 → 3 → 25 → 5 → 12 (the P1 security chain), then 16/23 (UI + pagination), then the rest by priority.

---

----------------------------------------------------- The authentication flow, A to Z -----------------------------------------------------

# 🧸 The Authentication Flow from A to Z (Explained Like I'm 5)

> [!NOTE] Everything in this section is **true today** (verified against the code). Read it top-to-bottom once,
> and you'll understand the whole journey a single login takes — and what happens after, when tokens
> expire, refresh, and log out.
>
> **The cast of characters:**
>
> - **🧍 The user** — types their email and password, clicks **Login**.
> - **🖥️ The app** (web `:3000` or admin `:3001`) — shows the login form, talks to the API.
> - **🚪 The proxy** (`apps/{web,admin}/proxy.ts`) — a bouncer that runs *between* the browser and the app pages; it checks cookies on every page navigation.
> - **🏢 The API** (`apps/api` on `:8080`) — the real brain. Validates credentials, mints tokens, stores sessions.
> - **🗄️ The database** (Postgres) — remembers users, refresh tokens, audit events.
> - **🍪 The cookies** — tiny invisible ID cards the browser carries for you.

---

## Step 0 — What the app looks like before anything happens

When you open `http://localhost:3001/auth/login`, the request first hits **the proxy**:

1. The proxy looks at your cookies. You have no `adminAccessToken` yet → you're *not authenticated*.
2. `/auth/login` is an **auth route** → the proxy lets the page through (it's the login page, after all).
3. The page renders. The login form's parent (`AuthProvider`) shows a spinner for a split second (`isInitializing` — item 30), then reveals the form.

> [!NOTE] **Why the spinner?** The browser needs one "tick" after the page loads to know it's a real browser and not a server render. Showing the form during that tick would flash it on every reload (and for logged-in users the proxy is about to bounce them away anyway).

---

## Step 1 — You type your email and password

Nothing fancy happens while you type. The form is a normal React component (`LoginForm`) that keeps the email + password in local state. As you type:

- The **password field** shows a show/hide 👁️ toggle and a caps-lock warning (item 27 — `PasswordInput`).
- A **strength meter** updates under the field (item 27 — `PasswordStrengthMeter`, scoring the same 5 rules the server enforces via the shared `strongPassword` schema).
- If you previously got locked out, a **countdown** (item 27 — `LockoutCountdown`) shows "try again in 04:32".

**Nothing has left your computer yet.** All of this is local UI.

---

## Step 2 — You click **Login**

This is where the real journey starts. Here is the exact sequence:

### 2a. Client-side validation (in the app)

The form checks the inputs against the shared zod schema **before** any network call:

- Email must look like an email (`z.string().email()`).
- Password must be non-empty (and, at signup/reset, pass `strongPassword`).

Invalid → show the error right there, **no network request**. Valid → continue.

### 2b. The app builds the request

The login form calls the API through the **typed endpoint registry** (`authEndpoints.adminLogin` for admin, `authEndpoints.login` for web) via `useApi`'s mutation. Behind the scenes this becomes:

```http
POST http://localhost:8080/auth/login
Content-Type: application/json
X-Client-Type: admin          # only for the admin panel (adminLogin)

{ "email": "admin@example.com", "password": "hunter2" }
```

Two important details:

- `credentials: "include"` is set on every request → the browser **sends cookies** with the request (right now there are none yet, but this matters for steps 6–8).
- The admin request carries `X-Client-Type: admin` so the API knows to (a) require admin access and (b) set the **admin cookie set** (`adminAccessToken`/`adminRefreshToken`) instead of the web ones. That's how the two apps keep isolated sessions on the same browser.

> [!WARNING] Note: this request goes **straight from the browser to the API** (`localhost:8080`), not through the Next.js proxy. The proxy only handles *page navigations*; API calls are direct, with CORS enabled in `main.ts` to allow `:3000`/`:3001` origins.

### 2c. The API's front door (middleware + guards)

When the request arrives at `:8080`, three layers run in order:

1. **Throttling** (`@Throttle({ strict: { ttl: 60000, limit: 5 } })`) — if *this IP* has tried logging in 5+ times in the last minute, the API answers **429 Too Many Requests** before doing any work. (Item 8/9 wants to make this smarter — per-email + escalating.)
2. **Validation** — the body is parsed against `LoginDto` (zod). Bad shape → **400** with a structured error.
3. **The controller** — `AuthController.login` extracts the client type from the header, grabs `deviceInfo` (user-agent) and `ipAddress` from the request, and hands everything to `AuthService.login`.

---

## Step 3 — The API checks who you are (`AuthService.login`)

This is the heart of it. Here's exactly what the service does, in order:

### 3a. Find the user

`prisma.user.findUnique({ where: { email } })` — look up the account by email.

### 3b. Admin gate (admin login only)

If `X-Client-Type: admin`, the API checks the account is allowed into the admin panel: either `isSuperAdmin === true`, or the account has the `ADMIN_DASHBOARD` permission. Not allowed → **403 `ADMIN_ACCESS_REQUIRED`**.

### 3c. The password check (timing-safe!)

The API **always** does a bcrypt compare, even when the user doesn't exist — it hashes a fixed dummy password and compares against *that* instead. Why? If the API answered "no such user" instantly and "wrong password" slowly, an attacker could measure the difference and discover which emails exist. By always doing the same amount of work, the API leaks nothing. (Item 7 — already implemented ✓.)

### 3d. Lockout check

If `failedLoginAttempts` reached 5 earlier, the account is locked until `lockedUntil`. While locked → **401 `ACCOUNT_LOCKED`** with `remainingSeconds` so the form can show its countdown. (Item 8 wants escalating windows.)

### 3e. Wrong password → count up + maybe lock

If the password is wrong, the API increments `failedLoginAttempts`. On the 5th failure it also sets `lockedUntil = now + 15 min` and emails the user ("your account was locked — was this you?"). You get **401 `INVALID_CREDENTIALS`** (same message whether the email exists or not — anti-enumeration).

### 3f. Right password → reset the counter + load permissions

- `failedLoginAttempts = 0`, `lockedUntil = null` (the account is trusted again).
- The API loads the user's **roles and permissions** from the RBAC tables (roles → role-permissions → merged with direct user-permissions).

### 3g. Create the session + mint the tokens

Now the API does the magic that lets you stay logged in:

1. **Creates a row in the `RefreshToken` table** (your *session*) with the device + IP + expiry (7 days by default). The row's `id` will become part of the refresh token — so the API can find *your specific session* later.
2. **Signs two JWTs** with two different secrets:
   - **Access token** — carries your id, email, name, roles, permissions, and flags (`isSuperAdmin`, `isEmailVerified`, `hasAdminAccess`). Lives **15 minutes**. This is the "I am logged in" card.
   - **Refresh token** — carries your id + the session's `jti`. Lives **7 days**. This is the "get me a new card" card.
3. **Hashes the refresh token** (bcrypt) and stores the hash in the session row. The plaintext refresh token is *never* stored — so a database leak can't be turned into usable refresh tokens.
4. **Cleans up** expired sessions + keeps only the newest 5 per user (items 5/18).
5. **Logs** the login to the log service (and, one day, the audit table from item 15).

### 3h. Hand the tokens back

The service returns `{ user, accessToken, refreshToken }`. A **`SetAuthCookiesInterceptor`** then turns them into cookies and attaches them to the response:

```http
HTTP/1.1 200 OK
Set-Cookie: accessToken=<jwt>; HttpOnly; SameSite=Lax; Path=/
Set-Cookie: refreshToken=<jwt>; HttpOnly; SameSite=Lax; Path=/
# (admin login instead sets adminAccessToken + adminRefreshToken)

{ "success": true, "data": { "user": { ... }, "accessToken": "...", "refreshToken": "..." }, "meta": {} }
```

> [!NOTE] **Why `HttpOnly`?** The browser stores the cookies but **JavaScript never sees them**. This blocks XSS attacks: even if an attacker runs script on your page, they can't read your tokens and can't steal your session. The cookies just ride along automatically on every request.
> **Why `SameSite=Lax`?** The browser only sends them on same-site requests and top-level navigations — a cross-site request forgery (CSRF) defense.

---

## Step 4 — Back in the app: "you're logged in!"

The app's login mutation resolves. Now:

1. It validates the response against the zod schema (`LoginServiceResponseSchema`).
2. For **admin**, it double-checks `user.hasAdminAccess` — if the API somehow let a non-admin through, the app shows "Admin access required" and does *not* navigate.
3. It calls `authLogin()` from `useAuth()` — this marks the app as authenticated **and broadcasts `"logged-in"` to other tabs** (item 30's `BroadcastChannel`), so a second tab that was showing the login page knows a session now exists.
4. It calls `router.push(redirectPath)` — e.g. `/hello` for web, `/` (or the original `?redirect=` target) for admin.

**The URL changes in the browser bar. And that navigation goes through the proxy again — this time with cookies.**

---

## Step 5 — The proxy checks you at the door (every page load)

Every navigation (`/hello`, `/settings/general`, …) hits `proxy.ts` **before** the page is served. The proxy can read the `HttpOnly` cookies because it runs on the server. It checks:

1. **Do you have an access-token cookie?** No → redirect to `/auth/login?redirect=<wherever you were going>`. That `redirect` param is why, after you log in, you land *back* where you were headed.
2. **Is it expired (or about to expire within 30s)?** Maybe → the proxy calls the API's `/auth/refresh` *on your behalf* (server-to-server), grabs the two fresh `Set-Cookie` headers, and **forwards them to your browser** on the response. You get a silently rotated session — the first API call the page makes never even sees a 401. (Item 29's cooldown means a flaky API isn't hammered on every navigation.)
3. **Is it a dead session?** The refresh was rejected → the proxy clears the stale cookies and bounces you to login (breaking the infinite "stale cookie" loop).
4. **Everything fine?** → serve the page.

> [!WARNING] **You won't see the proxy refresh in the browser's Network tab.** It's server-to-server. You'll only see it in the terminal as `[proxy:web] /hello: refreshed — rotated 2 cookie(s) (API 200, 12ms)`.

---

## Step 6 — The page loads and asks "who am I?"

The protected page mounts. It calls the `/auth/me` endpoint (via the typed registry) to load the user profile:

1. The browser sends `accessToken` + `refreshToken` cookies automatically (`credentials: include`).
2. The **`AuthGuard`** (global, on the API) picks up the access token — from the cookie or a `Bearer` header — and verifies its signature + expiry with the access-token secret.
3. Valid → `request.user = payload` and the controller fetches the user's fresh profile from the DB → the page renders with real data (name, roles, permissions).
4. **Expired or invalid?** → **401**, and now the client-side refresh flow (step 8) kicks in.

---

## Step 7 — Time passes: the access token expires (15 min)

Access tokens live 15 minutes; refresh tokens live 7 days. So while you keep working:

- Every API call (like `/auth/me`) rides on the 15-minute access token.
- When it expires, the API answers **401**. The app doesn't log you out — it refreshes. Two layers do this, and they're **independent** (a deliberate design; see `docs/token-refresh.md`):

### Layer 1 — The proxy (server-side, on navigation)

Already described in step 5: when you **navigate** to a page and the access token is within 30s of expiring, the proxy rotates it before serving the page. This is why pressing ⌘R (a full navigation) makes a new token appear — the proxy refreshed it during the request.

### Layer 2 — The client (browser-side, on any 401)

When any API call comes back **401** (e.g. the token expired mid-session without a navigation), `useApi`:

1. **Single-flights the refresh** — if several requests 401 at once, they all share *one* `POST /auth/refresh` (rotating the refresh token twice would kill the session — the first rotation invalidates the old token).
2. Calls `/auth/refresh` with the refresh cookie. The API **verifies** the refresh token's signature, **looks up the session row** by its `jti`, and — critically — **bcrypt-compares the presented token against the stored hash**. If they don't match → someone replayed an old (already-rotated) token → `TOKEN_THEFT_DETECTED` and **all sessions are revoked**.
3. On success, the API **rotates**: new access token + new refresh token, new `Set-Cookie` headers (and a bumped `lastUsedAt`/expiry on the session row).
4. The app **retries the original request** once. It now succeeds.
5. If the refresh *fails*: `"expired"` (session genuinely dead) → clear caches + redirect to login. `"transient"` (API down / 5xx) → **30s cooldown** (item 28) so a dead API isn't hammered, and the user is **not** logged out — the API might be back in a second.

---

## Step 8 — Logging out

Clicking **Logout** (in web or admin):

1. The app calls `POST /auth/logout` (with `X-Client-Type: admin` from the admin panel so only the admin cookie set is cleared).
2. The API **soft-deletes the session row** (the refresh token can never be used again) and a `ClearAuthCookiesInterceptor` clears both cookies in the response.
3. The app clears its React Query cache (no stale user data survives), marks itself logged out, **broadcasts `"logged-out"`** to other tabs (item 30) — those tabs also clear and bounce to login — and navigates to `/auth/login`.
4. If the logout network call fails, the app still logs out locally (cookies cleared on the next real navigation by the proxy's dead-session path). No stuck sessions.

**Logout-all** works the same but soft-deletes *every* session row for the user (kills all devices).

---

## The whole picture (one diagram)

```
   🧍 types email+password, clicks Login
        │
        ▼
   🖥️ App ── client-side zod validation ──▶ POST /auth/login  (X-Client-Type for admin)
        │                                        │
        │                                  🏢 API  (throttle → DTO → AuthService.login)
        │                                        │  find user → dummy-hash compare → lockout? →
        │                                        │  load RBAC → create session row → sign 2 JWTs
        │                                        ▼
        │                              🗄️ DB: session row (hashed refresh token) + counters
        │                                        │
        │◀─────────── 200 + Set-Cookie: accessToken (15m) + refreshToken (7d) HttpOnly
        ▼
   app: authLogin() → broadcast "logged-in" → router.push(/hello)
        │
        ▼
   🚪 Proxy on next navigation ── reads cookies server-side
        ├─ no cookie ─────────────▶ /auth/login?redirect=…
        ├─ token ~expiring ───────▶ server-side /auth/refresh → forward Set-Cookie (Layer 1)
        ├─ dead session ──────────▶ clear cookies → /auth/login
        └─ fine ──────────────────▶ serve page
        │
        ▼
   🖥️ App mounts ── isInitializing spinner ──▶ GET /auth/me (cookies auto-sent)
                                                  │
                                           🏢 API: AuthGuard verifies access token
                                                  │  401? ──▶ Layer 2: client single-flight refresh
                                                  ▼                 │
                                                  ✅ render profile        🏢 /auth/refresh → rotate → retry request
                                                  (15 min later, the whole   │
                                                   refresh dance repeats)    ▼
                                                                       app: if "expired" → clear cache + login page
                                                                            if "transient" → 30s cooldown, stay logged in
```

---

## The 60-second summary (if you read nothing else)

1. **Login** = the app validates your input → the API checks your password against a bcrypt hash (timing-safe, lockout-aware) → mints a **15-min access token** + **7-day refresh token** → sets them as **HttpOnly cookies** → redirects you in.
2. **Every page load** goes through the **proxy**, which reads those cookies server-side, refreshes them if they're about to expire, and bounces you to login if they're gone.
3. **Every API call** rides the access token; when it 401s, the **client** silently refreshes once (single-flighted) and retries — and never logs you out for a mere network blip (cooldown).
4. **Both refresh layers exist so you never see a login form in the middle of a session** — and the cookie isolation (web vs admin) keeps the two apps from sharing sessions.
5. **Logout** = revoke the session row + clear the cookies + tell the other tabs.

