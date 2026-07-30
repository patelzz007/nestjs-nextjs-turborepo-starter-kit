# Auth Roadmap

> Ideas and design decisions for improving authentication, authorization, and multi-tenancy.

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

```prisma
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

```prisma
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

```env
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
              │ Single-Tenant│   │  Multi-Tenant    │
              │ 1 org        │   │ N orgs           │
              │ Real name    │   │ Real names       │
              │ from .env    │   │ from header      │
              └──────────────┘   └─────────────────┘
                       │                │
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

```prisma
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

> Last updated: July 30, 2026
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
