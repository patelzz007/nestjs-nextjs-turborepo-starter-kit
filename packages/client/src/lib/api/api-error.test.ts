// The envelope → ApiError mapping itself is tested in @workspace/api-client
// (`errors.test.ts`); this suite keeps the web-only part: the auth error catalog.
import type { DataValue } from "@workspace/shared";
import { describe, expect, it } from "vitest";

import { resolveAuthErrorMessage } from "../auth/errors";
import { jsonResponse } from "../test-utils";
import { ApiError, readErrorPayload } from "./api-request";

function errorEnvelope(code: string, message: string, details?: Record<string, DataValue>): DataValue {
	return {
		success: false,
		error: { code, message, ...(details !== undefined ? { details } : {}) },
		meta: { correlationId: "corr-42", timestamp: 1790812800000 },
	};
}

describe("auth error resolution with the envelope", () => {
	it("maps the envelope code to the friendly catalog message", async () => {
		const payload = await readErrorPayload(jsonResponse(401, errorEnvelope("ACCESS_TOKEN_EXPIRED", "Access token has expired")));

		expect(payload).toBeInstanceOf(ApiError);
		if (payload instanceof ApiError) {
			expect(resolveAuthErrorMessage(payload)).toBe("Your session has expired. Please log in again.");
		}
	});
});
