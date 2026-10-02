# 10 — Security, Authentication & Authorization

## Security principle

The server is authoritative. The frontend may hide UI, but it cannot grant permission — every server-side handler re-checks authorization regardless of what the client believes is allowed, what a hidden button implies, or what a disabled form field suggests. See `05-contracts-zod-api.md`'s "Never trust the frontend" section — everything in this document is downstream of that one fact.

```text
❌ DON'T reason: "we only show the delete button to admins in the UI, so
   the DELETE endpoint doesn't need its own permission check."

   A user can call the API directly, bypassing your UI entirely. If the
   endpoint itself doesn't check permission, hiding the button accomplished
   nothing except making the vulnerability slightly less obvious.

✅ DO check authorization on every single request, at the server, every
   time, regardless of what the UI does or doesn't show.
```

## Authentication vs authorization

Authentication answers "who are you?" Authorization answers "what are you allowed to do?" Keep these concerns separate in code, not just in concept — a guard that authenticates should not also be the thing deciding permissions; that's a second guard, or a second, composable check.

## Authorization layers

Use the simplest layer that correctly expresses the rule:

```text
Authentication → RBAC → resource permission → ownership/relationship → tenant/org boundary → database/RLS (defense-in-depth)
```

Don't cram an enormous permission matrix into a JWT merely for convenience — fetch/derive permissions server-side per request where the matrix is large or changes often, so a permission revoked mid-session takes effect immediately rather than waiting for a token to expire.

## Roles and permissions

```ts
// ❌ DON'T — the literal string 'admin' scattered across dozens of files,
// with no single place that defines what roles/permissions even exist
if (user.role === 'admin') { ... }               // controller A
if (user.role === 'Admin') { ... }                // controller B — typo, silently never matches!
if (currentUser.userRole === 'admin') { ... }      // controller C — different property name entirely

// ✅ DO — one typed source of truth, imported everywhere
export enum Permission {
  USER_READ = 'USER.READ',
  USER_CREATE = 'USER.CREATE',
  REWARD_UPDATE = 'REWARD.UPDATE',
  REWARD_PUBLISH = 'REWARD.PUBLISH',
}
if (hasPermission(user, Permission.REWARD_PUBLISH)) { ... }
```

Prefer stable permission identifiers over scattered literal strings — define them once (e.g. `packages/contracts/src/permissions.ts`) and reference that everywhere: controllers, guards, and the frontend's UI-hiding logic all read from the same source, so a typo becomes a compile error instead of a silent authorization bypass.

## Per-endpoint permission mapping — mandatory for every new endpoint

Every new (or modified) endpoint must have its authorization requirements explicitly and visibly mapped — not left implicit in "well, it's under `/admin` so presumably it's admin-only." At minimum, document and enforce:

| Field | Example |
|---|---|
| Endpoint | `POST /rewards/:id/publish` |
| Required permission(s) | `REWARD.PUBLISH` |
| Ownership/relationship check | Reward must belong to the caller's organization |
| Tenant/org boundary | Enforced via `tenantId` scoping in the query, not just the permission check |
| ReBAC rule (if any) | Caller must be a `manager` of the `location` the reward belongs to |
| RLS coverage (if enabled) | `rewards` table policy scopes by `organization_id` |

