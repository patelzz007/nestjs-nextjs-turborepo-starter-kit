// @vitest-environment jsdom
import { renderHook } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { z } from "zod";

import { apiFetch, useApi, type OnRefresh, type OnUnauthorized } from "./use-api";
import { firstFetchCall, headersOf, inputUrl, jsonResponse, type FetchImpl } from "../test-utils";

const BASE_URL = "http://api.test";

interface Envelope {
	readonly success: true;
	readonly data: unknown;
	readonly meta: { readonly timestamp: string };
}

/** Minimal mirror of the API's ResponseInterceptor envelope. */
const envelopeSchema = z
	.object({
		success: z.literal(true),
		data: z.unknown(),
		meta: z.object({ timestamp: z.string() }).loose(),
	})
	.loose();

function successEnvelope(data: unknown): Envelope {
	return { success: true, data, meta: { timestamp: "2026-08-03T10:00:00.000Z" } };
}

afterEach(() => {
	vi.unstubAllGlobals();
});

describe("apiFetch", () => {
	it("sends credentials with every request and forwards query params", async () => {
		const fetchMock = vi.fn<FetchImpl>().mockResolvedValue(jsonResponse(200, successEnvelope({})));
		vi.stubGlobal("fetch", fetchMock);

		const result = await apiFetch(BASE_URL, "GET", "/auth/me", { query: { page: 1, q: undefined } });

		expect(fetchMock).toHaveBeenCalledTimes(1);
		const { input, init } = firstFetchCall(fetchMock);
		expect(inputUrl(input)).toBe("http://api.test/auth/me?page=1");
		expect(init.method).toBe("GET");
		expect(init.credentials).toBe("include");
		expect(result.ok).toBe(true);
	});

	it("stringifies JSON bodies and sets Content-Type on POST", async () => {
		const fetchMock = vi.fn<FetchImpl>().mockResolvedValue(jsonResponse(200, successEnvelope({})));
		vi.stubGlobal("fetch", fetchMock);

		await apiFetch(BASE_URL, "POST", "/auth/login", { body: { email: "alex@example.com" } });

		const { init } = firstFetchCall(fetchMock);
		expect(headersOf(init)["Content-Type"]).toBe("application/json");
		expect(init.body).toBe(JSON.stringify({ email: "alex@example.com" }));
	});

	it("passes string bodies through unmodified", async () => {
		const fetchMock = vi.fn<FetchImpl>().mockResolvedValue(jsonResponse(200, successEnvelope({})));
		vi.stubGlobal("fetch", fetchMock);

		await apiFetch(BASE_URL, "POST", "/auth/refresh", { body: "{}" });

		const { init } = firstFetchCall(fetchMock);
		expect(init.body).toBe("{}");
	});

	it("returns ok:false with the parsed error payload on non-2xx", async () => {
		const fetchMock = vi.fn<FetchImpl>().mockResolvedValue(jsonResponse(500, { message: "Server exploded" }));
		vi.stubGlobal("fetch", fetchMock);

		const result = await apiFetch(BASE_URL, "GET", "/auth/me");

		expect(result.ok).toBe(false);
		expect(result.status).toBe(500);
		if (!result.ok) expect(result.error).toEqual({ message: "Server exploded" });
	});

	it("maps AbortError to ok:false with status 0", async () => {
		const fetchMock = vi.fn<FetchImpl>().mockRejectedValue(new DOMException("Aborted", "AbortError"));
		vi.stubGlobal("fetch", fetchMock);

		const result = await apiFetch(BASE_URL, "GET", "/auth/me");

		expect(result.ok).toBe(false);
		expect(result.status).toBe(0);
		if (!result.ok) expect(result.error).toBe("aborted");
	});

	it("maps network failures to ok:false with status 0", async () => {
		const fetchMock = vi.fn<FetchImpl>().mockRejectedValue(new TypeError("fetch failed"));
		vi.stubGlobal("fetch", fetchMock);

		const result = await apiFetch(BASE_URL, "GET", "/auth/me");

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

		const { result } = renderHook(() => useApi(BASE_URL, onUnauthorized, onRefresh));
		const me = result.current.procedure({ method: "GET", path: "/auth/me", responseSchema: envelopeSchema });

		const response = await me.fetch();

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

		const { result } = renderHook(() => useApi(BASE_URL, onUnauthorized, onRefresh));
		const me = result.current.procedure({ method: "GET", path: "/auth/me", responseSchema: envelopeSchema });

		const response = await me.fetch();

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

		const { result } = renderHook(() => useApi(BASE_URL, onUnauthorized, onRefresh));
		const me = result.current.procedure({ method: "GET", path: "/auth/me", responseSchema: envelopeSchema });

		const response = await me.fetch();

		expect(onRefresh).not.toHaveBeenCalled();
		expect(onUnauthorized).not.toHaveBeenCalled();
		expect(response.ok).toBe(false);
		expect(response.status).toBe(403);
	});
});
