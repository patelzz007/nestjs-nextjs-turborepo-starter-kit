// @vitest-environment jsdom
import { renderHook } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { z } from "zod";

import {
	createApiRequestContext,
	createUncheckedApiRequestContext,
	fetchMutationUnchecked,
	fetchQuery,
	SessionRefreshUnavailableError,
	useApi,
	type OnRefresh,
	type OnUnauthorized,
} from "./use-api";
import { LIST_SLOT_INDEX, DataValueSchema, singleResponse, type DataValue } from "@workspace/shared";
import { apiRouter, defineMutation, defineQuery } from "./endpoints";
import { firstFetchCall, headersOf, inputUrl, jsonResponse, type FetchImpl } from "../test-utils";
import { ApiResponseContractError } from "@workspace/api-client";

const BASE_URL = "http://api.test";

/** Index signature keeps the envelope assignable to `DataValue` for `jsonResponse`. */
interface Envelope {
	readonly [key: string]: DataValue;
	readonly success: true;
	readonly data: DataValue;
	readonly meta: { readonly correlationId: string; readonly timestamp: number };
}

/** Fixture response contract: any JSON `data` inside the standard success envelope. */
const fixtureResponse = singleResponse(DataValueSchema);

function successEnvelope(data: DataValue): Envelope {
	return { success: true, data, meta: { correlationId: "corr-test", timestamp: 1786428000000 } };
}

/** Minimal tRPC-style GET def mirroring `apiRouter.auth.me` for the 401-pipeline tests. */
const meDef = defineQuery({ method: "GET", path: "/auth/me", input: z.undefined(), response: fixtureResponse }, { scope: () => ["auth", "me"] });

const paginatedDef = defineQuery(
	{ method: "GET", path: "/items", input: z.object({ page: z.number(), q: z.string().optional() }), response: fixtureResponse },
	{ scope: () => ["items"] },
);

const loginDef = defineMutation({ method: "POST", path: "/auth/login", input: z.object({ email: z.string() }), response: fixtureResponse });

afterEach(() => {
	vi.unstubAllGlobals();
});

describe("fetchQuery / fetchMutation (tRPC-style caller)", () => {
	const context = createApiRequestContext(BASE_URL, "web");

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

		const unchecked = createUncheckedApiRequestContext(BASE_URL, "web");
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

	it("accepts message-only refresh responses after cookies are set server-side", async () => {
		const fetchMock = vi.fn<FetchImpl>().mockResolvedValue(
			jsonResponse(200, {
				success: true,
				data: { message: "Tokens refreshed successfully" },
				meta: { correlationId: "corr-test", timestamp: 1786428000000 },
			}),
		);
		vi.stubGlobal("fetch", fetchMock);

		const unchecked = createUncheckedApiRequestContext(BASE_URL, "admin");
		const result = await fetchMutationUnchecked(unchecked, apiRouter.auth.refresh, {});

		expect(result.ok).toBe(true);
		if (result.ok) {
			expect(result.data.data).toEqual({ message: "Tokens refreshed successfully" });
		}
	});
});

