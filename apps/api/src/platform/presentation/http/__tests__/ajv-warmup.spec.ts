import Ajv from "ajv";
import { afterEach, describe, expect, it, vi } from "vitest";
import { z } from "zod";

import { AJV_WARMUP_BATCH_SIZE, warmupAjvValidators } from "../ajv-warmup";
import { ZodValidationPipe } from "../validation/pipes/zod-validation.pipe";

/** Fresh schemas (validators are cached per schema reference), more than one batch of them. */
function schemas(count: number): z.ZodType[] {
	return Array.from({ length: count }, (_unused: undefined, position: number): z.ZodType => z.object({ [`field${String(position)}`]: z.string().min(1) }).strict());
}

afterEach((): void => {
	vi.restoreAllMocks();
});

describe("warmupAjvValidators", () => {
	it("compiles nothing while the caller runs, then every schema in batches between turns of the event loop", async () => {
		const warmup = vi.spyOn(ZodValidationPipe, "warmup");
		const all = schemas(AJV_WARMUP_BATCH_SIZE * 2 + 1);

		const done = warmupAjvValidators(all);
		// Started from bootstrap after `listen`: the boot code that follows it is never held up.
		expect(warmup).not.toHaveBeenCalled();

		// One turn of the event loop runs one batch, leaving the rest for later turns.
		await new Promise<void>((resolve): void => {
			setImmediate(resolve);
		});
		expect(warmup).toHaveBeenCalledTimes(AJV_WARMUP_BATCH_SIZE);

		await expect(done).resolves.toBe(all.length);
		expect(warmup).toHaveBeenCalledTimes(all.length);
	});

	it("hands requests the validators it compiled: a pipe for a warmed schema compiles nothing", async () => {
		const [schema] = schemas(1);
		if (schema === undefined) {
			throw new Error("no schema");
		}
		await warmupAjvValidators([schema]);
		const compile = vi.spyOn(Ajv.prototype, "compile");

		expect(new ZodValidationPipe(schema).transform({ field0: "value" })).toEqual({ field0: "value" });
		expect(compile).not.toHaveBeenCalled();
	});
});
