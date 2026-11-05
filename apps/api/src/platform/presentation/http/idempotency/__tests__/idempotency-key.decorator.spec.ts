import { ApiErrorCodes } from "@workspace/shared";
import { describe, expect, it } from "vitest";

import { requiredIdempotencyKey } from "../idempotency-key.decorator";

describe("requiredIdempotencyKey", () => {
	it("returns a well-formed key", () => {
		expect(requiredIdempotencyKey("0193f2c4-0000-7000-8000-0000000000a1")).toBe("0193f2c4-0000-7000-8000-0000000000a1");
	});

	it("refuses a missing key with IDEMPOTENCY_KEY_REQUIRED", () => {
		expect(() => requiredIdempotencyKey(undefined)).toThrow(expect.objectContaining({ code: ApiErrorCodes.IDEMPOTENCY_KEY_REQUIRED }));
	});

	it("refuses a malformed, too short or repeated key as a validation error", () => {
		for (const raw of ["short", "has spaces in it", ["key-12345678", "key-87654321"]]) {
			expect(() => requiredIdempotencyKey(raw)).toThrow(expect.objectContaining({ code: ApiErrorCodes.VALIDATION_ERROR }));
		}
	});
});
