import { describe, expect, it } from "vitest";

import { drawnResizeWidths } from "../table-engine-table-resize";

/** Three columns drawn wider than their own sizes, as when they share a wide container's spare width. */
const DRAWN: ReadonlyMap<string, number> = new Map([
	["name", 200],
	["email", 300],
	["role", 100],
]);
const SIZES: ReadonlyMap<string, number> = new Map([
	["name", 150],
	["email", 200],
	["role", 50],
]);

function sum(widths: ReadonlyMap<string, number>): number {
	return [...widths.values()].reduce((total, width) => total + width, 0);
}

describe("drawnResizeWidths", () => {
	it("moves the dragged edge with the pointer and keeps the table as wide, the columns after it taking up the room", () => {
		const shrink = -60;
		const widths = drawnResizeWidths({ drawn: DRAWN, sizes: SIZES, dragged: ["name"], absorbers: ["email", "role"], delta: shrink });

		expect(widths.get("name")).toBe(200 + shrink);
		// 60 shared 300 : 100 between the two columns after the edge.
		expect(widths.get("email")).toBe(300 + 45);
		expect(widths.get("role")).toBe(100 + 15);
		expect(sum(widths)).toBe(sum(DRAWN));
	});

	it("takes room back from the columns after the edge only down to their own sizes, then lets the table grow", () => {
		const grow = 250;
		const widths = drawnResizeWidths({ drawn: DRAWN, sizes: SIZES, dragged: ["name"], absorbers: ["email", "role"], delta: grow });

		expect(widths.get("name")).toBe(200 + grow);
		// Only 150 of slack (100 + 50): both fall back to their own sizes, and the table is 100 wider.
		expect(widths.get("email")).toBe(200);
		expect(widths.get("role")).toBe(50);
		expect(sum(widths)).toBe(sum(DRAWN) + 100);
	});

	it("never draws the dragged column below nothing, and leaves the columns before it alone", () => {
		const widths = drawnResizeWidths({ drawn: DRAWN, sizes: SIZES, dragged: ["email"], absorbers: ["role"], delta: -1000 });

		expect(widths.get("email")).toBe(0);
		expect(widths.get("name")).toBe(200);
		expect(widths.get("role")).toBe(100 + 300);
	});
});
