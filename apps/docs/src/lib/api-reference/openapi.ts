import { z } from "zod";

/**
 * The parts of the exported OpenAPI document (`docs/generated/openapi.json`,
 * written by `pnpm --filter @workspace/api openapi:export`) and of the captured
 * samples (`docs/generated/api-samples.json`, written by
 * `apps/docs/scripts/capture-api-samples.mjs`) that the API reference renders.
 *
 * Both files are parsed at the boundary with these schemas; keys the reference
 * does not use are stripped, so nothing below is typed loosely.
 */

/** Any JSON value (sample bodies, enum members, defaults, examples). */
export type JsonValue = string | number | boolean | null | readonly JsonValue[] | { readonly [key: string]: JsonValue };

export const JsonValueSchema: z.ZodType<JsonValue> = z.lazy(() =>
	z.union([z.string(), z.number(), z.boolean(), z.null(), z.array(JsonValueSchema), z.record(z.string(), JsonValueSchema)]),
);

/** The JSON Schema keywords the API's zod → OpenAPI export emits. */
export interface JsonSchema {
	readonly $ref?: string | undefined;
	/** One type, or several (`["string", "null"]`). */
	readonly type?: string | readonly string[] | undefined;
	readonly format?: string | undefined;
	readonly description?: string | undefined;
	readonly enum?: readonly JsonValue[] | undefined;
	readonly properties?: Readonly<Record<string, JsonSchema>> | undefined;
	readonly required?: readonly string[] | undefined;
	readonly items?: JsonSchema | undefined;
	readonly anyOf?: readonly JsonSchema[] | undefined;
	readonly oneOf?: readonly JsonSchema[] | undefined;
	readonly allOf?: readonly JsonSchema[] | undefined;
	readonly nullable?: boolean | undefined;
	readonly minimum?: number | undefined;
	readonly maximum?: number | undefined;
	readonly minLength?: number | undefined;
	readonly maxLength?: number | undefined;
	readonly minItems?: number | undefined;
	readonly maxItems?: number | undefined;
	readonly pattern?: string | undefined;
	readonly default?: JsonValue | undefined;
}

export const JsonSchemaSchema: z.ZodType<JsonSchema> = z.lazy(() =>
	z.object({
		$ref: z.string().optional(),
		type: z.union([z.string(), z.array(z.string())]).optional(),
		format: z.string().optional(),
		description: z.string().optional(),
		enum: z.array(JsonValueSchema).optional(),
		properties: z.record(z.string(), JsonSchemaSchema).optional(),
		required: z.array(z.string()).optional(),
		items: JsonSchemaSchema.optional(),
		anyOf: z.array(JsonSchemaSchema).optional(),
		oneOf: z.array(JsonSchemaSchema).optional(),
		allOf: z.array(JsonSchemaSchema).optional(),
		nullable: z.boolean().optional(),
		minimum: z.number().optional(),
		maximum: z.number().optional(),
		minLength: z.number().optional(),
		maxLength: z.number().optional(),
		minItems: z.number().optional(),
		maxItems: z.number().optional(),
		pattern: z.string().optional(),
		default: JsonValueSchema.optional(),
	}),
);

const MediaTypesSchema = z.record(z.string(), z.object({ schema: JsonSchemaSchema.optional() }));

export const ParameterSchema = z.object({
	name: z.string().min(1),
	in: z.enum(["query", "path", "header", "cookie"]),
	required: z.boolean().optional(),
	description: z.string().optional(),
	schema: JsonSchemaSchema.optional(),
});
export type Parameter = z.output<typeof ParameterSchema>;

export const OperationSchema = z.object({
	operationId: z.string().min(1),
	summary: z.string().optional(),
	description: z.string().optional(),
	deprecated: z.boolean().optional(),
	tags: z.array(z.string()).default([]),
	parameters: z.array(ParameterSchema).default([]),
	requestBody: z.object({ required: z.boolean().optional(), content: MediaTypesSchema }).optional(),
	responses: z.record(z.string(), z.object({ description: z.string().default(""), content: MediaTypesSchema.optional() })),
});
export type Operation = z.output<typeof OperationSchema>;

export const HTTP_METHODS: readonly ["get", "post", "put", "patch", "delete"] = ["get", "post", "put", "patch", "delete"];
export const HttpMethodSchema = z.enum(HTTP_METHODS);
export type HttpMethod = z.output<typeof HttpMethodSchema>;

export const OpenApiDocumentSchema = z.object({
	paths: z.record(z.string(), z.partialRecord(HttpMethodSchema, OperationSchema)),
	components: z.object({ schemas: z.record(z.string(), JsonSchemaSchema).default({}) }).default({ schemas: {} }),
});
export type OpenApiDocument = z.output<typeof OpenApiDocumentSchema>;

/** One operation with the method and path it is mounted at. */
export interface Endpoint {
	readonly method: HttpMethod;
	readonly path: string;
	readonly operation: Operation;
}

/** Every operation of the document, sorted by path, then by method order (GET, POST, PUT, PATCH, DELETE). */
export function listEndpoints(document: OpenApiDocument): readonly Endpoint[] {
	const endpoints: Endpoint[] = [];
	for (const [path, item] of Object.entries(document.paths)) {
		for (const method of HTTP_METHODS) {
			const operation: Operation | undefined = item[method];
			if (operation !== undefined) {
				endpoints.push({ method, path, operation });
			}
		}
	}
	return endpoints.sort((left, right) => left.path.localeCompare(right.path) || HTTP_METHODS.indexOf(left.method) - HTTP_METHODS.indexOf(right.method));
}

// ── Captured samples ────────────────────────────────────────────────────────

export const CapturedSampleSchema = z.object({
	as: z.string().min(1),
	note: z.string().optional(),
	request: z.object({
		method: z.string().min(1),
		path: z.string().min(1),
		query: z.record(z.string(), z.string()).optional(),
		headers: z.record(z.string(), z.string()).default({}),
		body: JsonValueSchema.optional(),
	}),
	response: z.object({
		status: z.number().int(),
		contentType: z.string(),
		body: JsonValueSchema,
	}),
});
export type CapturedSample = z.output<typeof CapturedSampleSchema>;

export const MissingSampleSchema = z.object({ notCaptured: z.string().min(1) });
export type MissingSample = z.output<typeof MissingSampleSchema>;

export const SampleSchema = z.union([CapturedSampleSchema, MissingSampleSchema]);
export type Sample = z.output<typeof SampleSchema>;

export const ApiSamplesFileSchema = z.object({
	capturedFrom: z.string().min(1),
	/** Epoch ms (UTC midnight) of the capture run — the generated pages' `lastUpdated`. */
	capturedAt: z.number().int(),
	samples: z.record(z.string(), SampleSchema),
});
export type ApiSamplesFile = z.output<typeof ApiSamplesFileSchema>;

export function isCapturedSample(sample: Sample): sample is CapturedSample {
	return "request" in sample;
}
