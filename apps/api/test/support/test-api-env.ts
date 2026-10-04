// ============================================
// test/support/test-api-env.ts - TEST-ONLY environment fixtures
// ============================================
// Every value below is an obviously fake, TEST-ONLY fixture. None of them is
// accepted as a default anywhere in the app — the API refuses to boot without
// real values. They exist so unit tests are hermetic and e2e runs are
// deterministic. NEVER copy one of these into a real .env file.

import { SINGLE_TENANT_SEED_ORGANIZATION_ID } from "../../prisma/seed/organization-seed-ids";
import { parseApiConfig } from "../../src/config/api-config";
import type { ApiConfig } from "../../src/config/api-config.schema";
import { TypedConfigService } from "../../src/config/typed-config.service";

/** A raw env record, exactly as `process.env` would hold it. */
export type TestEnv = Readonly<Record<string, string>>;

/**
 * App-owned secrets. e2e FORCES these (overriding apps/api/.env) so a test run
 * never signs with, or depends on, a developer's real keys.
 */
export const TEST_API_SECRETS: TestEnv = {
	JWT_ACCESS_SECRET: "test-only-jwt-access-secret-not-for-real-use-0001",
	JWT_REFRESH_SECRET: "test-only-jwt-refresh-secret-not-for-real-use-0002",
	EMAIL_VERIFICATION_SECRET: "test-only-email-verification-secret-not-real-0003",
	TWO_FACTOR_PENDING_SECRET: "test-only-two-factor-pending-secret-not-real-0004",
	// TEST-ONLY Resend webhook signing secret (base64 of "test-only-webhook-signing-key").
	// e2e signs delivery webhooks with it (test/support/resend-webhook-signature.ts).
	RESEND_WEBHOOK_SECRET: "whsec_dGVzdC1vbmx5LXdlYmhvb2stc2lnbmluZy1rZXk=",
};

/**
 * Deterministic behaviour switches. e2e FORCES these too: OTP verification
 * would block every helper login, the mutation-intent guard validates Origin
 * against CORS_ORIGINS, and a test run must never send real email.
 */
export const TEST_API_SWITCHES: TestEnv = {
	LOGIN_VERIFICATION_MODE: "disabled",
	CORS_ORIGINS: "http://localhost:3000,http://localhost:3001,http://localhost:3003",
	EMAIL_MODE: "noop",
};

/**
 * Data-coupled secrets: the keys that WROTE rows already in the database. The seed wraps tenant
 * data keys with the master key, encrypts TOTP secrets with the MFA key ring and stores claim /
 * pairing codes as HMACs under the reward-code key ring — so an e2e run must use the same keys as
 * the seed did. They are still secrets (`.env.example` ships them empty; `pnpm secrets:generate`
 * fills them); only the e2e precedence differs from {@link TEST_API_SECRETS}.
 */
export const TEST_API_DATA_KEYS: TestEnv = {
	// 32 bytes of 0x07, base64 — TEST-ONLY tenant master key.
	TENANT_ENCRYPTION_MASTER_KEY: "BwcHBwcHBwcHBwcHBwcHBwcHBwcHBwcHBwcHBwcHBwc=",
	// 32 bytes of 0x01, base64 — TEST-ONLY MFA key ring.
	MFA_ENCRYPTION_KEYS: '{"1":"AQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQE="}',
	// 32 bytes of 0x02, base64 — TEST-ONLY reward code HMAC key ring.
	REWARD_CODE_HASH_KEYS: '{"1":"AgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgI="}',
};

/**
 * Infrastructure / data-coupled values. e2e keeps apps/api/.env's values when
 * present (the database and {@link TEST_API_DATA_KEYS}) and only fills gaps with these.
 */
export const TEST_API_INFRASTRUCTURE: TestEnv = {
	NODE_ENV: "test",
	APP_NAME: "hello-world",
	APP_URL: "http://localhost:3000",
	ADMIN_APP_URL: "http://localhost:3001",
	MERCHANT_APP_URL: "http://localhost:3003",
	DATABASE_URL: "postgresql://postgres:postgres@localhost:5432/monorepo",
	...TEST_API_DATA_KEYS,
	RESEND_API_KEY: "re_dummy",
	EMAIL_FROM_ADDRESS: "noreply@example.com",
	BCRYPT_SALT_ROUNDS: "10",
	// Explicit no-scanner mode: files become READY with scan status NOT_SCANNED (never CLEAN).
	MALWARE_SCANNER: "none",
	// Single-tenant mode serves a REAL organization: the one `pnpm db:seed` creates (verified at e2e boot).
	DEFAULT_ORGANIZATION_ID: SINGLE_TENANT_SEED_ORGANIZATION_ID,
};

/** The complete hermetic fixture used by unit tests. */
/**
 * e2e only: the test client (light-my-request) connects from loopback and acts
 * as the trusted reverse proxy, sending each synthetic client's address in
 * `X-Forwarded-For` — exactly how production sees clients behind a proxy
 * listed in TRUST_PROXY (common/http/client-ip.ts). Unit tests keep the
 * production default (no trusted proxy).
 */
export const TEST_E2E_PROXY: TestEnv = { TRUST_PROXY: "loopback" };

/**
 * e2e only: uploads go to the local disk driver with the explicit no-scanner
 * mode, whatever apps/api/.env says — a test run must never write to a real
 * cloud bucket. Specs that need verdicts override MALWARE_SCANNER with the
 * test-only EICAR scanner (test/support/eicar-signature-test-scanner.ts).
 */
export const TEST_E2E_STORAGE: TestEnv = { STORAGE_PROVIDER: "local", MALWARE_SCANNER: "none" };

export const TEST_API_ENV: TestEnv = { ...TEST_API_INFRASTRUCTURE, ...TEST_API_SECRETS, ...TEST_API_SWITCHES };

/** A fully validated `ApiConfig` built from the fixture (through the real schema) plus `overrides`. */
export function createTestApiConfig(overrides: TestEnv = {}): ApiConfig {
	return parseApiConfig({ ...TEST_API_ENV, ...overrides });
}

/** `TypedConfigService` over {@link createTestApiConfig}. */
export function createTestTypedConfig(overrides: TestEnv = {}): TypedConfigService {
	return new TypedConfigService(createTestApiConfig(overrides));
}
