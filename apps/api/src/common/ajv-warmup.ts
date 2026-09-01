/**
 * Pre-compile all Ajv validators at boot time.
 *
 * The ZodValidationPipe compiles Zod → JSON Schema → Ajv on first use per schema.
 * This function walks the apiContract tree and warms up every input schema so
 * the first request to each endpoint doesn't pay the compilation cost.
 */
import { apiContract } from "@workspace/shared";
import { ZodValidationPipe } from "./pipes/zod-validation.pipe";
import { Logger } from "@nestjs/common";

const logger = new Logger("AjvWarmup");

/** Walk a nested object tree and collect all Zod schemas (objects with _def). */
function collectSchemas(obj: unknown, schemas: unknown[] = []): unknown[] {
	if (obj === null || obj === undefined || typeof obj !== "object") return schemas;

	// If it looks like a Zod schema (has _def), collect it
	if ("_def" in obj && typeof obj._def === "object") {
		schemas.push(obj);
		return schemas;
	}

	// Recurse into object values
	for (const value of Object.values(obj as Record<string, unknown>)) {
		collectSchemas(value, schemas);
	}
	return schemas;
}

export function warmupAjvValidators(): void {
	const start = performance.now();
	const schemas = collectSchemas(apiContract);

	let warmed = 0;
	for (const schema of schemas) {
		try {
			ZodValidationPipe.warmup(schema as Parameters<typeof ZodValidationPipe.warmup>[0]);
			warmed++;
		} catch {
			// Some schemas may not be JSON-schema-compatible — skip silently
		}
	}

	const elapsed = (performance.now() - start).toFixed(0);
	logger.log(`Pre-compiled ${warmed} Ajv validators in ${elapsed}ms`);
}
