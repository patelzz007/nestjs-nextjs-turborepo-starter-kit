// @vitest-environment jsdom
import { renderHook } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { z } from "zod";

import { createApiRequestContext, createUncheckedApiRequestContext, fetchMutationUnchecked, fetchQuery, useApi, type OnRefresh, type OnUnauthorized } from "./use-api";
import { type DataValue } from "@workspace/shared";
import { apiRouter, defineMutation, defineQuery } from "./endpoints";
import { firstFetchCall, headersOf, inputUrl, jsonResponse, type FetchImpl } from "../test-utils";

const BASE_URL = "http://api.test";

interface Envelope {
	readonly success: true;
	readonly data: DataValue;
	readonly meta: { readonly timestamp: number };
}

/** Minimal mirror of the API's ResponseInterceptor envelope. */
const envelopeSchema = z.object({
	success: z.literal(true),
	data: z.custom<DataValue>(),
	meta: z.object({ timestamp: z.number() }),
});

function successEnvelope(data: DataValue): Envelope {
	return { success: true, data, meta: { timestamp: 1786428000000 } };
}

/** Minimal tRPC-style GET def mirroring `apiRouter.auth.me` for the 401-pipeline tests. */
const meDef = defineQuery(
	{ method: "GET", path: "/auth/me", input: z.undefined() },
	{
		response: envelopeSchema,
		queryKey: () => ["auth", "me"],
	},
);

const paginatedDef = defineQuery(
	{ method: "GET", path: "/items", input: z.object({ page: z.number(), q: z.string().optional() }) },
	{
		response: envelopeSchema,
		queryKey: (input) => ["items", input.page],
	},
);

const loginDef = defineMutation(
	{ method: "POST", path: "/auth/login", input: z.object({ email: z.string() }) },
	{
		response: envelopeSchema,
		queryKey: () => ["auth", "login"],
	},
);

afterEach(() => {
	vi.unstubAllGlobals();
});

describe("fetchQuery / fetchMutation (tRPC-style caller)", () => {
	const context = createApiRequestContext(BASE_URL);

	it("serializes input onto the URL and sends credentials", async () => {
		const fetchMock = vi.fn<FetchImpl>().mockResolvedValue(jsonResponse(200, successEnvelope({})));
		vi.stubGlobal("fetch", fetchMock);

		const result = await fetchQuery(context, paginatedDef, { page: 1, q: undefined });

		expect(fetchMock).toHaveBeenCalledTimes(1);
		const { input, init } = firstFetchCall(fetchMock);
		expect(inputUrl(input)).toBe("http://api.test/api/v1/items?page=1");
		expect(init.method).toBe("GET");
		expect(init.credentials).toBe("include");
		expect(result.ok).toBe(true);
	});

	it("stringifies JSON bodies and sets Content-Type on mutations", async () => {
		const fetchMock = vi.fn<FetchImpl>().mockResolvedValue(jsonResponse(200, successEnvelope({})));
		vi.stubGlobal("fetch", fetchMock);

		const unchecked = createUncheckedApiRequestContext(BASE_URL);
		await fetchMutationUnchecked(unchecked, loginDef, { email: "alex@example.com" });

		const { init } = firstFetchCall(fetchMock);
		expect(headersOf(init)["Content-Type"]).toBe("application/json");
		expect(init.body).toBe(JSON.stringify({ email: "alex@example.com" }));
	});

	it("returns ok:false with the parsed error payload on non-2xx", async () => {
		const fetchMock = vi.fn<FetchImpl>().mockResolvedValue(jsonResponse(500, { message: "Server exploded" }));
		vi.stubGlobal("fetch", fetchMock);

		const result = await fetchQuery(context, meDef, undefined);

		expect(result.ok).toBe(false);
		expect(result.status).toBe(500);
		if (!result.ok) {
			expect(result.error instanceof Error).toBe(true);
			if (result.error instanceof Error) expect(result.error.message).toBe("Server exploded");
		}
	});

	it("maps AbortError to ok:false with status 0", async () => {
		const fetchMock = vi.fn<FetchImpl>().mockRejectedValue(new DOMException("Aborted", "AbortError"));
		vi.stubGlobal("fetch", fetchMock);

		const result = await fetchQuery(context, meDef, undefined);

		expect(result.ok).toBe(false);
		expect(result.status).toBe(0);
		if (!result.ok) expect(result.error).toBe("aborted");
	});

	it("maps network failures to ok:false with status 0", async () => {
		const fetchMock = vi.fn<FetchImpl>().mockRejectedValue(new TypeError("fetch failed"));
		vi.stubGlobal("fetch", fetchMock);

		const result = await fetchQuery(context, meDef, undefined);

		expect(result.ok).toBe(false);
		expect(result.status).toBe(0);
	});
});

