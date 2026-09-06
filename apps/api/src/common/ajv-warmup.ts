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
import type { z as ZodV4 } from "zod/v4";
import { z } from "zod";

const logger = new Logger("AjvWarmup");

type ContractTreeValue = string | number | boolean | null | object;

const objectLikeSchema = z.looseObject({});

function isObjectLike(value: ContractTreeValue): value is Record<string, ContractTreeValue> {
	return objectLikeSchema.safeParse(value).success;
}

function isZodSchema(value: ContractTreeValue): value is ZodV4.ZodType {
	if (!isObjectLike(value)) {
		return false;
	}
	return "_def" in value;
}

/** Walk a nested object tree and collect all Zod schemas (objects with _def). */
function collectSchemas(obj: ContractTreeValue, schemas: ZodV4.ZodType[] = []): ZodV4.ZodType[] {
	if (!isObjectLike(obj)) {
		return schemas;
	}
	if (isZodSchema(obj)) {
		schemas.push(obj);
		return schemas;
	}

	for (const value of Object.values(obj)) {
		if (value === null) {
			continue;
		}
		if (isZodSchema(value)) {
			schemas.push(value);
			continue;
		}
		if (Array.isArray(value)) {
			for (const item of value) {
				if (item !== null && isObjectLike(item) && !isZodSchema(item)) {
					collectSchemas(item, schemas);
				}
			}
			continue;
		}
		if (isObjectLike(value)) {
			collectSchemas(value, schemas);
		}
	}

	return schemas;
}

export function warmupAjvValidators(): void {
	const start = performance.now();
	const schemas = collectSchemas(apiContract);

	let warmed = 0;
	for (const schema of schemas) {
		try {
			ZodValidationPipe.warmup(schema);
			warmed++;
		} catch {
			// Some schemas may not be JSON-schema-compatible — skip silently
		}
	}

	const elapsed = (performance.now() - start).toFixed(0);
	logger.log(`Pre-compiled ${String(warmed)} Ajv validators in ${elapsed}ms`);
}
