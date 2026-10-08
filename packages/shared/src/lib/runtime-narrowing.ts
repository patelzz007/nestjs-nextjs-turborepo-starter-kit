import { z } from "zod";

/**
 * Zod-backed narrowing for values that are ALREADY typed as a union in the same
 * trust zone (rules/28-runtime-validation.md): `string | string[]`, `Value | Value[]`,
 * `bigint | number`, a JSON node, a React ref. Wire data is still parsed with its own
 * schema at the boundary; these guards only pick the branch of a known union, so the
 * runtime `typeof` operator never appears in application code.
 *
 * Each guard narrows to the matching members of the caller's own union
 * (`Extract<T, string>`), so no type information is lost or invented.
 */

const STRING_SCHEMA = z.string();
/** Every JS number, including `NaN` and `±Infinity` (which `z.number()` rejects on its own). */
const NUMBER_SCHEMA = z.union([z.number(), z.nan(), z.literal([Number.POSITIVE_INFINITY, Number.NEGATIVE_INFINITY])]);
const BOOLEAN_SCHEMA = z.boolean();
const BIGINT_SCHEMA = z.bigint();
const JSON_PRIMITIVE_SCHEMA = z.union([STRING_SCHEMA, NUMBER_SCHEMA, BOOLEAN_SCHEMA, z.null()]);
const ARRAY_SCHEMA = z.instanceof(Array);
/** Structural (`z.function()`), so callables from another realm (jsdom, iframes) still count. */
const FUNCTION_SCHEMA = z.function();

/** Any value a JS expression can hold — the input of a guard that only answers yes/no. */
export type RuntimeValue = object | string | number | boolean | bigint | symbol | null | undefined;

/** The JSON primitive members of a union. */
export type JsonPrimitiveMember<T> = Extract<T, string | number | boolean | null>;

/** `true` when `value` is a string — narrows to the string members of `T`. */
export function isStringPrimitive<T>(value: T): value is Extract<T, string> {
	return STRING_SCHEMA.safeParse(value).success;
}

/** `true` when `value` is a number (any number, `NaN` included) — narrows to the number members of `T`. */
export function isNumberPrimitive<T>(value: T): value is Extract<T, number> {
	return NUMBER_SCHEMA.safeParse(value).success;
}

/** `true` when `value` is a boolean — narrows to the boolean members of `T`. */
export function isBooleanPrimitive<T>(value: T): value is Extract<T, boolean> {
	return BOOLEAN_SCHEMA.safeParse(value).success;
}

/** `true` when `value` is a bigint — narrows to the bigint members of `T`. */
export function isBigIntPrimitive<T>(value: T): value is Extract<T, bigint> {
	return BIGINT_SCHEMA.safeParse(value).success;
}

/** `true` when `value` is a JSON primitive (`string | number | boolean | null`). */
export function isJsonPrimitive<T>(value: T): value is JsonPrimitiveMember<T> {
	return JSON_PRIMITIVE_SCHEMA.safeParse(value).success;
}

/**
 * `true` when `value` is an array — narrows to the array members of the caller's union
 * (mutable or readonly) and keeps their element type. Two overloads, tried in order:
 *
 * 1. Single-or-many (`T | readonly T[]`): `string | readonly string[]`, a generic
 *    `Value | Value[] | null`, recursive JSON (`JsonValue`), open unions (`… | object`).
 * 2. Any other union, when its scalar members differ from the array's element type:
 *    `number | boolean | (string | number)[] | null` narrows to `(string | number)[]`.
 *
 * TypeScript only reaches the second overload when the argument does not fit the first,
 * so every call site is checked without explicit type arguments.
 */
export function isArrayValue<T>(value: T | readonly T[]): value is readonly T[];
export function isArrayValue<T>(value: T): value is Extract<T, readonly RuntimeValue[]>;
export function isArrayValue(value: RuntimeValue): boolean {
	return ARRAY_SCHEMA.safeParse(value).success;
}

/**
 * `true` when `value` is callable (plain, async, generator or class). Returns a plain
 * boolean: wrap it in a local guard that names the exact callable type the union holds
 * (e.g. `ref is React.RefCallback<T>`), since there is no safe "any function" type.
 */
export function isFunctionValue(value: RuntimeValue): boolean {
	return FUNCTION_SCHEMA.safeParse(value).success;
}
