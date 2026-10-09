import { describe, expect, it } from "vitest";

import { testRequest } from "../../../../test/support/http-execution-context";
import { DEFAULT_CLIENT_TYPE, resolveRequestClientType } from "./client-type";

describe("resolveRequestClientType", () => {
	it.each(["web", "admin", "merchant", "mobile"])("reads X-Client-Type: %s", (clientType: string) => {
		expect(resolveRequestClientType(testRequest({ headers: { "x-client-type": clientType } }))).toBe(clientType);
	});

	it("falls back to ?client_type= when the header is absent (Swagger UI)", () => {
		expect(resolveRequestClientType(testRequest({ headers: {}, query: { client_type: "mobile" } }))).toBe("mobile");
	});

	it("prefers the header over the query parameter", () => {
		expect(resolveRequestClientType(testRequest({ headers: { "x-client-type": "admin" }, query: { client_type: "mobile" } }))).toBe("admin");
	});

	it("resolves an absent client type to web", () => {
		expect(resolveRequestClientType(testRequest({ headers: {} }))).toBe(DEFAULT_CLIENT_TYPE);
		expect(DEFAULT_CLIENT_TYPE).toBe("web");
	});

	it.each(["Mobile", "MOBILE", "ios", "android", " mobile", "web,mobile"])("resolves the unrecognized value %j to web (exact match only)", (value: string) => {
		expect(resolveRequestClientType(testRequest({ headers: { "x-client-type": value } }))).toBe("web");
	});

	it("does not fall back to the query when the header is present but unrecognized", () => {
		expect(resolveRequestClientType(testRequest({ headers: { "x-client-type": "phone" }, query: { client_type: "mobile" } }))).toBe("web");
	});
});
