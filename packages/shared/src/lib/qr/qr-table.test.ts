import { describe, expect, it } from "vitest";

import { QrTableLookupError } from "./qr-errors";
import { readTableEntry } from "./qr-table";

describe("readTableEntry", () => {
	it("returns the entry at the index", () => {
		expect(readTableEntry([4, 5, 6], 2, "digits")).toBe(6);
		expect(readTableEntry(new Uint8Array([9]), 0, "bytes")).toBe(9);
	});

	it("throws a QrTableLookupError naming the table and index when the entry is missing", () => {
		expect(() => readTableEntry([1], 3, "digits")).toThrow(QrTableLookupError);
		expect(() => readTableEntry([1], -1, "digits")).toThrow('QR table "digits" has no entry at index -1');
	});
});
