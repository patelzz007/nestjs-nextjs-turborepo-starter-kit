// This repository's settings for packages/tooling. The tools hold no app name, port or path of their own: a
// product built from this starter changes this file, never the tool code. No imports with a runtime cost here:
// the secret scan and other pre-install CI steps read it before dependencies exist (the type import is erased).
// Tools that run after an install read it through packages/tooling/src/shared/settings.ts, which validates it.

import type { ToolingConfig } from "./packages/tooling/src/shared/tooling-config-schema.ts";

export const toolingConfig = {
	projectFile: "project.json",
	workspaces: {
		api: "@workspace/api",
		web: "@workspace/web",
		admin: "@workspace/admin",
		merchant: "@workspace/merchant",
		analyticsConsumer: "@workspace/analytics-consumer",
	},
	folders: {
		api: "apps/api",
		web: "apps/web",
		admin: "apps/admin",
		merchant: "apps/merchant",
		docs: "apps/docs",
		mobile: "apps/mobile",
		analyticsConsumer: "apps/analytics-consumer",
		tokens: "packages/tokens",
	},
	ports: { api: 8080, web: 3000, admin: 3001, docs: 3002, merchant: 3003, metro: 8081, mailpit: 8025 },
	nextApps: ["web", "admin", "merchant"],
	budgets: { bundle: "budgets/bundle.json", load: "budgets/load.json", mobileStartup: "budgets/mobile-startup.json" },
	artifacts: { ci: ".artifacts/ci", devTiming: ".artifacts/dev-timing", logs: ".artifacts/logs", playwright: ".artifacts/playwright" },
	migrations: { directory: "apps/api/prisma/migrations", baselineFile: "apps/api/prisma/migrations-baseline.json" },
	envExampleFiles: ["apps/api/.env.example", "apps/web/.env.example", "apps/admin/.env.example", "apps/merchant/.env.example", "apps/analytics-consumer/.env.example", "apps/mobile/.env.example"],
	testPlacementWorkspaces: ["apps/web", "apps/admin", "apps/merchant", "apps/docs", "apps/mobile", "infra/aws", "packages"],
	deploy: {
		apps: [
			{ app: "api", workspace: "@workspace/api", port: 8080, healthPath: "/health/ready" },
			{ app: "web", workspace: "@workspace/web", port: 3000, healthPath: "/" },
			{ app: "admin", workspace: "@workspace/admin", port: 3001, healthPath: "/auth/login" },
			{ app: "merchant", workspace: "@workspace/merchant", port: 3003, healthPath: "/auth/login" },
		],
		pm2Ecosystem: "infra/pm2/ecosystem.config.cjs",
	},
	tools: [
		{
			name: "mobile:route-types",
			group: "Mobile",
			description: "Write the mobile app's route types (run after adding or removing a screen).",
			command: "node packages/tooling/src/starter/mobile-route-types/cli.ts",
		},
		// Database
		{
			name: "db:deploy",
			group: "Database",
			description: "Apply pending migrations and the RLS policies, without prompts (CI, deploys).",
			command: "pnpm --filter @workspace/api db:deploy",
		},
		{ name: "db:migrate:status", group: "Database", description: "Show which migrations are applied.", command: "pnpm --filter @workspace/api db:migrate:status" },
		{ name: "db:push", group: "Database", description: "Push the schema without a migration (throwaway databases only).", command: "pnpm --filter @workspace/api db:push" },
		{
			name: "db:apply-security",
			group: "Database",
			description: "Re-apply the RLS policies and grants (db:migrate already does this).",
			command: "pnpm --filter @workspace/api db:apply-security",
		},
		{
			name: "db:check-rls-manifest",
			group: "Database",
			description: "Check every tenant table is covered by an RLS policy.",
			command: "pnpm --filter @workspace/api db:check-rls-manifest",
		},
		{
			name: "db:check-tenant-integrity",
			group: "Database",
			description: "Check no row points at another tenant's data.",
			command: "pnpm --filter @workspace/api db:check-tenant-integrity",
		},
		{
			name: "db:carry-github-link",
			group: "Database",
			description: "Copy your GitHub link from one local database to another.",
			command: "pnpm --filter @workspace/api db:carry-github-link",
		},
		// Development
		{
			name: "dev:analytics-consumer",
			group: "Development",
			description: "Run the analytics consumer (needs Kafka: pnpm docker:up).",
			command: "turbo dev --filter @workspace/analytics-consumer --log-prefix=none",
		},
		{
			name: "dev:tunnel",
			group: "Development",
			description: "Open a public tunnel to the local API (webhooks, phones).",
			command: "pnpm --silent --filter @workspace/api dev:tunnel",
		},
		{ name: "dev:timing", group: "Development", description: "Measure how long each dev server takes to be ready.", command: "node packages/tooling/src/dev-timing/cli.ts" },
		{ name: "docker:restart", group: "Development", description: "Restart the local containers.", command: "docker compose down && docker compose up -d" },
		{ name: "docker:logs", group: "Development", description: "Follow the local containers' logs.", command: "docker compose logs -f" },
		{ name: "docker:ps", group: "Development", description: "List the local containers.", command: "docker compose ps" },
		// Build and generate
		{ name: "build:shared", group: "Build and generate", description: "Build @workspace/shared (setup does this).", command: "pnpm --filter @workspace/shared build" },
		{
			name: "tokens:generate",
			group: "Build and generate",
			description: "Regenerate the theme CSS, icons and brand assets from @workspace/tokens.",
			command: "pnpm --filter @workspace/tokens generate",
		},
		{
			name: "openapi:export",
			group: "Build and generate",
			description: "Rewrite the committed OpenAPI document from the API.",
			command: "turbo run openapi:export --filter=@workspace/api",
		},
		{ name: "docs:api", group: "Build and generate", description: "Regenerate the docs site's API reference.", command: "pnpm --filter @workspace/docs-renderer docs:api" },
		{
			name: "secrets:generate",
			group: "Build and generate",
			description: "Generate fresh local app secrets into the .env files.",
			command: "node packages/tooling/src/app-secrets/cli.ts",
		},
		// Checks
		{
			name: "bundle:check",
			group: "Checks",
			description: "Check the app bundles against their size budgets (after a build).",
			command: "node packages/tooling/src/bundle-budget/cli.ts",
		},
		{
			name: "load:run",
			group: "Checks",
			description: "Start budgets/load.json's load test through the API and save its results (needs the load runner).",
			command: "node packages/tooling/src/load-baseline/cli.ts run",
		},
		{
			name: "load:check",
			group: "Checks",
			description: "Check a load test's results against budgets/load.json (--write-baseline recalibrates).",
			command: "node packages/tooling/src/load-baseline/cli.ts check",
		},
		{ name: "deps:check", group: "Checks", description: "Check every workspace uses the same dependency versions.", command: "turbo run deps:check" },
		{ name: "deps:fix", group: "Checks", description: "Align mismatched dependency versions.", command: "turbo run deps:fix" },
		{ name: "deps:list", group: "Checks", description: "List every dependency and its versions.", command: "turbo run deps:list" },
		{ name: "docs:check-links", group: "Checks", description: "Check every internal link in docs/.", command: "pnpm --filter @workspace/docs check:links" },
		{ name: "secrets:scan", group: "Checks", description: "Check no .env.example holds a real secret.", command: "node packages/tooling/src/env-example-secrets/cli.ts" },
	],
} satisfies ToolingConfig;
