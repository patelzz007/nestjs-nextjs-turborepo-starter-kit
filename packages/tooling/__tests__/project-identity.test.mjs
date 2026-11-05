import { readFileSync } from "node:fs";
import path from "node:path";

import { describe, expect, it } from "vitest";

import {
	driftedTargets,
	IDENTITY_TARGETS,
	parseProjectIdentity,
	renderApiEnvExample,
	renderCompose,
	renderMobileAppConfig,
	renderRootPackageJson,
	renderTokensModule,
} from "../scripts/lib/project-identity.mjs";

const REPO_ROOT = path.resolve(import.meta.dirname, "../../..");
const IDENTITY = { slug: "acme-rewards", displayName: "Acme Rewards" };

describe("parseProjectIdentity", () => {
	it("accepts a slug and a display name", () => {
		expect(parseProjectIdentity('{"slug":"acme","displayName":"Acme"}')).toStrictEqual({ slug: "acme", displayName: "Acme" });
	});

	it.each(["Acme", "acme_rewards", "-acme", "acme-", "acme--rewards", "a", "1acme"])("rejects the slug %s", (slug) => {
		expect(() => parseProjectIdentity(JSON.stringify({ slug, displayName: "Acme" }))).toThrow();
	});

	it("rejects an empty or over-long display name, and unknown keys", () => {
		expect(() => parseProjectIdentity('{"slug":"acme","displayName":"  "}')).toThrow();
		expect(() => parseProjectIdentity(JSON.stringify({ slug: "acme", displayName: "x".repeat(31) }))).toThrow();
		expect(() => parseProjectIdentity('{"slug":"acme","displayName":"Acme","name":"x"}')).toThrow();
	});
});

describe("the renderers", () => {
	it("renames the root package and nothing else", () => {
		const before = '{\n\t"name": "hello-world",\n\t"version": "0.0.1",\n\t"dependencies": { "x": { "name": "keep" } }\n}\n';
		expect(renderRootPackageJson(before, IDENTITY)).toBe('{\n\t"name": "acme-rewards",\n\t"version": "0.0.1",\n\t"dependencies": { "x": { "name": "keep" } }\n}\n');
	});

	it("names the Compose project, each container after its service (commented ones too) and the network", () => {
		const before = [
			"name: hello-world",
			"",
			"services:",
			"  # postgres:",
			"  #   container_name: hello-world-postgres",
			"  redis:",
			"    image: redis",
			"    container_name: hello-world-redis",
			"  bull-board:",
			"    container_name: old-bull-board",
			"",
			"volumes:",
			"  redis_data:",
			"",
			"networks:",
			"  infra:",
			"    name: hello-world-infra",
			"",
		].join("\n");
		expect(renderCompose(before, IDENTITY)).toBe(
			[
				"name: acme-rewards",
				"",
				"services:",
				"  # postgres:",
				"  #   container_name: acme-rewards-postgres",
				"  redis:",
				"    image: redis",
				"    container_name: acme-rewards-redis",
				"  bull-board:",
				"    container_name: acme-rewards-bull-board",
				"",
				"volumes:",
				"  redis_data:",
				"",
				"networks:",
				"  infra:",
				"    name: acme-rewards-infra",
				"",
			].join("\n"),
		);
	});

	it("sets the documented APP_NAME and OBSERVE_SERVICE_ID", () => {
		const before = "# the app\nAPP_NAME=Old\nX=1\nOBSERVE_SERVICE_ID=old\n";
		expect(renderApiEnvExample(before, IDENTITY)).toBe("# the app\nAPP_NAME=Acme Rewards\nX=1\nOBSERVE_SERVICE_ID=acme-rewards\n");
	});

	it("sets the phone app's default store name", () => {
		const before = '\tMOBILE_APP_NAME: z.string().trim().min(1).max(APP_NAME_MAX_LENGTH).default("Starter"),\n';
		expect(renderMobileAppConfig(before, IDENTITY)).toBe('\tMOBILE_APP_NAME: z.string().trim().min(1).max(APP_NAME_MAX_LENGTH).default("Acme Rewards"),\n');
	});

	it("generates the TypeScript identity module", () => {
		const module = renderTokensModule("", IDENTITY);
		expect(module).toContain('export const PROJECT_SLUG = "acme-rewards";');
		expect(module).toContain('export const PROJECT_DISPLAY_NAME = "Acme Rewards";');
	});

	it("fails loudly when an anchor line is gone, instead of skipping the file", () => {
		expect(() => renderApiEnvExample("X=1\n", IDENTITY)).toThrow(/APP_NAME/u);
		expect(() => renderCompose("services:\n", IDENTITY)).toThrow(/name:/u);
		expect(() => renderMobileAppConfig("", IDENTITY)).toThrow(/app-config-env\.ts/u);
	});
});

describe("driftedTargets", () => {
	it("lists only the files whose copy differs, with their new content", () => {
		const files = new Map(IDENTITY_TARGETS.map((target) => [target.path, ""]));
		files.set("package.json", '{\n\t"name": "acme-rewards",\n}\n');
		files.set("apps/api/.env.example", "APP_NAME=Old\nOBSERVE_SERVICE_ID=acme-rewards\n");
		files.set("packages/tokens/src/project-identity.ts", renderTokensModule("", IDENTITY));
		files.set("compose.yml", "name: acme-rewards\n");
		files.set("apps/mobile/build-env/app-config-env.ts", '\tMOBILE_APP_NAME: z.string().trim().min(1).max(APP_NAME_MAX_LENGTH).default("Acme Rewards"),\n');
		const drifted = driftedTargets(IDENTITY, (file) => files.get(file) ?? "");
		expect(drifted).toStrictEqual([{ path: "apps/api/.env.example", next: "APP_NAME=Acme Rewards\nOBSERVE_SERVICE_ID=acme-rewards\n" }]);
	});

	it("finds the repository in sync with project.json", () => {
		const identity = parseProjectIdentity(readFileSync(path.join(REPO_ROOT, "project.json"), "utf8"));
		expect(driftedTargets(identity, (file) => readFileSync(path.join(REPO_ROOT, file), "utf8"))).toStrictEqual([]);
	});
});
