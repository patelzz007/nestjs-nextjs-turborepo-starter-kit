import { z } from "zod";

/** Zod schema for a JSON primitive: `string | number | boolean | null`. */
export const JsonPrimitiveSchema = z.union([z.string(), z.number(), z.boolean(), z.null()]);

export type JsonPrimitive = z.output<typeof JsonPrimitiveSchema>;

export type JsonValueNode = JsonPrimitive | JsonValueNode[] | JsonObjectNode;

export interface JsonObjectNode {
	readonly [key: string]: JsonValueNode;
}

/** Recursive JSON value schema (lazy so the tree may nest arbitrarily deep). */
export const JsonValueSchema: z.ZodType<JsonValueNode> = z.lazy(() => z.union([JsonPrimitiveSchema, z.array(JsonValueSchema), JsonObjectSchema]));

export type JsonValue = z.output<typeof JsonValueSchema>;

/** Input accepted by {@link JsonValueSchema} before parsing/coercion. */
export type JsonValueInput = z.input<typeof JsonValueSchema>;

/** Recursive JSON object schema — a string-keyed map of any JSON value. */
export const JsonObjectSchema: z.ZodType<JsonObjectNode> = z.lazy(() => z.record(z.string(), JsonValueSchema));

export type JsonObject = z.output<typeof JsonObjectSchema>;

/** String-keyed map of JSON values — common shape for caught error objects. */
export const JsonRecordSchema = z.record(z.string(), JsonValueSchema);
