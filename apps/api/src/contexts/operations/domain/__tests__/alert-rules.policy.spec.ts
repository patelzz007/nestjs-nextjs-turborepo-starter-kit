import { epochMs, type OpsAlertSettings } from "@workspace/shared";
import { describe, expect, it } from "vitest";

import { type Breach, findBreaches, type Readings, reconcileAlerts, type ServerReading } from "../policies/alert-rules.policy";

const MINUTE = 60_000;
const NOW = epochMs(1_000 * MINUTE);
const SETTINGS: OpsAlertSettings = { cpuPercent: 90, cpuSustainMinutes: 3, memoryPercent: 90, diskPercent: 85, silentAfterMinutes: 3, tlsWarnDays: 14, extraRecipients: [] };
const NONE: Readings = { servers: [], instances: [], dependencies: [], endpoints: [] };

function server(overrides: Partial<ServerReading> = {}): ServerReading {
	return { id: "s1", name: "web-01", lastSeenAt: NOW, recentCpuAverages: [10, 10, 10], memoryPercent: 50, diskPercent: 50, ...overrides };
}

function rulesOf(readings: Partial<Readings>): string[] {
	return findBreaches({ ...NONE, ...readings }, SETTINGS, NOW).map((breach) => `${breach.subjectKind}:${breach.rule}`);
}

describe("findBreaches", () => {
	it("finds nothing on a healthy platform", () => {
		expect(rulesOf({ servers: [server()] })).toEqual([]);
	});

	it("opens CPU only when every minute of the sustain window is over the threshold", () => {
		expect(rulesOf({ servers: [server({ recentCpuAverages: [95, 92, 91] })] })).toEqual(["SERVER:CPU_HIGH"]);
		expect(rulesOf({ servers: [server({ recentCpuAverages: [95, 92, 40] })] })).toEqual([]);
		expect(rulesOf({ servers: [server({ recentCpuAverages: [95, 92] })] })).toEqual([]);
	});

	it("opens memory and disk at their thresholds", () => {
		expect(rulesOf({ servers: [server({ memoryPercent: 90, diskPercent: 85 })] })).toEqual(["SERVER:MEMORY_HIGH", "SERVER:DISK_HIGH"]);
	});

	it("reports a silent server as SILENT alone (its old figures say nothing now)", () => {
		expect(rulesOf({ servers: [server({ lastSeenAt: epochMs(NOW - 4 * MINUTE), memoryPercent: 99 })] })).toEqual(["SERVER:SILENT"]);
		expect(rulesOf({ servers: [server({ lastSeenAt: null })] })).toEqual([]);
	});

	it("covers instances, dependencies and endpoints", () => {
		expect(
			rulesOf({
				instances: [
					{ id: "i1", name: "api", lastSeenAt: epochMs(NOW - 4 * MINUTE) },
					{ id: "i2", name: "api", lastSeenAt: NOW },
				],
				dependencies: [
					{ dependency: "KAFKA", configured: true, down: true, error: "ECONNREFUSED" },
					{ dependency: "RABBITMQ", configured: false, down: true, error: null },
				],
				endpoints: [
					{ url: "https://a.example", up: false, tlsDaysLeft: 100 },
					{ url: "https://b.example", up: true, tlsDaysLeft: 14 },
				],
			}),
		).toEqual(["INSTANCE:SILENT", "DEPENDENCY:DEPENDENCY_DOWN", "ENDPOINT:ENDPOINT_DOWN", "ENDPOINT:TLS_EXPIRING"]);
	});

	it("says what happened in its message", () => {
		const [breach] = findBreaches({ ...NONE, dependencies: [{ dependency: "KAFKA", configured: true, down: true, error: "ECONNREFUSED" }] }, SETTINGS, NOW);
		expect(breach?.message).toBe("KAFKA is down: ECONNREFUSED");
	});
});

describe("reconcileAlerts", () => {
	const breach = (rule: Breach["rule"], value: number | null): Breach => ({
		subjectKind: "SERVER",
		subjectId: "s1",
		subjectName: "web-01",
		rule,
		value,
		threshold: 90,
		message: "m",
	});

	it("opens new breaches, updates still-breached alerts with their peak, and resolves the rest", () => {
		const changes = reconcileAlerts(
			[
				{ id: "a-cpu", subjectKind: "SERVER", subjectId: "s1", rule: "CPU_HIGH", peakValue: 97 },
				{ id: "a-disk", subjectKind: "SERVER", subjectId: "s1", rule: "DISK_HIGH", peakValue: 88 },
			],
			[breach("CPU_HIGH", 93), breach("MEMORY_HIGH", 91)],
		);

		expect(changes.open.map((entry) => entry.rule)).toEqual(["MEMORY_HIGH"]);
		expect(changes.update).toEqual([{ id: "a-cpu", lastValue: 93, peakValue: 97 }]);
		expect(changes.resolve).toEqual(["a-disk"]);
	});

	it("raises the peak when the value climbs, and keeps it for value-less rules", () => {
		expect(reconcileAlerts([{ id: "a", subjectKind: "SERVER", subjectId: "s1", rule: "CPU_HIGH", peakValue: 91 }], [breach("CPU_HIGH", 99)]).update).toEqual([
			{ id: "a", lastValue: 99, peakValue: 99 },
		]);
		expect(reconcileAlerts([{ id: "a", subjectKind: "SERVER", subjectId: "s1", rule: "SILENT", peakValue: 5 }], [breach("SILENT", null)]).update).toEqual([
			{ id: "a", lastValue: null, peakValue: 5 },
		]);
	});
});
