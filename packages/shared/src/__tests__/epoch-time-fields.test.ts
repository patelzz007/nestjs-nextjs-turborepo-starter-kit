import { describe, expect, it } from "vitest";
import { z } from "zod";

import * as root from "../index";

/**
 * Every instant the API stores or transports is epoch milliseconds (`EpochMsSchema`); a human-readable date
 * only exists in the UI. This walks every zod schema the package exports and fails on a time-named field
 * (`…At`, `…Until`, `…Since`, `…Expiry`, `…Date`) that is not a non-negative integer.
 *
 * Exempt: form schemas (exported names containing `Form`) — a date picker yields `YYYY-MM-DD`, which the
 * form converts to epoch ms before it submits (`parseRewardDateInputToEpochMs`). A third-party payload keeps
 * the provider's own field names (Resend's `created_at`) and is converted to epoch ms where it enters the API.
 */
const TIME_FIELD = /(?:At|Until|Since|Expiry|Date)$/;
/** Exported form schemas carry this in their name. */
const FORM_SCHEMA_MARKER = "Form";
/** zod's integer number formats (`.int()` is `safeint`). */
const INTEGER_FORMATS: ReadonlySet<string> = new Set<string>(["safeint", "int32", "uint32"]);

/** The schema under optional / nullable / default wrappers. */
function unwrapped(schema: z.core.$ZodType): z.core.$ZodType {
	if (schema instanceof z.ZodOptional || schema instanceof z.ZodNullable || schema instanceof z.ZodDefault) {
		return unwrapped(schema.unwrap());
	}
	return schema;
}

/** A non-negative integer — directly, or as the output of a wire preprocess (`"1767225600000"` → number). */
function isEpochMs(schema: z.core.$ZodType): boolean {
	const inner = unwrapped(schema);
	if (inner instanceof z.ZodPipe) {
		return isEpochMs(inner.out);
	}
	return inner instanceof z.ZodNumber && INTEGER_FORMATS.has(inner.format ?? "") && (inner.minValue ?? -1) >= 0;
}

/** The list-filter operator that tests presence, not a time. */
const IS_NULL_OPERATOR = "isNull";

/** A list-filter field (`listFilter.epochMs`): every comparison operator takes epoch ms (`in` / `nin` a list of them). */
function isEpochMsFilter(schema: z.core.$ZodType): boolean {
	const inner = unwrapped(schema);
	if (inner instanceof z.ZodPipe) {
		// A filter field normalises its wire form first (preprocess), then validates the operator object.
		return isEpochMsFilter(inner.out);
	}
	if (!(inner instanceof z.ZodObject)) {
		return false;
	}
	return Object.entries(inner.shape).every(([operator, value]: [string, z.core.$ZodType]): boolean => {
		const operand = unwrapped(value);
		return operator === IS_NULL_OPERATOR || isEpochMs(operand) || (operand instanceof z.ZodArray && isEpochMs(operand.element));
	});
}

/** `path` of every time-named field that is not epoch ms, inside `schema`. */
function nonEpochTimeFields(schema: z.core.$ZodType, path: string, seen: Set<z.core.$ZodType>): string[] {
	if (seen.has(schema)) {
		return [];
	}
	seen.add(schema);
	const inner = unwrapped(schema);
	if (inner instanceof z.ZodObject) {
		return Object.entries(inner.shape).flatMap(([key, field]: [string, z.core.$ZodType]): string[] => [
			...(TIME_FIELD.test(key) && !isEpochMs(field) && !isEpochMsFilter(field) ? [`${path}.${key}`] : []),
			...nonEpochTimeFields(field, `${path}.${key}`, seen),
		]);
	}
	if (inner instanceof z.ZodArray) {
		return nonEpochTimeFields(inner.element, `${path}[]`, seen);
	}
	if (inner instanceof z.ZodPipe) {
		return nonEpochTimeFields(inner.in, path, seen);
	}
	if (inner instanceof z.ZodUnion) {
		return inner.options.flatMap((option: z.core.$ZodType): string[] => nonEpochTimeFields(option, path, seen));
	}
	return [];
}

const exportedSchemas: readonly [string, z.core.$ZodType][] = Object.entries(root).flatMap(([name, value]): [string, z.core.$ZodType][] =>
	value instanceof z.ZodType && !name.includes(FORM_SCHEMA_MARKER) ? [[name, value]] : [],
);

describe("time fields of the shared contracts", () => {
	it("checks a meaningful number of exported schemas", () => {
		expect(exportedSchemas.length).toBeGreaterThan(100);
	});

	it("are all epoch milliseconds — dates become human-readable only in the UI", () => {
		const offending: string[] = exportedSchemas.flatMap(([name, schema]): string[] => nonEpochTimeFields(schema, name, new Set<z.core.$ZodType>()));

		expect(offending).toEqual([]);
	});

	it("flags a time field transported as a string", () => {
		const offending = nonEpochTimeFields(z.object({ expiresAt: z.string() }), "Example", new Set<z.core.$ZodType>());

		expect(offending).toEqual(["Example.expiresAt"]);
	});

	it("accepts a list filter whose operators take epoch ms, and flags one that takes strings", () => {
		const epochOperand = z.preprocess((value: string | number): number => Number(value), z.number().int().nonnegative());
		const valid = z.object({
			filter: z.object({ createdAt: z.object({ gte: epochOperand.optional(), in: z.array(epochOperand).optional(), isNull: z.boolean().optional() }) }),
		});
		const invalid = z.object({ filter: z.object({ createdAt: z.object({ gte: z.string().optional() }) }) });

		expect(nonEpochTimeFields(valid, "Example", new Set<z.core.$ZodType>())).toEqual([]);
		expect(nonEpochTimeFields(invalid, "Example", new Set<z.core.$ZodType>())).toEqual(["Example.filter.createdAt"]);
	});

	it("accepts optional and nullable epoch fields, inside arrays and unions", () => {
		const epoch = z.number().int().nonnegative();
		const schema = z.object({ items: z.array(z.union([z.object({ seenAt: epoch.nullable() }), z.object({ endsAt: epoch.optional() })])) });

		expect(nonEpochTimeFields(schema, "Example", new Set<z.core.$ZodType>())).toEqual([]);
	});
});
