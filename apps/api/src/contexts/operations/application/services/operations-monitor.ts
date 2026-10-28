// ============================================
// application/services/operations-monitor.ts — the minute's collection and the alert evaluation
// ============================================
// Once a minute, on ONE instance (a short Redis lock): check every dependency, record their minute,
// evaluate the alert rules, and open / update / resolve alerts with their emails — all in one unit of
// work, so an alert and its email commit together (ADR 060).
// Design patterns:
//   - Strategy (the probes) + pure policies (`findBreaches`, `reconcileAlerts`) composed here;
//     this class only orchestrates (Single Responsibility).

import { epochMs, OPS_MINUTE_MS, type EpochMs, type OpsAlert, type OpsDependencyStatus, type OpsHealth } from "@workspace/shared";

import type { ActorContext } from "../../../../platform/application/actor-context";
import type { Clock } from "../../../../platform/application/clock.port";
import type { UnitOfWork } from "../../../../platform/application/unit-of-work.port";
import { AdminAlertEmailTemplate } from "../../../notifications/public-api";
import { findBreaches, reconcileAlerts, type EndpointReading, type InstanceReading, type Readings, type ServerReading } from "../../domain/policies/alert-rules.policy";
import { percentOf } from "../../domain/policies/health.policy";
import { bucketStartOf } from "../../domain/policies/history-window.policy";
import type { OperationsScope } from "../operations-scope";
import type { DependencyProbe, DependencyProbeResult } from "../ports/dependency-probe.port";
import type { OpsLiveStore } from "../ports/ops-live-store.port";
import { OPS_MONITOR_COLLECT_OPERATION } from "../ports/operations.tokens";

const HUNDRED = 100;
/** The live-store lock name of the minute's collection. */
const COLLECT_JOB = "collect";

export interface OperationsMonitorDeps {
	readonly uow: UnitOfWork<OperationsScope>;
	readonly live: OpsLiveStore;
	readonly probes: readonly DependencyProbe[];
	readonly clock: Clock;
	readonly actor: ActorContext;
	/** The admin panel's address, for the alert email's button. */
	readonly adminAppUrl: string;
}

function toStatus(probe: DependencyProbe, result: DependencyProbeResult, at: EpochMs): OpsDependencyStatus {
	if (!result.configured) {
		return { dependency: probe.dependency, health: "UNKNOWN", configured: false, latencyMs: null, checkedAt: at, error: null, stats: null };
	}
	const health: OpsHealth = result.up ? "UP" : "DOWN";
	return {
		dependency: probe.dependency,
		health,
		configured: true,
		latencyMs: result.latencyMs,
		checkedAt: at,
		error: result.up ? null : result.error,
		stats: result.up ? result.stats : null,
	};
}

/** The figure columns of a dependency's minute, from its stats. */
function figuresOf(status: OpsDependencyStatus): {
	connectionsUsed: number | null;
	sizeBytes: number | null;
	memoryUsedBytes: number | null;
	backlog: number | null;
	failed: number | null;
} {
	const empty = { connectionsUsed: null, sizeBytes: null, memoryUsedBytes: null, backlog: null, failed: null };
	const { stats } = status;
	if (stats === null) {
		return empty;
	}
	switch (stats.dependency) {
		case "POSTGRES":
			return { ...empty, connectionsUsed: stats.connectionsUsed, sizeBytes: stats.sizeBytes };
		case "REDIS":
			return { ...empty, connectionsUsed: stats.connectedClients, memoryUsedBytes: stats.usedMemoryBytes };
		case "QUEUES":
			return {
				...empty,
				backlog: stats.queues.reduce((total, queue) => total + queue.waiting + queue.delayed, 0),
				failed: stats.queues.reduce((total, queue) => total + queue.failed, 0),
			};
		case "KAFKA":
			return { ...empty, backlog: stats.consumerLag };
		case "RABBITMQ":
		case "ENDPOINTS":
			return empty;
	}
}

export class OperationsMonitor {
	public constructor(private readonly deps: OperationsMonitorDeps) {}

