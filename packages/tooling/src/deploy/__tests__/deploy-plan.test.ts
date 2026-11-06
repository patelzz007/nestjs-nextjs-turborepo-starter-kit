import { z } from "zod";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import path from "node:path";

import { describe, expect, it } from "vitest";

import { buildSteps, deployLayout, envLinks, healthUrl, isHealthy, parseGateCommand, PLATFORM_APPS, processName, releasesToPrune, requiredEnvFiles } from "../deploy-plan.ts";
import { packageManifest } from "../../testing/manifests.ts";

const ProjectSchema = z.looseObject({ slug: z.string() });
const EcosystemSchema = z.object({
	apps: z.array(z.looseObject({ name: z.string(), cwd: z.string().optional(), args: z.union([z.string(), z.array(z.string())]).optional() })),
});

const REPO_ROOT = path.resolve(import.meta.dirname, "../../../../..");
const SHA = "0123456789abcdef0123456789abcdef01234567";

describe("parseGateCommand", () => {
	it("accepts `deploy <full sha>` and `rollback`", () => {
		expect(parseGateCommand(`deploy ${SHA}`)).toStrictEqual({ kind: "deploy", commit: SHA });
		expect(parseGateCommand("  rollback ")).toStrictEqual({ kind: "rollback" });
	});

	it.each([
		undefined,
		"",
		"deploy",
		"deploy main",
		`deploy ${SHA.slice(0, 7)}`,
		`deploy ${SHA.toUpperCase()}`,
		`deploy ${SHA}; rm -rf /`,
		`deploy ${SHA} extra`,
		"rollback now",
		"bash",
		`deploy $(whoami)`,
	])("refuses %j", (command) => {
		expect(parseGateCommand(command).kind).toBe("refused");
	});
});

describe("the release plan", () => {
	it("lays the Droplet out under one root", () => {
		const layout = deployLayout("/srv/acme");
		expect(layout.release(SHA)).toBe(`/srv/acme/releases/${SHA}`);
		expect([layout.current, layout.previous, layout.envDir, layout.repository]).toStrictEqual([
			"/srv/acme/current",
			"/srv/acme/previous",
			"/srv/acme/shared/env",
			"/srv/acme/repository.git",
		]);
	});

	it("links each app's shared env file into the release", () => {
		expect(envLinks("/srv/acme/shared/env", "/r")).toStrictEqual([
			{ app: "api", source: "/srv/acme/shared/env/api.env", link: "/r/apps/api/.env" },
			{ app: "web", source: "/srv/acme/shared/env/web.env", link: "/r/apps/web/.env" },
			{ app: "admin", source: "/srv/acme/shared/env/admin.env", link: "/r/apps/admin/.env" },
			{ app: "merchant", source: "/srv/acme/shared/env/merchant.env", link: "/r/apps/merchant/.env" },
		]);
	});

	it("installs from the lockfile, builds the four apps, then migrates and loads reference data with the migration login — before anything is switched", () => {
		const steps = buildSteps("/srv/acme/shared/env");
		expect(steps.map((step) => step.name)).toStrictEqual(["install", "build", "migrate", "reference data"]);
		const [install, build, migrate, reference] = steps;
		expect(install?.argv).toStrictEqual(["pnpm", "install", "--frozen-lockfile", "--prefer-offline"]);
		expect(build?.argv).toStrictEqual([
			"pnpm",
			"turbo",
			"run",
			"build",
			"--filter=@workspace/api...",
			"--filter=@workspace/web...",
			"--filter=@workspace/admin...",
			"--filter=@workspace/merchant...",
		]);
		expect(install?.env).toStrictEqual({});
		expect(migrate?.argv).toStrictEqual(["pnpm", "--filter", "@workspace/api", "db:deploy"]);
		expect(reference?.argv).toStrictEqual(["pnpm", "--filter", "@workspace/api", "db:sync-reference-data"]);
		for (const step of [migrate, reference]) {
			expect(step?.env).toStrictEqual({ DOTENV_PATH: "/srv/acme/shared/env/api-migrate.env" });
		}
	});

	it("needs every app's env file and the migration login's", () => {
		expect(requiredEnvFiles("/e")).toStrictEqual(["/e/api.env", "/e/web.env", "/e/admin.env", "/e/merchant.env", "/e/api-migrate.env"]);
	});

	it("uses a script that really exists for each step", () => {
		const api = packageManifest(readFileSync(path.join(REPO_ROOT, "apps/api/package.json"), "utf8"));
		expect(api.scripts?.["db:deploy"]).toContain("prisma migrate deploy");
		expect(api.scripts?.["db:deploy"]).toContain("db:apply-security");
		// `dotenv run` honours DOTENV_PATH, which is how the migration login is chosen.
		expect(api.scripts?.["db:deploy"]).toContain("dotenv run");
		expect(api.scripts?.["db:sync-reference-data"]).toContain("dotenv run");
		for (const { workspace } of PLATFORM_APPS) {
			const dir = workspace.replace("@workspace/", "apps/");
			expect(packageManifest(readFileSync(path.join(REPO_ROOT, dir, "package.json"), "utf8")).name).toBe(workspace);
		}
	});
});

