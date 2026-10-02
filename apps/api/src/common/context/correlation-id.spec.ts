import { IncomingMessage } from "node:http";
import { Socket } from "node:net";

import { describe, expect, it } from "vitest";

import { correlationIdFor, CorrelationIdSchema, generateCorrelationId, MAX_CORRELATION_ID_LENGTH, readIncomingCorrelationId } from "./correlation-id";

function rawWith(headers: Record<string, string | string[]>): IncomingMessage {
	const raw = new IncomingMessage(new Socket());
	raw.headers = headers;
	return raw;
}

describe("CorrelationIdSchema", () => {
	it("accepts UUIDs, nanoids, W3C-style and vendor ids up to 64 characters", () => {
		for (const id of [
			"0b7c2a5e-6f1d-4c2e-9d3a-1f2e3d4c5b6a",
			"V1StGXR8_Z5jdHi6B-myT",
			"00-4bf92f3577b34da6a3ce929d0e0e4736-00f067aa0ba902b7-01",
			"req:abc.123",
			"a".repeat(MAX_CORRELATION_ID_LENGTH),
		]) {
			expect(CorrelationIdSchema.safeParse(id).success).toBe(true);
		}
	});

	it("rejects empty, over-long and unsafe values (whitespace, control characters, injection)", () => {
		for (const id of ["", "a".repeat(MAX_CORRELATION_ID_LENGTH + 1), "has space", "line\nbreak", "tab\tid", "<script>", 'quote"id', "semi;colon", "ünïcode"]) {
			expect(CorrelationIdSchema.safeParse(id).success).toBe(false);
		}
	});
});

describe("readIncomingCorrelationId", () => {
	it("prefers X-Correlation-Id over X-Request-Id", () => {
		expect(readIncomingCorrelationId({ headers: { "x-correlation-id": "corr-a", "x-request-id": "req-b" } })).toBe("corr-a");
		expect(readIncomingCorrelationId({ headers: { "x-request-id": "req-b" } })).toBe("req-b");
	});

	it("falls through to X-Request-Id when X-Correlation-Id is invalid", () => {
		expect(readIncomingCorrelationId({ headers: { "x-correlation-id": "bad value", "x-request-id": "req-ok" } })).toBe("req-ok");
	});

	it("uses the first value of a repeated header and trims surrounding whitespace", () => {
		expect(readIncomingCorrelationId({ headers: { "x-correlation-id": [" corr-1 ", "corr-2"] } })).toBe("corr-1");
	});

	it("returns undefined when nothing valid was sent", () => {
		expect(readIncomingCorrelationId({ headers: {} })).toBeUndefined();
		expect(readIncomingCorrelationId({ headers: { "x-correlation-id": "x".repeat(65) } })).toBeUndefined();
	});
});

describe("generateCorrelationId", () => {
	it("produces a schema-valid id, unique per call", () => {
		const first: string = generateCorrelationId();

		expect(CorrelationIdSchema.safeParse(first).success).toBe(true);
		expect(generateCorrelationId()).not.toBe(first);
	});
});

describe("correlationIdFor", () => {
	it("reuses a valid incoming id", () => {
		expect(correlationIdFor(rawWith({ "x-correlation-id": "corr-incoming" }))).toBe("corr-incoming");
	});

	it("decides once per request: a generated id is stable across calls for the same raw request", () => {
		const raw = rawWith({ "x-correlation-id": "not valid!" });
		const first: string = correlationIdFor(raw);

		expect(first).not.toBe("not valid!");
		expect(correlationIdFor(raw)).toBe(first);
	});

	it("gives different requests different generated ids", () => {
		expect(correlationIdFor(rawWith({}))).not.toBe(correlationIdFor(rawWith({})));
	});
});
