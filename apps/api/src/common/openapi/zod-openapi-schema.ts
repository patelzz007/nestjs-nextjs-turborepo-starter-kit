// ============================================
// common/openapi/zod-openapi-schema.ts - zod → OpenAPI 3.0 schema conversion
// ============================================
// Nest 12 parameter decorators accept a Standard Schema (`@Body({ schema })`)
// and @nestjs/swagger 12 documents such parameters automatically — request
// bodies, and object query/path schemas expanded into one parameter per key.
// The request decorators (`ZodBody` / `ZodQuery` / `ZodParams` / `ZodParam`)
// set that schema, so every validated input is documented from the SAME zod
// schema that validates it (rules/05-contracts-zod-api.md → "zod drives Swagger").
//
// This module is the converter Swagger uses for those schemas
// (`standardSchemaConverter` in `buildOpenApiDocument`). It wraps zod v4's
// native `z.toJSONSchema(schema, { target: "openapi-3.0", io })` — `io: "input"`
// for requests, because the docs describe what a CLIENT SENDS (a `.default()`
// field is optional on the wire). The raw output is parsed through
// `JsonSchemaNodeSchema` below, which:
//   - types the library output without casts (zod is the runtime contract here too),
//   - STRIPS every keyword OpenAPI 3.0 does not understand (`$schema`, `id`,
//     `propertyNames`, `patternProperties`, …) because zod objects strip unknown keys,
// and `toOpenApiSchema` maps the typed tree onto `@nestjs/swagger`'s
// `SchemaObject`, fixing the few 3.0-isms (`const` → `enum`, numeric
// `exclusiveMinimum` → boolean form, the first `examples` entry → `example`, `$ref`
// siblings wrapped in `allOf`).
//
// Why not Swagger's built-in Standard-JSON-Schema fallback: recursive schemas
// (`z.lazy`, e.g. `JsonValueSchema`) make zod emit `definitions` named
// `__schema0`, `__schema1`, … — unique per conversion only, so two different
// bodies would overwrite each other's components. Here they get deterministic,
// collision-free names (see `componentRenames`).

import { createHash } from "node:crypto";

import type { ReferenceObject, SchemaObject, StandardSchemaConverter } from "@nestjs/swagger";
import { isArrayValue, LIST_SLOT_INDEX, JsonPrimitiveSchema, JsonValueSchema, type JsonPrimitive, type JsonValue } from "@workspace/shared";
import { z } from "zod";

/** A schema position in an OpenAPI 3.0 document: an inline schema or a `$ref`. */
export type OpenApiSchema = SchemaObject | ReferenceObject;

/** The subset of JSON Schema (OpenAPI 3.0 flavour) that zod's `openapi-3.0` target emits and OpenAPI understands. */
interface JsonSchemaNode {
	readonly $ref?: string | undefined;
	readonly type?: string | string[] | undefined;
	readonly nullable?: boolean | undefined;
	readonly format?: string | undefined;
	readonly pattern?: string | undefined;
	readonly title?: string | undefined;
	readonly description?: string | undefined;
	readonly deprecated?: boolean | undefined;
	readonly readOnly?: boolean | undefined;
	readonly writeOnly?: boolean | undefined;
	readonly multipleOf?: number | undefined;
	readonly minimum?: number | undefined;
	readonly maximum?: number | undefined;
	readonly exclusiveMinimum?: number | boolean | undefined;
	readonly exclusiveMaximum?: number | boolean | undefined;
	readonly minLength?: number | undefined;
	readonly maxLength?: number | undefined;
	readonly minItems?: number | undefined;
	readonly maxItems?: number | undefined;
	readonly uniqueItems?: boolean | undefined;
	readonly minProperties?: number | undefined;
	readonly maxProperties?: number | undefined;
	readonly required?: string[] | undefined;
	readonly enum?: JsonPrimitive[] | undefined;
	readonly const?: JsonPrimitive | undefined;
	readonly default?: JsonValue | undefined;
	readonly example?: JsonValue | undefined;
	readonly examples?: JsonValue[] | undefined;
	readonly items?: JsonSchemaNode | JsonSchemaNode[] | undefined;
	readonly properties?: Record<string, JsonSchemaNode> | undefined;
	readonly additionalProperties?: boolean | JsonSchemaNode | undefined;
	readonly allOf?: JsonSchemaNode[] | undefined;
	readonly anyOf?: JsonSchemaNode[] | undefined;
	readonly oneOf?: JsonSchemaNode[] | undefined;
	readonly not?: JsonSchemaNode | undefined;
	readonly definitions?: Record<string, JsonSchemaNode> | undefined;
	readonly $defs?: Record<string, JsonSchemaNode> | undefined;
}