	/** The minute's collection, if this instance wins the minute's lock. Returns whether it ran. */
	public async collectMinute(): Promise<boolean> {
		const now: EpochMs = this.deps.clock.now();
		const bucketStart: EpochMs = bucketStartOf(now, "MINUTE");
		if (!(await this.deps.live.claimMinute(COLLECT_JOB, bucketStart))) {
			return false;
		}
		const statuses: OpsDependencyStatus[] = await Promise.all(this.deps.probes.map(async (probe) => toStatus(probe, await probe.probe(), now)));
		await this.deps.live.putDependencies(statuses);
		const instances = await this.deps.live.instances();
		await this.deps.uow.runSystemOperation(OPS_MONITOR_COLLECT_OPERATION, this.deps.actor, async (scope): Promise<void> => {
			for (const status of statuses.filter((entry) => entry.configured)) {
				await scope.history.putDependencyPoint(status.dependency, "MINUTE", {
					bucketStart,
					upPercent: status.health === "UP" ? HUNDRED : 0,
					latencyMsAvg: status.latencyMs,
					...figuresOf(status),
				});
			}
			const settings = await scope.settings.get();
			const servers = await scope.servers.list();
			const live = await this.deps.live.serverLive(servers.map((server) => server.id));
			const serverReadings: ServerReading[] = await Promise.all(
				servers.map(async (server): Promise<ServerReading> => {
					const sample = live.get(server.id) ?? null;
					return {
						id: server.id,
						name: server.name,
						lastSeenAt: server.lastSeenAt,
						recentCpuAverages: await scope.history.recentServerCpu(server.id, settings.alerts.cpuSustainMinutes),
						memoryPercent: sample === null ? null : percentOf(sample.memoryUsedBytes, sample.memoryTotalBytes),
						diskPercent: sample === null || sample.disks.length === 0 ? null : Math.max(...sample.disks.map((disk) => percentOf(disk.usedBytes, disk.totalBytes))),
					};
				}),
			);
			const instanceReadings: InstanceReading[] = instances.map((instance) => ({
				id: instance.instanceId,
				name: `${instance.service} on ${instance.hostname} (pid ${String(instance.pid)})`,
				lastSeenAt: instance.sampledAt,
			}));
			const endpointReadings: EndpointReading[] = statuses.flatMap((status) =>
				status.stats?.dependency === "ENDPOINTS" ? status.stats.endpoints.map((endpoint) => ({ url: endpoint.url, up: endpoint.up, tlsDaysLeft: endpoint.tlsDaysLeft })) : [],
			);
			const readings: Readings = {
				servers: serverReadings,
				instances: instanceReadings,
				dependencies: statuses
					.filter((status) => status.dependency !== "ENDPOINTS")
					.map((status) => ({ dependency: status.dependency, configured: status.configured, down: status.health === "DOWN", error: status.error })),
				endpoints: endpointReadings,
			};
			const changes = reconcileAlerts(await scope.alerts.listOpen(), findBreaches(readings, settings.alerts, now));
			const recipients: string[] = [...new Set([...(await scope.recipients.superAdminEmails()), ...settings.alerts.extraRecipients].map((email) => email.toLowerCase()))];
			for (const breach of changes.open) {
				const alert: OpsAlert = await scope.alerts.open(breach, now);
				await this.notify(scope, alert, "open", recipients, now);
			}
			for (const update of changes.update) {
				await scope.alerts.update(update.id, update);
			}
			for (const alertId of changes.resolve) {
				const alert: OpsAlert = await scope.alerts.resolve(alertId, now);
				await this.notify(scope, alert, "resolve", recipients, now);
			}
		});
		return true;
	}

	/** One alert email per recipient, in the same transaction as the alert row. */
	private async notify(scope: OperationsScope, alert: OpsAlert, kind: "open" | "resolve", recipients: readonly string[], now: EpochMs): Promise<void> {
		const title: string = kind === "open" ? `Alert: ${alert.message}` : `Resolved: ${alert.message}`;
		const openedFor: string =
			kind === "resolve" && alert.resolvedAt !== null ? `\n\nIt lasted ${String(Math.max(1, Math.round((alert.resolvedAt - alert.openedAt) / OPS_MINUTE_MS)))} minutes.` : "";
		const message = `${alert.message}.${openedFor}`;
		for (const to of recipients) {
			await scope.emails.request(new AdminAlertEmailTemplate({ to, title, message, action: { label: "Open the alerts", url: `${this.deps.adminAppUrl}/operations/alerts` } }));
		}
		await scope.alerts.markNotified(alert.id, kind, epochMs(now));
	}
}
