/**
 * What `pnpm dev:timing` measures (plan §19.1, decision #53): the servers
 * `pnpm dev` boots and how each one proves it is ready, the representative
 * signed-in page per Next app, the Metro bundle, and what a cold run deletes.
 * Pure data, so the plan is unit-tested and changes are reviewed in one place.
 */
import os from "node:os";

/** The four phases, in the order a run measures them. */
export const PHASES = {
	coldDev: { id: "A", title: "pnpm dev → every port answers" },
	apiBoot: { id: "B", title: "API process spawned → /health/ready 200" },
	firstPageCompile: { id: "C", title: "first signed-in GET of a representative route" },
	firstMetroBundle: { id: "D", title: "first iOS Metro bundle downloaded" },
};

/** The measurement target naming the slowest server of phase A (the whole stack). */
export const ALL_SERVERS_TARGET = "all";

/**
 * How a server proves it is up: `ok` = `GET` answers 200 (the API readiness
 * probe), `responds` = any HTTP answer (a Next/Astro dev server is listening),
 * `metro` = Metro's `/status` body says the packager runs.
 *
 * @typedef {"ok" | "responds" | "metro"} ReadinessKind
 * @typedef {{ id: string, port: number, path: string, readiness: ReadinessKind }} DevServer
 */

/** @type {readonly DevServer[]} */
export const DEV_SERVERS = [
	{ id: "api", port: 8080, path: "/health/ready", readiness: "ok" },
	{ id: "web", port: 3000, path: "/", readiness: "responds" },
	{ id: "admin", port: 3001, path: "/", readiness: "responds" },
	{ id: "docs", port: 3002, path: "/", readiness: "responds" },
	{ id: "merchant", port: 3003, path: "/", readiness: "responds" },
	{ id: "mobile", port: 8081, path: "/status", readiness: "metro" },
];

/** The seeded organization the merchant route opens (apps/api/prisma/seed/organizations.ts → ORGANIZATION_SEED_SLUGS.kl). */
const SEEDED_MERCHANT_SLUG = "brew-bean-kl";

/**
 * The representative route per Next app and the seeded demo account whose
 * session requests it (apps/api/prisma/seed/users.ts, docs/user-guide/README.md).
 * The web route uses the platform admin because the seeded customers start
 * with an unverified email and would be redirected to verification.
 *
 * @typedef {import("./session.mjs").DemoAccount} DemoAccount
 * @typedef {{ id: string, port: number, path: string, account: DemoAccount }} PageTarget
 */

/** @type {readonly PageTarget[]} */
export const PAGE_TARGETS = [
	{
		id: "web",
		port: 3000,
		path: "/dashboard",
		account: { email: "admin@example.com", password: "Admin@123", clientType: "web", origin: "http://localhost:3000" },
	},
	{
		id: "admin",
		port: 3001,
		path: "/",
		account: { email: "admin@example.com", password: "Admin@123", clientType: "admin", origin: "http://localhost:3001" },
	},
	{
		id: "merchant",
		port: 3003,
		path: `/orgs/${SEEDED_MERCHANT_SLUG}/dashboard`,
		account: { email: "brew.owner@kl-rewards.demo", password: "BrewOwner@123", clientType: "merchant", origin: "http://localhost:3003" },
	},
];

/**
 * The API's env file, read for one key only: EMAIL_TEST_TO (dev-only) sends
 * every email, login codes included, to one address, which is then the
 * Mailpit mailbox to read the code from.
 */
export const API_ENV_FILE = "apps/api/.env";
export const EMAIL_REDIRECT_KEY = "EMAIL_TEST_TO";

/** The API every login goes to. */
export const API_PORT = 8080;
/** Metro's port. */
export const METRO_PORT = 8081;
/**
 * The manifest request an iOS client sends first (Expo CLI ManifestMiddleware,
 * `GET /` with `expo-platform: ios`). Its `launchAsset.url` is the exact
 * development bundle the simulator then downloads. The bundle path is not
 * hard-coded: in this monorepo Metro serves from the workspace root, so the
 * entry is `/apps/mobile/index.ts.bundle?platform=ios&dev=true&lazy=true&…`
 * and the bare `/index.bundle?platform=ios&dev=true` answers 404.
 */
export const METRO_MANIFEST_PATH = "/";
export const METRO_MANIFEST_HEADERS = { "expo-platform": "ios", accept: "application/expo+json,application/json" };

/** Build output and caches a cold run deletes, relative to the repository root. */
export const COLD_RESET_PATHS = [".turbo", "apps/web/.next", "apps/admin/.next", "apps/merchant/.next", "apps/api/dist"];

/**
 * Metro's caches, which `expo start --clear` resets: the transform cache
 * (`<tmpdir>/metro-cache`, set by expo/metro-config and by uniwind/metro) and
 * the file-map caches (`<tmpdir>/metro-file-map-*`). A cold run deletes them
 * directly because `turbo dev -- --clear` would pass the flag to every app.
 * See `metroCacheRoots` for which temp directories that means.
 */
export const METRO_CACHE_DIRECTORY = "metro-cache";
export const METRO_FILE_MAP_PREFIX = "metro-file-map-";

/**
 * Node's POSIX fallback temp directory, used when TMPDIR is unset. Turbo runs
 * tasks in strict env mode and does not pass TMPDIR on, so Metro under
 * `pnpm dev` writes its caches to `/tmp` even where this shell's
 * `os.tmpdir()` is a per-user folder (macOS `/var/folders/…/T`). Verified on
 * the T40 baseline: the caches were in `/tmp`, not in `os.tmpdir()`.
 */
const POSIX_FALLBACK_TMPDIR = "/tmp";

/**
 * Every directory Metro's caches may be in: this process's temp directory
 * and the one a turbo task sees.
 *
 * @param {string} [ownTmpdir]
 * @returns {string[]}
 */
export function metroCacheRoots(ownTmpdir = os.tmpdir()) {
	return [...new Set([ownTmpdir, POSIX_FALLBACK_TMPDIR])];
}

/**
 * @param {number} port
 * @param {string} path
 * @returns {string}
 */
export function localUrl(port, path) {
	return `http://localhost:${String(port)}${path}`;
}
