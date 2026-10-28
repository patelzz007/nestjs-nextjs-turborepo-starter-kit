import { LOAD_TEST_SCENARIOS, LoadTestScenarioSchema } from "@workspace/shared";
import { describe, expect, it } from "vitest";

import { k6RunConfig, scenarioWeights } from "../k6-config";
import { loadTestJob } from "./fixtures";

describe("scenarioWeights", () => {
	it("runs one scenario at weight 1", () => {
		expect(scenarioWeights({ target: "SCENARIO", scenario: "browse-marketplace", mixWeights: null })).toEqual([{ scenario: "browse-marketplace", weight: 1 }]);
	});

	it("uses a mix's weights, falling back to the defaults and leaving zeros out", () => {
		const weights = scenarioWeights({ target: "MIX", scenario: null, mixWeights: { "browse-marketplace": 0, "claim-reward": 7 } });

		expect(weights.find((entry) => entry.scenario === "browse-marketplace")).toBeUndefined();
		expect(weights.find((entry) => entry.scenario === "claim-reward")?.weight).toBe(7);
		const others = LoadTestScenarioSchema.options.filter(
			(scenario) => scenario !== "browse-marketplace" && scenario !== "claim-reward" && LOAD_TEST_SCENARIOS[scenario].defaultWeight > 0,
		);
		expect(weights).toHaveLength(others.length + 1);
	});

	it("has no scenarios for one endpoint", () => {
		expect(scenarioWeights({ target: "ENDPOINT", scenario: null, mixWeights: null })).toEqual([]);
	});
});

describe("k6RunConfig", () => {
	it("plans the job: its stages, scenarios and users, without a trailing slash on the address", () => {
		const config = k6RunConfig(loadTestJob(), undefined);

		expect(config.baseUrl).toBe("http://localhost:8080");
		expect(config.endpoint).toBeNull();
		expect(config.scenarios).toEqual([{ scenario: "browse-marketplace", weight: 1 }]);
		expect(config.stages.reduce((sum, stage) => sum + stage.durationSeconds, 0)).toBe(30);
		expect(config.trafficKey).toBe("key");
	});

	it("targets the override address and one endpoint when asked", () => {
		const config = k6RunConfig(loadTestJob({ target: "ENDPOINT", scenario: null, endpoint: "/rewards" }), "http://host.docker.internal:8080");

		expect(config.baseUrl).toBe("http://host.docker.internal:8080");
		expect(config.endpoint).toBe("/rewards");
	});
});
