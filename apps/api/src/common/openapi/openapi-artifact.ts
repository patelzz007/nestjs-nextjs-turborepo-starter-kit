// ============================================
// common/openapi/openapi-artifact.ts - the committed OpenAPI artifact
// ============================================
// `docs/generated/openapi.json` is the exported OpenAPI document (ADR 022):
// reviewable in a diff, consumable by external tooling (client generators,
// contract tests, API gateways) without booting the API.
//
// It must be byte-for-byte reproducible, so the document is serialized with
// EVERY object's keys sorted (Swagger's own key order follows decorator and
// module registration order, which is an implementation detail), two-space
// indentation and a trailing newline. Array order is kept — it is meaningful
// (`required`, `enum`, `allOf`, parameter order).
//
//   pnpm --filter @workspace/api openapi:export   # rewrite the artifact
//   test/openapi-artifact.e2e-spec.ts             # fails when it is stale

import type { OpenAPIObject } from "@nestjs/swagger";
import { JsonValueSchema, type JsonValue } from "@workspace/shared";

/** Repository-relative path of the committed artifact. */
export const OPENAPI_ARTIFACT_PATH = "docs/generated/openapi.json";

/** Indentation of the serialized artifact (spaces). */
const ARTIFACT_INDENT = 2;

/** A copy of `value` whose objects list their keys in sorted order, at every depth. */
export function sortJsonKeys(value: JsonValue): JsonValue {
	if (Array.isArray(value)) {
		return value.map((entry: JsonValue): JsonValue => sortJsonKeys(entry));
	}
	if (value === null || typeof value !== "object") {
		return value;
	}
	const sorted: Record<string, JsonValue> = {};
	for (const key of Object.keys(value).sort()) {
		const entry: JsonValue | undefined = value[key];
		if (entry !== undefined) {
			sorted[key] = sortJsonKeys(entry);
		}
	}
	return sorted;
}

/**
 * Serialize an OpenAPI document deterministically: plain JSON (a round trip
 * drops `undefined` members), validated as JSON, keys sorted, stable indent,
 * trailing newline.
 */
export function serializeOpenApiArtifact(document: OpenAPIObject): string {
	const json: JsonValue = JsonValueSchema.parse(JSON.parse(JSON.stringify(document)));
	return `${JSON.stringify(sortJsonKeys(json), null, ARTIFACT_INDENT)}\n`;
}
