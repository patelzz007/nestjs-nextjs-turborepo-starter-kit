import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";

import { describe, expect, it } from "vitest";

import { extractEndpointAccess, type ControllerSource } from "./endpoint-access";
import { ApiSamplesFileSchema, listEndpoints, OpenApiDocumentSchema } from "./openapi";
import { renderApiReference } from "./render";

// ── Generated API reference guard ───────────────────────────────────────────
// `docs/technical/api-reference/*.md` is rendered from three generated inputs:
//   - docs/generated/openapi.json      (pnpm --filter @workspace/api openapi:export)
//   - apps/api/src/**/*.controller.ts  (guards, permissions, rate limits)
//   - docs/generated/api-samples.json  (apps/docs/scripts/capture-api-samples.mjs)
// This test fails when the committed pages differ from what those inputs
// render. Regenerate with `pnpm docs:api` (this file with `--update`).

const REPOSITORY_ROOT: string = path.resolve(import.meta.dirname, "../../../../..");
const OUTPUT_DIRECTORY: string = path.join(REPOSITORY_ROOT, "docs/technical/api-reference");
const CONTROLLERS_DIRECTORY: string = path.join(REPOSITORY_ROOT, "apps/api/src");

function readJson(relativePath: string): string {
	return readFileSync(path.join(REPOSITORY_ROOT, relativePath), "utf8");
}

function controllerSources(): readonly ControllerSource[] {
	return readdirSync(CONTROLLERS_DIRECTORY, { recursive: true, encoding: "utf8" })
		.filter((file) => file.endsWith(".controller.ts"))
		.sort()
		.map((file) => ({ path: `apps/api/src/${file}`, source: readFileSync(path.join(CONTROLLERS_DIRECTORY, file), "utf8") }));
}

const document = OpenApiDocumentSchema.parse(JSON.parse(readJson("docs/generated/openapi.json")));
const samples = ApiSamplesFileSchema.parse(JSON.parse(readJson("docs/generated/api-samples.json")));
const access = extractEndpointAccess(controllerSources());
const files = renderApiReference({ document, access, samples });

describe("generated API reference", () => {
	it("finds the controller method of every operation", () => {
		const missing = listEndpoints(document)
			.map((endpoint) => endpoint.operation.operationId)
			.filter((operationId) => !access.has(operationId));
		expect(missing).toEqual([]);
	});

	it("only keeps samples of operations that still exist", () => {
		const operationIds = new Set(listEndpoints(document).map((endpoint) => endpoint.operation.operationId));
		expect(Object.keys(samples.samples).filter((operationId) => !operationIds.has(operationId))).toEqual([]);
	});

	it("has no stale pages in docs/technical/api-reference", () => {
		const committed = readdirSync(OUTPUT_DIRECTORY).filter((file) => file.endsWith(".md"));
		expect(committed.filter((file) => !files.has(file))).toEqual([]);
	});

	it.each([...files.keys()])("docs/technical/api-reference/%s is up to date (run `pnpm docs:api` when this fails)", async (file) => {
		await expect(files.get(file)).toMatchFileSnapshot(path.join(OUTPUT_DIRECTORY, file));
	});
});
