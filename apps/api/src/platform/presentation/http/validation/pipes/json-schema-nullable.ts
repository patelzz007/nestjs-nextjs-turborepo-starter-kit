import { isArrayValue, JsonObjectSchema, JsonPrimitiveSchema, type JsonObject, type JsonValue } from "@workspace/shared";

/** How many branches a zod `.nullable()` emits: the value's own schema and `{ type: "null" }`. */
const NULLABLE_BRANCH_COUNT = 2;

/** Keys that make a branch too complex to fold into a `type` list (it is left as `anyOf`). */
const COMPOSITE_KEYS: readonly string[] = ["anyOf", "oneOf", "allOf", "$ref", "not"];

function isNullBranch(branch: JsonObject): boolean {
	return Object.keys(branch).length === 1 && branch.type === "null";
}

/**
 * Folds one nullable `anyOf: [{ type: T, …rules }, { type: "null" }]` into
 * `{ type: [T, "null"], …rules }` (an `enum` / `const` gains `null`). Ajv's
 * `coerceTypes` coerces a value only when NONE of the listed types match it,
 * so `null` stays `null` — inside an `anyOf`, Ajv tries the `T` branch first
 * and coerces `null` into it (`0`, `""`, `false`) before zod ever sees the body.
 */
function foldNullableAnyOf(node: JsonObject): JsonObject {
	const { anyOf, ...rest } = node;
	if (!isArrayValue(anyOf) || anyOf.length !== NULLABLE_BRANCH_COUNT) {
		return node;
	}
	const branches = anyOf.flatMap((branch): JsonObject[] => {
		const parsed = JsonObjectSchema.safeParse(branch);
		return parsed.success ? [parsed.data] : [];
	});
	const valueBranch = branches.find((branch) => !isNullBranch(branch));
	const type = JsonPrimitiveSchema.safeParse(valueBranch?.type);
	if (branches.length !== NULLABLE_BRANCH_COUNT || !branches.some(isNullBranch) || valueBranch === undefined || !type.success || type.data === null) {
		return node;
	}
	if (COMPOSITE_KEYS.some((key) => key in valueBranch)) {
		return node;
	}
	const { const: constant, enum: allowed, ...rules } = valueBranch;
	const nullableEnum: JsonObject = isArrayValue(allowed) ? { enum: [...allowed, null] } : constant === undefined ? {} : { enum: [constant, null] };
	return { ...rest, ...rules, type: [type.data, "null"], ...nullableEnum };
}

/**
 * Rewrites every nullable `anyOf` in a zod-emitted JSON Schema (at any depth)
 * into a `type` list, so the compiled Ajv check never coerces an explicit or
 * defaulted `null` into another type. Everything else is returned unchanged.
 */
export function nullableAsTypeLists(schema: JsonValue): JsonValue {
	if (isArrayValue(schema)) {
		return schema.map(nullableAsTypeLists);
	}
	const parsed = JsonObjectSchema.safeParse(schema);
	if (!parsed.success) {
		return schema;
	}
	return foldNullableAnyOf(Object.fromEntries(Object.entries(parsed.data).map(([key, value]): [string, JsonValue] => [key, nullableAsTypeLists(value)])));
}