describe("useApi 401 pipeline", () => {
	it("refreshes once on 401 and retries the original request", async () => {
		const fetchMock = vi
			.fn<FetchImpl>()
			.mockResolvedValueOnce(jsonResponse(401, { message: "Unauthorized" }))
			.mockResolvedValueOnce(jsonResponse(200, successEnvelope({ id: "u_1", email: "alex@example.com" })));
		vi.stubGlobal("fetch", fetchMock);

		const onRefresh = vi.fn<OnRefresh>().mockResolvedValue(true);
		const onUnauthorized = vi.fn<OnUnauthorized>();

		const { result } = renderHook(() => useApi(apiRouter, BASE_URL, onUnauthorized, onRefresh));
		const me = result.current.procedure(meDef);

		const response = await me.fetch(undefined);

		expect(onRefresh).toHaveBeenCalledTimes(1);
		expect(onUnauthorized).not.toHaveBeenCalled();
		expect(fetchMock).toHaveBeenCalledTimes(2);
		expect(response.ok).toBe(true);
		if (response.ok) {
			expect(response.data).toMatchObject({ success: true, data: { id: "u_1", email: "alex@example.com" } });
		}
	});

	it("calls onUnauthorized when the refresh fails", async () => {
		const fetchMock = vi.fn<FetchImpl>().mockResolvedValueOnce(jsonResponse(401, { message: "Unauthorized" }));
		vi.stubGlobal("fetch", fetchMock);

		const onRefresh = vi.fn<OnRefresh>().mockResolvedValue(false);
		const onUnauthorized = vi.fn<OnUnauthorized>();

		const { result } = renderHook(() => useApi(apiRouter, BASE_URL, onUnauthorized, onRefresh));
		const me = result.current.procedure(meDef);

		const response = await me.fetch(undefined);

		expect(onRefresh).toHaveBeenCalledTimes(1);
		expect(onUnauthorized).toHaveBeenCalledTimes(1);
		expect(fetchMock).toHaveBeenCalledTimes(1);
		expect(response.ok).toBe(false);
		if (!response.ok) expect(response.error).toBe("Unauthorized");
	});

	it("does not retry or call onUnauthorized on non-401 errors", async () => {
		const fetchMock = vi.fn<FetchImpl>().mockResolvedValue(jsonResponse(403, { message: "Forbidden" }));
		vi.stubGlobal("fetch", fetchMock);

		const onRefresh = vi.fn<OnRefresh>().mockResolvedValue(true);
		const onUnauthorized = vi.fn<OnUnauthorized>();

		const { result } = renderHook(() => useApi(apiRouter, BASE_URL, onUnauthorized, onRefresh));
		const me = result.current.procedure(meDef);

		const response = await me.fetch(undefined);

		expect(onRefresh).not.toHaveBeenCalled();
		expect(onUnauthorized).not.toHaveBeenCalled();
		expect(response.ok).toBe(false);
		expect(response.status).toBe(403);
	});

	it("sends X-Client-Type: admin on typed router calls when clientType is admin", async () => {
		const fetchMock = vi
			.fn<FetchImpl>()
			.mockResolvedValue(jsonResponse(200, successEnvelope({ userId: "u_1", email: "a@b.com", fullName: "A", expiresAt: null, checkedAt: 0 })));
		vi.stubGlobal("fetch", fetchMock);

		const onRefresh = vi.fn<OnRefresh>().mockResolvedValue(true);
		const onUnauthorized = vi.fn<OnUnauthorized>();

		const { result } = renderHook(() => useApi(apiRouter, BASE_URL, onUnauthorized, onRefresh, { clientType: "admin" }));
		const session = result.current.auth.sessionStatus;

		await session.fetch(undefined);

		const init = fetchMock.mock.calls[0]?.[1];
		expect(init?.headers).toMatchObject({ "X-Client-Type": "admin" });
	});

	it("sends X-Client-Type: merchant on merchant portal calls", async () => {
		const fetchMock = vi
			.fn<FetchImpl>()
			.mockResolvedValue(jsonResponse(200, successEnvelope({ userId: "u_1", email: "a@b.com", fullName: "A", expiresAt: null, checkedAt: 0 })));
		vi.stubGlobal("fetch", fetchMock);

		const onRefresh = vi.fn<OnRefresh>().mockResolvedValue(true);
		const onUnauthorized = vi.fn<OnUnauthorized>();

		const { result } = renderHook(() => useApi(apiRouter, BASE_URL, onUnauthorized, onRefresh, { clientType: "merchant" }));
		await result.current.auth.sessionStatus.fetch(undefined);

		const init = fetchMock.mock.calls[0]?.[1];
		expect(init?.headers).toMatchObject({ "X-Client-Type": "merchant" });
	});
});