describe("useApi 401 pipeline", () => {
	it("refreshes once on 401 and retries the original request", async () => {
		const fetchMock = vi
			.fn<FetchImpl>()
			.mockResolvedValueOnce(jsonResponse(401, { message: "Unauthorized" }))
			.mockResolvedValueOnce(jsonResponse(200, successEnvelope({ id: "u_1", email: "alex@example.com" })));
		vi.stubGlobal("fetch", fetchMock);

		const onRefresh = vi.fn<OnRefresh>().mockResolvedValue("ok");
		const onUnauthorized = vi.fn<OnUnauthorized>();

		const { result } = renderHook(() => useApi(apiRouter, BASE_URL, "web", onUnauthorized, onRefresh));
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

	it("calls onUnauthorized when the refresh says the session expired", async () => {
		const fetchMock = vi.fn<FetchImpl>().mockResolvedValueOnce(jsonResponse(401, { message: "Unauthorized" }));
		vi.stubGlobal("fetch", fetchMock);

		const onRefresh = vi.fn<OnRefresh>().mockResolvedValue("expired");
		const onUnauthorized = vi.fn<OnUnauthorized>();

		const { result } = renderHook(() => useApi(apiRouter, BASE_URL, "web", onUnauthorized, onRefresh));
		const me = result.current.procedure(meDef);

		const response = await me.fetch(undefined);

		expect(onRefresh).toHaveBeenCalledTimes(1);
		expect(onUnauthorized).toHaveBeenCalledTimes(1);
		expect(fetchMock).toHaveBeenCalledTimes(1);
		expect(response.ok).toBe(false);
		expect(response.kind).toBe("unauthorized");
		if (!response.ok) expect(response.error).toBe("Unauthorized");
	});

	it("fails only the request — never the session — when the refresh could not run right now", async () => {
		const fetchMock = vi.fn<FetchImpl>().mockResolvedValueOnce(jsonResponse(401, { message: "Unauthorized" }));
		vi.stubGlobal("fetch", fetchMock);

		const onRefresh = vi.fn<OnRefresh>().mockResolvedValue("transient");
		const onUnauthorized = vi.fn<OnUnauthorized>();

		const { result } = renderHook(() => useApi(apiRouter, BASE_URL, "web", onUnauthorized, onRefresh));
		const me = result.current.procedure(meDef);

		const response = await me.fetch(undefined);

		expect(onRefresh).toHaveBeenCalledTimes(1);
		expect(onUnauthorized).not.toHaveBeenCalled();
		expect(fetchMock).toHaveBeenCalledTimes(1);
		expect(response.ok).toBe(false);
		expect(response.status).toBe(401);
		expect(response.kind).toBe("sessionUnavailable");
		if (!response.ok) expect(response.error).toBeInstanceOf(SessionRefreshUnavailableError);
	});

	it("throws the typed refresh-unavailable error from fetchOrThrow, so queries fail without ending the session", async () => {
		vi.stubGlobal("fetch", vi.fn<FetchImpl>().mockResolvedValueOnce(jsonResponse(401, { message: "Unauthorized" })));
		const onRefresh = vi.fn<OnRefresh>().mockResolvedValue("transient");
		const onUnauthorized = vi.fn<OnUnauthorized>();

		const { result } = renderHook(() => useApi(apiRouter, BASE_URL, "web", onUnauthorized, onRefresh));

		await expect(result.current.procedure(meDef).fetchOrThrow(undefined)).rejects.toBeInstanceOf(SessionRefreshUnavailableError);
		expect(onUnauthorized).not.toHaveBeenCalled();
	});

	it("still ends the session when the retried request is 401 again after a successful refresh", async () => {
		const fetchMock = vi
			.fn<FetchImpl>()
			.mockResolvedValueOnce(jsonResponse(401, { message: "Unauthorized" }))
			.mockResolvedValueOnce(jsonResponse(401, { message: "Unauthorized" }));
		vi.stubGlobal("fetch", fetchMock);
		const onRefresh = vi.fn<OnRefresh>().mockResolvedValue("ok");
		const onUnauthorized = vi.fn<OnUnauthorized>();

		const { result } = renderHook(() => useApi(apiRouter, BASE_URL, "web", onUnauthorized, onRefresh));
		const response = await result.current.procedure(meDef).fetch(undefined);

		expect(onRefresh).toHaveBeenCalledTimes(1);
		expect(fetchMock).toHaveBeenCalledTimes(2);
		expect(onUnauthorized).toHaveBeenCalledTimes(1);
		expect(response.kind).toBe("unauthorized");
		if (!response.ok) expect(response.error).toBe("Unauthorized");
	});

	it("maps a 2xx body that is not JSON to a contract violation, not a transport failure", async () => {
		vi.stubGlobal("fetch", vi.fn<FetchImpl>().mockResolvedValue(new Response("<html>gateway</html>", { status: 200, headers: { "content-type": "application/json" } })));

		const result = await fetchQuery(createApiRequestContext(BASE_URL, "web"), meDef, undefined);

		expect(result.ok).toBe(false);
		expect(result.status).toBe(200);
		if (!result.ok) expect(result.error).toBeInstanceOf(ApiResponseContractError);
	});

	it("does not retry or call onUnauthorized on non-401 errors", async () => {
		const fetchMock = vi.fn<FetchImpl>().mockResolvedValue(jsonResponse(403, { message: "Forbidden" }));
		vi.stubGlobal("fetch", fetchMock);

		const onRefresh = vi.fn<OnRefresh>().mockResolvedValue("ok");
		const onUnauthorized = vi.fn<OnUnauthorized>();

		const { result } = renderHook(() => useApi(apiRouter, BASE_URL, "web", onUnauthorized, onRefresh));
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

		const onRefresh = vi.fn<OnRefresh>().mockResolvedValue("ok");
		const onUnauthorized = vi.fn<OnUnauthorized>();

		const { result } = renderHook(() => useApi(apiRouter, BASE_URL, "admin", onUnauthorized, onRefresh));
		const session = result.current.auth.sessionStatus;

		await session.fetch(undefined);

		const init = fetchMock.mock.calls[LIST_SLOT_INDEX.first]?.[LIST_SLOT_INDEX.second];
		expect(init?.headers).toMatchObject({ "X-Client-Type": "admin" });
	});

	it("sends X-Client-Type: merchant on merchant portal calls", async () => {
		const fetchMock = vi
			.fn<FetchImpl>()
			.mockResolvedValue(jsonResponse(200, successEnvelope({ userId: "u_1", email: "a@b.com", fullName: "A", expiresAt: null, checkedAt: 0 })));
		vi.stubGlobal("fetch", fetchMock);

		const onRefresh = vi.fn<OnRefresh>().mockResolvedValue("ok");
		const onUnauthorized = vi.fn<OnUnauthorized>();

		const { result } = renderHook(() => useApi(apiRouter, BASE_URL, "merchant", onUnauthorized, onRefresh));
		await result.current.auth.sessionStatus.fetch(undefined);

		const init = fetchMock.mock.calls[LIST_SLOT_INDEX.first]?.[LIST_SLOT_INDEX.second];
		expect(init?.headers).toMatchObject({ "X-Client-Type": "merchant" });
	});

	it("sends X-Client-Type on web calls too — the API never has to guess the cookie set", async () => {
		const fetchMock = vi
			.fn<FetchImpl>()
			.mockResolvedValue(jsonResponse(200, successEnvelope({ userId: "u_1", email: "a@b.com", fullName: "A", expiresAt: null, checkedAt: 0 })));
		vi.stubGlobal("fetch", fetchMock);

		const { result } = renderHook(() => useApi(apiRouter, BASE_URL, "web", vi.fn<OnUnauthorized>(), vi.fn<OnRefresh>().mockResolvedValue("ok")));
		await result.current.auth.sessionStatus.fetch(undefined);

		expect(fetchMock.mock.calls[LIST_SLOT_INDEX.first]?.[LIST_SLOT_INDEX.second]?.headers).toMatchObject({ "X-Client-Type": "web" });
	});

	it("never lets a procedure's own headers drop the mutation-intent or client-type headers", async () => {
		const fetchMock = vi.fn<FetchImpl>().mockResolvedValue(jsonResponse(200, successEnvelope({})));
		vi.stubGlobal("fetch", fetchMock);
		const spoofing = defineMutation(
			{ method: "POST", path: "/auth/login", input: z.object({ email: z.string() }), response: fixtureResponse },
			{ baseOptions: { headers: { "X-Client-Type": "admin", "X-Mutation-Intent": "none" } } },
		);

		await fetchMutationUnchecked(createUncheckedApiRequestContext(BASE_URL, "web"), spoofing, { email: "alex@example.com" });

		expect(headersOf(firstFetchCall(fetchMock).init)).toMatchObject({ "X-Client-Type": "web", "X-Mutation-Intent": "same-origin" });
	});
});
