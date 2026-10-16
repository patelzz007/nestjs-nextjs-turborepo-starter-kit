import { describe, expect, it } from "vitest";

import { LIST_SLOT_INDEX } from "./named-list-index";

describe("LIST_SLOT_INDEX", () => {
	it("maps ordinal names to 0-based positions", () => {
		expect(Object.values(LIST_SLOT_INDEX)).toEqual([0, 1, 2, 3, 4, 5, 6, 7, 8, 9]);
	});

	it("reads the same element as the position it names, tuple types included", () => {
		const pair: [number, string] = [7, "seven"];
		const count: number = pair[LIST_SLOT_INDEX.first];
		const label: string = pair[LIST_SLOT_INDEX.second];
		expect(count).toBe(7);
		expect(label).toBe("seven");
	});
});
