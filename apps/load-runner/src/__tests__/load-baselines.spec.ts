// The nightly gate's load-baselines.json (enhancement 3.9) against the load runner's own contract: the
// run it starts must be one the API accepts within the default caps, and its endpoint groups must hold
// exactly the steps the run's scenarios make (a scenario that gains a step must put it in a group).

import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { LOAD_TEST_DEFAULT_CAPS, LOAD_TEST_SCENARIOS, LoadTestMixWeightsSchema, StartLoadTestSchema } from "@workspace/shared";
import { describe, expect, it } from "vitest";
import { z } from "zod";

import { scenarioWeights } from "../k6-config";

/** The parts of load-baselines.json checked here (packages/tooling/scripts/lib/load-baselines.mjs owns the full shape). */
const BaselinesSchema = z.object({
	run: z.object({
		name: z.string(),
		shape: z.enum(["CONSTANT", "RAMP", "SPIKE", "SOAK"]),
		virtualUsers: z.number(),
		requestsPerSecond: z.number(),
		durationSeconds: z.number(),
		mixWeights: LoadTestMixWeightsSchema,
	}),
	total: z.object({ p95Ms: z.number(), maxErrorPercent: z.number() }),
	groups: z.record(z.string(), z.object({ steps: z.array(z.string()) })),
});

const baselines = BaselinesSchema.parse(JSON.parse(readFileSync(resolve(import.meta.dirname, "../../../../load-baselines.json"), "utf8")));
const SECONDS_PER_MINUTE = 60;
/** Every scenario signs its user in first (k6-script.ts `signIn`), whichever scenarios the mix holds. */
const SIGN_IN_STEP = "login";

describe("load-baselines.json", () => {
	it("starts a traffic mix the API accepts, within the default load-test caps", () => {
		const { run, total } = baselines;
		const body = StartLoadTestSchema.parse({
			name: run.name,
			target: "MIX",
			scenario: null,
			endpoint: null,
			mixWeights: run.mixWeights,
			shape: run.shape,
			virtualUsers: run.virtualUsers,
			requestsPerSecond: run.requestsPerSecond,
			durationSeconds: run.durationSeconds,
			thresholdP95Ms: total.p95Ms,
			thresholdErrorPercent: total.maxErrorPercent,
		});

		expect(body.virtualUsers).toBeLessThanOrEqual(LOAD_TEST_DEFAULT_CAPS.maxVirtualUsers);
		expect(body.requestsPerSecond).toBeLessThanOrEqual(LOAD_TEST_DEFAULT_CAPS.maxRequestsPerSecond);
		expect(body.durationSeconds).toBeLessThanOrEqual(LOAD_TEST_DEFAULT_CAPS.maxMinutes * SECONDS_PER_MINUTE);
	});

	it("puts every step the run makes in exactly one endpoint group, and names no other step", () => {
		const made: string[] = [
			SIGN_IN_STEP,
			...scenarioWeights({ target: "MIX", scenario: null, mixWeights: baselines.run.mixWeights }).flatMap(({ scenario }) => LOAD_TEST_SCENARIOS[scenario].steps),
		];
		const grouped: string[] = Object.values(baselines.groups).flatMap((group) => group.steps);

		expect(new Set(grouped).size).toBe(grouped.length);
		expect([...new Set(grouped)].toSorted()).toEqual([...new Set(made)].toSorted());
	});
});
