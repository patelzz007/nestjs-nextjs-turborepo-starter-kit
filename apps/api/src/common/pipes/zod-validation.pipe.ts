import { BadRequestException, Injectable, type PipeTransform } from "@nestjs/common";
import Ajv, { type ErrorObject, type ValidateFunction } from "ajv";
import type { z as ZodV4 } from "zod/v4";
import { toJSONSchema, url } from "zod/v4";

import {
	EmailAddressSchema,
	JsonObjectSchema,
	JsonPrimitiveSchema,
	JsonRecordSchema,
	JsonValueSchema,
	UuidParamSchema,
	type JsonObject,
	type JsonValue,
} from "@workspace/shared";

/**
 * How a {@link ZodValidationPipe} validates:
 *
 * - `"ajv+zod"` (default) — Ajv first (fast structural rejection and type
 *   coercion of query-string / path values), then `schema.safeParse()` on the
 *   coerced value; returns the PARSED output. Zod is the single runtime
 *   contract, so the handler always receives exactly what the shared schema
 *   produces: trims, lower-casing (canonical emails), defaults and refinements
 *   (cross-field rules such as "exactly one of" or "reason required when
 *   rejected") are never skipped.
 * - `"zod"` — `schema.safeParse()` only. Used by `@ZodListQuery`, whose
 *   bracket grammar is normalized by preprocess steps before any JSON-Schema
 *   check could apply.
 * - `"ajv"` — the JSON-Schema check alone, returning the coerced input. An
 *   explicit opt-out for a hot path whose schema has no transforms, defaults
 *   beyond JSON Schema, or refinements; never the default, because it would
 *   silently skip any rule JSON Schema cannot express.
 */
export interface ZodValidationPipeOptions {
	readonly engine: "ajv" | "zod" | "ajv+zod";
}

/**
 * Validation pipe backed by a COMPILED JSON-Schema validator instead of a
 * per-request Zod parse.
 *
 * Zod stays the single source of truth for every schema (the same `apiContract`
 * input schemas the client uses) — this pipe just compiles them into Ajv
 * validators ONCE at first use and reuses the compiled function. The hot-path
 * win is real: Zod's runtime parse is the slowest part of request validation,
 * and Ajv's compiled checks are several times faster for the shapes this API
 * validates.
 *
 * The error contract matches the previous Zod pipe exactly:
 * `{ message: "Validation failed", errors: [{ path, message }] }` — clients
 * and tests that asserted on it keep working unchanged.
 */
@Injectable()
export class ZodValidationPipe implements PipeTransform<JsonValue, JsonValue> {
	/** Compiled Ajv (matching zod v4's `toJSONSchema` output). */
	private readonly ajv: Ajv = new Ajv({
		strict: false,
		allErrors: true,
		coerceTypes: true,
		useDefaults: true,
		// `removeAdditional` stays OFF so `.strict()` schemas (which emit
		// `additionalProperties: false`) REJECT unknown keys — matching the
		// behavior of the Zod pipe this replaces.
		removeAdditional: false,
	});

	/** Cache of compiled validators keyed by schema reference. */
	private readonly cache = new WeakMap<ZodV4.ZodType, ValidateFunction>();

	constructor(
		private readonly schema: ZodV4.ZodType,
		private readonly options: ZodValidationPipeOptions = { engine: "ajv+zod" },
	) {}

