import { API_VERSION_PREFIX, APP_VERSION_HEADER, apiVersionPrefix, CLIENT_TYPE_HEADER, MUTATION_INTENT_HEADER, MUTATION_INTENT_VALUE } from "@workspace/shared";
import { describe, expect, it } from "vitest";

import { AUTHORIZATION_HEADER, appVersionHeader, bearerAuthorizationHeader, buildUrl, AbortErrorSchema, mergeProcedureHeaders, mutationIntentHeaders } from "./http";

describe("buildUrl", () => {
	it("prefixes the default API version and keeps the query string", () => {
		expect(buildUrl("http://api.test", "/auth/me?x=1")).toBe(`http://api.test${API_VERSION_PREFIX}/auth/me?x=1`);
	});

	it("uses the leaf's own version when it has one", () => {
		expect(buildUrl("http://api.test", "/items", "v2")).toBe(`http://api.test${apiVersionPrefix("v2")}/items`);
	});
});

describe("headers", () => {
	it("mutationIntentHeaders sends the mutation intent", () => {
		expect(mutationIntentHeaders()).toEqual({ [MUTATION_INTENT_HEADER]: MUTATION_INTENT_VALUE });
	});

	it("appVersionHeader is X-App-Version when a version is known, nothing otherwise", () => {
		expect(appVersionHeader("1.4.0")).toEqual({ [APP_VERSION_HEADER]: "1.4.0" });
		expect(appVersionHeader(undefined)).toEqual({});
	});

	it("bearerAuthorizationHeader is a Bearer header when a token is held, nothing otherwise", () => {
		expect(bearerAuthorizationHeader("abc")).toEqual({ [AUTHORIZATION_HEADER]: "Bearer abc" });
		expect(bearerAuthorizationHeader(null)).toEqual({});
	});

	it("mergeProcedureHeaders lets no call site drop or rewrite the client-type, intent or app-version headers", () => {
		const merged = mergeProcedureHeaders("mobile", { [CLIENT_TYPE_HEADER]: "web", [APP_VERSION_HEADER]: "0.0.1", "X-Custom": "kept" }, "1.4.0");

		expect(merged).toEqual({ "X-Custom": "kept", [CLIENT_TYPE_HEADER]: "mobile", [APP_VERSION_HEADER]: "1.4.0", [MUTATION_INTENT_HEADER]: MUTATION_INTENT_VALUE });
	});

	it("mergeProcedureHeaders sends no app version for a browser client", () => {
		expect(mergeProcedureHeaders("web", undefined)).toEqual({ [CLIENT_TYPE_HEADER]: "web", [MUTATION_INTENT_HEADER]: MUTATION_INTENT_VALUE });
	});
});

describe("AbortErrorSchema", () => {
	it("recognizes the browser/Node DOMException abort and the plain Error abort of React Native", () => {
		expect(AbortErrorSchema.safeParse(new DOMException("The operation was aborted.", "AbortError")).success).toBe(true);
		const nativeAbort = new Error("Aborted");
		nativeAbort.name = "AbortError";
		expect(AbortErrorSchema.safeParse(nativeAbort).success).toBe(true);
	});

	it("rejects any other failure", () => {
		expect(AbortErrorSchema.safeParse(new TypeError("Network request failed")).success).toBe(false);
		expect(AbortErrorSchema.safeParse("AbortError").success).toBe(false);
	});
});