/**
 * Runtime contract for the converter's input. Unknown keywords are stripped
 * (zod's default object behaviour) — that is how unsupported JSON-Schema
 * keywords never reach the OpenAPI document.
 */
const JsonSchemaNodeSchema: z.ZodType<JsonSchemaNode> = z.lazy(() =>
	z.object({
		$ref: z.string().optional(),
		type: z.union([z.string(), z.array(z.string())]).optional(),
		nullable: z.boolean().optional(),
		format: z.string().optional(),
		pattern: z.string().optional(),
		title: z.string().optional(),
		description: z.string().optional(),
		deprecated: z.boolean().optional(),
		readOnly: z.boolean().optional(),
		writeOnly: z.boolean().optional(),
		multipleOf: z.number().optional(),
		minimum: z.number().optional(),
		maximum: z.number().optional(),
		exclusiveMinimum: z.union([z.number(), z.boolean()]).optional(),
		exclusiveMaximum: z.union([z.number(), z.boolean()]).optional(),
		minLength: z.number().optional(),
		maxLength: z.number().optional(),
		minItems: z.number().optional(),
		maxItems: z.number().optional(),
		uniqueItems: z.boolean().optional(),
		minProperties: z.number().optional(),
		maxProperties: z.number().optional(),
		required: z.array(z.string()).optional(),
		enum: z.array(JsonPrimitiveSchema).optional(),
		const: JsonPrimitiveSchema.optional(),
		default: JsonValueSchema.optional(),
		example: JsonValueSchema.optional(),
		examples: z.array(JsonValueSchema).optional(),
		items: z.union([JsonSchemaNodeSchema, z.array(JsonSchemaNodeSchema)]).optional(),
		properties: z.record(z.string(), JsonSchemaNodeSchema).optional(),
		additionalProperties: z.union([z.boolean(), JsonSchemaNodeSchema]).optional(),
		allOf: z.array(JsonSchemaNodeSchema).optional(),
		anyOf: z.array(JsonSchemaNodeSchema).optional(),
		oneOf: z.array(JsonSchemaNodeSchema).optional(),
		not: JsonSchemaNodeSchema.optional(),
		definitions: z.record(z.string(), JsonSchemaNodeSchema).optional(),
		$defs: z.record(z.string(), JsonSchemaNodeSchema).optional(),
	}),
);

/** The result of converting one zod schema. */
export interface ZodOpenApiConversion {
	/** The root schema, with every `$ref` pointing into `#/components/schemas/`. */
	readonly schema: OpenApiSchema;
	/** Component schemas the root references (recursive / `.meta({ id })` schemas), keyed by component name. */
	readonly components: Readonly<Record<string, OpenApiSchema>>;
}

const COMPONENT_REF_PREFIX = "#/components/schemas/";
const LOCAL_REF_PATTERN = /^#\/(?:definitions|\$defs)\/(?<name>.+)$/;
/** zod names anonymous recursive definitions `__schema0`, `__schema1`, … — unique per conversion only. */
const GENERATED_DEFINITION_PATTERN = /^__schema\d+$/;
/** Hex characters of the content hash used to name anonymous recursive definitions. */
const COMPONENT_HASH_LENGTH = 12;

/** Which side of a zod schema to describe: what a client sends (`input`) or what the server returns (`output`). */
export type ZodSchemaDirection = "input" | "output";

/**
 * Convert a zod schema into an OpenAPI 3.0 schema — by default describing its
 * INPUT (the wire shape a client sends). Throws on a construct OpenAPI cannot
 * express (a self-referencing ROOT schema) so the mistake surfaces when the
 * document is built, not as a silently wrong document.
 */
