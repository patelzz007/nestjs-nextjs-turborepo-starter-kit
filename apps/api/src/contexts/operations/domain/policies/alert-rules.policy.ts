// ============================================
// domain/policies/alert-rules.policy.ts — which alerts should be open, and what to change
// ============================================
// Design patterns:
//   - Pure functions (no I/O): the evaluator gathers readings, these decide.
//   - Single Responsibility: `findBreaches` turns readings into breaches; `reconcileAlerts` turns
//     breaches and the open alerts into the changes to make. Neither knows how alerts are stored
//     or emailed.

import type { EpochMs, OpsAlertRule, OpsAlertSettings, OpsAlertSubjectKind, OpsDependency } from "@workspace/shared";

const MS_PER_MINUTE = 60_000;

/** One server's readings, as the evaluator saw them. */
export interface ServerReading {
	readonly id: string;
	readonly name: string;
	readonly lastSeenAt: EpochMs | null;
	/** The CPU averages of its latest minutes, newest first. */
	readonly recentCpuAverages: readonly number[];
	readonly memoryPercent: number | null;
	/** Its fullest disk. */
	readonly diskPercent: number | null;
}

/** One instance that has reported and has not shut down cleanly. */
export interface InstanceReading {
	readonly id: string;
	readonly name: string;
	readonly lastSeenAt: EpochMs;
}

export interface DependencyReading {
	readonly dependency: OpsDependency;
	readonly configured: boolean;
	readonly down: boolean;
	readonly error: string | null;
}

export interface EndpointReading {
	readonly url: string;
	readonly up: boolean;
	readonly tlsDaysLeft: number | null;
}

export interface Readings {
	readonly servers: readonly ServerReading[];
	readonly instances: readonly InstanceReading[];
	readonly dependencies: readonly DependencyReading[];
	readonly endpoints: readonly EndpointReading[];
}

/** A condition that is true right now and should have an open alert. */
export interface Breach {
	readonly subjectKind: OpsAlertSubjectKind;
	readonly subjectId: string;
	readonly subjectName: string;
	readonly rule: OpsAlertRule;
	readonly value: number | null;
	readonly threshold: number | null;
	readonly message: string;
}

/** An alert that is open now, as stored. */
export interface OpenAlert {
	readonly id: string;
	readonly subjectKind: OpsAlertSubjectKind;
	readonly subjectId: string;
	readonly rule: OpsAlertRule;
	readonly peakValue: number | null;
}

/** What to change: alerts to open, open alerts to update (still breached), and alerts to resolve. */
export interface AlertChanges {
	readonly open: readonly Breach[];
	readonly update: readonly { readonly id: string; readonly lastValue: number | null; readonly peakValue: number | null }[];
	readonly resolve: readonly string[];
}

function rounded(value: number): string {
	return value.toFixed(0);
}

function serverBreaches(server: ServerReading, settings: OpsAlertSettings, now: EpochMs): Breach[] {
	const base: Pick<Breach, "subjectKind" | "subjectId" | "subjectName"> = { subjectKind: "SERVER", subjectId: server.id, subjectName: server.name };
	const breaches: Breach[] = [];
	const silentAfterMs: number = settings.silentAfterMinutes * MS_PER_MINUTE;
	if (server.lastSeenAt !== null && now - server.lastSeenAt > silentAfterMs) {
		const silentMinutes: number = (now - server.lastSeenAt) / MS_PER_MINUTE;
		breaches.push({
			...base,
			rule: "SILENT",
			value: silentMinutes,
			threshold: settings.silentAfterMinutes,
			message: `${server.name} has not reported for ${rounded(silentMinutes)} minutes`,
		});
		return breaches;
	}
	const sustained: readonly number[] = server.recentCpuAverages.slice(0, settings.cpuSustainMinutes);
	if (sustained.length === settings.cpuSustainMinutes && sustained.every((cpu) => cpu >= settings.cpuPercent)) {
		const value: number = Math.max(...sustained);
		breaches.push({
			...base,
			rule: "CPU_HIGH",
			value,
			threshold: settings.cpuPercent,
			message: `${server.name} CPU has been above ${String(settings.cpuPercent)}% for ${String(settings.cpuSustainMinutes)} minutes (peak ${rounded(value)}%)`,
		});
	}
	if (server.memoryPercent !== null && server.memoryPercent >= settings.memoryPercent) {
		breaches.push({
			...base,
			rule: "MEMORY_HIGH",
			value: server.memoryPercent,
			threshold: settings.memoryPercent,
			message: `${server.name} memory is at ${rounded(server.memoryPercent)}%`,
		});
	}
	if (server.diskPercent !== null && server.diskPercent >= settings.diskPercent) {
		breaches.push({
			...base,
			rule: "DISK_HIGH",
			value: server.diskPercent,
			threshold: settings.diskPercent,
			message: `${server.name} disk is ${rounded(server.diskPercent)}% full`,
		});
	}
	return breaches;
}

