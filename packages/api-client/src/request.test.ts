// The request core on its default (cookie) transport — exactly the web's
// behavior — and its platform-neutral failure mapping.
import { APP_VERSION_HEADER, CLIENT_TYPE_HEADER, DataValueSchema, singleResponse } from "@workspace/shared";
import { afterEach, describe, expect, it, vi } from "vitest";
import { z } from "zod";

import { AUTHORIZATION_HEADER, NO_HTTP_RESPONSE_STATUS, REQUEST_ABORTED_ERROR } from "./http";
import { createApiRequestContext, createUncheckedApiRequestContext, fetchMutationUnchecked, fetchQuery } from "./request";
import { defineMutation, defineQuery } from "./router";
import { firstFetchCall, headersOf, jsonResponse, type FetchImpl } from "./testing";

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