export function zodToOpenApi(schema: z.ZodType, io: ZodSchemaDirection = "input"): ZodOpenApiConversion {
	const raw: JsonSchemaNode = JsonSchemaNodeSchema.parse(z.toJSONSchema(schema, { target: "openapi-3.0", io, unrepresentable: "any" }));
	const definitions: Readonly<Record<string, JsonSchemaNode>> = { ...raw.definitions, ...raw.$defs };
	const context: ConversionContext = { renames: componentRenames(definitions), openObjects: io === "output" };

	const components: Record<string, OpenApiSchema> = {};
	for (const [definitionName, definition] of Object.entries(definitions)) {
		components[context.renames.get(definitionName) ?? definitionName] = toOpenApiSchema(definition, context);
	}
	return { schema: toOpenApiSchema(raw, context), components };
}

/**
 * The `standardSchemaConverter` handed to `SwaggerModule.createDocument`: every
 * zod schema attached to a route parameter (`@Body({ schema })`, which is what
 * the Zod request decorators set) is converted here. Any other Standard
 * Schema falls back to Swagger's built-in conversion (`undefined`).
 */
export const zodStandardSchemaConverter: StandardSchemaConverter = (schema, { schemaType }) => (schema instanceof z.ZodType ? zodToOpenApi(schema, schemaType) : undefined);

/**
 * Stable component names for this conversion's definitions. Named (`.meta({ id })`)
 * definitions keep their id; zod's anonymous `__schemaN` names are only unique
 * within ONE conversion, so they are replaced by a hash of the whole definition
 * set plus the local name — identical schemas share a component, different
 * ones can never collide.
 */
function componentRenames(definitions: Readonly<Record<string, JsonSchemaNode>>): ReadonlyMap<string, string> {
	const fingerprint: string = JSON.stringify(definitions);
	const renames = new Map<string, string>();
	for (const definitionName of Object.keys(definitions)) {
		if (GENERATED_DEFINITION_PATTERN.test(definitionName)) {
			const digest: string = createHash("sha256").update(`${fingerprint}:${definitionName}`).digest("hex").slice(0, COMPONENT_HASH_LENGTH);
			renames.set(definitionName, `ZodSchema_${digest}`);
		}
	}
	return renames;
}

/** Per-conversion settings threaded through the recursive mapping. */
interface ConversionContext {
	/** zod's per-conversion definition names → stable component names. */
	readonly renames: ReadonlyMap<string, string>;
	/**
	 * Responses (`io: "output"`): zod marks EVERY output object
	 * `additionalProperties: false` (a parsed value never has extra keys). A
	 * response document must not say that — clients are expected to IGNORE
	 * fields the API adds later (rules/05 change-safety matrix, ADR 022) — so
	 * the closed-object marker is dropped. Request schemas keep it: there it
	 * documents a `.strict()` body that rejects unknown keys.
	 */
	readonly openObjects: boolean;
}

function rewriteRef(ref: string, renames: ReadonlyMap<string, string>): string {
	const match: RegExpExecArray | null = LOCAL_REF_PATTERN.exec(ref);
	const localName: string | undefined = match?.groups?.name;
	if (localName === undefined) {
		throw new Error(`Unsupported $ref "${ref}" in a zod-generated schema (a self-referencing root schema cannot be documented — give the recursive part its own schema).`);
	}
	return `${COMPONENT_REF_PREFIX}${renames.get(localName) ?? localName}`;
}

function toOpenApiList(nodes: readonly JsonSchemaNode[], context: ConversionContext): OpenApiSchema[] {
	return nodes.map((node: JsonSchemaNode): OpenApiSchema => toOpenApiSchema(node, context));
}