This mapping lives two places, kept in sync: as an explicit `@UseGuards(...)`/permission-decorator chain on the controller method (so it's enforced), and as a short entry in the feature's module documentation (so it's reviewable without reading every guard's implementation — see `14-documentation.md`). A PR adding an endpoint without this mapping is incomplete — see `16-code-review-checklist.md` and `18-definition-of-done.md`.

```ts
// ❌ DON'T — a new endpoint with no guards at all, added quickly to
// "unblock" a frontend feature, with a mental note to "add auth later"
@Post(':id/publish')
public async publish(@Param('id') id: string) {
  return this.rewardsService.publish(id);
}

// ✅ DO — the full mapping, enforced at the point of definition, not deferred
@Post(':id/publish')
@RequirePermission(Permission.REWARD_PUBLISH)
@RequireOwnership({ resource: 'reward', relation: 'organization' })
public async publish(@Param('id') id: RewardId, @CurrentUser() user: AuthUser): Promise<RewardResponseDto> {
  return this.rewardsService.publish(id, user);
}
```

## ReBAC

Relationship-based rules apply when access depends on a relationship rather than a flat role:

```text
user → member_of → organization
user → owns → resource
manager → manages → location
```

Keep relationship evaluation explicit and testable — a policy function that takes `(user, resource)` and returns a boolean/reason, not authorization logic inlined ad hoc across multiple controllers where it's easy for one copy to drift from another.

## RLS

If PostgreSQL RLS is adopted: define policies intentionally, test both allowed and denied access for each policy, ensure session/tenant context cannot be forged by a client, and understand the connection-pooling implications. RLS is defense-in-depth, not a substitute for application authorization — both layers must independently deny access for the same case, so a bug in one doesn't become a full breach.

## Impersonation

If admin impersonation exists: make it explicit, audit every impersonated action (see audit logging below — impersonated actions are exactly the kind of thing an audit log must capture precisely), distinguish the acting administrator from the subject being impersonated, never lose the original administrator's identity in logs, expire impersonation context, and make the UI visibly indicate impersonation is active.

## Secrets

Never commit passwords, private keys, API secrets, database credentials, or signing keys. Public client configuration is not secret merely because it lives in an environment variable — anything shipped to a browser or mobile bundle (`NEXT_PUBLIC_*`, `EXPO_PUBLIC_*`) must be treated as public.

## Extra server-side validation — never trust that the frontend already checked

This is worth restating here, specifically for security-sensitive fields, because it's the single most common real-world vulnerability class: assuming a value is safe because the UI wouldn't have let the user submit it.

```ts
// ❌ DON'T — trusting a role or price claimed by the client
@Post('checkout')
async checkout(@Body() body: { items: CartItem[]; totalPrice: number }) {
  await charge(body.totalPrice); // the client computed this — what stops them from sending 0.01?
}

// ✅ DO — the server independently recomputes anything security- or
// money-relevant from trusted server-side data, and IGNORES any client-
// supplied value for it entirely
@Post('checkout')
async checkout(@ZodBody(CheckoutSchema) body: CheckoutDto) {
  const items = await this.pricingService.priceItems(body.itemIds); // server looks up real, current prices
  const total = items.reduce((sum, item) => sum + item.price * item.quantity, 0); // computed server-side, not trusted from the client
  await charge(total);
}
```

Anything that determines price, permission, ownership, or identity must be recomputed or independently verified server-side — never taken as given from client input, even if the client-side code "would never send something wrong."

## Web security

Consider CSRF, XSS, SSRF, SQL injection, prototype pollution, open redirects, insecure file uploads (`20-object-storage.md`), authorization bypass, and rate limiting on every feature that accepts input or handles sessions.

## Mobile security

Never ship server secrets inside an Expo client bundle. Client applications — mobile included — are hostile environments; assume the binary can be decompiled and any embedded value extracted.

## Audit logging — mandatory for every state-changing transaction

Every meaningful transaction — every create, update, delete, and every sensitive read (e.g. viewing another user's PII) — is recorded in a durable, append-only audit log. This is not optional, and it is not the same thing as your regular application logs (`12-observability-and-operations.md`) — audit logs exist specifically so that, if something goes wrong (a data breach, an insider misusing access, a customer disputing "I never authorized that"), there is a complete, trustworthy record of exactly what happened, who did it, and from where.

### What every audit log entry must include

| Field | Why |
|---|---|
| `organizationId` / `orgId` | Which org's data was touched — critical for multi-tenant forensics |
| `tenantId` | Same, if tenancy is modeled separately from org |
| `userId` (and `actingAsUserId` if impersonating) | Who performed the action — the real actor, never just who they claimed to be |
| `timestamp` (epoch, UTC) | Exactly when — epoch milliseconds, not a locale-formatted string, so it sorts and compares unambiguously |
| `endpoint` | Which API route/operation was hit |
| `requestBody` | What was sent (redact secrets/payment details — see below) |
| `responseBody` / `responseStatus` | What happened as a result |
| `ipAddress` | Where the request came from |
| `userAgent` / `device` | What client/device made the request |
| `requestId` / `traceId` | Correlates this entry with logs/traces for the same request (`12-observability-and-operations.md`) |

Include as much additional metadata as is reasonably available and safe to store — session ID, geographic region derived from IP, API key/client ID if the request came from a service account rather than a human. More forensic detail is better than less, within the redaction rules below.

```ts
// ✅ DO — an audit log entry, written as part of (or immediately after)
// every state-changing request, via a shared interceptor rather than
// hand-written per endpoint (hand-written invites the exact endpoint
// that most needed logging to be the one someone forgot)
interface AuditLogEntry {
  organizationId: string;
  tenantId: string;
  userId: string;
  actingAsUserId?: string; // set only during impersonation
  timestampEpochMs: number;
  endpoint: string;
  method: string;
  requestBody: Record<string, unknown>; // redacted, see below
  responseStatus: number;
  responseBody?: Record<string, unknown>; // redacted, see below
  ipAddress: string;
  userAgent: string;
  requestId: string;
}
```

### Implementation approach

Write audit entries from a shared NestJS interceptor applied globally (or to every state-changing route), not by hand inside each controller method — an audit log that depends on every developer remembering to add a line of logging code to every new endpoint will, eventually, have gaps exactly where they matter most.

```ts
@Injectable()
export class AuditLogInterceptor implements NestInterceptor {
  public constructor(private readonly auditLog: AuditLogService) {}

  public intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const request = context.switchToHttp().getRequest<Request>();
    const startedAt = Date.now();
    return next.handle().pipe(
      tap({
        next: (responseBody) => this.record(request, 200, responseBody, startedAt),
        error: (err) => this.record(request, err.status ?? 500, { error: err.message }, startedAt),
      }),
    );
  }

  private async record(request: Request, status: number, responseBody: unknown, startedAt: number): Promise<void> {
    await this.auditLog.write({
      organizationId: request.user?.organizationId,
      tenantId: request.user?.tenantId,
      userId: request.user?.id,
      timestampEpochMs: startedAt,
      endpoint: request.path,
      method: request.method,
      requestBody: redactSensitiveFields(request.body),
      responseStatus: status,
      responseBody: redactSensitiveFields(responseBody),
      ipAddress: request.ip,
      userAgent: request.headers['user-agent'] ?? 'unknown',
      requestId: request.headers['x-request-id'] as string,
    });
  }
}
```

### Redaction

Audit logs must never contain plaintext passwords, full payment card numbers, authentication tokens, or other secrets — redact these fields (replace with `[REDACTED]`) before writing, the same way `12-observability-and-operations.md` requires for regular application logs. The goal is a complete forensic record of *what happened*, not a second place secrets can leak from.

### Storage and immutability

Audit log storage should be append-only in practice — application code should never have an `UPDATE`/`DELETE` path for audit log rows (a separate, tightly-restricted retention/archival job is a different concern from "can a compromised application account tamper with its own audit trail"). Store audit logs somewhere queryable for incident response (a dedicated table or a log aggregation system), and keep them for a retention period that matches your compliance/business requirements — this is a decision worth an explicit ADR (`14-documentation.md`).

## Password hashing

```ts
// ❌ DON'T — a fast, general-purpose hash (MD5, SHA-256 alone) for
// passwords. These are DESIGNED to be fast, which is exactly the wrong
// property for password hashing — it makes brute-forcing a leaked
// hash database cheap and fast for an attacker.
const hash = crypto.createHash('sha256').update(password).digest('hex');

// ✅ DO — a purpose-built, deliberately slow password hashing algorithm
// (argon2id preferred; bcrypt acceptable) with an appropriate work factor
const hash = await argon2.hash(password, { type: argon2.argon2id });
```

Never store a password in any reversible form, ever, under any circumstance — not "temporarily," not "for debugging," not in a log (`12-observability-and-operations.md`'s redaction rule applies with zero exceptions here).

## Session and token management

```text
❌ DON'T — a JWT access token with a long expiry (days/weeks) and no
   revocation mechanism. If a token is ever compromised, there is
   NOTHING that can be done to invalidate it short of rotating the
   signing key for every user.

✅ DO — short-lived access tokens (minutes, not days), paired with a
   longer-lived, revocable refresh token stored server-side (or in a
   database-backed session table) that CAN be invalidated (logout,
   suspected compromise, password change) — the access token's short
   life bounds the damage window even without an explicit revocation
   check on every single request.
```

Rotate refresh tokens on use (issue a new one, invalidate the old one, on every refresh) so a stolen refresh token has a narrow, single-use window rather than being silently reusable indefinitely by an attacker who intercepted it once.

## CORS

```ts
// ❌ DON'T — a wildcard CORS policy on any endpoint that reads
// cookies/credentials, which effectively lets ANY website make
// authenticated requests on behalf of a logged-in user's browser
app.enableCors({ origin: '*', credentials: true }); // this combination is actively dangerous, and most frameworks will refuse it outright for good reason

// ✅ DO — an explicit, narrow allowlist of trusted origins
app.enableCors({ origin: ['https://app.example.com', 'https://admin.example.com'], credentials: true });
```

## Content Security Policy and security headers

Every web response should carry, at minimum: a Content-Security-Policy restrictive enough to meaningfully limit XSS blast radius (no unrestricted `unsafe-inline`/`unsafe-eval` without a specific, understood reason), `X-Content-Type-Options: nosniff`, `X-Frame-Options`/`frame-ancestors` to prevent clickjacking unless the app deliberately needs to be embeddable, and `Strict-Transport-Security` in production. Set these centrally (a shared middleware/Next.js config), not ad hoc per route where it's easy to forget on a new one.

## Input sanitization vs validation — two different jobs

```text
❌ DON'T conflate these: "I validated this input with a zod schema, so
   it's safe to render as HTML" — validation confirms the SHAPE and
   constraints of data (it's a string, under 500 characters), it says
   NOTHING about whether that string is safe to interpret as HTML/SQL/a
   shell command.

✅ DO treat sanitization as a separate, additional step for the SPECIFIC
   sink the data is headed to: escape/sanitize HTML before rendering
   user-supplied content as markup (or better, never render it as raw
   HTML at all — let React's default text-content escaping handle it,
   and use a vetted sanitization library only for the rare case of
   genuinely needing to render user-supplied rich text), use
   parameterized queries (which Prisma gives you by default — never
   drop to raw string-concatenated SQL) for anything database-bound, and
   never pass unsanitized input to a shell command at all if it can
   possibly be avoided.
```

```tsx
// ❌ DON'T
<div dangerouslySetInnerHTML={{ __html: userComment }} /> // XSS if userComment isn't sanitized

// ✅ DO — let React escape it by default
<div>{userComment}</div>
```

## Brute-force and enumeration protection

Beyond the endpoint-level rate limiting already covered (`02-backend-nestjs.md`), specifically protect flows that reveal whether an identifier exists (login, password reset, signup) from enumeration: return the same response shape and timing regardless of whether the email/username exists, so an attacker can't use response differences to build a list of valid accounts.

```ts
// ❌ DON'T — different responses leak whether an account exists
if (!user) throw new NotFoundException('No account with that email');
// vs a different error/success path when the user DOES exist — an attacker
// can enumerate valid emails just by observing which response they get

// ✅ DO — same response either way
// "If an account exists with that email, we've sent a reset link."
```

## Dependency vulnerability scanning

Every dependency update runs through automated vulnerability scanning (via the package manager's own audit tooling or a dedicated service) as part of CI (`13-ci-cd-and-quality-gates.md`) — a known-vulnerable dependency version should fail the build, not be discovered later during a security review.

## PII handling

Treat personally identifiable information (name, email, address, phone, NRIC/passport/any government ID, precise location, biometrics) as a distinct category requiring deliberate handling: minimize what's collected to only what's genuinely needed, and apply the same redaction discipline to it in logs and audit trails as to secrets (`12-observability-and-operations.md`, this document's audit-logging section).

### Malaysia: PDPA 2010 (as amended 2024) — what engineering must be able to do

This project currently targets the Malaysian market, so the governing law is the Personal Data Protection Act 2010 as amended by the Personal Data Protection (Amendment) Act 2024, which came into force in stages during 2025 — not GDPR/CCPA. Details and deadlines evolve through Commissioner guidelines, so **confirm current requirements with counsel and the PDP Commissioner's published guidance**; this section only records what the code and infrastructure must be *able* to support. It is engineering guidance, not legal advice.

| PDPA requirement (summary) | What the codebase must support |
|---|---|
| Security principle — protect personal data from loss, misuse, unauthorized access | Everything in this document: authorization, encryption in transit, secrets handling, audit logging, least privilege |
| Retention principle — don't keep personal data longer than necessary | A documented retention period per data category and a **purge/anonymization job** (see below) |
| Data access and correction requests | An admin-usable, audited way to export and correct a person's data |
| Data portability (added 2025) | A machine-readable export (e.g. JSON/CSV) of a person's data, built from the same zod schemas |
| Mandatory breach notification (added 2025) | Detection, an incident runbook, and the ability to establish *what was accessed* — the audit log is what makes this answerable (`12`, `14`) |
| Data Protection Officer (added 2025, for qualifying organisations) | A named contact; an organisational matter, but the runbook lists who to call |
| Sensitive data now includes biometric data | Extra care: separate storage/encryption decisions and an ADR before collecting fingerprints or face data |
| Cross-border transfer rules | Know which regions your database, object storage, queues, logs, and third-party processors (email, analytics, payment) run in; record it in an ADR |

### Soft delete is not deletion under the retention principle

This project's mandatory soft delete (`isDeleted`, `deletedAt`, `deletedBy`) hides a record from normal views but leaves the personal data physically present. Retention is therefore a **separate, deliberate mechanism**:

```text
❌ DON'T assume soft delete satisfies "don't keep it longer than necessary".
❌ DON'T keep personal data in the audit log forever — request/response bodies are exactly where PII hides.
✅ DO define, per data category, a retention period and what happens at expiry (hard delete or irreversible anonymization).
✅ DO run the purge as a tracked, idempotent, batched job (`08-database-prisma.md` backfill rules) that is the ONLY allowlisted place a hard delete is allowed.
✅ DO give audit-log entries their own retention period and keep PII in them redacted or tokenized from the start.
✅ DO record each purge itself (what category, how many rows, when) without recording the purged data.
```

Anonymization must be irreversible (replace identifying fields with non-reversible placeholders, keep only non-identifying facts needed for accounting/analytics) — a reversible "mask" is still personal data.

## Multi-factor authentication

```text
❌ DON'T treat MFA as an all-or-nothing, purely optional add-on bolted
   onto login with no thought about WHICH actions should require it.

✅ DO offer MFA (TOTP-based at minimum) for all accounts, and REQUIRE it
   (step-up authentication, even for an already-logged-in session) for
   the highest-sensitivity actions specifically — changing an account's
   own email/password, viewing/exporting payment details, admin
   impersonation (above), and any action this project's audit-logging
   section would flag as high-risk.
```

## Service-to-service authentication — API keys and machine credentials

```text
❌ DON'T reuse the same authentication mechanism built for human users
   (a login-session cookie, a short-lived user JWT) for service-to-service
   calls — a service account has different lifecycle needs (no login
   flow, needs to be revocable independently of any human's session, and
   often needs a narrower, fixed permission scope rather than whatever a
   human happens to have).

✅ DO issue distinct API keys/service credentials for machine-to-machine
   calls, scoped to the minimum permission the calling service actually
   needs (Interface Segregation applied to auth, effectively —
   21-oop-and-solid-principles.md), independently revocable, and
   distinguishable in the audit log (this document's audit-logging
   section) from a genuine human-initiated action — a security incident
   investigation needs to be able to tell "a human did this" from "an
   automated service did this" at a glance.
```

## Secrets rotation

```text
❌ DON'T treat a secret (a database password, an API key, a signing key)
   as something set once at initial setup and never touched again —
   every credential that's never rotated is a credential whose exposure
   window, if it's ever leaked, is effectively unbounded.

✅ DO have an actual, documented rotation process (even if manually
   triggered rather than fully automated) for every credential class,
   and rotate immediately — not on the next scheduled cycle — the moment
   a leak is suspected (a secret accidentally committed to git history,
   even if the commit was later reverted; git history retains it).
```

## Webhook signature verification

```ts
// ❌ DON'T — process an incoming webhook payload without verifying it
// actually came from the claimed provider; a webhook URL, once known
// (they're often not secret), can be hit by anyone with a
// perfectly-formed fake payload
@Post('webhooks/stripe')
async handleWebhook(@Body() body: unknown) {
  await this.processPayment(body); // an attacker can POST a fake "payment succeeded" event
}

// ✅ DO — verify the provider's cryptographic signature BEFORE
// validating/processing the payload at all (and remember, per
// 03-web-nextjs.md's middleware section, that signature verification
// typically needs the RAW request body, which means body-parsing
// middleware order matters)
@Post('webhooks/stripe')
async handleWebhook(@Req() req: RawBodyRequest<Request>, @Headers('stripe-signature') signature: string) {
  const event = this.stripe.webhooks.constructEvent(req.rawBody, signature, this.webhookSecret); // throws if the signature is invalid — nothing downstream runs on a forged payload
  await this.processEvent(event);
}
```

## The full worked example — an endpoint from request to audit log

Tying together everything in this document into one concrete flow, for a single endpoint: `POST /rewards/:id/publish`.

```text
1. Request arrives with a bearer token.
2. AuthGuard verifies the token's signature and validity, resolves it
   to a real, current user record (not trusting any claim embedded in
   the token beyond its identity — permissions are looked up fresh,
   per this document's "don't cram a large permission matrix into a
   JWT" guidance above).
3. PermissionGuard checks the resolved user has REWARD.PUBLISH.
4. OwnershipGuard checks the specific reward (looked up by :id) belongs
   to the user's own organization — this is a SEPARATE check from #3;
   having the permission generally does not mean owning THIS specific resource.
5. The controller calls RewardsService.publish(id, user) — which itself
   re-validates business eligibility (is this reward in a publishable
   state at all?) rather than assuming the guards already covered everything.
6. On success, the AuditLogInterceptor (already running around the
   whole request per this document's audit-logging section) records:
   organizationId, userId, timestampEpochMs, endpoint, the request body
   (redacted), 200 status, ipAddress, userAgent, requestId.
7. Response returns the published reward.

If step 2, 3, or 4 fails, the request is rejected BEFORE step 5 ever
runs — and the audit log STILL records the attempt (with its actual
failure status code), because a denied request is exactly the kind of
event a security investigation later needs visibility into, not just
successful ones.
```

## Common authorization mistakes, catalogued

```text
❌ Checking permission but not ownership: a user with REWARD.PUBLISH
   generally can publish ANY organization's reward, not just their own,
   because only the permission was checked, not the resource relationship.

❌ Checking ownership but trusting a client-supplied organizationId to
   do it: the ownership check itself must use the SERVER's own record of
   which organization the resource and the user belong to — never a
   client-supplied field claiming which organization a request is "for."

❌ Checking authorization in the frontend only, with the assumption the
   backend "probably" also checks it, without actually verifying that
   assumption for this specific endpoint.

❌ A permission check that's present but checks the WRONG permission
   (copy-pasted from a neighboring endpoint and never updated to match
   this endpoint's actual action) — this passes review at a glance
   because "a guard is there," but doesn't actually protect anything
   correctly. See 16-code-review-checklist.md's "common false-pass
   patterns" section — this is exactly the kind of thing that needs a
   reviewer to actually READ which permission is named, not just confirm one exists.

❌ Authorization logic duplicated slightly differently across several
   endpoints that should share the exact same rule, which drifts apart
   over time as one gets updated and the others don't — extract a shared
   policy (per 02-backend-nestjs.md's "OrderEligibilityPolicy" pattern)
   the moment the same rule appears in a second place.
```

## Threat modeling a new feature (STRIDE, applied in five minutes)

Before building anything that touches auth, money, files, or other users' data, run this quick pass. Each letter is a question; write the answer down in the PR description.

```text
S — Spoofing:          Can someone pretend to be another user/service? (auth, webhook signature, API keys)
T — Tampering:         Can someone modify data they shouldn't? (server-side validation, signed URLs, ownership checks)
R — Repudiation:       Could a user deny doing something, and could we prove otherwise? (audit log completeness)
I — Information disclosure: Can someone read data they shouldn't? (tenant scoping, response mapping, log redaction, enumeration)
D — Denial of service: Can one actor exhaust a shared resource? (rate limits, bounded pagination, upload size caps, expensive endpoints)
E — Elevation of privilege: Can a low-privilege actor reach a high-privilege action? (guards, ownership, mass assignment)
```

```text
❌ DON'T skip this because "it's just a small endpoint." Small endpoints
   with a missing ownership check are how cross-tenant data leaks happen.
✅ DO write one line per letter, even if the line is "N/A — read-only,
   public data." The exercise is what surfaces the case you'd have missed.
```

## Mass assignment

```ts
// ❌ DON'T — spreading the request body straight into a database write.
// A client adds `"role": "admin"` or `"isDeleted": false` or
// `"organizationId": "<someone else's org>"` and it is persisted.
await prisma.user.update({ where: { id }, data: body });

// ✅ DO — the zod schema is an ALLOWLIST; only parsed, known fields pass
const dto = UpdateProfileSchema.parse(body);          // { name, avatarKey } and nothing else
await prisma.user.update({ where: { id: user.id }, data: dto });
```

Zod's default behavior of stripping unknown keys is your first line of defense here; `.strict()` (for sensitive schemas) turns "silently dropped" into "loudly rejected" so a probing client is visible in logs.

## Insecure direct object reference (IDOR)

```ts
// ❌ DON'T — the ID in the URL is the only thing checked. Any authenticated
// user can read any order by guessing/incrementing IDs.
@Get(':id') findOne(@Param('id') id: string) { return this.orders.findById(id); }

// ✅ DO — the query itself is scoped to what the caller may see
@Get(':id') findOne(@Param('id') id: OrderId, @CurrentUser() u: AuthUser) {
  return this.orders.findByIdForUser(id, u); // WHERE id = ? AND organizationId = ? [AND customerId = ?]
}
```

Using UUIDs instead of sequential integers makes guessing harder but is **not** authorization. Never let "the ID is unguessable" stand in for an ownership check.

## OWASP Top 10 mapping — where each is handled in this rule set

| OWASP category | Where this rule set addresses it |
|---|---|
| Broken access control | Per-endpoint permission mapping, ownership checks, tenant scoping, RLS (`10`, `08`) |
| Cryptographic failures | argon2id, no secrets in clients, TLS/HSTS, signed URLs (`10`, `20`) |
| Injection | Prisma parameterization, zod allowlists, sort-field allowlists, no raw SQL concatenation (`05`, `08`, `10`) |
| Insecure design | Threat modeling above, Definition of Ready (`15`) |
| Security misconfiguration | Validated env at boot, CORS allowlist, security headers, Swagger exposure decision (`02`, `10`) |
| Vulnerable components | Dependency scanning in CI, automated update PRs (`13`) |
| Identification & authentication failures | Short-lived tokens, refresh rotation, MFA step-up, brute-force limits (`10`) |
| Software & data integrity failures | Webhook signature verification, lockfile, reproducible builds, idempotency (`09`, `13`) |
| Logging & monitoring failures | Audit log + structured logs + alerting (`10`, `12`) |
| SSRF | Never fetch a client-supplied URL without an allowlist and network egress controls (`10`) |

## SSRF — server-side request forgery

```ts
// ❌ DON'T — the server fetches whatever URL the client supplies. An attacker
// points it at http://169.254.169.254/ (cloud metadata) or an internal admin service.
const res = await fetch(dto.imageUrl);

// ✅ DO — allowlist hosts, resolve and block private/link-local ranges,
// enforce timeouts and response-size limits; better still, don't fetch
// client-supplied URLs at all (accept an upload via a signed URL instead)
const url = SafeExternalUrlSchema.parse(dto.imageUrl); // https only, host in allowlist
const res = await fetchWithTimeout(url, { timeoutMs: EXTERNAL_FETCH_TIMEOUT_MS, maxBytes: MAX_REMOTE_IMAGE_BYTES });
```

## Security review checklist for any PR touching auth, money, files, or tenancy

- [ ] STRIDE pass written in the PR description
- [ ] Every new endpoint: permission + ownership + tenant mapped and tested (allowed AND denied)
- [ ] No client-supplied identity/role/org/price trusted
- [ ] No raw SQL; if unavoidable, parameterized and reviewed by a second person
- [ ] Rate limits set appropriately for the endpoint's sensitivity and cost
- [ ] Logs and audit entries redact secrets/PII
- [ ] Error responses leak nothing internal
- [ ] New dependency scanned; new secret stored only server-side

## Session and account lifecycle events that must be audited

Login success/failure, logout, token refresh and refresh-token reuse detection, password change/reset, MFA enrollment/removal, role/permission changes, API key creation/revocation, impersonation start/stop, data export, account deletion request/completion, and every denied authorization attempt. These are the events an investigator asks about first; if any is missing from the audit log, the log has a hole exactly where an attacker would operate.

## Refresh token reuse detection

```text
Refresh tokens rotate on every use. If a refresh token that was ALREADY used is presented again, one of two things happened:
a client bug, or theft. Treat it as theft: revoke the entire token family for that session, force re-authentication,
audit-log the event, and (for high-risk accounts) notify the user.
❌ Quietly issuing a new token pair for a reused refresh token.
✅ Revoke the family; make the attacker and the legitimate client both re-authenticate.
```
