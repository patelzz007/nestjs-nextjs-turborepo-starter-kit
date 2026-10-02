import type { OpenAPIObject } from "@nestjs/swagger";
import { describe, expect, it } from "vitest";

import { serializeOpenApiArtifact, sortJsonKeys } from "./openapi-artifact";

/** Two documents with the same content, built in different key orders. */
function documentInOrder(reversed: boolean): OpenAPIObject {
	const info = reversed ? { version: "1.0", title: "API" } : { title: "API", version: "1.0" };
	const paths = reversed
		? { "/b": { get: { responses: {}, summary: "b" } }, "/a": { get: { summary: "a", responses: {} } } }
		: { "/a": { get: { responses: {}, summary: "a" } }, "/b": { get: { summary: "b", responses: {} } } };
	return reversed ? { paths, info, openapi: "3.0.0" } : { openapi: "3.0.0", info, paths };
}

describe("sortJsonKeys", () => {
	it("sorts object keys at every depth and keeps array order", () => {
		const sorted = sortJsonKeys({ z: 1, a: { y: [3, { d: 1, c: 2 }, 1], b: null } });

		expect(JSON.stringify(sorted)).toBe('{"a":{"b":null,"y":[3,{"c":2,"d":1},1]},"z":1}');
	});

	it("returns primitives unchanged", () => {
		expect(sortJsonKeys("x")).toBe("x");
		expect(sortJsonKeys(null)).toBeNull();
	});
});

describe("serializeOpenApiArtifact", () => {
	it("is byte-for-byte identical regardless of the key order the document was built in", () => {
		expect(serializeOpenApiArtifact(documentInOrder(true))).toBe(serializeOpenApiArtifact(documentInOrder(false)));
	});

	it("uses two-space indentation, sorted keys and a trailing newline", () => {
		const serialized: string = serializeOpenApiArtifact(documentInOrder(true));

		expect(serialized.endsWith("}\n")).toBe(true);
		expect(serialized.startsWith('{\n  "info": {\n    "title": "API",')).toBe(true);
	});
});
