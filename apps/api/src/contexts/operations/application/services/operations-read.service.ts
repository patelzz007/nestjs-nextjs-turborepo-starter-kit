// ============================================
// application/services/operations-read.service.ts — every read of the operations console
// ============================================
// The read side (CQRS, ADR 059): plain queries over the repositories and the live store, mapped to
// the shared contract shapes. No writes, no events (a simple read service, as `rules/30` allows for
// reads that gain nothing from a query bus). Every method runs under the console's read operation.

import type { Readable } from "node:stream";

import {
	epochMs,
	LOAD_TEST_READ_ENDPOINTS,
	OPS_INSTANCE_DOWN_AFTER_MS,
	OpsCloudProviderSchema,
	PLATFORM_DISPLAY_REGION,
	type EpochMs,
	type LoadTestOverview,
	type LoadTestRunDetail,
	type OpsAlertList,
	type OpsAlertSettings,
	type OpsAlertStatusFilter,
	type OpsBackupList,
	type OpsDependency,
	type OpsDependencyHistory,
	type OpsDependencyList,
	type OpsHistoryRange,
	type OpsInstance,
	type OpsInstanceHistory,
	type OpsInstanceList,
	type OpsOverview,
	type OpsServerDetail,
	type OpsServerHistory,
	type OpsServerList,
	type OpsServerSummary,
} from "@workspace/shared";

import type { ActorContext } from "../../../../platform/application/actor-context";
import type { Clock } from "../../../../platform/application/clock.port";
import { LoadTestNotFoundError, OpsBackupNotFoundError, OpsInstanceNotFoundError, OpsServerNotFoundError } from "../../domain/errors/operations.errors";
import { nextScheduledBackupAt } from "../../domain/policies/backup-schedule.policy";
import { percentOf } from "../../domain/policies/health.policy";
import { historyWindow } from "../../domain/policies/history-window.policy";
import { loadTestAvailability } from "../../domain/policies/load-test-availability.policy";
import { toBackup } from "../commands/backups/backup.handlers";
import { toLoadTestRun } from "../commands/load-tests/load-test.handlers";
import type { OperationsReadScope } from "../operations-scope";
import type { BackupStoragePort, DatabaseDumpPort } from "../ports/backup.ports";
import type { CloudServerFactsPort } from "../ports/cloud-server-facts.port";
import type { OperationsReads } from "../ports/operations-reads.port";
import type { OpsLiveStore } from "../ports/ops-live-store.port";
import type { OpsServerRecord } from "../ports/operations-repositories.port";
import { toServerDetail, toServerSummary } from "./ops-server-view";

export interface OperationsReadDeps {
	readonly reads: OperationsReads;
	readonly live: OpsLiveStore;
	readonly cloud: CloudServerFactsPort;
	readonly clock: Clock;
	readonly dump: DatabaseDumpPort;
	readonly backupStorage: BackupStoragePort;
	readonly loadTesting: { readonly enabled: boolean; readonly allowProduction: boolean; readonly isProduction: boolean; readonly queueAvailable: boolean };
}

/** A backup file to stream, with the name it downloads as. */
export interface BackupFile {
	readonly stream: Readable;
	readonly fileName: string;
	readonly sizeBytes: number | null;
}

export class OperationsReadService {
	public constructor(private readonly deps: OperationsReadDeps) {}

	public async overview(actor: ActorContext): Promise<OpsOverview> {
		const [servers, instances, dependencies, alerts] = await Promise.all([this.servers(actor), this.instances(), this.dependencies(), this.alerts(actor, "OPEN")]);
		return {
			servers: servers.servers,
			instances: instances.instances,
			dependencies: dependencies.dependencies,
			openAlerts: alerts.alerts,
			cloudProviders: [...this.deps.cloud.configuredProviders()],
		};
	}

