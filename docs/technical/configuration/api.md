---
title: "API Configuration & Environment Variables"
tags: ["configuration", "environment", "nestjs", "zod", "security"]
description: "How apps/api reads its environment: one zod schema parsed once before Nest bootstraps, value-free fail-fast errors, no insecure secret defaults, and TypedConfigService as the only way code reads configuration."
order: 7
author: "Platform Team"
lastUpdated: 1790812800000
coverImage: "https://images.unsplash.com/photo-1558494949-ef010cbdcc31?auto=format&fit=crop&w=1600&q=80"
---

# API Configuration & Environment Variables

> [!NOTE] This page covers `apps/api` and `apps/analytics-consumer`. The
> Next.js apps are covered in [Configuration (Next.js apps)](./frontend.md).
> All of them share the building blocks and the `parseEnvOrThrow` /
> `EnvValidationError` format from `@workspace/shared` (`runtime/app-env.ts`).

## Table of Contents

1. [The rule in one sentence](#1-the-rule-in-one-sentence)
2. [Architecture](#2-architecture)
3. [How validation fails](#3-how-validation-fails)
4. [Using config in code](#4-using-config-in-code)
5. [Variables](#5-variables)
6. [Cross-field rules](#6-cross-field-rules)
7. [Breaking changes (Phase B)](#7-breaking-changes-phase-b)
8. [Adding a variable](#8-adding-a-variable)
9. [Tests](#9-tests)
10. [Scripts and tooling outside Nest](#10-scripts-and-tooling-outside-nest)

---

## 1. The rule in one sentence

**Only `apps/api/src/config/api-config.ts` reads `process.env`**. It parses the
whole environment once, through one zod schema, before Nest bootstraps; every
other file injects `TypedConfigService`. ESLint enforces it
(`no-restricted-properties` in `apps/api/eslint.config.js`), and a lint canary
(`src/eslint-boundaries.spec.ts`) fails if the ban is ever dropped.

---

## 2. Architecture

```
packages/shared/src/runtime/app-env.ts      ← building blocks shared by every app (never reads process.env)
  NodeEnvSchema, HttpUrlEnvSchema, BooleanFlagEnvSchema, CookieDomainEnvSchema,
  integerEnvSchema, optionalIntegerEnvSchema, commaSeparatedEnvSchema,
  PostgresUrlEnvSchema, KafkaBrokersEnvSchema, parseEnvOrThrow, EnvValidationError

apps/api/src/config/
├── api-env.fields.ts          ← API-only field schemas: secrets, AES-256 keys, MFA key ring,
│                                JWT expiry, 0/1 toggles, log level, cache backend, storage provider
├── api-config.schema.ts       ← THE contract: ApiEnvInputSchema (flat, variable-named)
│                                → cross-field rules → grouped, typed ApiConfig
├── api-config.ts              ← parseApiConfig(source) + getApiConfig() (memoized; the ONLY process.env read)
├── typed-config.service.ts    ← TypedConfigService: named getters over ApiConfig (no fallbacks, no env reads)
├── tenancy.config.ts          ← TenancyConfigService (backed by TypedConfigService)
└── config.module.ts           ← @Global: provides TypedConfigService from getApiConfig()

apps/api/src/main.ts           ← getApiConfig() FIRST, then `await import("./bootstrap/bootstrap-app")`
apps/analytics-consumer/src/env.ts ← the consumer's OWN schema (its own .env — never apps/api/.env; see apps/analytics-consumer/.env.example)
```

Boot order:

1. `main.ts` loads `.env` (`dotenv/config`) and calls `getApiConfig()`.
2. On an `EnvValidationError` it writes the message to stderr and exits with
   code `1` — **before the Nest module graph is even imported**. (Several module
   files decide their imports at load time — queues only with `REDIS_URL`,
   NestJS Observe only with credentials — so the graph is imported dynamically
   after validation.)
3. `bootstrapApp(config)` builds the Fastify adapter and the Nest app from the
   same memoized `ApiConfig`; `ConfigModule` wraps it in `TypedConfigService`.

Runtime `NODE_ENV` is authoritative. The production build's rspack
`DefinePlugin` inlines `process.env.NODE_ENV` for dependencies, but the config
module hands the whole `process.env` object to the schema, so our code always
sees the real runtime value.

---

## 3. How validation fails

```text
Invalid environment configuration for apps/api:
  - DATABASE_URL: must be a postgres:// or postgresql:// connection URL
  - JWT_ACCESS_SECRET: is required but not set
  - JWT_REFRESH_SECRET: must be at least 32 characters (generate one with: pnpm secrets:generate apps/api/.env)
  - TENANT_ENCRYPTION_MASTER_KEY: is required but not set
Set these variables (see the app's .env.example). Values are never printed.
```

- **Every** invalid variable is listed, not just the first.
- **Values are never printed** — messages are built from variable names and
  schema messages; any value that still appears is replaced with `[redacted]`.
- Nested problems name the path: `MFA_ENCRYPTION_KEYS.1: must decode to exactly 32 bytes`,
  `CORS_ORIGINS.1: must be an absolute http:// or https:// URL`.
- An empty value (`FOO=`) counts as unset.
- Unknown variables are ignored (`process.env` carries the whole OS
  environment), so a typo in an *optional* name is not caught — check
  `.env.example`.

---

## 4. Using config in code

```ts
// ✅ Anywhere in the Nest graph: inject the typed service
@Injectable()
export class InviteService {
	public constructor(private readonly config: TypedConfigService) {}

	public inviteUrl(token: string): string {
		return `${this.config.merchantAppUrl}/invite/${token}`;
	}
}

// ✅ Module files that pick imports at load time (the config is already validated by main.ts)
const redisUrl: string | undefined = getApiConfig().messaging.redisUrl;

// ❌ Never — ESLint rejects it outside src/config/api-config.ts
const url = process.env.MERCHANT_APP_URL ?? "http://localhost:3003";
```

- There are **no fallbacks** in getters. Defaults live in the schema, next to
  the rule, and are documented in `.env.example`.
- Environment checks use `config.isProduction` / `isDevelopment` / `isTest`,
  never string comparisons.
- Libraries receive explicit values. `@workspace/messaging` no longer reads
  `REDIS_URL` / `KAFKA_BROKERS` / `RABBITMQ_URL` itself — the API passes them via
  `buildAppMessagingConfig(config.messaging)`.

---

## 5. Variables

`apps/api/.env.example` documents every variable (a test fails if one is
missing). Summary, grouped as in the schema:

| Group | Variables | Rules / defaults |
| --- | --- | --- |
| Runtime | `NODE_ENV`, `APP_NAME` | both **required**; `NODE_ENV` ∈ development/test/production |
| HTTP | `HOST`, `PORT`, `API_PUBLIC_URL`, `TRUST_PROXY`, `SHUTDOWN_TIMEOUT_MS`, `SECURITY_HARDENING_ENABLED`, `SWAGGER_ENABLED` | `127.0.0.1`, `8080` (1–65535), `http://HOST:PORT`, trust no proxy, `15000`; hardening on in production; Swagger and client-IP policy below |
| CORS / cookies | `CORS_ORIGINS`, `COOKIE_DOMAIN` | origins **required** (≥ 1 absolute http(s) URL); bare cookie host optional |
| Frontend URLs | `APP_URL`, `ADMIN_APP_URL`, `MERCHANT_APP_URL` | all **required** (no localhost fallbacks) |
| Database | `DATABASE_URL`, `DB_POOL_MAX`, `DB_IDLE_TIMEOUT_MS` | postgres URL **required**; `10`, `30000` |
| Auth | `JWT_ACCESS_SECRET`, `JWT_REFRESH_SECRET`, `EMAIL_VERIFICATION_SECRET`, `TWO_FACTOR_PENDING_SECRET`, `JWT_ACCESS_EXPIRY`, `JWT_REFRESH_EXPIRY`, `TWO_FACTOR_ISSUER`, `LOGIN_VERIFICATION_MODE`, `BCRYPT_SALT_ROUNDS` | four **required secrets** (≥ 32 chars, not the placeholder, pairwise different); `15m`, `7d`; issuer = `APP_NAME`; `new-device` (`new-device` \| `always` \| `disabled`, `disabled` rejected in production); 10–15, default `12` |
| MFA / encryption | `MFA_ENCRYPTION_KEYS`, `MFA_ENROLLMENT_DEADLINE_MS`, `MFA_RECOVERY_DELAY_MS`, `MFA_STEP_UP_TTL_MS`, `TENANT_ENCRYPTION_MASTER_KEY`, `TENANT_JOB_HMAC_SECRET` | MFA key ring and master key **required secrets** (base64 of exactly 32 bytes); 30 d / 24 h / 5 min; job secret optional (fails closed when unset) |
| Email | `EMAIL_MODE`, `RESEND_API_KEY`, `EMAIL_FROM_ADDRESS`, `EMAIL_REPLY_TO`, `EMAIL_TEST_TO`, `EMAIL_MAX_ATTEMPTS`, `EMAIL_TIMEOUT_MS`, `EMAIL_RATE_LIMIT_PER_MINUTE`, `RESEND_WEBHOOK_SECRET`, `WEBHOOK_RATE_LIMIT_PER_MINUTE` | `send`; key required with `send`; from address **required**; 1–10 (3), ≥ 100 ms (10000), 0; webhook 120/min |
| Rate limits / caches | `THROTTLE_*`, `SECURITY_COUNTER_MAX_KEYS`, `AUTHORIZATION_CACHE_*`, `USER_SESSION_CACHE_*`, `ACCESS_TOKEN_STATE_CACHE_*` | positive integers with the historical defaults; backends `memory`/`redis`/`auto` |
| Brokers | `REDIS_URL`, `BULLMQ_PREFIX`, `REDIS_NAMESPACE`, `KAFKA_BROKERS`, `RABBITMQ_URL`, `MESSAGING_CLIENT_ID`, `MESSAGING_CONNECTION_NAME` | `redis(s)://`, `host:port` list, `amqp(s)://`; Redis **required in production** |
| Kafka security / delivery | `KAFKA_SSL`, `KAFKA_SSL_CA_LOCATION`, `KAFKA_SASL_MECHANISM`, `KAFKA_SASL_USERNAME`, `KAFKA_SASL_PASSWORD`, `KAFKA_DELIVERY_TIMEOUT_MS` | `true`/`false`; CA PEM path (needs `KAFKA_SSL=true`); `plain` (needs TLS) / `scram-sha-256` / `scram-sha-512` with username + password; publish budget ms (≥ 1000, default 30000). Schema: `KafkaSecurityEnvShape` from `@workspace/messaging/kafka` |
| Storage | `STORAGE_PROVIDER`, `STORAGE_PRIVATE_CONTAINER` (+ aliases), `STORAGE_PUBLIC_CONTAINER` (+ alias), `STORAGE_CLOUDFRONT_PUBLIC_DOMAIN`, `FIREBASE_*`, `AWS_*`, `STORAGE_DOWNLOAD_TTL_SECONDS` (+ legacy alias), `STORAGE_PHYSICAL_DELETE_DELAY_MS`, `STORAGE_PROCESSING_CALLBACK_SECRET` | provider auto-detect; s3/firebase need a private container; AWS keys both-or-neither; callback secret optional (callbacks rejected when unset) |
| Observability | `LOG_LEVEL`, `MEMORY_MONITORING`, `MEMORY_LEAK_WARMUP_MS`, `MEMORY_LEAK_WINDOW_MS`, `MEMORY_LEAK_GROWTH_THRESHOLD_MB`, `OBSERVE_ENABLED`, `OBSERVE_APP_KEY`, `OBSERVE_APP_SECRET`, `OBSERVE_SERVICE_ID` | THE log level for pino, every Nest logger (info → LOG, debug → DEBUG, trace → VERBOSE; `silent` turns Nest logging off) and Prisma events (`warn`; same in every environment — `info` shows the route map, `debug` developer detail); memory monitoring always on in production — leak check on the heap measured after each major GC: warm-up ≥ 0 ms (300000), window ≥ 300000 ms (1800000, also the minimum gap between two `memory.leak_suspected` warnings), floor rise between the window halves ≥ 1 MB (64); Observe needs both credentials |
| Tenancy | `TENANCY_ENABLED`, `DEFAULT_ORGANIZATION_ID` | `false`; organization id **required in single-tenant mode** (a real organization, verified at boot — `pnpm db:seed` creates `a178a4d1-6915-4eb3-bf84-6fb14e1feb6c`) |

Swagger (`SWAGGER_ENABLED`, `0`/`1`/`false`/`true`): development/test — on by
default and public (`0` turns it off); production — OFF by default, and when
enabled with `SWAGGER_ENABLED=1` every docs URL (UI, `-json`, assets, `/docs`)
requires a platform SuperAdmin session (admin `adminAccessToken` cookie or a
Bearer token), else 401/403 (see [API Routes](../api/routes.md#9-api-docs-swagger)).

Client IP (`TRUST_PROXY`): unset = trust no proxy — the client IP is the TCP
peer and `X-Forwarded-For` is ignored. Otherwise a comma-separated list of the
proxies in front of the API (IPs, CIDRs, `loopback`/`linklocal`/`uniquelocal`);
the client IP is the first address in `X-Forwarded-For`, read right to left,
that is not a trusted proxy. `1`/`true` (trust everyone) is rejected at boot.
`cf-connecting-ip` is never read. One resolver (`common/http/client-ip.ts`)
feeds `request.ip`, rate-limit trackers, sessions and the audit log.

Toggles: the historical `0`/`1` switches (`SECURITY_HARDENING_ENABLED`, `SWAGGER_ENABLED`, `OBSERVE_ENABLED`) accept
`0`, `1`, `true`, `false`; the `true`/`false` flags (`MEMORY_MONITORING`,
`TENANCY_ENABLED`) accept exactly those two words. Anything
else fails boot instead of being guessed.

---

## 6. Cross-field rules

| Rule | Why |
| --- | --- |
| The four signing secrets must all differ | One leaked secret must not forge another token type |
| `EMAIL_MODE=send` requires `RESEND_API_KEY` | Otherwise every email silently fails at send time |
| `EMAIL_MODE` must be `send` on a deployed production environment (production with a non-localhost `APP_URL`) | `log-only` prints one-time codes and reset links into the log; `noop` reports fake "sent" results |
| `RESEND_WEBHOOK_SECRET` is required on a deployed production environment with `EMAIL_MODE=send` | Without it every delivery webhook is answered 503 and bounces/complaints never reach the email log |
| `LOGIN_VERIFICATION_MODE=disabled` is rejected in production | New-device verification is what stops a stolen password alone from opening a session |
| `EMAIL_TEST_TO` is rejected in production unless `APP_URL` is localhost | It redirects every outbound email to one inbox — fine on your machine (even for a production build), an outage for real users on a deployment |
| `REDIS_URL` is required in production | Distributed caches, rate limits and BullMQ need it |
| `AWS_ACCESS_KEY_ID` and `AWS_SECRET_ACCESS_KEY` are set together | Half a key pair is always a mistake |
| `OBSERVE_ENABLED` on requires both Observe credentials | An explicit opt-in must not silently do nothing |
| `STORAGE_PROVIDER=s3`/`firebase` requires a private container | Uploads would otherwise target a local-only name |

---

## 7. Breaking changes (Phase B)

| Change | Action |
| --- | --- |
| Secrets have **no defaults** anywhere (previously dev fallbacks such as `access-secret-change-me`, a public dev MFA key, `pilot-dev-job-secret-change-me`) | Set them: `pnpm secrets:generate apps/api/.env` |
| `MFA_ENCRYPTION_KEYS` entries must be base64 of **exactly 32 bytes** (the service always required it at use time; the old generator produced 128 bytes, so MFA encryption failed at runtime) | Regenerate the MFA key (`pnpm secrets:generate` now emits 32-byte keys). No existing MFA secret can have been encrypted with a non-32-byte key |
| Newly required: `NODE_ENV`, `APP_NAME`, `APP_URL`, `ADMIN_APP_URL`, `MERCHANT_APP_URL`, `CORS_ORIGINS`, `EMAIL_FROM_ADDRESS` (previously localhost/example fallbacks) | Set them (all are in `.env.example`) |
| `RESEND_API_KEY` required when `EMAIL_MODE=send` (the default) | Set it, or use `EMAIL_MODE=log-only` / `noop` |
| `REDIS_URL` required in **production** (was "outside development", checked only in `main.ts`) | Set it in production |
| Invalid values fail boot instead of falling back (e.g. `EMAIL_MODE=smtp`, `PORT=abc`, `BCRYPT_SALT_ROUNDS=4` — now 10–15, `LOG_LEVEL=silly`) | Fix the value |
| `TENANT_JOB_HMAC_SECRET` has no default; signing fails closed without it | Set it (≥ 32 chars) before signing tenant job contexts |
| `POST /files/processing-callback` is rejected in **every** environment without `STORAGE_PROCESSING_CALLBACK_SECRET` (dev used to accept unauthenticated callbacks) | Set the secret for custom processing workers |
| New `API_PUBLIC_URL` (default `http://HOST:PORT`) replaces the old `APP_URL`-based local-storage link base (which pointed at the web app) | Set it when the API sits behind a proxy |
| `@workspace/messaging` no longer reads env; `MessagingModuleOptions.redisUrl` / `kafkaBrokers` / `rabbitmqUrl` are required keys (`undefined` = disabled); `envKeys` and `resolveMessagingEnv` were removed | Pass values from your app's config |
| Removed: `validateApiEnv`, `validateEnv`, `apiEnvSchema`, `sharedEnvSchema` (`runtime/env-validation.ts`) and the unused `EnvSchema`/`parseEnv` (`schemas/api/env.ts`) from `@workspace/shared` | Use `parseEnvOrThrow` with your own schema |

`FORCE_LOGIN_VERIFICATION` (`true`/`false`) was replaced by `LOGIN_VERIFICATION_MODE`
(`true` → `always`, `false` → `new-device`). Verification used to be skipped
whenever `NODE_ENV=test`; it is now only ever off when explicitly `disabled`.

---

## 8. Adding a variable

1. Add it to `ApiEnvInputSchema` in `api-config.schema.ts`, reusing a building
   block (`integerEnvSchema`, `SecretEnvSchema`, `HttpUrlEnvSchema`, …). Secrets
   get **no default**. Put a default next to the rule for everything else.
2. Add a cross-field rule to `checkApiEnvRules` if it depends on another
   variable (always with a `path`, never echoing a value).
3. Map it into the grouped `ApiConfig` (`toApiConfig`) and add a named getter
   to `TypedConfigService`.
4. Document it in `apps/api/.env.example` (`env-example.spec.ts` fails until you do).
5. Add a TEST-ONLY fixture value to `test/support/test-api-env.ts` if it is required.
6. Extend `api-config.schema.spec.ts` (missing → named error, default, format).
7. If it affects the build output, declare it in `turbo.json`.

---

## 9. Tests

| Test | Covers |
| --- | --- |
| `src/config/api-config.schema.spec.ts` | Fixture parses; every required variable listed by name; no secret defaults; placeholder/short/duplicate secrets; MFA key ring; master key; formats; toggles; cross-field rules; derived values; Swagger policy; cache backend |
| `src/config/api-config.spec.ts` | Value-free `EnvValidationError`; unrelated OS variables ignored; `getApiConfig()` parses once |
| `src/config/typed-config.service.spec.ts` | Getters, client-app URLs, key copies, broker/cache/storage switches |
| `src/config/env-example.spec.ts` | `.env.example` documents every schema variable, ships secrets empty, and boots once secrets are filled |
| `src/eslint-boundaries.spec.ts` | `process.env` ban and frontend-import ban actually fire |
| `packages/shared/src/runtime/app-env.test.ts` | Shared building blocks |

Unit tests are hermetic: `test/setup-unit-env.ts` installs the TEST-ONLY
fixture from `test/support/test-api-env.ts` and never reads `apps/api/.env`.
e2e (`test/setup-env.ts`) loads `apps/api/.env` for infrastructure values
(database, Redis, tenant master key), fills gaps from the fixture, and **forces**
test-only signing secrets (including a test-only `RESEND_WEBHOOK_SECRET`),
`LOGIN_VERIFICATION_MODE=disabled` (one suite, `test/login-verification.e2e-spec.ts`,
boots with `always` to prove the code is required), a fixed
`CORS_ORIGINS` and `EMAIL_MODE=noop` (a test run never sends real email).
Build config for a test with `createTestApiConfig({ … })` /
`createTestTypedConfig({ … })` — never mutate `process.env`.

---

## 10. Scripts and tooling outside Nest

`prisma.config.ts`, `prisma/seed/**` and `apps/api/scripts/**` run outside the
Nest app (Prisma CLI, `tsx`) and keep reading the few variables they need
(`DATABASE_URL`, `REDIS_URL`, `BULLMQ_PREFIX`, `RESEND_WEBHOOK_SECRET`,
`WEBHOOK_URL`) directly; `prisma.config.ts` already fails fast with a clear
message when `DATABASE_URL` is missing. The ESLint `process.env` ban applies to
`src/**` only.
