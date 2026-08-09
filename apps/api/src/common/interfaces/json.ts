import { z } from "zod";

/**
 * Zod schema for a JSON primitive: `string | number | boolean | null`.
 */
export const JsonPrimitiveSchema = z.union([z.string(), z.number(), z.boolean(), z.null()]);

export type JsonPrimitive = z.output<typeof JsonPrimitiveSchema>;

/**
 * Recursive JSON value — primitive, array of values, or object.
 *
 * The anchor types below are deliberately NON-exported: zod cannot infer a
 * self-referencing schema's type on its own, so each schema is anchored to a
 * plain node type and the exported aliases are derived with `z.output`
 * (rule 5 — never hand-write the type alongside the schema).
 */
type JsonValueNode = JsonPrimitive | JsonValueNode[] | JsonObjectNode;

interface JsonObjectNode {
	readonly [key: string]: JsonValueNode;
}

/** Recursive JSON value schema (lazy so the tree may nest arbitrarily deep). */
export const JsonValueSchema: z.ZodType<JsonValueNode> = z.lazy(() => z.union([JsonPrimitiveSchema, z.array(JsonValueSchema), JsonObjectSchema]));

export type JsonValue = z.output<typeof JsonValueSchema>;

/** Recursive JSON object schema — a string-keyed map of any JSON value. */
export const JsonObjectSchema: z.ZodType<JsonObjectNode> = z.lazy(() => z.record(z.string(), JsonValueSchema));

export type JsonObject = z.output<typeof JsonObjectSchema>;
