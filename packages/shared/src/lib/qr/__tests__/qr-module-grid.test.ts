import { describe, expect, it } from "vitest";

import { QrModuleGrid } from "../qr-module-grid";

describe("QrModuleGrid", () => {
	it("starts all light, all data modules", () => {
		const grid = new QrModuleGrid(3);
		expect(grid.size).toBe(3);
		expect(grid.darkCount()).toBe(0);
		expect(grid.isFunction(1, 1)).toBe(false);
	});

	it("tells whether a position is inside the symbol", () => {
		const grid = new QrModuleGrid(3);
		expect(grid.contains(0, 0)).toBe(true);
		expect(grid.contains(2, 2)).toBe(true);
		expect(grid.contains(3, 0)).toBe(false);
		expect(grid.contains(0, -1)).toBe(false);
	});

	it("reads outside the symbol as light, never as a function module", () => {
		const grid = new QrModuleGrid(3);
		expect(grid.isDark(-1, 0)).toBe(false);
		expect(grid.isFunction(0, 3)).toBe(false);
	});

	it("sets function modules as reserved and data modules as unreserved", () => {
		const grid = new QrModuleGrid(3);
		grid.setFunctionModule(0, 1, true);
		grid.setDataModule(2, 0, true);
		expect([grid.isDark(0, 1), grid.isFunction(0, 1)]).toEqual([true, true]);
		expect([grid.isDark(2, 0), grid.isFunction(2, 0)]).toEqual([true, false]);
		expect(grid.darkCount()).toBe(2);
	});

	it("toggles a module's colour", () => {
		const grid = new QrModuleGrid(2);
		grid.toggle(1, 1);
		expect(grid.isDark(1, 1)).toBe(true);
		grid.toggle(1, 1);
		expect(grid.isDark(1, 1)).toBe(false);
	});

	it("clones into an independent copy", () => {
		const grid = new QrModuleGrid(2);
		grid.setFunctionModule(0, 0, true);
		const copy = grid.clone();
		copy.toggle(0, 0);
		copy.setDataModule(1, 1, true);
		expect(grid.isDark(0, 0)).toBe(true);
		expect(grid.isDark(1, 1)).toBe(false);
		expect(copy.isFunction(0, 0)).toBe(true);
	});

	it("throws when writing outside the symbol", () => {
		const grid = new QrModuleGrid(2);
		expect(() => {
			grid.setDataModule(2, 0, true);
		}).toThrow(RangeError);
		expect(() => {
			grid.toggle(0, 5);
		}).toThrow("Module (0, 5) is outside a 2×2 symbol");
	});
});
