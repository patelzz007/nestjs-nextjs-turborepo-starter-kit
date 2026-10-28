// ============================================
// k6-config.ts — the file the k6 script reads: one run's plan
// ============================================
// Pure function (no I/O): a queued job in, the k6 configuration out — the target, the stages of
// its shape, the scenario weights and the load-test users.

import { LOAD_TEST_SCENARIOS, loadTestStages, LoadTestScenarioSchema, type LoadTestJob, type LoadTestScenario, type LoadTestStage } from "@workspace/shared";

/** What `k6-script.ts` reads (`open(__ENV.LOAD_TEST_CONFIG)`). */
export interface K6RunConfig {
	readonly baseUrl: string;
	readonly apiPrefix: string;
	readonly origins: LoadTestJob["origins"];
	readonly trafficKey: string;
	readonly tenantSlug: string;
	readonly virtualUsers: number;
	readonly stages: readonly LoadTestStage[];
	/** `ENDPOINT` runs call this one path; otherwise the scenarios below run, by weight. */
	readonly endpoint: string | null;
	readonly scenarios: readonly { readonly scenario: LoadTestScenario; readonly weight: number }[];
	readonly customers: LoadTestJob["customers"];
	readonly staff: LoadTestJob["staff"];
}

/** The scenarios a run picks from, with their weights (one scenario: weight 1; a mix: its weights, zeros left out). */
export function scenarioWeights(job: Pick<LoadTestJob, "target" | "scenario" | "mixWeights">): { scenario: LoadTestScenario; weight: number }[] {
	if (job.target === "SCENARIO" && job.scenario !== null) {
		return [{ scenario: job.scenario, weight: 1 }];
	}
	if (job.target === "MIX") {
		return LoadTestScenarioSchema.options.flatMap((scenario) => {
			const weight: number = job.mixWeights?.[scenario] ?? LOAD_TEST_SCENARIOS[scenario].defaultWeight;
			return weight > 0 ? [{ scenario, weight }] : [];
		});
	}
	return [];
}

export function k6RunConfig(job: LoadTestJob, targetOverride: string | undefined): K6RunConfig {
	return {
		baseUrl: (targetOverride ?? job.baseUrl).replace(/\/$/, ""),
		apiPrefix: job.apiPrefix,
		origins: job.origins,
		trafficKey: job.trafficKey,
		tenantSlug: job.tenantSlug,
		virtualUsers: job.virtualUsers,
		stages: loadTestStages(job.shape, job.requestsPerSecond, job.durationSeconds),
		endpoint: job.target === "ENDPOINT" ? job.endpoint : null,
		scenarios: scenarioWeights(job),
		customers: job.customers,
		staff: job.staff,
	};
}
