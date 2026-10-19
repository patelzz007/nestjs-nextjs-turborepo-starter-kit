import { describe, expect, it } from "vitest";

import { newRowId, ROW_ID_ENTROPY_BYTES, rowIdFrom, RowIdError } from "../row-id";

const UUID_V7 = /^[0-9a-f]{8}-[0-9a-f]{4}-7[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;
const AT = Date.UTC(2026, 9, 19, 12, 0, 0, 123);
/** The largest time a 48-bit millisecond field holds. */
const MAX_TIMESTAMP_MS = 2 ** 48 - 1;

/** The 48-bit Unix-millisecond timestamp a v7 UUID starts with. */
function timestampOf(id: string): number {
	return Number.parseInt(id.replaceAll("-", "").slice(0, 12), 16);
}

describe("newRowId", () => {
	it("is a version 7, RFC 9562 variant UUID", () => {
		expect(newRowId()).toMatch(UUID_V7);
	});

	it("starts with its creation time in milliseconds", () => {
		expect(timestampOf(newRowId(AT))).toBe(AT);
	});

	it("sorts by creation time, and stays unique within one millisecond", () => {
		const earlier = newRowId(AT);
		const later = newRowId(AT + 1);
		const sameMs = new Set(Array.from({ length: 1000 }, (): string => newRowId(AT)));

		expect([later, earlier].sort()).toEqual([earlier, later]);
		expect(sameMs.size).toBe(1000);
	});
});

describe("rowIdFrom", () => {
	it("is a pure function of the time and the entropy, and still a v7 UUID", () => {
		const entropy = new Uint8Array(ROW_ID_ENTROPY_BYTES).fill(0xff);

		expect(rowIdFrom(AT, entropy)).toBe(rowIdFrom(AT, entropy));
		expect(rowIdFrom(AT, entropy)).toMatch(UUID_V7);
		expect(timestampOf(rowIdFrom(AT, entropy))).toBe(AT);
	});

	it("uses only the first entropy bytes it needs", () => {
		const longer = new Uint8Array(32).fill(7);

		expect(rowIdFrom(AT, longer)).toBe(rowIdFrom(AT, longer.subarray(0, ROW_ID_ENTROPY_BYTES)));
	});

	it("refuses too little entropy and a time that does not fit 48 bits", () => {
		expect((): string => rowIdFrom(AT, new Uint8Array(ROW_ID_ENTROPY_BYTES - 1))).toThrow(RowIdError);
		expect((): string => rowIdFrom(-1, new Uint8Array(ROW_ID_ENTROPY_BYTES))).toThrow(RowIdError);
		expect((): string => rowIdFrom(MAX_TIMESTAMP_MS + 1, new Uint8Array(ROW_ID_ENTROPY_BYTES))).toThrow(RowIdError);
		expect((): string => rowIdFrom(AT + 0.5, new Uint8Array(ROW_ID_ENTROPY_BYTES))).toThrow(RowIdError);
	});
});
