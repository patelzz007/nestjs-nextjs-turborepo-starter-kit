import { describe, expect, it } from "vitest";

import { ApiPaginatedMetaSchema, ApiResponseMetaSchema, createApiSuccessEnvelopeSchema } from "./api-response";
import { DataValueSchema } from "./common";

const TIMESTAMP = 1_790_812_800_000;
const CORRELATION_ID = "c0ffee00-1234-4abc-8def-0123456789ab";

describe("ApiResponseMetaSchema", () => {
	it("keeps the correlation id the API stamped on the response", () => {
		expect(ApiResponseMetaSchema.parse({ correlationId: CORRELATION_ID, timestamp: TIMESTAMP })).toEqual({ correlationId: CORRELATION_ID, timestamp: TIMESTAMP });
	});

	it("rejects a response whose meta has no correlation id instead of defaulting it to an empty string", () => {
		expect(ApiResponseMetaSchema.safeParse({ timestamp: TIMESTAMP }).success).toBe(false);
		expect(createApiSuccessEnvelopeSchema(DataValueSchema).safeParse({ success: true, data: null, meta: { timestamp: TIMESTAMP } }).success).toBe(false);
	});

	it("requires the correlation id on paginated meta too", () => {
		const page = { limit: 20, total: 0, page: 1, totalPages: 1, nextCursor: null, hasNext: false, hasPrevious: false, timestamp: TIMESTAMP };
		expect(ApiPaginatedMetaSchema.safeParse(page).success).toBe(false);
		expect(ApiPaginatedMetaSchema.safeParse({ ...page, correlationId: CORRELATION_ID }).success).toBe(true);
	});

	it("documents the correlation id as a required property in the generated JSON Schema", () => {
		expect(ApiResponseMetaSchema.toJSONSchema({ io: "output" }).required).toContain("correlationId");
		expect(ApiResponseMetaSchema.toJSONSchema({ io: "input" }).required).toContain("correlationId");
	});
});
