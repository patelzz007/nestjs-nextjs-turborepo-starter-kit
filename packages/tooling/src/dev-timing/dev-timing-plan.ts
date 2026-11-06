/**
 * What `pnpm tools dev:timing` measures (plan §19.1, decision #53): the servers
 * `pnpm dev` boots and how each one proves it is ready, the representative
 * signed-in page per Next app, the Metro bundle, and what a cold run deletes.
 * Pure data, so the plan is unit-tested and changes are reviewed in one place.
 */
import os from "node:os";
import { toolingConfig } from "../../../../tooling.config.ts";

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
 */
export type ReadinessKind = "ok" | "responds" | "metro";
export interface DevServer {
	id: string;
	port: number;
	path: string;
	readiness: ReadinessKind;
}

export const DEV_SERVERS: readonly DevServer[] = [
	{ id: "api", port: toolingConfig.ports.api, path: "/health/ready", readiness: "ok" },
	{ id: "web", port: toolingConfig.ports.web, path: "/", readiness: "responds" },
	{ id: "admin", port: toolingConfig.ports.admin, path: "/", readiness: "responds" },
	{ id: "docs", port: toolingConfig.ports.docs, path: "/", readiness: "responds" },
	{ id: "merchant", port: toolingConfig.ports.merchant, path: "/", readiness: "responds" },
	{ id: "mobile", port: toolingConfig.ports.metro, path: "/status", readiness: "metro" },
];

/** The seeded tenant the merchant route opens (apps/api/prisma/seed/tenants.ts → TENANT_SEED_SLUGS.kl). */
const SEEDED_MERCHANT_SLUG = "brew-bean-kl";

/**
 * The representative route per Next app and the seeded demo account whose
 * session requests it (apps/api/prisma/seed/users.ts, docs/user-guide/README.md).
 * The web route uses the platform admin because the seeded customers start
 * with an unverified email and would be redirected to verification.
 */
export type DemoAccount = import("./session.ts").DemoAccount;
export interface PageTarget {
	id: string;
	port: number;
	path: string;
	account: DemoAccount;
}

export const PAGE_TARGETS: readonly PageTarget[] = [
	{
		id: "web",
		port: toolingConfig.ports.web,
		path: "/dashboard",
		account: { email: "admin@example.com", password: "Admin@123", clientType: "web", origin: `http://localhost:${String(toolingConfig.ports.web)}` },
	},
	{
		id: "admin",
		port: toolingConfig.ports.admin,
		path: "/",
		account: { email: "admin@example.com", password: "Admin@123", clientType: "admin", origin: `http://localhost:${String(toolingConfig.ports.admin)}` },
	},
	{
		id: "merchant",
		port: toolingConfig.ports.merchant,
		path: `/t/${SEEDED_MERCHANT_SLUG}/dashboard`,
		account: { email: "brew.owner@kl-rewards.demo", password: "BrewOwner@123", clientType: "merchant", origin: `http://localhost:${String(toolingConfig.ports.merchant)}` },
	},
];

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
export const COLD_RESET_PATHS = [
	".turbo",
	`${toolingConfig.folders.web}/.next`,
	`${toolingConfig.folders.admin}/.next`,
	`${toolingConfig.folders.merchant}/.next`,
	`${toolingConfig.folders.api}/dist`,
];

/**
 * Metro's caches, which `expo start --clear` resets: the transform cache
 * (`<tmpdir>/metro-cache`, set by expo/metro-config and by uniwind/metro) and
 * the file-map caches (`<tmpdir>/metro-file-map-*`). A cold run deletes them
 * directly because `turbo dev -- --clear` would pass the flag to every app.
 * (`apps/mobile`'s own `dev` script always passes `--clear` too, so a warm run's
 * Metro numbers include rebuilding its transform cache.)
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
 */

export function metroCacheRoots(ownTmpdir: string = os.tmpdir()): string[] {
	return [...new Set([ownTmpdir, POSIX_FALLBACK_TMPDIR])];
}

export function localUrl(port: number, path: string): string {
	return `http://localhost:${String(port)}${path}`;
}