	public async servers(actor: ActorContext): Promise<OpsServerList> {
		const now: EpochMs = this.deps.clock.now();
		const { servers, openAlerts, silentAfterMinutes } = await this.deps.reads.read(actor, async (scope) => ({
			servers: await scope.servers.list(),
			openAlerts: await scope.alerts.listOpen(),
			silentAfterMinutes: (await scope.settings.get()).alerts.silentAfterMinutes,
		}));
		const live = await this.deps.live.serverLive(servers.map((server) => server.id));
		return {
			servers: servers.map((server): OpsServerSummary =>
				toServerSummary(
					server,
					live.get(server.id) ?? null,
					openAlerts.filter((alert) => alert.subjectKind === "SERVER" && alert.subjectId === server.id).length,
					now,
					silentAfterMinutes,
				),
			),
		};
	}

	public async server(actor: ActorContext, serverId: string): Promise<OpsServerDetail> {
		const now: EpochMs = this.deps.clock.now();
		const { server, openAlerts, silentAfterMinutes } = await this.deps.reads.read(actor, async (scope) => ({
			server: await this.requireServer(scope, serverId),
			openAlerts: (await scope.alerts.listOpen()).filter((alert) => alert.subjectKind === "SERVER" && alert.subjectId === serverId).length,
			silentAfterMinutes: (await scope.settings.get()).alerts.silentAfterMinutes,
		}));
		const live = (await this.deps.live.serverLive([serverId])).get(serverId) ?? null;
		const cloud = await this.cloudFactsOf(server);
		return toServerDetail(server, { live, openAlerts, now, silentAfterMinutes, cloud: cloud.facts, cloudError: cloud.error });
	}

	public async serverHistory(actor: ActorContext, serverId: string, range: OpsHistoryRange): Promise<OpsServerHistory> {
		const window = historyWindow(range, this.deps.clock.now());
		const points = await this.deps.reads.read(actor, async (scope) => {
			await this.requireServer(scope, serverId);
			return scope.history.serverPoints(serverId, window.resolution, window.from, window.to);
		});
		return { ...window, points: [...points] };
	}

	public async instances(): Promise<OpsInstanceList> {
		const now: EpochMs = this.deps.clock.now();
		const instances = await this.deps.live.instances();
		return {
			instances: instances
				.map((instance): OpsInstance => ({ ...instance, health: now - instance.sampledAt > OPS_INSTANCE_DOWN_AFTER_MS ? "DOWN" : "UP" }))
				.sort((left, right) => left.service.localeCompare(right.service) || left.hostname.localeCompare(right.hostname) || left.startedAt - right.startedAt),
		};
	}

	public async instanceHistory(actor: ActorContext, instanceId: string, range: OpsHistoryRange): Promise<OpsInstanceHistory> {
		const window = historyWindow(range, this.deps.clock.now());
		const points = await this.deps.reads.read(actor, (scope) => scope.history.instancePoints(instanceId, window.resolution, window.from, window.to));
		const known: boolean = points.length > 0 || (await this.deps.live.instances()).some((instance) => instance.instanceId === instanceId);
		if (!known) {
			throw new OpsInstanceNotFoundError(instanceId);
		}
		return { ...window, points: [...points] };
	}

	public async dependencies(): Promise<OpsDependencyList> {
		return { dependencies: [...(await this.deps.live.dependencies())] };
	}

	public async dependencyHistory(actor: ActorContext, dependency: OpsDependency, range: OpsHistoryRange): Promise<OpsDependencyHistory> {
		const window = historyWindow(range, this.deps.clock.now());
		const points = await this.deps.reads.read(actor, (scope) => scope.history.dependencyPoints(dependency, window.resolution, window.from, window.to));
		return { ...window, points: [...points] };
	}

	public async alerts(actor: ActorContext, status: OpsAlertStatusFilter): Promise<OpsAlertList> {
		return { alerts: [...(await this.deps.reads.read(actor, (scope) => scope.alerts.list(status)))] };
	}

	public async alertSettings(actor: ActorContext): Promise<OpsAlertSettings> {
		return (await this.deps.reads.read(actor, (scope) => scope.settings.get())).alerts;
	}

