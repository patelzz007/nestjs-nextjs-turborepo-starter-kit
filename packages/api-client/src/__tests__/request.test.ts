// The request core on its default (cookie) transport — exactly the web's
// behavior — and its platform-neutral failure mapping.
import { API_VERSION, API_VERSION_OVERRIDE_HEADER, apiVersionPrefix, APP_VERSION_HEADER, CLIENT_TYPE_HEADER, DataValueSchema, singleResponse } from "@workspace/shared";
import { afterEach, describe, expect, it, vi } from "vitest";
import { z } from "zod";

import { AUTHORIZATION_HEADER, NO_HTTP_RESPONSE_STATUS, REQUEST_ABORTED_ERROR } from "../http";
import { createApiRequestContext, createUncheckedApiRequestContext, fetchMutation, fetchMutationUnchecked, fetchQuery } from "../request";
import { defineMutation, defineQuery } from "../router";
import { firstFetchCall, headersOf, inputUrl, jsonResponse, type FetchImpl } from "../testing";

const META = { correlationId: "corr-1", timestamp: 1_790_812_800_000 };
const meDef = defineQuery({ method: "GET", path: "/auth/me", input: z.undefined(), response: singleResponse(DataValueSchema) }, { scope: () => ["auth", "me"] });
const logoutDef = defineMutation({ method: "POST", path: "/auth/logout", input: z.object({}).strict(), response: singleResponse(DataValueSchema) });

afterEach(() => {
	vi.unstubAllGlobals();
});

describe("cookie transport (the default)", () => {
	it("sends the session cookies and the client type, and no bearer token or app version", async () => {
		const fetchMock = vi.fn<FetchImpl>().mockResolvedValue(jsonResponse(200, { success: true, data: { id: "u1" }, meta: META }));
		vi.stubGlobal("fetch", fetchMock);

		await fetchQuery(createApiRequestContext("http://api.test", "merchant"), meDef, undefined);

		const { init } = firstFetchCall(fetchMock);
		expect(init.credentials).toBe("include");
		expect(headersOf(init)[CLIENT_TYPE_HEADER]).toBe("merchant");
		expect(headersOf(init)).not.toHaveProperty(AUTHORIZATION_HEADER);
		expect(headersOf(init)).not.toHaveProperty(APP_VERSION_HEADER);
	});

	it("calls fetch synchronously, before the first await (the web relies on it)", () => {
		const fetchMock = vi.fn<FetchImpl>().mockResolvedValue(jsonResponse(200, { success: true, data: null, meta: META }));
		vi.stubGlobal("fetch", fetchMock);

		void fetchQuery(createApiRequestContext("http://api.test", "web"), meDef, undefined);

		expect(fetchMock).toHaveBeenCalledTimes(1);
	});

	it("keeps lifecycle calls (refresh / logout) out of the 401 pipeline", async () => {
		const fetchMock = vi.fn<FetchImpl>().mockResolvedValue(jsonResponse(401, { message: "Unauthorized" }));
		vi.stubGlobal("fetch", fetchMock);

		const result = await fetchMutationUnchecked(createUncheckedApiRequestContext("http://api.test", "web"), logoutDef, {});

		expect(result).toMatchObject({ kind: "httpError", status: 401 });
		expect(firstFetchCall(fetchMock).init.credentials).toBe("include");
	});
});

describe("API version (ADR 094)", () => {
	function stubFetch(): ReturnType<typeof vi.fn<FetchImpl>> {
		const fetchMock = vi.fn<FetchImpl>().mockResolvedValue(jsonResponse(200, { success: true, data: { id: "u1" }, meta: META }));
		vi.stubGlobal("fetch", fetchMock);
		return fetchMock;
	}

	it("sends every call to the build's API version when the client pins none, without an override header", async () => {
		const fetchMock = stubFetch();

		await fetchQuery(createApiRequestContext("http://api.test", "web"), meDef, undefined);

		const { input, init } = firstFetchCall(fetchMock);
		expect(inputUrl(input)).toBe(`http://api.test${apiVersionPrefix(API_VERSION)}/auth/me`);
		expect(headersOf(init)).not.toHaveProperty(API_VERSION_OVERRIDE_HEADER);
	});

	it("sends every call to the client's pinned version, without an override header", async () => {
		const fetchMock = stubFetch();

		await fetchMutation({ ...createApiRequestContext("http://api.test", "web"), apiVersion: "v2" }, logoutDef, {});

		const { input, init } = firstFetchCall(fetchMock);
		expect(inputUrl(input)).toBe(`http://api.test${apiVersionPrefix("v2")}/auth/logout`);
		expect(headersOf(init)).not.toHaveProperty(API_VERSION_OVERRIDE_HEADER);
	});

	it("sends an overriding call to its own version and names it in Accept-version", async () => {
		const fetchMock = stubFetch();

		await fetchQuery(createApiRequestContext("http://api.test", "web"), meDef, undefined, { apiVersion: "v2" });

		const { input, init } = firstFetchCall(fetchMock);
		expect(inputUrl(input)).toBe(`http://api.test${apiVersionPrefix("v2")}/auth/me`);
		expect(headersOf(init)[API_VERSION_OVERRIDE_HEADER]).toBe("v2");
	});

	it("sends no override header when a call names the version its client is pinned to", async () => {
		const fetchMock = stubFetch();

		await fetchQuery({ ...createApiRequestContext("http://api.test", "web"), apiVersion: "v2" }, meDef, undefined, { apiVersion: "v2" });

		expect(headersOf(firstFetchCall(fetchMock).init)).not.toHaveProperty(API_VERSION_OVERRIDE_HEADER);
	});
});

describe("failures without an HTTP answer", () => {
	it("maps React Native's abort (a plain Error named AbortError) to an aborted call", async () => {
		const nativeAbort = new Error("Aborted");
		nativeAbort.name = "AbortError";
		vi.stubGlobal("fetch", vi.fn<FetchImpl>().mockRejectedValue(nativeAbort));

		await expect(fetchQuery(createApiRequestContext("http://api.test", "web"), meDef, undefined)).resolves.toEqual({
			kind: "aborted",
			ok: false,
			status: NO_HTTP_RESPONSE_STATUS,
			data: null,
			error: REQUEST_ABORTED_ERROR,
		});
	});

	it("maps React Native's network failure to a network error", async () => {
		const failure = new TypeError("Network request failed");
		vi.stubGlobal("fetch", vi.fn<FetchImpl>().mockRejectedValue(failure));

		await expect(fetchQuery(createApiRequestContext("http://api.test", "web"), meDef, undefined)).resolves.toMatchObject({
			kind: "network",
			status: NO_HTTP_RESPONSE_STATUS,
			error: failure,
		});
	});
});
