import { describe, expect, it } from "vitest";

import { assertThemeParity, findMissingThemeVariables, ThemeParityError } from "./parity";

describe("findMissingThemeVariables", () => {
	it("reports nothing when every theme defines the same variables", () => {
		expect(
			findMissingThemeVariables(
				new Map([
					["light", ["card", "border"]],
					["dark", ["border", "card"]],
				]),
			),
		).toStrictEqual([]);
	});

	it("names every variable each theme is missing, sorted", () => {
		const themes = new Map([
			["light", ["card", "ring", "border"]],
			["dark", ["card", "scrim"]],
		]);

		expect(findMissingThemeVariables(themes)).toStrictEqual(["dark is missing --border", "dark is missing --ring", "light is missing --scrim"]);
	});
});

describe("assertThemeParity", () => {
	it("throws a ThemeParityError naming the output and the missing variables", () => {
		const themes = new Map([
			["light", ["card", "ring"]],
			["dark", ["card"]],
		]);

		expect(() => {
			assertThemeParity("mobile.css", themes);
		}).toThrow(ThemeParityError);
		expect(() => {
			assertThemeParity("mobile.css", themes);
		}).toThrow("mobile.css: every theme must define the same variables.\ndark is missing --ring");
	});

	it("passes when the themes match", () => {
		expect(() => {
			assertThemeParity("web.css", new Map([["light", ["card"]]]));
		}).not.toThrow();
	});
});