	public async backups(actor: ActorContext): Promise<OpsBackupList> {
		const now: EpochMs = this.deps.clock.now();
		const { backups, settings } = await this.deps.reads.read(actor, async (scope) => ({ backups: await scope.backups.list(), settings: await scope.settings.get() }));
		return {
			backups: backups.map(toBackup),
			schedule: settings.backup,
			timeZone: PLATFORM_DISPLAY_REGION.timeZone,
			nextScheduledAt: nextScheduledBackupAt(settings.backup.backupHour, PLATFORM_DISPLAY_REGION.timeZone, now),
			storageConfigured: this.deps.dump.availability().ready,
		};
	}

	/** The stored bytes of a finished backup (the download route has already redeemed its ticket). */
	public async backupFile(actor: ActorContext, backupId: string): Promise<BackupFile> {
		const backup = await this.deps.reads.read(actor, (scope) => scope.backups.find(backupId));
		if (backup?.status !== "SUCCEEDED" || backup.storageContainer === null || backup.storagePath === null) {
			throw new OpsBackupNotFoundError(backupId);
		}
		const stream = await this.deps.backupStorage.open(backup.storageContainer, backup.storagePath);
		if (stream === null) {
			throw new OpsBackupNotFoundError(backupId);
		}
		return { stream, fileName: `backup-${new Date(backup.createdAt).toISOString().replace(/[:.]/g, "-")}.dump`, sizeBytes: backup.sizeBytes };
	}

	public async loadTests(actor: ActorContext): Promise<LoadTestOverview> {
		const availability = loadTestAvailability(this.deps.loadTesting);
		const { runs, caps, users } = await this.deps.reads.read(actor, async (scope) => ({
			runs: await scope.loadTests.list(),
			caps: (await scope.settings.get()).loadTestCaps,
			users: await scope.loadTestTenant.loadTestUserCount(),
		}));
		return {
			enabled: availability.enabled,
			disabledReason: availability.enabled ? null : availability.reason,
			caps,
			endpoints: [...LOAD_TEST_READ_ENDPOINTS],
			runs: runs.map(toLoadTestRun),
			loadTestUsers: users,
		};
	}

	/** A run with its seconds, its steps, and every server's CPU and memory over the same window. */
	public async loadTest(actor: ActorContext, runId: string): Promise<LoadTestRunDetail> {
		const now: EpochMs = this.deps.clock.now();
		return this.deps.reads.read(actor, async (scope) => {
			const run = await scope.loadTests.find(runId);
			if (run === null) {
				throw new LoadTestNotFoundError(runId);
			}
			const from: EpochMs = run.startedAt ?? run.createdAt;
			const to: EpochMs = epochMs(run.finishedAt ?? now);
			const [points, steps, servers, history] = await Promise.all([
				scope.loadTests.points(runId),
				scope.loadTests.steps(runId),
				scope.servers.list(),
				scope.history.serverMinutePointsBetween(from, to),
			]);
			return {
				run: toLoadTestRun(run),
				points: [...points],
				steps: [...steps],
				servers: servers.map((server) => ({
					serverId: server.id,
					name: server.name,
					points: (history.get(server.id) ?? []).map((point) => ({
						at: point.bucketStart,
						cpuPercent: point.cpuPercentAvg,
						memoryPercent: percentOf(point.memoryUsedBytes, point.memoryTotalBytes),
					})),
				})),
			};
		});
	}

	private async requireServer(scope: OperationsReadScope, serverId: string): Promise<OpsServerRecord> {
		const server = await scope.servers.find(serverId);
		if (server === null) {
			throw new OpsServerNotFoundError(serverId);
		}
		return server;
	}

	/** The provider's facts for a cloud server; a laptop or an `OTHER` server has none (and no error). */
	private async cloudFactsOf(server: OpsServerRecord): Promise<{ readonly facts: OpsServerDetail["cloud"]; readonly error: string | null }> {
		const provider = OpsCloudProviderSchema.safeParse(server.provider);
		if (!provider.success || server.providerServerId === null) {
			return { facts: null, error: null };
		}
		const result = await this.deps.cloud.factsOf(provider.data, server.providerServerId);
		return result.kind === "facts" ? { facts: result.facts, error: null } : { facts: null, error: result.reason };
	}
}