	public transform(value: JsonValue): JsonValue {
		if (this.options.engine === "zod") {
			return this.parseWithZod(value);
		}
		const validator: ValidateFunction = this.getValidator();

		if (validator(value)) {
			return this.options.engine === "ajv+zod" ? this.parseWithZod(value) : value;
		}

		const validationErrors = validator.errors;
		if (validationErrors === null || validationErrors === undefined) {
			throw new BadRequestException({
				message: "Validation failed",
				errors: [],
				statusCode: 400,
			});
		}

		const issues: readonly { readonly path: string; readonly message: string; readonly code: string }[] = validationErrors.map(
			(error: ErrorObject): { readonly path: string; readonly message: string; readonly code: string } => ({
				path: error.instancePath.replace(/^\//, "").replace(/\//g, ".") || "root",
				message: this.formatErrorMessage(error),
				code: error.keyword,
			}),
		);

		throw new BadRequestException({
			message: "Validation failed",
			errors: issues,
			statusCode: 400,
		});
	}

	/**
	 * Zod engine: runs the schema itself (preprocess / refinements included) and
	 * returns its PARSED output. Same `{ message, errors }` failure body as the
	 * Ajv path, so clients and the global filter see one validation contract.
	 */
	private parseWithZod(value: JsonValue): JsonValue {
		const result = this.schema.safeParse(value);
		if (result.success) {
			return JsonValueSchema.parse(result.data);
		}
		const issues: readonly { readonly path: string; readonly message: string; readonly code: string }[] = result.error.issues.map(
			(issue): { readonly path: string; readonly message: string; readonly code: string } => ({
				path: issue.path.length > 0 ? issue.path.map((segment): string => String(segment)).join(".") : "root",
				message: issue.message,
				code: issue.code,
			}),
		);
		throw new BadRequestException({
			message: "Validation failed",
			errors: issues,
			statusCode: 400,
		});
	}

	/**
	 * Format a human-readable error message from an Ajv error.
	 */
	private formatErrorMessage(error: ErrorObject): string {
		const field: string = error.instancePath.replace(/^\//, "").replace(/\//g, ".") || "root";
		const params = readAjvErrorParams(error.params);
		switch (error.keyword) {
			case "type": {
				return `Field '${field}' must be of type ${readAjvParam(params, "type")}`;
			}
			case "required": {
				return `Field '${readAjvParam(params, "missingProperty")}' is required`;
			}
			case "enum": {
				const allowed = readAjvParamList(params, "allowedValues");
				return `Field '${field}' must be one of: ${allowed}`;
			}
			case "minLength": {
				return `Field '${field}' must be at least ${readAjvParam(params, "limit")} characters`;
			}
			case "maxLength": {
				return `Field '${field}' must be at most ${readAjvParam(params, "limit")} characters`;
			}
			case "minimum": {
				return `Field '${field}' must be at least ${readAjvParam(params, "limit")}`;
			}
			case "maximum": {
				return `Field '${field}' must be at most ${readAjvParam(params, "limit")}`;
			}
			case "pattern": {
				return `Field '${field}' does not match the required pattern`;
			}
			case "format": {
				return `Field '${field}' must be a valid ${readAjvParam(params, "format")}`;
			}
			case "additionalProperties": {
				return `Field '${field}' has unknown properties: ${readAjvParam(params, "additionalProperty")}`;
			}
			default: {
				return error.message ?? `Validation failed for field '${field}'`;
			}
		}
	}

	/**
	 * Pre-compile a Zod schema into an Ajv validator.
	 * Call this at boot time to eliminate cold-start latency on the first request.
	 */
	public static warmup(schema: ZodV4.ZodType): void {
		compileSchema(schema, sharedAjv, sharedCache);
	}

	private getValidator(): ValidateFunction {
		return compileSchema(this.schema, this.ajv, this.cache);
	}
}

/** Shared Ajv instance for pre-compilation (avoids creating a new instance per warmup call). */
const sharedAjv: Ajv = new Ajv({ strict: false, allErrors: true, coerceTypes: true, useDefaults: true, removeAdditional: false });
const sharedCache = new WeakMap<ZodV4.ZodType, ValidateFunction>();

function readAjvErrorParams(params: ErrorObject["params"]): Record<string, JsonValue> {
	const parsed = JsonRecordSchema.safeParse(params);
	return parsed.success ? parsed.data : {};
}

function readAjvParam(params: Record<string, JsonValue>, key: string): string {
	const value = params[key];
	const primitive = JsonPrimitiveSchema.safeParse(value);
	if (primitive.success) {
		return primitive.data === null ? "null" : String(primitive.data);
	}
	return "unknown";
}

function readAjvParamList(params: Record<string, JsonValue>, key: string): string {
	const value = params[key];
	if (!Array.isArray(value)) {
		return "unknown";
	}
	return value
		.map((item): string => {
			const primitive = JsonPrimitiveSchema.safeParse(item);
			return primitive.success ? String(primitive.data) : "unknown";
		})
		.join(", ");
}

const ajvWithFormats = new WeakSet<Ajv>();

/**
 * Every JSON Schema `format` the `apiContract` schemas emit (Zod v4
 * `toJSONSchema`), mapped to the Zod schema that DEFINES it — so the Ajv check
 * is exactly as strict as the Zod rule, never a second definition.
 *
 * Ajv runs with `strict: false`, which merely WARNS about an unknown format and
 * then skips the check — a request would validate more loosely than its schema.
 * `zod-validation.pipe.spec.ts` therefore fails the build when a contract
 * emits a format missing here: add it (with the Zod schema behind it).
 *
 * `z.url({ protocol })` emits plain `uri` (the protocol rule has no JSON Schema
 * form): a schema that needs it must use the pipe's `zod` engine.
 */
export const AJV_STRING_FORMATS: Readonly<Record<string, ZodV4.ZodType>> = {
	email: EmailAddressSchema,
	uuid: UuidParamSchema,
	uri: url(),
};

/** Register {@link AJV_STRING_FORMATS} on an Ajv instance (once). */
function registerAjvFormats(ajv: Ajv): void {
	if (ajvWithFormats.has(ajv)) {
		return;
	}
	for (const [format, schema] of Object.entries(AJV_STRING_FORMATS)) {
		ajv.addFormat(format, (value: JsonValue): boolean => schema.safeParse(value).success);
	}
	ajvWithFormats.add(ajv);
}

/** Compile a Zod schema into an Ajv validator, caching the result. */
function compileSchema(schema: ZodV4.ZodType, ajv: Ajv, cache: WeakMap<ZodV4.ZodType, ValidateFunction>): ValidateFunction {
	const cached: ValidateFunction | undefined = cache.get(schema);
	if (cached !== undefined) {
		return cached;
	}

	const jsonSchema: JsonObject = JsonObjectSchema.parse(toJSONSchema(schema));
	const compiledSchema: JsonObject = JsonObjectSchema.parse(
		Object.fromEntries(Object.entries(jsonSchema).filter(([key]: readonly [string, JsonValue]): boolean => key !== "$schema")),
	);

	registerAjvFormats(ajv);

	const validator: ValidateFunction = ajv.compile(compiledSchema);
	cache.set(schema, validator);
	return validator;
}
