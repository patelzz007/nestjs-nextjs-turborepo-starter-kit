import { epochMs, type OpsDependency, type OpsHealth } from "@workspace/shared";
import { describe, expect, it } from "vitest";

import { overallStatus, publicComponentStatuses, STATUS_CHECK_STALE_MS, worstStatus, type MonitoredDependency } from "../policies/public-status.policy";

const NOW = epochMs(Date.UTC(2026, 10, 3, 12, 0));

function check(dependency: OpsDependency, health: OpsHealth, ageMs = 30_000, configured = true): MonitoredDependency {
	return { dependency, health, configured, checkedAt: epochMs(NOW - ageMs) };
}

const ALL_UP: readonly MonitoredDependency[] = [check("ENDPOINTS", "UP"), check("POSTGRES", "UP"), check("QUEUES", "UP"), check("REDIS", "UP")];

function statusOf(key: string, components: ReturnType<typeof publicComponentStatuses>): string | undefined {
	return components.find((component) => component.key === key)?.status;
}

describe("worstStatus", () => {
	it("takes the most serious, and OPERATIONAL for none", () => {
		expect(worstStatus(["OPERATIONAL", "DEGRADED", "UNKNOWN"])).toBe("DEGRADED");
		expect(worstStatus(["PARTIAL_OUTAGE", "MAJOR_OUTAGE"])).toBe("MAJOR_OUTAGE");
		expect(worstStatus([])).toBe("OPERATIONAL");
	});
});

describe("publicComponentStatuses", () => {
	it("reads every part as working when the monitor's recent checks are all up", () => {
		const components = publicComponentStatuses(ALL_UP, [], NOW);
		expect(components.map((component) => [component.key, component.status])).toStrictEqual([
			["api", "OPERATIONAL"],
			["database", "OPERATIONAL"],
			["background-jobs", "OPERATIONAL"],
		]);
		expect(components.at(0)?.label).toBe("Website, apps and API");
		expect(overallStatus(components)).toBe("OPERATIONAL");
	});

	it("takes the worst dependency a part rests on (Redis down takes background work down)", () => {
		const components = publicComponentStatuses([...ALL_UP.filter((entry) => entry.dependency !== "REDIS"), check("REDIS", "DOWN")], [], NOW);
		expect(statusOf("background-jobs", components)).toBe("MAJOR_OUTAGE");
		expect(statusOf("database", components)).toBe("OPERATIONAL");
		expect(overallStatus(components)).toBe("MAJOR_OUTAGE");
	});

	it("says UNKNOWN for a check too old to speak for now, or a part with nothing configured", () => {
		const stale = publicComponentStatuses([check("ENDPOINTS", "UP", STATUS_CHECK_STALE_MS + 1), check("POSTGRES", "UP")], [], NOW);
		expect(statusOf("api", stale)).toBe("UNKNOWN");
		expect(statusOf("background-jobs", stale)).toBe("UNKNOWN");
		expect(statusOf("database", stale)).toBe("OPERATIONAL");

		const unconfigured = publicComponentStatuses([check("ENDPOINTS", "UP"), check("POSTGRES", "UP"), check("QUEUES", "DOWN", 0, false), check("REDIS", "UP")], [], NOW);
		expect(statusOf("background-jobs", unconfigured)).toBe("OPERATIONAL");
	});

	it("lets an open incident make the parts it names look worse by its impact, never better", () => {
		const minor = publicComponentStatuses(ALL_UP, [{ impact: "MINOR", components: ["api"] }], NOW);
		expect(statusOf("api", minor)).toBe("DEGRADED");
		expect(statusOf("database", minor)).toBe("OPERATIONAL");

		const major = publicComponentStatuses(ALL_UP, [{ impact: "MAJOR", components: ["database", "api"] }], NOW);
		expect(statusOf("database", major)).toBe("PARTIAL_OUTAGE");
		expect(statusOf("api", major)).toBe("PARTIAL_OUTAGE");

		const down = publicComponentStatuses(
			[check("ENDPOINTS", "UP"), check("POSTGRES", "DOWN"), check("QUEUES", "UP"), check("REDIS", "UP")],
			[{ impact: "MINOR", components: ["database"] }],
			NOW,
		);
		expect(statusOf("database", down)).toBe("MAJOR_OUTAGE");
	});
});
