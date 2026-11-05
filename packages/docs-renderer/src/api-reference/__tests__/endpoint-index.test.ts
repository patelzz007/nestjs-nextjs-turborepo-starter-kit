import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";

import { describe, expect, it } from "vitest";

import { extractEndpointAccess, type ControllerSource, type EndpointAccess } from "../endpoint-access";
import { buildEndpointIndex, endpointAuth, EndpointIndexSchema } from "../endpoint-index";
import { listEndpoints, OpenApiDocumentSchema } from "../openapi";
import { headingAnchor } from "../render";

const REPOSITORY_ROOT: string = path.resolve(import.meta.dirname, "../../../../..");
const CONTROLLERS_DIRECTORY: string = path.join(REPOSITORY_ROOT, "apps/api/src");
const POLICY_FILE = "apps/api/src/platform/presentation/http/security/throttling/rate-limit-policy.ts";

function controllerSources(): readonly ControllerSource[] {
	return readdirSync(CONTROLLERS_DIRECTORY, { recursive: true, encoding: "utf8" })
		.filter((file) => file.endsWith(".controller.ts"))
		.sort()
		.map((file) => ({ path: `apps/api/src/${file}`, source: readFileSync(path.join(CONTROLLERS_DIRECTORY, file), "utf8") }));
}

const document = OpenApiDocumentSchema.parse(JSON.parse(readFileSync(path.join(REPOSITORY_ROOT, "docs/generated/openapi.json"), "utf8")));
const access = extractEndpointAccess(controllerSources(), readFileSync(path.join(REPOSITORY_ROOT, POLICY_FILE), "utf8"));
const rows = buildEndpointIndex(document, access);

function accessWith(overrides: Partial<EndpointAccess>): EndpointAccess {
	return {
		sourceFile: "apps/api/src/x.controller.ts",
		isPublic: false,
		merchantApiKey: false,
		refreshToken: false,
		allowsIntegrationKey: false,
		superAdminOnly: false,
		adminAccessOnly: false,
		permissions: [],
		policies: [],
		emailVerified: false,
		fullSession: false,
		rlsBypass: false,
		idempotent: false,
		skipsMutationIntent: false,
		throttles: [],
		...overrides,
	};
}

describe("endpoint index", () => {
	it("should have one schema-valid row per OpenAPI operation", () => {
		expect(rows).toHaveLength(listEndpoints(document).length);
		expect(EndpointIndexSchema.parse(rows)).toEqual(rows);
	});

	it("should link every row to an existing section of its generated reference page", () => {
		const missing = rows.flatMap((row): string[] => {
			const [route = "", anchor = ""] = row.href.split("#");
			const file = path.join(REPOSITORY_ROOT, `${route.replace(/^\/docs\//, "docs/")}.md`);
			const anchors = new Set(
				readFileSync(file, "utf8")
					.split("\n")
					.filter((line) => line.startsWith("#"))
					.map((line) => headingAnchor(line.replace(/^#+\s*/, ""))),
			);
			return anchors.has(anchor) ? [] : [row.href];
		});
		expect(missing).toEqual([]);
	});

	it("should name how a caller authenticates, API key first", () => {
		expect(endpointAuth(undefined)).toBe("unknown");
		expect(endpointAuth(accessWith({ merchantApiKey: true, isPublic: true }))).toBe("apiKey");
		expect(endpointAuth(accessWith({ refreshToken: true }))).toBe("refreshToken");
		expect(endpointAuth(accessWith({ isPublic: true }))).toBe("public");
		expect(endpointAuth(accessWith({}))).toBe("session");
	});

	it("should refuse an operation whose tag has no reference page", () => {
		const orphan = OpenApiDocumentSchema.parse({ paths: { "/x": { get: { operationId: "X_get", tags: ["NoSuchTag"], responses: {} } } } });
		expect(() => buildEndpointIndex(orphan, new Map())).toThrow(/NoSuchTag/);
	});
});
