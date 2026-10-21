import { describe, expect, it } from "vitest";
import { z } from "zod";

import {
	contractFormSchema,
	NullableNumberInputSchema,
	NullableTextInputSchema,
	OptionalNumberInputSchema,
	OptionalTextInputSchema,
	RequiredNumberInputSchema,
} from "../contract-form-schema";

describe("form input converters", () => {
	it("trims text, and reads a blank as null or absent", () => {
		expect(NullableTextInputSchema.parse("  Kopi  ")).toBe("Kopi");
		expect(NullableTextInputSchema.parse("   ")).toBeNull();
		expect(OptionalTextInputSchema.parse("")).toBeUndefined();
	});

	it("reads numbers from text, reporting a blank required one as missing (never 0)", () => {
		expect(RequiredNumberInputSchema.parse(" 12.5 ")).toBe(12.5);
		expect(RequiredNumberInputSchema.safeParse("").success).toBe(false);
		expect(RequiredNumberInputSchema.safeParse("abc").success).toBe(false);
		expect(NullableNumberInputSchema.parse("")).toBeNull();
		expect(OptionalNumberInputSchema.parse("")).toBeUndefined();
		expect(OptionalNumberInputSchema.parse("3")).toBe(3);
	});
});

describe("contractFormSchema", () => {
	const Contract = z.object({ quantity: z.number().int().min(1, "At least one") }).strict();
	const Form = contractFormSchema(z.object({ quantity: RequiredNumberInputSchema }), Contract);

	it("outputs the contract's parse of the converted values", () => {
		expect(Form.parse({ quantity: "4" })).toEqual({ quantity: 4 });
	});

	it("reports the contract's issues on the form's own field paths", () => {
		const result = Form.safeParse({ quantity: "0" });

		expect(result.success).toBe(false);
		expect(result.error?.issues.map((issue) => ({ path: issue.path, message: issue.message }))).toEqual([{ path: ["quantity"], message: "At least one" }]);
	});
});