describe("health", () => {
	it("checks each app on loopback", () => {
		expect(PLATFORM_APPS.map(healthUrl)).toStrictEqual([
			"http://127.0.0.1:8080/health/ready",
			"http://127.0.0.1:3000/",
			"http://127.0.0.1:3001/auth/login",
			"http://127.0.0.1:3003/auth/login",
		]);
	});

	it("needs the API ready (200) and a web app rendering (below 500, redirects allowed)", () => {
		const api = PLATFORM_APPS.find(({ app }) => app === "api") ?? { app: "", workspace: "", port: 0, healthPath: "", readiness: "" };
		const web = PLATFORM_APPS.find(({ app }) => app === "web") ?? api;
		expect([200, 503, 307].map((status) => isHealthy(api, status))).toStrictEqual([true, false, false]);
		expect([200, 307, 404, 500, 502, 0].map((status) => isHealthy(web, status))).toStrictEqual([true, true, true, false, false, false]);
	});
});

describe("releasesToPrune", () => {
	const releases = ["a", "b", "c", "d", "e", "f", "g"].map((name, index) => ({ name, deployedAt: index }));

	it("keeps the newest five", () => {
		expect(releasesToPrune(releases, { current: "g", previous: "f" })).toStrictEqual(["b", "a"]);
	});

	it("never prunes the live or the previous release, however old", () => {
		expect(releasesToPrune(releases, { current: "a", previous: "b", keep: 2 })).toStrictEqual(["e", "d", "c"]);
	});
});

describe("the pm2 ecosystem", () => {
	const require = createRequire(import.meta.url);
	const ecosystem = EcosystemSchema.parse(require(path.join(REPO_ROOT, "infra/pm2/ecosystem.config.cjs")));
	const { slug } = ProjectSchema.parse(JSON.parse(readFileSync(path.join(REPO_ROOT, "project.json"), "utf8")));

	it("runs the four apps, named after the project, from the release they belong to", () => {
		expect(ecosystem.apps.map((app) => app.name)).toStrictEqual(PLATFORM_APPS.map(({ app }) => processName(slug, app)));
		for (const app of ecosystem.apps) {
			expect(app.cwd?.startsWith(path.join(REPO_ROOT, "apps"))).toBe(true);
			expect(app.env).toStrictEqual({ NODE_ENV: "production" });
		}
	});

	it("binds the web apps to loopback on the ports the health checks and nginx use", () => {
		const nextApps = ecosystem.apps.filter((app) => !app.name.endsWith("-api"));
		expect(nextApps.map((app) => app.args)).toStrictEqual(
			PLATFORM_APPS.filter(({ app }) => app !== "api").map(({ port }) => ["start", "--port", String(port), "--hostname", "127.0.0.1"]),
		);
	});
});
