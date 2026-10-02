// ── Unit-test env bootstrap (hermetic) ────────────────────────────────────
// Unit tests never read apps/api/.env: the whole environment the API schema
// needs comes from the TEST-ONLY fixture (test/support/test-api-env.ts), so a
// developer's local secrets or broker URLs cannot change a unit test's result.
// Vitest loads `setupFiles` before test-file imports, so module files that
// read `getApiConfig()` at load time see this fixture.
import { TEST_API_ENV } from "./support/test-api-env";

for (const [name, value] of Object.entries(TEST_API_ENV)) {
	process.env[name] = value;
}
