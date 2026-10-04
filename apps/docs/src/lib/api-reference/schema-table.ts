import type { JsonSchema, JsonValue } from "./openapi";

/**
 * Turns a JSON Schema into the rows of a Markdown field table:
 * `field · type · required · notes`, nested objects as dotted names
 * (`codes[].backupCode`), so a reader sees every field without opening Swagger.
 */

export interface FieldRow {
	readonly name: string;
	readonly type: string;
	readonly required: boolean;
	readonly notes: string;
}

/** Named component schemas, for resolving `$ref`. */
export type SchemaRegistry = Readonly<Record<string, JsonSchema>>;

/** Deepest nesting rendered; anything below is summarized by its type. */
const MAX_DEPTH = 4;
/** Enum members listed before the rest are summarized as "+N more". */
const MAX_ENUM_MEMBERS = 10;
/** Regex patterns longer than this are left out (the format or description says enough). */
const MAX_PATTERN_LENGTH = 60;
const REF_PREFIX = "#/components/schemas/";

export function resolveSchema(schema: JsonSchema, registry: SchemaRegistry): JsonSchema {
	if (schema.$ref === undefined) {
		return schema;
	}
	const target: JsonSchema | undefined = registry[schema.$ref.replace(REF_PREFIX, "")];
	return target === undefined ? schema : resolveSchema(target, registry);
}

function formatValue(value: JsonValue): string {
	return typeof value === "string" ? `"${value}"` : JSON.stringify(value);
}

/** A short, human type label: `string (uuid)`, `"A" \| "B"`, `object[]`, `integer \| null`. */
export function typeLabel(schema: JsonSchema, registry: SchemaRegistry): string {
	const resolved = resolveSchema(schema, registry);
	const variants = resolved.anyOf ?? resolved.oneOf;
	let label: string;
	if (variants !== undefined) {
		label = [...new Set(variants.map((variant) => typeLabel(variant, registry)))].join(" | ");
	} else if (resolved.enum !== undefined) {
		const members = resolved.enum.slice(0, MAX_ENUM_MEMBERS).map((member) => formatValue(member));
		const rest = resolved.enum.length - MAX_ENUM_MEMBERS;
		label = rest > 0 ? `${members.join(" | ")} | … (+${String(rest)} more)` : members.join(" | ");
	} else if (resolved.type === "array") {
		label = `${resolved.items === undefined ? "any" : typeLabel(resolved.items, registry)}[]`;
	} else if (resolved.type !== undefined) {
		const type = typeof resolved.type === "string" ? resolved.type : resolved.type.join(" | ");
		label = resolved.format === undefined ? type : `${type} (${resolved.format})`;
	} else if (resolved.properties !== undefined) {
		label = "object";
	} else {
		label = "any JSON";
	}
	return resolved.nullable === true ? `${label} | null` : label;
}

/** Description plus the constraints a client must respect. */
export function constraintNotes(schema: JsonSchema, registry: SchemaRegistry): string {
	const resolved = resolveSchema(schema, registry);
	const notes: string[] = [];
	if (resolved.description !== undefined) notes.push(resolved.description);
	if (resolved.minLength !== undefined && resolved.minLength === resolved.maxLength) {
		notes.push(`exactly ${String(resolved.minLength)} characters`);
	} else if (resolved.minLength !== undefined && resolved.maxLength !== undefined) {
		notes.push(`length ${String(resolved.minLength)}–${String(resolved.maxLength)}`);
	} else if (resolved.minLength !== undefined) {
		notes.push(`at least ${String(resolved.minLength)} characters`);
	} else if (resolved.maxLength !== undefined) {
		notes.push(`at most ${String(resolved.maxLength)} characters`);
	}
	if (resolved.minimum !== undefined || resolved.maximum !== undefined) {
		const isSafeIntegerBound = resolved.maximum === Number.MAX_SAFE_INTEGER;
		if (!isSafeIntegerBound) {
			notes.push(`range ${resolved.minimum === undefined ? "−∞" : String(resolved.minimum)}–${resolved.maximum === undefined ? "∞" : String(resolved.maximum)}`);
		} else if (resolved.minimum !== undefined && resolved.minimum !== 0) {
			notes.push(`min ${String(resolved.minimum)}`);
		}
	}
	if (resolved.minItems !== undefined || resolved.maxItems !== undefined) {
		notes.push(`${String(resolved.minItems ?? 0)}–${resolved.maxItems === undefined ? "∞" : String(resolved.maxItems)} items`);
	}
	if (resolved.pattern !== undefined && resolved.format === undefined && resolved.pattern.length <= MAX_PATTERN_LENGTH) {
		notes.push(`pattern \`${resolved.pattern}\``);
	}
	if (resolved.default !== undefined) notes.push(`default \`${JSON.stringify(resolved.default)}\``);
	return notes.join("; ");
}

/** The object shapes a schema can take (itself, or each object variant of an anyOf/oneOf). */
function objectShapes(schema: JsonSchema, registry: SchemaRegistry): readonly JsonSchema[] {
	const resolved = resolveSchema(schema, registry);
	if (resolved.properties !== undefined) return [resolved];
	if (resolved.allOf !== undefined) {
		const merged: Record<string, JsonSchema> = {};
		const required: string[] = [];
		for (const part of resolved.allOf) {
			for (const shape of objectShapes(part, registry)) {
				Object.assign(merged, shape.properties);
				required.push(...(shape.required ?? []));
			}
		}
		return [{ type: "object", properties: merged, required }];
	}
	const variants = resolved.anyOf ?? resolved.oneOf;
	if (variants !== undefined) return variants.flatMap((variant) => objectShapes(variant, registry));
	return [];
}

function collectRows(schema: JsonSchema, registry: SchemaRegistry, prefix: string, depth: number, rows: FieldRow[]): void {
	const shapes = objectShapes(schema, registry);
	shapes.forEach((shape, shapeIndex) => {
		const required = new Set(shape.required ?? []);
		const shapePrefix = shapes.length > 1 ? `${prefix}⟨shape ${String(shapeIndex + 1)}⟩ ` : prefix;
		for (const [key, child] of Object.entries(shape.properties ?? {})) {
			const name = `${shapePrefix}${key}`;
			rows.push({ name, type: typeLabel(child, registry), required: required.has(key), notes: constraintNotes(child, registry) });
			if (depth >= MAX_DEPTH) continue;
			const resolved = resolveSchema(child, registry);
			if (resolved.type === "array" && resolved.items !== undefined) {
				collectRows(resolved.items, registry, `${name}[].`, depth + 1, rows);
			} else {
				collectRows(resolved, registry, `${name}.`, depth + 1, rows);
			}
		}
	});
}

/** Field rows of an object schema (an array schema lists its items' fields as `[].field`). */
export function schemaRows(schema: JsonSchema, registry: SchemaRegistry): readonly FieldRow[] {
	const rows: FieldRow[] = [];
	const resolved = resolveSchema(schema, registry);
	if (resolved.type === "array" && resolved.items !== undefined) {
		collectRows(resolved.items, registry, "[].", 1, rows);
	} else {
		collectRows(resolved, registry, "", 1, rows);
	}
	return rows;
}
