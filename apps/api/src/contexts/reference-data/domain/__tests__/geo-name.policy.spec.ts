import { describe, expect, it } from "vitest";

import { sanitizeGeoName, withSanitizedGeoName } from "../policies/geo-name.policy";

describe("sanitizeGeoName", () => {
	it.each<[string, string]>([
		["Kuala Lumpur", "Kuala Lumpur"],
		["  Penang  ", "Penang"],
		["<b>Johor</b>", "Johor"],
		["Melaka <script>alert(1)</script>", "Melaka alert(1)"],
		['<img src="x" onerror="y">Sabah', "Sabah"],
		["\t\nSarawak\n", "Sarawak"],
		["<br/>", ""],
		["   ", ""],
		["São Paulo", "São Paulo"],
		["a < b", "a < b"],
	])("%j → %j", (input, expected) => {
		expect(sanitizeGeoName(input)).toBe(expected);
	});
});

describe("withSanitizedGeoName", () => {
	it("returns a new object with the name sanitized, leaving the input untouched", () => {
		const input = { name: " <i>Kedah</i> ", flag: true };
		const output = withSanitizedGeoName(input);
		expect(output).toEqual({ name: "Kedah", flag: true });
		expect(output).not.toBe(input);
		expect(input.name).toBe(" <i>Kedah</i> ");
	});

	it("returns the input itself when it carries no name (a partial update)", () => {
		const input: { readonly name?: string; readonly flag: boolean } = { flag: false };
		expect(withSanitizedGeoName(input)).toBe(input);
	});
});