/** Map one typed JSON-Schema node onto an OpenAPI 3.0 schema object. */
function toOpenApiSchema(node: JsonSchemaNode, context: ConversionContext): OpenApiSchema {
	const annotations: SchemaObject = annotationsOf(node);
	if (node.$ref !== undefined) {
		const reference: ReferenceObject = { $ref: rewriteRef(node.$ref, context.renames) };
		// OpenAPI 3.0 ignores siblings of `$ref`; wrap so descriptions/nullable survive.
		return Object.keys(annotations).length === 0 ? reference : { allOf: [reference], ...annotations };
	}

	const schema: SchemaObject = { ...annotations, ...validationKeywordsOf(node) };
	if (node.type !== undefined) schema.type = node.type;
	if (node.enum !== undefined) schema.enum = node.enum;
	else if (node.const !== undefined) schema.enum = [node.const];
	if (node.items !== undefined) {
		// A tuple (`items: [...]`) has no OpenAPI 3.0 form; document "any of the positions".
		schema.items = isArrayValue(node.items) ? { anyOf: toOpenApiList(node.items, context) } : toOpenApiSchema(node.items, context);
	}
	if (node.properties !== undefined) {
		schema.properties = Object.fromEntries(
			Object.entries(node.properties).map(([key, value]: readonly [string, JsonSchemaNode]): readonly [string, OpenApiSchema] => [key, toOpenApiSchema(value, context)]),
		);
	}
	if (node.required !== undefined && node.required.length > 0) schema.required = node.required;
	if (node.additionalProperties === true || (node.additionalProperties === false && !context.openObjects)) {
		schema.additionalProperties = node.additionalProperties;
	} else if (node.additionalProperties !== undefined && node.additionalProperties !== false) {
		schema.additionalProperties = toOpenApiSchema(node.additionalProperties, context);
	}
	if (node.allOf !== undefined) schema.allOf = toOpenApiList(node.allOf, context);
	if (node.anyOf !== undefined) schema.anyOf = toOpenApiList(node.anyOf, context);
	if (node.oneOf !== undefined) schema.oneOf = toOpenApiList(node.oneOf, context);
	if (node.not !== undefined) schema.not = toOpenApiSchema(node.not, context);
	return schema;
}

/** Descriptive keywords (docs-only) — kept even next to a `$ref`. */
function annotationsOf(node: JsonSchemaNode): SchemaObject {
	const schema: SchemaObject = {};
	if (node.title !== undefined) schema.title = node.title;
	if (node.description !== undefined) schema.description = node.description;
	if (node.nullable !== undefined) schema.nullable = node.nullable;
	if (node.deprecated !== undefined) schema.deprecated = node.deprecated;
	if (node.readOnly !== undefined) schema.readOnly = node.readOnly;
	if (node.writeOnly !== undefined) schema.writeOnly = node.writeOnly;
	if (node.default !== undefined) schema.default = node.default;
	// OpenAPI 3.0 schemas carry a single `example`; `.meta({ examples })` contributes its first entry.
	const example: JsonValue | undefined = node.example ?? node.examples?.[LIST_SLOT_INDEX.first];
	if (example !== undefined) schema.example = example;
	return schema;
}

/** Validation keywords, normalised to OpenAPI 3.0 (boolean `exclusiveMinimum`/`exclusiveMaximum`). */
function validationKeywordsOf(node: JsonSchemaNode): SchemaObject {
	const schema: SchemaObject = {};
	if (node.format !== undefined) schema.format = node.format;
	if (node.pattern !== undefined) schema.pattern = node.pattern;
	if (node.multipleOf !== undefined) schema.multipleOf = node.multipleOf;
	if (node.minimum !== undefined) schema.minimum = node.minimum;
	if (node.maximum !== undefined) schema.maximum = node.maximum;
	applyExclusiveBound(schema, node.exclusiveMinimum, "minimum");
	applyExclusiveBound(schema, node.exclusiveMaximum, "maximum");
	if (node.minLength !== undefined) schema.minLength = node.minLength;
	if (node.maxLength !== undefined) schema.maxLength = node.maxLength;
	if (node.minItems !== undefined) schema.minItems = node.minItems;
	if (node.maxItems !== undefined) schema.maxItems = node.maxItems;
	if (node.uniqueItems !== undefined) schema.uniqueItems = node.uniqueItems;
	if (node.minProperties !== undefined) schema.minProperties = node.minProperties;
	if (node.maxProperties !== undefined) schema.maxProperties = node.maxProperties;
	return schema;
}

/** JSON Schema 2020-12 writes `exclusiveMinimum: 5`; OpenAPI 3.0 writes `minimum: 5, exclusiveMinimum: true`. */
function applyExclusiveBound(schema: SchemaObject, bound: number | boolean | undefined, side: "minimum" | "maximum"): void {
	if (bound === undefined) return;
	const exclusive: boolean = bound !== false;
	if (bound !== true && bound !== false) schema[side] = bound;
	if (side === "minimum") schema.exclusiveMinimum = exclusive;
	else schema.exclusiveMaximum = exclusive;
}
