import { fileURLToPath } from "node:url";

import { composeConfigs } from "@workspace/oxlint-config/compose";
import { nestjsConfig } from "@workspace/oxlint-config/nestjs";

/**
 * apps/api: the shared NestJS config plus the API's own boundaries.
 *
 * Type-aware rules run through oxlint-tsgolint against each file's nearest
 * tsconfig (tsconfig.json for src/, and the per-folder configs elsewhere).
 */
export default composeConfigs(nestjsConfig, {
	// Absolute, so the composed config also works copied elsewhere (the lint canaries).
	jsPlugins: [{ name: "api", specifier: fileURLToPath(new URL("./lint-rules/index.js", import.meta.url)) }],
	// The shared config ignores `**/prisma/**` (generated clients elsewhere); here the top-level
	// prisma/ folder is hand-written source (seed, RLS manifest) that must meet the same bar as src/.
	// Anchored with `/`: `src/prisma/` stays ignored, exactly as before the move to oxlint.
	ignorePatterns: ["lint-rules/**", "!/prisma/", "!/prisma/**"],
	overrides: [
		// Prisma's generated client has deeply nested generic chains the type-aware unsafe rules cannot resolve.
		{
			files: ["src/prisma/**/*.ts"],
			rules: {
				"typescript/no-unsafe-assignment": "off",
				"typescript/no-unsafe-call": "off",
				"typescript/no-unsafe-member-access": "off",
				"typescript/no-unsafe-argument": "off",
				"typescript/no-unsafe-return": "off",
			},
		},
		// Env vars are read at runtime; turbo.json does not enumerate every key.
		{
			files: ["scripts/**/*.ts", "src/config/**/*.ts"],
			rules: { "turbo/no-undeclared-env-vars": "off" },
		},
		// Env boundary (docs/technical/configuration/api.md): `process.env` is read ONLY by
		// src/config/api-config.ts, which parses it once through the zod schema in
		// api-config.schema.ts. Everything else injects TypedConfigService (or, for load-time
		// module wiring, calls getApiConfig()).
		{
			files: ["src/**/*.ts"],
			excludeFiles: ["src/config/api-config.ts"],
			rules: {
				"no-restricted-properties": [
					"error",
					{
						object: "process",
						property: "env",
						message: "Read configuration through TypedConfigService / getApiConfig() (src/config), never process.env directly. See docs/technical/configuration/api.md.",
					},
				],
			},
		},
		// Repositories are registered via spread arrays in persistence modules.
		{
			files: ["src/**/repositories/**/*.repository.ts"],
			rules: { "nestjs/injectable-should-be-provided": "off" },
		},
		// Storage queue workers are registered conditionally when REDIS_URL is set.
		{
			files: ["src/contexts/files/runtime/services/storage-queue.processors.ts"],
			rules: { "nestjs/injectable-should-be-provided": "off" },
		},
		// Walks the dynamic apiContract tree — Object.values entries are not precisely typed.
		{
			files: ["src/common/ajv-warmup.ts"],
			rules: { "typescript/no-unsafe-argument": "off" },
		},
		{
			files: [
				"src/contexts/identity/auth/cache/user-session-cache.service.ts",
				"src/contexts/authorization/rbac/cache/authorization-cache.service.ts",
				"src/contexts/notifications/runtime/email/email-queue.service.ts",
			],
			rules: { "nestjs/injectable-should-be-provided": "off" },
		},
		// Versioning guard: every controller builds its path with `apiPath()` from
		// `@workspace/shared` (→ `/api/v1/...`). The client transport prepends the SAME
		// prefix, so an unversioned controller is unreachable from the apps (the `/session`
		// 404 regression). Root/health/webhook stay unversioned by allowlist; test-only
		// `*.probe.ts` controllers are excluded.
		{
			files: ["src/**/*.controller.ts"],
			excludeFiles: ["**/*.probe.ts"],
			rules: { "api/no-unversioned-controller": "error" },
		},
	],
});
