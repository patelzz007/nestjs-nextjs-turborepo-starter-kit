import { LIST_SLOT_INDEX } from "@workspace/shared";
import { describe, expect, it } from "vitest";

import { DATA_TABLE_ROW_ACTION_DEFAULT_TONES, resolveDataTableRowActionTone } from "../row-action-tone";

describe("resolveDataTableRowActionTone", () => {
	it("keeps an entry's own tone wherever it sits", () => {
		expect(resolveDataTableRowActionTone("destructive", LIST_SLOT_INDEX.first)).toBe("destructive");
		expect(resolveDataTableRowActionTone("yellow", LIST_SLOT_INDEX.second)).toBe("yellow");
	});

	it("gives an entry without one the next hue in menu order, so neighbours differ", () => {
		expect(resolveDataTableRowActionTone(undefined, LIST_SLOT_INDEX.first)).toBe("blue");
		expect(resolveDataTableRowActionTone(undefined, LIST_SLOT_INDEX.second)).toBe("violet");
		expect(resolveDataTableRowActionTone(undefined, LIST_SLOT_INDEX.third)).toBe("teal");
	});

	it("cycles past the end of the palette, and never hands out red by default", () => {
		expect(resolveDataTableRowActionTone(undefined, DATA_TABLE_ROW_ACTION_DEFAULT_TONES.length)).toBe("blue");
		expect(DATA_TABLE_ROW_ACTION_DEFAULT_TONES).not.toContain("destructive");
	});
});
