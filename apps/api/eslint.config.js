import { nestjsConfig } from "@workspace/eslint-config/nestjs";
import { noUnversionedController } from "./eslint-rules/no-unversioned-controller.js";

/** @type {import("eslint").Linter.Config} */
export default [
	// Global ignores — must be first so ESLint skips these files entirely
	{
		ignores: ["eslint-rules/**"],
	},
	...nestjsConfig,

	// Un-ignore the hand-written Prisma seed + RLS manifest: the shared base
	// config ignores `**/prisma/**` (generated clients elsewhere), but here it is
	// source code that must meet the same bar as src/. Must follow the spread:
	// a negated global ignore only re-includes what an EARLIER object ignored.
	{
		ignores: ["!prisma/", "!prisma/**/", "!prisma/**/*.ts"],
	},

	// ── Parser options: allow spec files as default project members ──
	// Spec files are excluded from tsconfig.json, but typescript-eslint's
	// projectService tries to resolve them. allowDefaultProject tells the
	// service to include matching files even though they're not in tsconfig.
	{
		files: ["**/*.ts", "**/*.tsx"],
		languageOptions: {
			parserOptions: {
				projectService: {
					allowDefaultProject: ["src/modules/auth/*.spec.ts"],
				},
			},
		},
	},

	// ── Type tracing overrides for specific patterns ────────────────
	// Prisma's generated client has deeply-nested generic chains that
	// strictTypeChecked cannot resolve. Catch blocks that use
	// `instanceof` narrowing (the repo convention) are also flagged
	// because the linter sometimes loses the narrowed type across
	// branches. These overrides are surgical — the blanket disable
	// was removed so the remaining modules are fully enforced.
	{
		files: ["src/prisma/**/*.ts"],
		rules: {
			"@typescript-eslint/no-unsafe-assignment": "off",
			"@typescript-eslint/no-unsafe-call": "off",
			"@typescript-eslint/no-unsafe-member-access": "off",
			"@typescript-eslint/no-unsafe-argument": "off",
			"@typescript-eslint/no-unsafe-return": "off",
		},
	},
	{
		files: ["scripts/**/*.ts"],
		languageOptions: {
			parserOptions: {
				project: "./tsconfig.scripts.json",
				projectService: false,
			},
		},
	},
	// ── Tests, seed, and source-graph scripts: type-aware lint via tsconfig.check.json ──
	// These files are outside tsconfig.json (the build program), so they are
	// parsed with the strict check program that `typecheck` also runs.
	{
		files: ["src/**/*.spec.ts", "src/**/*.test.ts", "src/**/__tests__/**/*.ts", "test/**/*.ts", "prisma/**/*.ts", "scripts/render-email-previews.ts"],
		languageOptions: {
			parserOptions: {
				project: "./tsconfig.check.json",
				tsconfigRootDir: import.meta.dirname,
				projectService: false,
			},
		},
	},
	// Scripts use Node APIs whose types cannot be fully resolved by strictTypeChecked.
	{
		files: ["scripts/**/*.ts"],
		rules: {
			"@typescript-eslint/no-unsafe-assignment": "off",
			"@typescript-eslint/no-unsafe-call": "off",
			"@typescript-eslint/no-unsafe-member-access": "off",
			"@typescript-eslint/no-unsafe-argument": "off",
			"@typescript-eslint/no-unsafe-return": "off",
			"@typescript-eslint/naming-convention": "off",
			"@typescript-eslint/restrict-template-expressions": "off",
			"@typescript-eslint/restrict-plus-operands": "off",
			"@typescript-eslint/consistent-type-assertions": "off",
			"no-console": "off",
		},
	},
	{
		files: ["scripts/cleanup-stale-bullmq-repeat-jobs.ts"],
		rules: {
			"@typescript-eslint/no-unsafe-assignment": "off",
			"@typescript-eslint/no-unsafe-member-access": "off",
			"@typescript-eslint/no-unsafe-call": "off",
			"@typescript-eslint/no-floating-promises": "off",
		},
	},

	// Env vars are read at runtime; turbo.json does not enumerate every key.
	{
		files: ["scripts/**/*.ts", "src/config/**/*.ts"],
		rules: {
			"turbo/no-undeclared-env-vars": "off",
		},
	},

	// ── Env boundary (docs/api-configuration.md) ──────────────────
	// `process.env` is read ONLY by src/config/api-config.ts, which parses it
	// once through the zod schema in api-config.schema.ts (fail fast, value-free
	// errors). Everything else injects TypedConfigService (or, for load-time
	// module wiring, calls getApiConfig()).
	{
		files: ["src/**/*.ts"],
		ignores: ["src/config/api-config.ts"],
		rules: {
			"no-restricted-properties": [
				"error",
				{
					object: "process",
					property: "env",
					message: "Read configuration through TypedConfigService / getApiConfig() (src/config), never process.env directly. See docs/api-configuration.md.",
				},
			],
		},
	},

	// Repositories are registered via spread arrays in persistence modules.
	{
		files: ["src/**/repositories/**/*.repository.ts"],
		rules: {
			"@darraghor/nestjs-typed/injectable-should-be-provided": "off",
		},
	},

	// Storage queue workers are registered conditionally when REDIS_URL is set.
	{
		files: ["src/modules/files/services/storage-queue.processors.ts"],
		rules: {
			"@darraghor/nestjs-typed/injectable-should-be-provided": "off",
		},
	},

	// Walks the dynamic apiContract tree — Object.values entries are not precisely typed.
	{
		files: ["src/common/ajv-warmup.ts"],
		rules: {
			"@typescript-eslint/no-unsafe-argument": "off",
		},
	},
	{
		files: [
			"src/modules/auth/cache/user-session-cache.service.ts",
			"src/modules/authorization/cache/authorization-cache.service.ts",
			"src/modules/notifications/email/email-queue.service.ts",
		],
		rules: {
			"@darraghor/nestjs-typed/injectable-should-be-provided": "off",
		},
	},

	// ── Versioning guard: no unversioned business controllers ──────
	// Every controller must build its path with `apiPath()` from
	// `@workspace/shared` (→ `/api/v1/...`). The client transport prepends the
	// SAME prefix, so an unversioned controller is unreachable from the apps
	// (the `/session` 404 regression). Root/health/webhook stay unversioned by
	// allowlist; test-only `*.probe.ts` controllers are excluded.
	{
		files: ["src/**/*.controller.ts"],
		ignores: ["**/*.probe.ts"],
		plugins: {
			"local-rules": { rules: { "no-unversioned-controller": noUnversionedController } },
		},
		rules: {
			"local-rules/no-unversioned-controller": "error",
		},
	},
];
