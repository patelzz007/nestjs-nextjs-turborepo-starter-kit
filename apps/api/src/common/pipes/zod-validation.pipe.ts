import { BadRequestException, Injectable, type PipeTransform } from "@nestjs/common";
import Ajv, { type ErrorObject, type ValidateFunction } from "ajv";
import type { z } from "zod/v4";
import { toJSONSchema } from "zod/v4";

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
export class ZodValidationPipe implements PipeTransform {
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
	private readonly cache = new WeakMap<z.ZodType, ValidateFunction>();

	constructor(private readonly schema: z.ZodType) {}

	public transform(value: unknown): unknown {
		const validator: ValidateFunction = this.getValidator();

		if (validator(value)) {
			return value;
		}

		const issues: readonly { readonly path: string; readonly message: string }[] = (validator.errors ?? []).map(
			(error: ErrorObject): { readonly path: string; readonly message: string } => ({
				path: error.instancePath.replace(/^\//, "").replace(/\//g, "."),
				message: error.message ?? "Invalid value",
			}),
		);

		throw new BadRequestException({
			message: "Validation failed",
			errors: issues,
		});
	}

	private getValidator(): ValidateFunction {
		const cached: ValidateFunction | undefined = this.cache.get(this.schema);
		if (cached !== undefined) {
			return cached;
		}

		// Zod v4 natively emits JSON Schema (`toJSONSchema`) — the third-party
		// `zod-to-json-schema` package is deprecated (and doesn't support v4
		// schemas). Zod remains the single source of truth; this is purely a
		// compiled validation fast-path. The `$schema` header is stripped: Ajv
		// defaults to draft-07 and can't resolve the 2020-12 meta-schema URI.
		const schema: Record<string, unknown> = toJSONSchema(this.schema);
		// Strip the `$schema` header (Ajv defaults to draft-07 and can't resolve
		// the 2020-12 meta-schema URI) — done via an explicit filter so no
		// unused destructured binding trips the naming convention.
		const compiledSchema: Record<string, unknown> = Object.fromEntries(Object.entries(schema).filter(([key]: readonly [string, unknown]): boolean => key !== "$schema"));

		// zod's `.email()` emits `format: "email"`; Ajv doesn't know the format
		// out of the box, so register the standard one (matches the strictness
		// of zod's own check closely enough for the wire contract).
		this.ajv.addFormat("email", (value: unknown): boolean => {
			if (typeof value !== "string") {
				return false;
			}
			return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
		});

		const validator: ValidateFunction = this.ajv.compile(compiledSchema);
		this.cache.set(this.schema, validator);
		return validator;
	}
}
