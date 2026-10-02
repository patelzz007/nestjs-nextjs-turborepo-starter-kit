// ============================================
// test/support/test-api-env.ts - TEST-ONLY environment fixtures
// ============================================
// Every value below is an obviously fake, TEST-ONLY fixture. None of them is
// accepted as a default anywhere in the app — the API refuses to boot without
// real values. They exist so unit tests are hermetic and e2e runs are
// deterministic. NEVER copy one of these into a real .env file.

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
	// 32 bytes of 0x01, base64 — TEST-ONLY MFA key ring.
	MFA_ENCRYPTION_KEYS: '{"1":"AQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQE="}',
};

/**
 * Deterministic behaviour switches. e2e FORCES these too: OTP verification
 * would block every helper login, the mutation-intent guard validates Origin
 * against CORS_ORIGINS, and a test run must never send real email.
 */
export const TEST_API_SWITCHES: TestEnv = {
	FORCE_LOGIN_VERIFICATION: "false",
	CORS_ORIGINS: "http://localhost:3000,http://localhost:3001,http://localhost:3003",
	EMAIL_MODE: "noop",
};

/**
 * Infrastructure / data-coupled values. e2e keeps apps/api/.env's values when
 * present (the database, and the tenant master key that wrapped its existing
 * data keys) and only fills gaps with these.
 */
export const TEST_API_INFRASTRUCTURE: TestEnv = {
	NODE_ENV: "test",
	APP_NAME: "hello-world",
	APP_URL: "http://localhost:3000",
	ADMIN_APP_URL: "http://localhost:3001",
	MERCHANT_APP_URL: "http://localhost:3003",
	DATABASE_URL: "postgresql://postgres:postgres@localhost:5432/monorepo",
	// 32 bytes of 0x07, base64 — TEST-ONLY tenant master key.
	TENANT_ENCRYPTION_MASTER_KEY: "BwcHBwcHBwcHBwcHBwcHBwcHBwcHBwcHBwcHBwcHBwc=",
	RESEND_API_KEY: "re_dummy",
	EMAIL_FROM_ADDRESS: "noreply@example.com",
	BCRYPT_SALT_ROUNDS: "10",
};

/** The complete hermetic fixture used by unit tests. */
export const TEST_API_ENV: TestEnv = { ...TEST_API_INFRASTRUCTURE, ...TEST_API_SECRETS, ...TEST_API_SWITCHES };

/** A fully validated `ApiConfig` built from the fixture (through the real schema) plus `overrides`. */
export function createTestApiConfig(overrides: TestEnv = {}): ApiConfig {
	return parseApiConfig({ ...TEST_API_ENV, ...overrides });
}

/** `TypedConfigService` over {@link createTestApiConfig}. */
export function createTestTypedConfig(overrides: TestEnv = {}): TypedConfigService {
	return new TypedConfigService(createTestApiConfig(overrides));
}
