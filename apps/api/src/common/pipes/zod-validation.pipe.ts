import { BadRequestException, Injectable, type PipeTransform } from "@nestjs/common";
import Ajv, { type ErrorObject, type ValidateFunction } from "ajv";
import type { z as ZodV4 } from "zod/v4";
import { toJSONSchema } from "zod/v4";

import { EmailAddressSchema, JsonObjectSchema, JsonPrimitiveSchema, JsonRecordSchema, UuidParamSchema, type JsonObject, type JsonValue } from "@workspace/shared";

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

	constructor(private readonly schema: ZodV4.ZodType) {}

	public transform(value: JsonValue): JsonValue {
		const validator: ValidateFunction = this.getValidator();

		if (validator(value)) {
			return value;
		}

		const issues: readonly { readonly path: string; readonly message: string; readonly code: string }[] = validator.errors.map(
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

/** Register JSON Schema formats emitted by Zod v4 (`z.email()`, `z.uuid()`, etc.). */
function registerAjvFormats(ajv: Ajv): void {
	if (ajvWithFormats.has(ajv)) {
		return;
	}
	ajv.addFormat("email", (value: JsonValue): boolean => {
		return EmailAddressSchema.safeParse(value).success;
	});
	ajv.addFormat("uuid", (value: JsonValue): boolean => {
		return UuidParamSchema.safeParse(value).success;
	});
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
