import { describe, expect, it } from "vitest";

import { buildDataChangeDiff, formatDataChangeValue } from "../data-change-diff";

describe("buildDataChangeDiff", () => {
	it("marks the database-reported changed columns of an UPDATE — a redacted secret included — and lists them first", () => {
		const rows = buildDataChangeDiff({
			oldData: { id: "u-1", fullName: "[PII]", passwordHash: "[REDACTED]", status: "ACTIVE" },
			newData: { id: "u-1", fullName: "[PII]", passwordHash: "[REDACTED]", status: "LOCKED" },
			changedColumns: ["passwordHash", "status"],
		});

		expect(rows).toEqual([
			{ column: "passwordHash", before: "[REDACTED]", after: "[REDACTED]", status: "changed" },
			{ column: "status", before: "ACTIVE", after: "LOCKED", status: "changed" },
			{ column: "fullName", before: "[PII]", after: "[PII]", status: "unchanged" },
			{ column: "id", before: "u-1", after: "u-1", status: "unchanged" },
		]);
	});

	it("shows every column of an INSERT as set and of a DELETE as removed", () => {
		expect(buildDataChangeDiff({ oldData: null, newData: { id: 7, name: "Mug" }, changedColumns: [] }).map((row) => row.status)).toEqual(["added", "added"]);
		expect(buildDataChangeDiff({ oldData: { id: 7 }, newData: null, changedColumns: [] })).toEqual([{ column: "id", before: 7, after: undefined, status: "removed" }]);
	});

	it("has no columns for a TRUNCATE (no row images)", () => {
		expect(buildDataChangeDiff({ oldData: null, newData: null, changedColumns: [] })).toEqual([]);
	});
});

describe("formatDataChangeValue", () => {
	it("shows strings as-is and everything else as JSON", () => {
		expect(formatDataChangeValue("Kopi Corner")).toBe("Kopi Corner");
		expect(formatDataChangeValue(null)).toBe("null");
		expect(formatDataChangeValue(1_790_000_000_000)).toBe("1790000000000");
		expect(formatDataChangeValue({ truncated: true, originalBytes: 20_000 })).toBe('{"truncated":true,"originalBytes":20000}');
	});
});