/** Every condition that should have an open alert now. */
export function findBreaches(readings: Readings, settings: OpsAlertSettings, now: EpochMs): Breach[] {
	const silentAfterMs: number = settings.silentAfterMinutes * MS_PER_MINUTE;
	return [
		...readings.servers.flatMap((server) => serverBreaches(server, settings, now)),
		...readings.instances.flatMap((instance): Breach[] => {
			const silentMs: number = now - instance.lastSeenAt;
			return silentMs > silentAfterMs
				? [
						{
							subjectKind: "INSTANCE",
							subjectId: instance.id,
							subjectName: instance.name,
							rule: "SILENT",
							value: silentMs / MS_PER_MINUTE,
							threshold: settings.silentAfterMinutes,
							message: `Instance ${instance.name} stopped reporting ${rounded(silentMs / MS_PER_MINUTE)} minutes ago`,
						},
					]
				: [];
		}),
		...readings.dependencies.flatMap((dependency): Breach[] =>
			dependency.configured && dependency.down
				? [
						{
							subjectKind: "DEPENDENCY",
							subjectId: dependency.dependency,
							subjectName: dependency.dependency,
							rule: "DEPENDENCY_DOWN",
							value: null,
							threshold: null,
							message: `${dependency.dependency} is down${dependency.error === null ? "" : `: ${dependency.error}`}`,
						},
					]
				: [],
		),
		...readings.endpoints.flatMap((endpoint): Breach[] => {
			const breaches: Breach[] = [];
			if (!endpoint.up) {
				breaches.push({
					subjectKind: "ENDPOINT",
					subjectId: endpoint.url,
					subjectName: endpoint.url,
					rule: "ENDPOINT_DOWN",
					value: null,
					threshold: null,
					message: `${endpoint.url} is not answering`,
				});
			}
			if (endpoint.tlsDaysLeft !== null && endpoint.tlsDaysLeft <= settings.tlsWarnDays) {
				breaches.push({
					subjectKind: "ENDPOINT",
					subjectId: endpoint.url,
					subjectName: endpoint.url,
					rule: "TLS_EXPIRING",
					value: endpoint.tlsDaysLeft,
					threshold: settings.tlsWarnDays,
					message: `The TLS certificate of ${endpoint.url} expires in ${String(endpoint.tlsDaysLeft)} days`,
				});
			}
			return breaches;
		}),
	];
}

function keyOf(alert: { readonly subjectKind: OpsAlertSubjectKind; readonly subjectId: string; readonly rule: OpsAlertRule }): string {
	return `${alert.subjectKind}\u0000${alert.subjectId}\u0000${alert.rule}`;
}

/**
 * The changes that make the open alerts match the breaches: one open alert per breach (opened if it
 * has none, its peak and latest value updated if it has), and every other open alert resolved.
 */
export function reconcileAlerts(openAlerts: readonly OpenAlert[], breaches: readonly Breach[]): AlertChanges {
	const breachByKey = new Map<string, Breach>(breaches.map((breach): [string, Breach] => [keyOf(breach), breach]));
	const openKeys = new Set<string>(openAlerts.map(keyOf));
	return {
		open: [...breachByKey.values()].filter((breach) => !openKeys.has(keyOf(breach))),
		update: openAlerts.flatMap((alert) => {
			const breach: Breach | undefined = breachByKey.get(keyOf(alert));
			if (breach === undefined) {
				return [];
			}
			const peakValue: number | null = breach.value === null ? alert.peakValue : Math.max(alert.peakValue ?? breach.value, breach.value);
			return [{ id: alert.id, lastValue: breach.value, peakValue }];
		}),
		resolve: openAlerts.filter((alert) => !breachByKey.has(keyOf(alert))).map((alert) => alert.id),
	};
}
