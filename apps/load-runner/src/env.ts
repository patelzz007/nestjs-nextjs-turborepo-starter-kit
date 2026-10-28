// The load runner's configuration: the ONE place it reads process.env (oxlint enforces it).

import { BooleanFlagEnvSchema } from "@workspace/shared";
import { z } from "zod";

const RunnerEnvSchema = z.object({
	/** The same Redis the API uses: the runner takes jobs from its `operations.load-test` queue. */
	REDIS_URL: z.string().min(1),
	/** The API's BullMQ prefix (`BULLMQ_PREFIX`, default `bull`). */
	BULLMQ_PREFIX: z.string().min(1).default("bull"),
	/**
	 * Overrides the address each job names: in Docker on a laptop the API is not at `localhost`
	 * but at `http://host.docker.internal:8080`.
	 */
	LOAD_TEST_TARGET_URL: z.url().optional(),
	/** The k6 binary (the runner's image ships it). */
	K6_BINARY: z.string().min(1).default("k6"),
	/** Writes k6's own console output to the runner's log. */
	K6_VERBOSE: BooleanFlagEnvSchema,
});

export type RunnerEnv = z.output<typeof RunnerEnvSchema>;

export function loadRunnerEnv(source: Readonly<Record<string, string | undefined>> = process.env): RunnerEnv {
	return RunnerEnvSchema.parse(source);
}
