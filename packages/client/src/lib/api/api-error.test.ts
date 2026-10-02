import { DataValueSchema, epochMs, singleResponse, type DataValue } from "@workspace/shared";
import { afterEach, describe, expect, it, vi } from "vitest";
import { z } from "zod";

import { isAccountLockedError, resolveAuthErrorMessage } from "../auth/errors";
import { jsonResponse, type FetchImpl } from "../test-utils";
import { ApiError, createApiRequestContext, fetchQuery, readErrorPayload } from "./api-request";
import { defineQuery } from "./endpoints";

const LOCKED_UNTIL = 1790812800000;

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

	it("lifts lockout timing out of details so the login countdown keeps working", async () => {
		const payload = await readErrorPayload(jsonResponse(401, errorEnvelope("ACCOUNT_LOCKED", "Account locked", { lockedUntil: LOCKED_UNTIL, remainingSeconds: 299 })));

		expect(payload instanceof ApiError ? payload.lockedUntil : undefined).toBe(LOCKED_UNTIL);
		expect(payload instanceof ApiError ? payload.remainingSeconds : undefined).toBe(299);
		expect(isAccountLockedError(payload)).toBe(true);
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

describe("ApiError.fromEnvelope", () => {
	it("ignores malformed lockout details instead of throwing", () => {
		const error = ApiError.fromEnvelope(
			{ success: false, error: { code: "ACCOUNT_LOCKED", message: "locked", details: { lockedUntil: "soon" } }, meta: { correlationId: "c", timestamp: epochMs(1) } },
			401,
		);

		expect(error.lockedUntil).toBeUndefined();
		expect(error.statusCode).toBe(401);
	});
});

describe("auth error resolution with the envelope", () => {
	it("maps the envelope code to the friendly catalog message", async () => {
		const payload = await readErrorPayload(jsonResponse(401, errorEnvelope("ACCESS_TOKEN_EXPIRED", "Access token has expired")));

		expect(payload).toBeInstanceOf(ApiError);
		if (payload instanceof ApiError) {
			expect(resolveAuthErrorMessage(payload)).toBe("Your session has expired. Please log in again.");
		}
	});
});

describe("fetchQuery with the error envelope", () => {
	const meDef = defineQuery({ method: "GET", path: "/auth/me", input: z.undefined(), response: singleResponse(DataValueSchema) }, { queryKey: () => ["auth", "me"] });

	it("does not attempt a refresh when the envelope code marks the session dead", async () => {
		vi.stubGlobal("fetch", vi.fn<FetchImpl>().mockResolvedValue(jsonResponse(401, errorEnvelope("TOKEN_VERSION_MISMATCH", "Token revoked"))));
		const onRefresh = vi.fn((): Promise<boolean> => Promise.resolve(true));
		const onUnauthorized = vi.fn((): Promise<void> => Promise.resolve());

		const result = await fetchQuery(createApiRequestContext("http://api.test", onUnauthorized, onRefresh), meDef, undefined);

		expect(result.ok).toBe(false);
		expect(onRefresh).not.toHaveBeenCalled();
		expect(onUnauthorized).toHaveBeenCalledTimes(1);
	});

	it("surfaces the envelope as an ApiError on a non-401 failure", async () => {
		vi.stubGlobal("fetch", vi.fn<FetchImpl>().mockResolvedValue(jsonResponse(409, errorEnvelope("IDEMPOTENCY_KEY_REUSED", "Key reused"))));

		const result = await fetchQuery(createApiRequestContext("http://api.test"), meDef, undefined);

		expect(result.ok).toBe(false);
		if (!result.ok) {
			expect(result.status).toBe(409);
			expect(result.error instanceof ApiError ? result.error.code : undefined).toBe("IDEMPOTENCY_KEY_REUSED");
		}
	});
});
