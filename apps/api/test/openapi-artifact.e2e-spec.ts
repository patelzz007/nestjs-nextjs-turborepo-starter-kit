// ── Exported OpenAPI artifact guard (ADR 022) ──────────────────────────────
// `docs/generated/openapi.json` is the committed, deterministic export of the
// document bootstrap serves at `/v1/docs-json` (same `buildOpenApiDocument`).
// This spec fails when the committed file is stale — any change to a route,
// a request schema or a response contract must ship with the regenerated
// artifact, so the diff of an API change is reviewable in one place.
//
// Regenerate (needs the same local Postgres + Redis as every e2e spec):
//
//   pnpm --filter @workspace/api openapi:export
//
// which runs THIS file with `--update`: vitest then rewrites the file
// snapshot instead of failing. In CI (`CI=true`) a missing file fails too.
import path from "node:path";
import { fileURLToPath } from "node:url";

import { type NestFastifyApplication } from "@nestjs/platform-fastify";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { buildOpenApiDocument } from "../src/common/api-docs";
import { OPENAPI_ARTIFACT_PATH, serializeOpenApiArtifact } from "../src/common/openapi/openapi-artifact";
import { createE2eApp } from "./e2e-helpers";

const REPOSITORY_ROOT: string = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../..");

describe("OpenAPI artifact (e2e)", () => {
	let app: NestFastifyApplication;

	beforeAll(async () => {
		app = await createE2eApp();
	});

	afterAll(async () => {
		await app.close();
	});

	it(`${OPENAPI_ARTIFACT_PATH} matches the document the API builds (run \`pnpm --filter @workspace/api openapi:export\` when this fails)`, async () => {
		const first: string = serializeOpenApiArtifact(buildOpenApiDocument(app));

		// Deterministic: building twice yields the same bytes.
		expect(serializeOpenApiArtifact(buildOpenApiDocument(app))).toBe(first);
		await expect(first).toMatchFileSnapshot(path.join(REPOSITORY_ROOT, OPENAPI_ARTIFACT_PATH));
	});
});
