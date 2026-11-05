// The platform deploy (ADR 075): what runs on the Droplet when GitHub Actions asks for a deploy, as pure
// functions so every decision is unit-tested (packages/tooling/__tests__/deploy-plan.test.mjs). The two
// scripts beside this folder only carry the decisions out:
//
//   deploy-gate.mjs     the SSH forced command: validates the request, fetches the commit, unpacks it into
//                       releases/<sha>, and hands over to that release's own deploy-release.mjs.
//   deploy-release.mjs  installs, builds, migrates, switches `current`, reloads pm2, health-checks, and
//                       rolls back to the previous release on any failure.

import path from "node:path";

/** A full git commit id: the only thing the gate accepts as a deploy target. */
const COMMIT_PATTERN = /^[0-9a-f]{40}$/u;

/** Releases kept on disk (the live one and the one before it are never pruned). */
export const RELEASES_TO_KEEP = 5;

/** Each process the platform runs under pm2: its workspace, port and the page that proves it is up. */
export const PLATFORM_APPS = [
	{ app: "api", workspace: "@workspace/api", port: 8080, healthPath: "/health/ready" },
	{ app: "web", workspace: "@workspace/web", port: 3000, healthPath: "/" },
	{ app: "admin", workspace: "@workspace/admin", port: 3001, healthPath: "/auth/login" },
	{ app: "merchant", workspace: "@workspace/merchant", port: 3003, healthPath: "/auth/login" },
];

/**
 * The command an SSH client asked for (`SSH_ORIGINAL_COMMAND`): `deploy <40-hex sha>` or `rollback`.
 * Anything else, including extra words, shell syntax or a short sha, is refused.
 * @param {string | undefined} original
 * @returns {{ readonly kind: "deploy"; readonly commit: string } | { readonly kind: "rollback" } | { readonly kind: "refused"; readonly reason: string }}
 */
export function parseGateCommand(original) {
	const words = (original ?? "")
		.trim()
		.split(/\s+/u)
		.filter((word) => word.length > 0);
	const [verb, target, ...rest] = words;
	if (rest.length > 0) {
		return { kind: "refused", reason: "too many arguments" };
	}
	if (verb === "deploy" && target !== undefined && COMMIT_PATTERN.test(target)) {
		return { kind: "deploy", commit: target };
	}
	if (verb === "rollback" && target === undefined) {
		return { kind: "rollback" };
	}
	return { kind: "refused", reason: "expected `deploy <full commit sha>` or `rollback`" };
}

/**
 * The Droplet's layout under one root (`/srv/<slug>`).
 * @param {string} root
 */
export function deployLayout(root) {
	return {
		root,
		repository: path.join(root, "repository.git"),
		releases: path.join(root, "releases"),
		current: path.join(root, "current"),
		previous: path.join(root, "previous"),
		envDir: path.join(root, "shared", "env"),
		lock: path.join(root, "deploy.lock"),
		/** @param {string} commit */
		release: (commit) => path.join(root, "releases", commit),
	};
}

/**
 * Each app's env file in `shared/env` and where it is linked inside a release (`apps/<app>/.env`, which the
 * API's dotenv and `next build` / `next start` read).
 * @param {string} envDir @param {string} releaseDir
 */
export function envLinks(envDir, releaseDir) {
	return PLATFORM_APPS.map(({ app }) => ({ app, source: path.join(envDir, `${app}.env`), link: path.join(releaseDir, "apps", app, ".env") }));
}

/**
 * The steps that build a release, in order, each run in the release directory. Migrations, the security
 * SQL and the reference data run BEFORE the switch, with the MIGRATION login (`shared/env/api-migrate.env`,
 * through DOTENV_PATH), never the API's runtime login (docs/technical/operations/separate-database-credentials.md).
 * Every migration must keep the running (old) release working: expand first, contract in a later release (ADR 075).
 * @param {string} envDir
 * @returns {readonly { readonly name: string; readonly argv: readonly string[]; readonly env: Readonly<Record<string, string>> }[]}
 */
export function buildSteps(envDir) {
	const migrationEnv = { DOTENV_PATH: path.join(envDir, "api-migrate.env") };
	return [
		{ name: "install", argv: ["pnpm", "install", "--frozen-lockfile", "--prefer-offline"], env: {} },
		{ name: "build", argv: ["pnpm", "turbo", "run", "build", ...PLATFORM_APPS.map(({ workspace }) => `--filter=${workspace}...`)], env: {} },
		{ name: "migrate", argv: ["pnpm", "--filter", "@workspace/api", "db:deploy"], env: migrationEnv },
		{ name: "reference data", argv: ["pnpm", "--filter", "@workspace/api", "db:sync-reference-data"], env: migrationEnv },
	];
}

/**
 * The env files a release needs in `shared/env`: one per app, plus the migration login's.
 * @param {string} envDir
 */
export function requiredEnvFiles(envDir) {
	return [...PLATFORM_APPS.map(({ app }) => path.join(envDir, `${app}.env`)), path.join(envDir, "api-migrate.env")];
}

/**
 * The releases to delete: everything but the newest `keep` (by deploy time), and never the live or the
 * previous one.
 * @param {readonly { readonly name: string; readonly deployedAt: number }[]} releases
 * @param {{ readonly current: string | null; readonly previous: string | null; readonly keep?: number }} options
 * @returns {string[]}
 */
export function releasesToPrune(releases, { current, previous, keep = RELEASES_TO_KEEP }) {
	const newestFirst = [...releases].sort((left, right) => right.deployedAt - left.deployedAt);
	return newestFirst
		.slice(keep)
		.map((release) => release.name)
		.filter((name) => name !== current && name !== previous);
}

/**
 * The URL that proves an app is up.
 * @param {(typeof PLATFORM_APPS)[number]} app
 */
export function healthUrl(app) {
	return `http://127.0.0.1:${String(app.port)}${app.healthPath}`;
}

/**
 * Whether a health answer counts as up: the API's readiness probe must say 200; a web app must render
 * (any status below 500, since a signed-out page may redirect).
 * @param {(typeof PLATFORM_APPS)[number]} app @param {number} status
 */
export function isHealthy(app, status) {
	return app.app === "api" ? status === 200 : status > 0 && status < 500;
}

/**
 * The pm2 process name of an app: `<slug>-<app>`, so two products can share a Droplet.
 * @param {string} slug @param {string} app
 */
export function processName(slug, app) {
	return `${slug}-${app}`;
}
