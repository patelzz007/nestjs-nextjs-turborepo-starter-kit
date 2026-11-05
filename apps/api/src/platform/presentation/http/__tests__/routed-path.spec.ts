import { describe, expect, it } from "vitest";

import { decodedRequestPath, routeTemplateOf } from "../routed-path";

describe("decodedRequestPath", () => {
	it("drops the query and the fragment, then percent-decodes what Fastify routes on", () => {
		expect(decodedRequestPath("/v1/%64ocs-json?download=1")).toBe("/v1/docs-json");
		expect(decodedRequestPath("/v1/admin/users#/merchant/me")).toBe("/v1/admin/users");
		expect(decodedRequestPath("/v1/docs%2Djson")).toBe("/v1/docs-json");
		expect(decodedRequestPath("")).toBe("");
	});

	it("returns null for a malformed escape, so callers can fail closed", () => {
		expect(decodedRequestPath("/v1/%zz")).toBeNull();
		expect(decodedRequestPath("/v1/%E0%A4%A")).toBeNull();
	});
});

describe("routeTemplateOf", () => {
	it("is the matched template, or undefined when no route matched", () => {
		expect(routeTemplateOf({ url: "/v1/files/abc", routeOptions: { url: "/v1/files/:fileId" } })).toBe("/v1/files/:fileId");
		expect(routeTemplateOf({ url: "/nope", routeOptions: {} })).toBeUndefined();
	});
});
