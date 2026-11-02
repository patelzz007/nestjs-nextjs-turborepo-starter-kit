import { epochMs, type OpsAlertSettings } from "@workspace/shared";
import { describe, expect, it } from "vitest";

import { type Breach, findBreaches, type InstanceReading, type Readings, reconcileAlerts, replacedInstanceIds, type ServerReading } from "../policies/alert-rules.policy";

const MINUTE = 60_000;
const NOW = epochMs(1_000 * MINUTE);
const SETTINGS: OpsAlertSettings = { cpuPercent: 90, cpuSustainMinutes: 3, memoryPercent: 90, diskPercent: 85, silentAfterMinutes: 3, tlsWarnDays: 14, extraRecipients: [] };
const NONE: Readings = { servers: [], instances: [], dependencies: [], endpoints: [] };

function server(overrides: Partial<ServerReading> = {}): ServerReading {
	return { id: "s1", name: "web-01", lastSeenAt: NOW, recentCpuAverages: [10, 10, 10], memoryPercent: 50, diskPercent: 50, ...overrides };
}

/** An API process on web-01, started an hour before NOW and reporting until NOW. */
function instance(overrides: Partial<InstanceReading> = {}): InstanceReading {
	return { id: "i1", name: "api", service: "api", hostname: "web-01", startedAt: epochMs(NOW - 60 * MINUTE), lastSeenAt: NOW, ...overrides };
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
				instances: [instance({ id: "i1", lastSeenAt: epochMs(NOW - 4 * MINUTE) }), instance({ id: "i2", hostname: "web-02" })],
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

	it("treats a process a newer one of its service replaced on its host as restarted, not silent", () => {
		const old = instance({ id: "old", startedAt: epochMs(NOW - 90 * MINUTE), lastSeenAt: epochMs(NOW - 30 * MINUTE) });
		const restarted = instance({ id: "new", startedAt: epochMs(NOW - 29 * MINUTE) });

		expect(rulesOf({ instances: [old, restarted] })).toEqual([]);
		expect([...replacedInstanceIds([old, restarted])]).toEqual(["old"]);
	});

	it("forgets every earlier process after many restarts, alerting for none of them", () => {
		const restarts = [1, 2, 3, 4].map((step) =>
			instance({ id: `pid-${String(step)}`, startedAt: epochMs(NOW - (50 - step * 10) * MINUTE), lastSeenAt: epochMs(NOW - (45 - step * 10) * MINUTE) }),
		);
		const live = instance({ id: "pid-5", startedAt: epochMs(NOW - 2 * MINUTE) });

		expect(rulesOf({ instances: [...restarts, live] })).toEqual([]);
		expect([...replacedInstanceIds([...restarts, live])].toSorted()).toEqual(["pid-1", "pid-2", "pid-3", "pid-4"]);
	});

	it("still reports a process nothing replaced: a crash on a host whose other worker started before it went quiet, or another host", () => {
		const crashed = instance({ id: "crashed", startedAt: epochMs(NOW - 60 * MINUTE), lastSeenAt: epochMs(NOW - 10 * MINUTE) });
		const sibling = instance({ id: "sibling", startedAt: epochMs(NOW - 60 * MINUTE) });
		const elsewhere = instance({ id: "elsewhere", hostname: "web-02", startedAt: epochMs(NOW - MINUTE) });
		const otherService = instance({ id: "worker", service: "worker", startedAt: epochMs(NOW - MINUTE) });

		expect(rulesOf({ instances: [crashed, sibling, elsewhere, otherService] })).toEqual(["INSTANCE:SILENT"]);
		expect(replacedInstanceIds([crashed, sibling, elsewhere, otherService]).size).toBe(0);
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
