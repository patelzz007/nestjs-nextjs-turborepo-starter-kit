import { Prisma } from "@prisma/client";
import { z } from "zod";

import { JsonValueSchema, type JsonValueInput } from "@workspace/shared";

const PrismaInputJsonValueSchema: z.ZodType<Prisma.InputJsonValue> = z.custom<Prisma.InputJsonValue>(
	(value) => JsonValueSchema.safeParse(value).success && value !== null,
);

/** Parses a non-null JSON payload for Prisma `InputJsonValue` columns. */
export function parsePrismaInputJson(value: Exclude<JsonValueInput, null>): Prisma.InputJsonValue {
	const parsed = JsonValueSchema.parse(value);
	if (parsed === null) {
		throw new Error("Prisma InputJsonValue cannot be null");
	}
	return PrismaInputJsonValueSchema.parse(parsed);
}

/** Parses nullable JSON payloads for optional Prisma `Json?` columns (SQL NULL). */
export function parsePrismaNullableJson(value: JsonValueInput): Prisma.InputJsonValue | typeof Prisma.DbNull {
	if (value === null) {
		return Prisma.DbNull;
	}
	return parsePrismaInputJson(value);
}

/** Parses nullable JSON payloads for required Prisma `Json` columns (JSON null literal). */
export function parsePrismaRequiredJson(value: JsonValueInput): Prisma.InputJsonValue | typeof Prisma.JsonNull {
	if (value === null) {
		return Prisma.JsonNull;
	}
	return parsePrismaInputJson(value);
}
