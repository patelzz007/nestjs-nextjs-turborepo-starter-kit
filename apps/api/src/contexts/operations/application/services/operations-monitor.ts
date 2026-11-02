// ============================================
// application/services/operations-monitor.ts — the minute's collection and the alert evaluation
// ============================================
// Once a minute, on ONE instance (a short Redis lock): check every dependency, record their minute,
// evaluate the alert rules, and open / update / resolve alerts with their notifications (ops-alert-notifier.ts)
// — all in one unit of work, so an alert and the word of it commit together (ADR 060, 070).
// Design patterns:
//   - Strategy (the probes) + pure policies (`findBreaches`, `reconcileAlerts`) composed here;
//     this class only orchestrates (Single Responsibility).

import { type EpochMs, type OpsAlert, type OpsDependencyStatus, type OpsHealth } from "@workspace/shared";

import type { ActorContext } from "../../../../platform/application/actor-context";
import type { Clock } from "../../../../platform/application/clock.port";
import type { UnitOfWork } from "../../../../platform/application/unit-of-work.port";
import {
	findBreaches,
	reconcileAlerts,
	replacedInstanceIds,
	type EndpointReading,
	type InstanceReading,
	type Readings,
	type ServerReading,
} from "../../domain/policies/alert-rules.policy";
import { percentOf } from "../../domain/policies/health.policy";
import { bucketStartOf } from "../../domain/policies/history-window.policy";
import type { OperationsScope } from "../operations-scope";
import type { DependencyProbe, DependencyProbeResult } from "../ports/dependency-probe.port";
import type { OpsLiveStore } from "../ports/ops-live-store.port";
import { OPS_MONITOR_COLLECT_OPERATION } from "../ports/operations.tokens";
import { alertAudienceOf, OpsAlertNotifier } from "./ops-alert-notifier";

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
	private readonly notifier: OpsAlertNotifier;

	public constructor(private readonly deps: OperationsMonitorDeps) {
		this.notifier = new OpsAlertNotifier(deps.adminAppUrl);
	}

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
		const instanceReadings: InstanceReading[] = instances.map((instance) => ({
			id: instance.instanceId,
			name: `${instance.service} on ${instance.hostname} (pid ${String(instance.pid)})`,
			service: instance.service,
			hostname: instance.hostname,
			startedAt: instance.startedAt,
			lastSeenAt: instance.sampledAt,
		}));
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
			const audience = alertAudienceOf(await scope.recipients.alertRecipients(), settings.alerts.extraRecipients);
			for (const breach of changes.open) {
				const alert: OpsAlert = await scope.alerts.open(breach, now);
				await this.notifier.notify(scope, alert, "open", audience, now);
			}
			for (const update of changes.update) {
				await scope.alerts.update(update.id, update);
			}
			for (const alertId of changes.resolve) {
				const alert: OpsAlert = await scope.alerts.resolve(alertId, now);
				await this.notifier.notify(scope, alert, "resolve", audience, now);
			}
		});
		// A process a newer one of its service replaced on its host was restarted, not lost: forget it now
		// (after the alerts committed, so an alert it had open resolves next minute) instead of in 24 hours.
		for (const instanceId of replacedInstanceIds(instanceReadings)) {
			await this.deps.live.removeInstance(instanceId);
		}
		return true;
	}
}
