/**
 * Pre-compile the Ajv validators of every `apiContract` input schema, once the API is up.
 *
 * The ZodValidationPipe compiles Zod → JSON Schema → Ajv on first use per schema, into one
 * cache every pipe shares. Compiling them all takes about two seconds of CPU, so it runs
 * AFTER the server listens and in small batches, yielding to the event loop between them:
 * requests are served meanwhile, and one that needs a schema not compiled yet compiles it
 * itself, as it would without the warmup.
 */
import { apiContract, CaughtValueSchema, isArrayValue } from "@workspace/shared";
import { readCaughtErrorMessage } from "../../infrastructure/utils/caught-error";
import { ZodValidationPipe } from "./validation/pipes/zod-validation.pipe";
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
export function collectSchemas(obj: ContractTreeValue, schemas: ZodV4.ZodType[] = []): ZodV4.ZodType[] {
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
		if (isArrayValue(value)) {
			for (const item of value) {
				if (isObjectLike(item) && !isZodSchema(item)) {
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

/** Schemas compiled per turn of the event loop: a few milliseconds of work between requests. */
export const AJV_WARMUP_BATCH_SIZE = 8;

/** Lets the event loop run (pending I/O, timers, requests) before the next batch. */
function yieldToEventLoop(): Promise<void> {
	return new Promise((resolve): void => {
		setImmediate(resolve);
	});
}

/**
 * Compiles `schemas` (by default every `apiContract` input schema) in batches of
 * {@link AJV_WARMUP_BATCH_SIZE}, yielding between batches; resolves with how many compiled.
 */
export async function warmupAjvValidators(schemas: readonly ZodV4.ZodType[] = collectSchemas(apiContract)): Promise<number> {
	const start = performance.now();
	let warmed = 0;
	for (let first = 0; first < schemas.length; first += AJV_WARMUP_BATCH_SIZE) {
		await yieldToEventLoop();
		for (const schema of schemas.slice(first, first + AJV_WARMUP_BATCH_SIZE)) {
			try {
				ZodValidationPipe.warmup(schema);
				warmed++;
			} catch (error) {
				// Not JSON-schema-compatible: the pipe compiles (or reports) it on first use, as without the warmup.
				logger.debug(`Skipped an Ajv warmup schema: ${readCaughtErrorMessage(CaughtValueSchema.parse(error))}`);
			}
		}
	}

	const elapsed = (performance.now() - start).toFixed(0);
	logger.log(`Pre-compiled ${String(warmed)} Ajv validators in ${elapsed}ms, between requests`);
	return warmed;
}
