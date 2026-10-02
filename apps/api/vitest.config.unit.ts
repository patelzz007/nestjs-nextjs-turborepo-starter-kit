import { defineConfig } from "vitest/config";

export default defineConfig({
	test: {
		environment: "node",
		// Existing src/**/*.spec.ts files use bare describe/it/expect globals.
		globals: true,
		// setup-unit-env.ts installs the hermetic TEST-ONLY env fixture BEFORE
		// test-file imports evaluate (module files read getApiConfig() at load).
		setupFiles: ["./test/setup-unit-env.ts"],
		// Every unit spec in src/, prisma/ and scripts/ is listed here (all of
		// them are type-checked by tsconfig.check.json).
		// A new spec directory must be added below, or it silently never runs.
		include: [
			"src/modules/notifications/**/*.spec.ts",
			"src/common/pipes/*.spec.ts",
			"src/modules/auth/services/access-token-state.service.spec.ts",
			"src/modules/auth/services/auth-events.service.spec.ts",
			"src/modules/auth/decorators/*.spec.ts",
			"src/modules/auth/guards/__tests__/*.spec.ts",
			"src/modules/auth/constants/*.spec.ts",
			"src/modules/impersonation/*.spec.ts",
			"src/modules/auth/services/secret-encryption.service.spec.ts",
			"src/modules/auth/services/mfa-challenge.service.spec.ts",
			"src/modules/authorization/services/user-session-revocation.service.spec.ts",
			"src/modules/authorization/cache/authorization-cache.service.spec.ts",
			"src/modules/authorization/kernel/__tests__/*.spec.ts",
			"src/modules/authorization/guards/__tests__/*.spec.ts",
			"src/modules/authorization/services/privilege-escalation.service.spec.ts",
			"src/modules/authorization/repositories/role-assignment.repository.spec.ts",
			"src/infrastructure/outbox/*.spec.ts",
			"src/infrastructure/jobs/*.spec.ts",
			"src/messaging/*.spec.ts",
			"src/modules/files/services/file-authorization.service.spec.ts",
			"src/modules/authorization/services/authorization-context.resolver.spec.ts",
			"src/common/interceptors/rls.interceptor.spec.ts",
			"src/common/middleware/*.spec.ts",
			"src/prisma/rls-context.spec.ts",
			"src/modules/sessions/sessions.service.spec.ts",
			"src/modules/rewards/services/*.spec.ts",
			"src/modules/rewards/repositories/*.spec.ts",
			"src/modules/rewards/utils/*.spec.ts",
			"src/modules/rewards/guards/*.spec.ts",
			"src/modules/organization/services/*.spec.ts",
			"src/modules/storage/utils/*.spec.ts",
			"src/modules/storage/adapters/**/*.spec.ts",
			"src/modules/files/controllers/*.spec.ts",
			"prisma/rls/manifest-index.spec.ts",
			// Error model, redaction, API docs gate, health, encryption key, idempotency, admin read models.
			"src/*.spec.ts",
			"src/common/*.spec.ts",
			"src/common/decorators/*.spec.ts",
			"src/common/openapi/*.spec.ts",
			"src/common/errors/*.spec.ts",
			"src/common/logging/*.spec.ts",
			"src/common/lifecycle/*.spec.ts",
			"src/modules/health/*.spec.ts",
			"src/config/*.spec.ts",
			"src/common/context/*.spec.ts",
			"src/modules/logs/*.spec.ts",
			"src/modules/authorization/admin/**/*.spec.ts",
			"src/platform/**/*.spec.ts",
			"prisma/seed/**/*.spec.ts",
			"scripts/rls-apply-plan.spec.ts",
			// Previously unwired suites (type-checked by tsconfig.check.json; now run too).
			"src/common/utils/*.spec.ts",
			"src/modules/auth/auth.service.spec.ts",
			"src/modules/auth/auth.controller.spec.ts",
			"src/modules/auth/interceptors/*.spec.ts",
			"src/modules/auth/services/session-restriction.service.spec.ts",
			"src/modules/auth/utils/*.spec.ts",
			"src/modules/authorization-cedar/services/*.spec.ts",
			"src/modules/product/__tests__/*.spec.ts",
			"src/modules/sample-category/__tests__/*.spec.ts",
			"src/modules/sessions/session-status.controller.spec.ts",
			// Per-resource list-query translators (docs/list-queries.md).
			"src/modules/*.list-query.spec.ts",
		],
		// Email/notification specs never touch the network or a real DB — all
		// external calls (Resend, Prisma) are mocked.
		testTimeout: 15_000,
		hookTimeout: 15_000,
	},
});
