import { describe, expect, expectTypeOf, it } from "vitest";

import type { JsonValueNode } from "../schemas/runtime/json";

import { isArrayValue, isBigIntPrimitive, isBooleanPrimitive, isFunctionValue, isJsonPrimitive, isNumberPrimitive, isStringPrimitive } from "./runtime-narrowing";

describe("runtime-narrowing (zod-backed guards for in-process unions)", () => {
	it("isStringPrimitive accepts strings only", () => {
		expect(isStringPrimitive("a")).toBe(true);
		expect(isStringPrimitive("")).toBe(true);
		expect(isStringPrimitive(1)).toBe(false);
		expect(isStringPrimitive(null)).toBe(false);
		expect(isStringPrimitive(["a"])).toBe(false);
	});

	it("isNumberPrimitive accepts every JS number, NaN and infinities included", () => {
		expect(isNumberPrimitive(0)).toBe(true);
		expect(isNumberPrimitive(-1.5)).toBe(true);
		expect(isNumberPrimitive(Number.NaN)).toBe(true);
		expect(isNumberPrimitive(Number.POSITIVE_INFINITY)).toBe(true);
		expect(isNumberPrimitive(Number.NEGATIVE_INFINITY)).toBe(true);
		expect(isNumberPrimitive("1")).toBe(false);
		expect(isNumberPrimitive(BigInt(1))).toBe(false);
	});

	it("isBooleanPrimitive accepts booleans only", () => {
		expect(isBooleanPrimitive(false)).toBe(true);
		expect(isBooleanPrimitive(0)).toBe(false);
	});

	it("isBigIntPrimitive accepts bigints only", () => {
		expect(isBigIntPrimitive(BigInt(10))).toBe(true);
		expect(isBigIntPrimitive(10)).toBe(false);
	});

	it("isJsonPrimitive accepts string, number, boolean and null, and rejects containers", () => {
		expect(isJsonPrimitive("x")).toBe(true);
		expect(isJsonPrimitive(1)).toBe(true);
		expect(isJsonPrimitive(true)).toBe(true);
		expect(isJsonPrimitive(null)).toBe(true);
		expect(isJsonPrimitive({})).toBe(false);
		expect(isJsonPrimitive([])).toBe(false);
		expect(isJsonPrimitive(undefined)).toBe(false);
	});

	it("isArrayValue accepts mutable and readonly arrays and keeps the element type", () => {
		const single: string | readonly string[] = ["a", "b"];
		expect(isArrayValue(single)).toBe(true);
		expect(isArrayValue([])).toBe(true);
		expect(isArrayValue("x")).toBe(false);
		expect(isArrayValue({ length: 1 })).toBe(false);
		expect(isArrayValue(null)).toBe(false);
	});

	it("isFunctionValue accepts plain, async, generator and class callables", () => {
		expect(isFunctionValue(() => undefined)).toBe(true);
		expect(
			isFunctionValue(async (): Promise<number> => {
				await Promise.resolve();
				return 1;
			}),
		).toBe(true);
		expect(
			isFunctionValue(function* generate(): Generator<number> {
				yield 1;
			}),
		).toBe(true);
		expect(
			isFunctionValue(
				class Thing {
					public readonly name: string = "thing";
				},
			),
		).toBe(true);
		expect(isFunctionValue({})).toBe(false);
		expect(isFunctionValue(null)).toBe(false);
	});
});

/** The element-type inference `isArrayValue` must get right, checked at compile time by `tsc` (typecheck). */
describe("isArrayValue narrowing (compile-time)", () => {
	it("narrows a single-or-many union to its array member", () => {
		function labelsOf(value: string | readonly string[]): readonly string[] {
			if (isArrayValue(value)) {
				expectTypeOf(value).toEqualTypeOf<readonly string[]>();
				return value;
			}
			expectTypeOf(value).toEqualTypeOf<string>();
			return [value];
		}
		expect(labelsOf(["a", "b"])).toEqual(["a", "b"]);
		expect(labelsOf("a")).toEqual(["a"]);
	});

	it("narrows a union whose scalars differ from the array's element type", () => {
		type AttributeValue = number | boolean | (string | number)[] | null;
		function sizeOf(value: AttributeValue): number {
			if (isArrayValue(value)) {
				expectTypeOf(value).toEqualTypeOf<(string | number)[]>();
				return value.length;
			}
			expectTypeOf(value).toEqualTypeOf<number | boolean | null>();
			return 1;
		}
		expect(sizeOf(["a", 1])).toBe(2);
		expect(sizeOf(true)).toBe(1);
	});

	it("narrows an optional list with unrelated falsy members", () => {
		function formatsOf(value: false | readonly ("csv" | "xlsx")[] | undefined): readonly ("csv" | "xlsx")[] {
			if (isArrayValue(value)) {
				expectTypeOf(value).toEqualTypeOf<readonly ("csv" | "xlsx")[]>();
				return value;
			}
			expectTypeOf(value).toEqualTypeOf<false | undefined>();
			return [];
		}
		expect(formatsOf(["csv"])).toEqual(["csv"]);
		expect(formatsOf(false)).toEqual([]);
	});

	it("narrows a recursive JSON value to its array member", () => {
		function depthOf(value: JsonValueNode): number {
			if (isArrayValue(value)) {
				expectTypeOf(value).toEqualTypeOf<JsonValueNode[]>();
				return 1 + Math.max(0, ...value.map((item: JsonValueNode): number => depthOf(item)));
			}
			return 0;
		}
		expect(depthOf([[1], 2])).toBe(2);
		expect(depthOf({ a: 1 })).toBe(0);
	});

	it("narrows an open union (`… | object`) to an array of that union", () => {
		type TreeValue = string | number | object;
		function itemsOf(value: TreeValue): readonly TreeValue[] {
			if (isArrayValue(value)) {
				return value;
			}
			return [value];
		}
		expect(itemsOf([1, "a"])).toEqual([1, "a"]);
		expect(itemsOf({ a: 1 })).toEqual([{ a: 1 }]);
	});

	it("narrows a generic single-or-many value without losing the type parameter", () => {
		function countOf<Value>(value: Value | Value[] | null): number {
			if (isArrayValue(value)) {
				expectTypeOf(value).toEqualTypeOf<Value[]>();
				return value.length;
			}
			return value === null ? 0 : 1;
		}
		expect(countOf<string>(["a", "b"])).toBe(2);
		expect(countOf<string>("a")).toBe(1);
	});
});
