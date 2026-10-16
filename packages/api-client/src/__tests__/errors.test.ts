import { DataValueSchema, singleResponse, type DataValue } from "@workspace/shared";
import { afterEach, describe, expect, it, vi } from "vitest";
import { z } from "zod";

import { ApiError, readErrorPayload } from "./errors";
import type { RefreshResult } from "./refresh";
import { createApiRequestContext, fetchQuery } from "./request";
import { defineQuery } from "./router";
import { jsonResponse, type FetchImpl } from "./testing";

function errorEnvelope(code: string, message: string, details?: Record<string, DataValue>): DataValue {
	return {
		success: false,
		error: { code, message, ...(details !== undefined ? { details } : {}) },
		meta: { correlationId: "corr-42", timestamp: 1790812800000 },
	};
}

afterEach(() => {
	vi.unstubAllGlobals();
});

describe("readErrorPayload", () => {
	it("flattens the standard envelope into an ApiError (code, status, message, correlation id)", async () => {
		const payload = await readErrorPayload(jsonResponse(401, errorEnvelope("INVALID_CREDENTIALS", "Invalid email or password")));

		expect(payload).toBeInstanceOf(ApiError);
		if (payload instanceof ApiError) {
			expect(payload.message).toBe("Invalid email or password");
			expect(payload.error).toBe("INVALID_CREDENTIALS");
			expect(payload.code).toBe("INVALID_CREDENTIALS");
			expect(payload.statusCode).toBe(401);
			expect(payload.correlationId).toBe("corr-42");
			expect(payload.details).toBeUndefined();
		}
	});

	it("keeps validation details", async () => {
		const payload = await readErrorPayload(
			jsonResponse(400, errorEnvelope("VALIDATION_ERROR", "Validation failed", { issues: [{ path: "email", message: "bad", code: "format" }] })),
		);

		expect(payload instanceof ApiError ? payload.details : undefined).toEqual({ issues: [{ path: "email", message: "bad", code: "format" }] });
	});

	it("still accepts the legacy flat body and fills statusCode from the HTTP status", async () => {
		const payload = await readErrorPayload(jsonResponse(403, { message: "Forbidden", error: "PERMISSION_DENIED" }));

		expect(payload).toBeInstanceOf(ApiError);
		expect(payload instanceof ApiError ? payload.statusCode : undefined).toBe(403);
		expect(payload instanceof ApiError ? payload.code : undefined).toBe("PERMISSION_DENIED");
	});

	it("falls back to raw text for non-JSON bodies and a generic error for empty ones", async () => {
		expect(await readErrorPayload(new Response("Bad Gateway", { status: 502 }))).toBe("Bad Gateway");
		const empty = await readErrorPayload(new Response("", { status: 504 }));
		expect(empty instanceof Error ? empty.message : "").toBe("Request failed (504)");
	});
});

describe("fetchQuery with the error envelope", () => {
	const meDef = defineQuery({ method: "GET", path: "/auth/me", input: z.undefined(), response: singleResponse(DataValueSchema) }, { scope: () => ["auth", "me"] });

	it.each(["TOKEN_VERSION_MISMATCH", "SESSION_REVOKED"])("does not attempt a refresh when the envelope code %s marks the session dead", async (code: string) => {
		vi.stubGlobal("fetch", vi.fn<FetchImpl>().mockResolvedValue(jsonResponse(401, errorEnvelope(code, "Token revoked"))));
		const onRefresh = vi.fn((): Promise<RefreshResult> => Promise.resolve("ok"));
		const onUnauthorized = vi.fn((): Promise<void> => Promise.resolve());

		const result = await fetchQuery(createApiRequestContext("http://api.test", "web", onUnauthorized, onRefresh), meDef, undefined);

		expect(result.ok).toBe(false);
		expect(onRefresh).not.toHaveBeenCalled();
		expect(onUnauthorized).toHaveBeenCalledTimes(1);
	});

	it("surfaces the envelope as an ApiError on a non-401 failure", async () => {
		vi.stubGlobal("fetch", vi.fn<FetchImpl>().mockResolvedValue(jsonResponse(409, errorEnvelope("IDEMPOTENCY_KEY_REUSED", "Key reused"))));

		const result = await fetchQuery(createApiRequestContext("http://api.test", "web"), meDef, undefined);

		expect(result.ok).toBe(false);
		if (!result.ok) {
			expect(result.status).toBe(409);
			expect(result.error instanceof ApiError ? result.error.code : undefined).toBe("IDEMPOTENCY_KEY_REUSED");
		}
	});

	it("treats a 404 as final — never silently re-sends the request to another API version", async () => {
		const fetchMock = vi.fn<FetchImpl>().mockResolvedValue(jsonResponse(404, errorEnvelope("NOT_FOUND", "Not found")));
		vi.stubGlobal("fetch", fetchMock);

		const result = await fetchQuery(createApiRequestContext("http://api.test", "web"), meDef, undefined);

		expect(result.ok).toBe(false);
		expect(result.status).toBe(404);
		expect(fetchMock).toHaveBeenCalledTimes(1);
	});
});
