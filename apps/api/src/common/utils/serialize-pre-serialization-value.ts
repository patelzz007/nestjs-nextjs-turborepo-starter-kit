import { type DataValue } from "@workspace/shared";
import { z } from "zod";

/** JSON-safe primitive or Prisma `BigInt` before response serialization. */
export type PreSerializationPrimitive = string | number | boolean | null | bigint;

/**
 * Response payload node that may still contain `bigint` values (e.g. from
 * Prisma) before the Fastify `preSerialization` hook normalizes them.
 */
export type PreSerializationValue = PreSerializationPrimitive | readonly PreSerializationValue[] | { readonly [key: string]: PreSerializationValue | undefined };

const PreSerializationValueSchema: z.ZodType<PreSerializationValue> = z.lazy(() =>
	z.union([
		z.string(),
		z.number(),
		z.boolean(),
		z.null(),
		z.bigint(),
		z.array(PreSerializationValueSchema),
		z.record(z.string(), z.union([PreSerializationValueSchema, z.undefined()])),
	]),
);

/** Parses an unknown Fastify pre-serialization payload. */
export function parsePreSerializationValue(value: unknown): PreSerializationValue | null {
	const parsed = PreSerializationValueSchema.safeParse(value);
	if (!parsed.success) {
		return null;
	}
	return parsed.data;
}

/**
 * Recursively replace every `BigInt` in a pre-serialization payload with its
 * `Number` equivalent so `JSON.stringify` can serialize the result.
 * Optional object properties with `undefined` are omitted (matching JSON).
 */
export function serializePreSerializationValue(value: PreSerializationValue): DataValue {
	const bigintParsed = z.bigint().safeParse(value);
	if (bigintParsed.success) {
		return Number(bigintParsed.data);
	}

	const primitiveParsed = z.union([z.string(), z.number(), z.boolean(), z.null()]).safeParse(value);
	if (primitiveParsed.success) {
		return primitiveParsed.data;
	}

	const arrayParsed = z.array(PreSerializationValueSchema).safeParse(value);
	if (arrayParsed.success) {
		return arrayParsed.data.map((entry) => serializePreSerializationValue(entry));
	}

	const recordParsed = z.record(z.string(), z.union([PreSerializationValueSchema, z.undefined()])).safeParse(value);
	if (recordParsed.success) {
		const result: Record<string, DataValue> = {};
		for (const [key, val] of Object.entries(recordParsed.data)) {
			if (val === undefined) {
				continue;
			}
			result[key] = serializePreSerializationValue(val);
		}
		return result;
	}

	throw new Error("serializePreSerializationValue: value is not a supported pre-serialization payload");
}
