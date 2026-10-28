// ============================================
// infrastructure/persistence/prisma-operations.repositories.ts — the console's Prisma repositories
// ============================================
// Design patterns:
//   - REPOSITORY: each class implements one port of `operations-repositories.port.ts` on the
//     transaction it is given (the unit of work's, or a read executor's) — it never opens one.
//   - Data Mapper: rows (BigInt epochs and byte counts) are mapped to the shared contract shapes
//     (numbers, branded `EpochMs`) here, and nowhere else.

import type { LoadTestRun as LoadTestRunRow, OpsAlert as OpsAlertRow, OpsBackup as OpsBackupRow, OpsServer as OpsServerRow, Prisma } from "@prisma/client";
import {
	epochMs,
	LOAD_TEST_DEFAULT_CAPS,
	LoadTestMixWeightsSchema,
	LoadTestScenarioSchema,
	OPS_ERROR_MAX_LENGTH,
	OPS_DEFAULT_ALERT_SETTINGS,
	OPS_DEFAULT_BACKUP_SCHEDULE,
	type EpochMs,
	type LoadTestPoint,
	type LoadTestStepStat,
	type OpsAlert,
	type OpsAlertSettings,
	type OpsAlertStatusFilter,
	type OpsBackupSchedule,
	type OpsDependency,
	type OpsDependencyPoint,
	type OpsHostFacts,
	type OpsInstancePoint,
	type OpsResolution,
	type OpsServerPoint,
	type OpsServerProvider,
	type LoadTestCaps,
} from "@workspace/shared";

import type { Breach } from "../../domain/policies/alert-rules.policy";
import type {
	InstanceIdentity,
	LoadTestRepository,
	LoadTestRunRecord,
	NewLoadTestRun,
	OpsAlertRecipientsReader,
	OpsAlertRepository,
	OpsBackupRecord,
	OpsBackupRepository,
	OpsHistoryRepository,
	OpsServerRecord,
	OpsServerRepository,
	OpsSettingsRecord,
	OpsSettingsRepository,
} from "../../application/ports/operations-repositories.port";

type Db = Prisma.TransactionClient;

const LIVE = { isDeleted: false };
/** `OpsBackup.pgDumpVersion` / `serverVersion` are `VarChar(100)`. */
const VERSION_TEXT_MAX_LENGTH = 100;
/** `LoadTestRun.abortReason` is `VarChar(300)`. */
const ABORT_REASON_MAX_LENGTH = 300;
/** The one settings row's key (`OpsSettings.key`). */
const SETTINGS_KEY = "default";

function epoch(value: bigint): EpochMs {
	return epochMs(Number(value));
}

function epochOrNull(value: bigint | null): EpochMs | null {
	return value === null ? null : epoch(value);
}

function numberOrNull(value: bigint | null): number | null {
	return value === null ? null : Number(value);
}

function whole(value: number): bigint {
	return BigInt(Math.round(value));
}

// ── Servers ─────────────────────────────────────────────────────────────────

function toServer(row: OpsServerRow): OpsServerRecord {
	return {
		id: row.id,
		name: row.name,
		provider: row.provider,
		providerServerId: row.providerServerId,
		agentTokenPrefix: row.agentTokenPrefix,
		lastSeenAt: epochOrNull(row.lastSeenAt),
		agentVersion: row.agentVersion,
		hostname: row.hostname,
		os: row.os,
		kernel: row.kernel,
		cpuModel: row.cpuModel,
		cpuCores: row.cpuCores,
		memoryTotalBytes: numberOrNull(row.memoryTotalBytes),
		uptimeSeconds: numberOrNull(row.uptimeSeconds),
		createdAt: epoch(row.createdAt),
	};
}

export class PrismaOpsServerRepository implements OpsServerRepository {
	public constructor(private readonly db: Db) {}

	public async list(): Promise<readonly OpsServerRecord[]> {
		return (await this.db.opsServer.findMany({ where: LIVE, orderBy: { name: "asc" } })).map(toServer);
	}

	public async find(serverId: string): Promise<OpsServerRecord | null> {
		const row = await this.db.opsServer.findFirst({ where: { id: serverId, ...LIVE } });
		return row === null ? null : toServer(row);
	}

	public async findByTokenHash(tokenHash: string): Promise<OpsServerRecord | null> {
		const row = await this.db.opsServer.findFirst({ where: { agentTokenHash: tokenHash, ...LIVE } });
		return row === null ? null : toServer(row);
	}

	public async isNameTaken(name: string): Promise<boolean> {
		return (await this.db.opsServer.count({ where: { name: { equals: name, mode: "insensitive" }, ...LIVE } })) > 0;
	}

	public async create(server: {
		readonly name: string;
		readonly provider: OpsServerProvider;
		readonly providerServerId: string | null;
		readonly tokenHash: string;
		readonly tokenPrefix: string;
	}): Promise<OpsServerRecord> {
		return toServer(
			await this.db.opsServer.create({
				data: {
					name: server.name,
					provider: server.provider,
					providerServerId: server.providerServerId,
					agentTokenHash: server.tokenHash,
					agentTokenPrefix: server.tokenPrefix,
				},
			}),
		);
	}

	public async replaceToken(serverId: string, token: { readonly tokenHash: string; readonly tokenPrefix: string }): Promise<OpsServerRecord> {
		return toServer(await this.db.opsServer.update({ where: { id: serverId }, data: { agentTokenHash: token.tokenHash, agentTokenPrefix: token.tokenPrefix } }));
	}

	public async revoke(serverId: string, now: EpochMs, actorUserId: string): Promise<void> {
		await this.db.opsServer.update({ where: { id: serverId }, data: { isDeleted: true, deletedAt: BigInt(now), deletedBy: actorUserId } });
	}

	public async recordReport(serverId: string, report: { readonly agentVersion: string; readonly host: OpsHostFacts; readonly at: EpochMs }): Promise<void> {
		await this.db.opsServer.update({
			where: { id: serverId },
			data: {
				lastSeenAt: BigInt(report.at),
				agentVersion: report.agentVersion,
				hostname: report.host.hostname,
				os: report.host.os,
				kernel: report.host.kernel,
				cpuModel: report.host.cpuModel,
				cpuCores: report.host.cpuCores,
				memoryTotalBytes: whole(report.host.memoryTotalBytes),
				uptimeSeconds: whole(report.host.uptimeSeconds),
			},
		});
	}
}

// ── History ─────────────────────────────────────────────────────────────────

const SERVER_POINT_SELECT = {
	serverId: true,
	bucketStart: true,
	cpuPercentAvg: true,
	cpuPercentMax: true,
	stealPercentAvg: true,
	iowaitPercentAvg: true,
	load1Avg: true,
	memoryUsedBytes: true,
	memoryTotalBytes: true,
	memoryPercentMax: true,
	swapUsedBytes: true,
	diskUsedBytes: true,
	diskTotalBytes: true,
	diskPercentMax: true,
	inodesPercentMax: true,
	diskReadBytesPerSec: true,
	diskWriteBytesPerSec: true,
	netRxBytesPerSec: true,
	netTxBytesPerSec: true,
	tcpConnections: true,
	processCount: true,
} satisfies Prisma.OpsServerSampleSelect;

type ServerPointRow = Prisma.OpsServerSampleGetPayload<{ select: typeof SERVER_POINT_SELECT }>;

function toServerPoint(row: ServerPointRow): OpsServerPoint {
	return {
		bucketStart: epoch(row.bucketStart),
		cpuPercentAvg: row.cpuPercentAvg,
		cpuPercentMax: row.cpuPercentMax,
		stealPercentAvg: row.stealPercentAvg,
		iowaitPercentAvg: row.iowaitPercentAvg,
		load1Avg: row.load1Avg,
		memoryUsedBytes: Number(row.memoryUsedBytes),
		memoryTotalBytes: Number(row.memoryTotalBytes),
		memoryPercentMax: row.memoryPercentMax,
		swapUsedBytes: Number(row.swapUsedBytes),
		diskUsedBytes: Number(row.diskUsedBytes),
		diskTotalBytes: Number(row.diskTotalBytes),
		diskPercentMax: row.diskPercentMax,
		inodesPercentMax: row.inodesPercentMax,
		diskReadBytesPerSec: row.diskReadBytesPerSec,
		diskWriteBytesPerSec: row.diskWriteBytesPerSec,
		netRxBytesPerSec: row.netRxBytesPerSec,
		netTxBytesPerSec: row.netTxBytesPerSec,
		tcpConnections: row.tcpConnections,
		processCount: row.processCount,
	};
}

function serverPointData(point: OpsServerPoint): Omit<Prisma.OpsServerSampleUncheckedCreateInput, "serverId" | "resolution" | "bucketStart"> {
	return {
		cpuPercentAvg: point.cpuPercentAvg,
		cpuPercentMax: point.cpuPercentMax,
		stealPercentAvg: point.stealPercentAvg,
		iowaitPercentAvg: point.iowaitPercentAvg,
		load1Avg: point.load1Avg,
		memoryUsedBytes: whole(point.memoryUsedBytes),
		memoryTotalBytes: whole(point.memoryTotalBytes),
		memoryPercentMax: point.memoryPercentMax,
		swapUsedBytes: whole(point.swapUsedBytes),
		diskUsedBytes: whole(point.diskUsedBytes),
		diskTotalBytes: whole(point.diskTotalBytes),
		diskPercentMax: point.diskPercentMax,
		inodesPercentMax: point.inodesPercentMax,
		diskReadBytesPerSec: point.diskReadBytesPerSec,
		diskWriteBytesPerSec: point.diskWriteBytesPerSec,
		netRxBytesPerSec: point.netRxBytesPerSec,
		netTxBytesPerSec: point.netTxBytesPerSec,
		tcpConnections: point.tcpConnections,
		processCount: point.processCount,
	};
}

const INSTANCE_POINT_SELECT = {
	instanceId: true,
	service: true,
	hostname: true,
	version: true,
	bucketStart: true,
	cpuPercentAvg: true,
	cpuPercentMax: true,
	rssBytes: true,
	heapUsedBytes: true,
	eventLoopLagP99Ms: true,
	gcPauseMs: true,
	requestCount: true,
	serverErrorCount: true,
	clientErrorCount: true,
	latencyP50Ms: true,
	latencyP95Ms: true,
	latencyP99Ms: true,
} satisfies Prisma.OpsInstanceSampleSelect;

type InstancePointRow = Prisma.OpsInstanceSampleGetPayload<{ select: typeof INSTANCE_POINT_SELECT }>;

function toInstancePoint(row: InstancePointRow): OpsInstancePoint {
	return {
		bucketStart: epoch(row.bucketStart),
		cpuPercentAvg: row.cpuPercentAvg,
		cpuPercentMax: row.cpuPercentMax,
		rssBytes: Number(row.rssBytes),
		heapUsedBytes: Number(row.heapUsedBytes),
		eventLoopLagP99Ms: row.eventLoopLagP99Ms,
		gcPauseMs: row.gcPauseMs,
		requestCount: row.requestCount,
		serverErrorCount: row.serverErrorCount,
		clientErrorCount: row.clientErrorCount,
		latencyP50Ms: row.latencyP50Ms,
		latencyP95Ms: row.latencyP95Ms,
		latencyP99Ms: row.latencyP99Ms,
	};
}

const DEPENDENCY_POINT_SELECT = {
	dependency: true,
	bucketStart: true,
	upPercent: true,
	latencyMsAvg: true,
	connectionsUsed: true,
	sizeBytes: true,
	memoryUsedBytes: true,
	backlog: true,
	failed: true,
} satisfies Prisma.OpsDependencySampleSelect;

type DependencyPointRow = Prisma.OpsDependencySampleGetPayload<{ select: typeof DEPENDENCY_POINT_SELECT }>;

function toDependencyPoint(row: DependencyPointRow): OpsDependencyPoint {
	return {
		bucketStart: epoch(row.bucketStart),
		upPercent: row.upPercent,
		latencyMsAvg: row.latencyMsAvg,
		connectionsUsed: row.connectionsUsed,
		sizeBytes: numberOrNull(row.sizeBytes),
		memoryUsedBytes: numberOrNull(row.memoryUsedBytes),
		backlog: row.backlog,
		failed: row.failed,
	};
}

function nullableWhole(value: number | null): bigint | null {
	return value === null ? null : whole(value);
}

function groupBy<Key, Item>(items: readonly Item[], keyOf: (item: Item) => Key): Map<Key, Item[]> {
	const groups = new Map<Key, Item[]>();
	for (const item of items) {
		const key: Key = keyOf(item);
		groups.set(key, [...(groups.get(key) ?? []), item]);
	}
	return groups;
}

export class PrismaOpsHistoryRepository implements OpsHistoryRepository {
	public constructor(private readonly db: Db) {}

	public async putServerPoint(serverId: string, resolution: OpsResolution, point: OpsServerPoint): Promise<void> {
		const data = serverPointData(point);
		await this.db.opsServerSample.upsert({
			where: { serverId_resolution_bucketStart: { serverId, resolution, bucketStart: BigInt(point.bucketStart) } },
			create: { serverId, resolution, bucketStart: BigInt(point.bucketStart), ...data },
			update: data,
		});
	}

	public async putInstancePoint(instance: InstanceIdentity, resolution: OpsResolution, point: OpsInstancePoint): Promise<void> {
		const data = {
			service: instance.service,
			hostname: instance.hostname,
			version: instance.version,
			cpuPercentAvg: point.cpuPercentAvg,
			cpuPercentMax: point.cpuPercentMax,
			rssBytes: whole(point.rssBytes),
			heapUsedBytes: whole(point.heapUsedBytes),
			eventLoopLagP99Ms: point.eventLoopLagP99Ms,
			gcPauseMs: point.gcPauseMs,
			requestCount: point.requestCount,
			serverErrorCount: point.serverErrorCount,
			clientErrorCount: point.clientErrorCount,
			latencyP50Ms: point.latencyP50Ms,
			latencyP95Ms: point.latencyP95Ms,
			latencyP99Ms: point.latencyP99Ms,
		};
		await this.db.opsInstanceSample.upsert({
			where: { instanceId_resolution_bucketStart: { instanceId: instance.instanceId, resolution, bucketStart: BigInt(point.bucketStart) } },
			create: { instanceId: instance.instanceId, resolution, bucketStart: BigInt(point.bucketStart), ...data },
			update: data,
		});
	}

	public async putDependencyPoint(dependency: OpsDependency, resolution: OpsResolution, point: OpsDependencyPoint): Promise<void> {
		const data = {
			upPercent: point.upPercent,
			latencyMsAvg: point.latencyMsAvg,
			connectionsUsed: point.connectionsUsed,
			sizeBytes: nullableWhole(point.sizeBytes),
			memoryUsedBytes: nullableWhole(point.memoryUsedBytes),
			backlog: point.backlog,
			failed: point.failed,
		};
		await this.db.opsDependencySample.upsert({
			where: { dependency_resolution_bucketStart: { dependency, resolution, bucketStart: BigInt(point.bucketStart) } },
			create: { dependency, resolution, bucketStart: BigInt(point.bucketStart), ...data },
			update: data,
		});
	}

	public async serverPoints(serverId: string, resolution: OpsResolution, from: EpochMs, to: EpochMs): Promise<readonly OpsServerPoint[]> {
		const rows = await this.db.opsServerSample.findMany({
			where: { serverId, resolution, bucketStart: { gte: BigInt(from), lte: BigInt(to) }, ...LIVE },
			select: SERVER_POINT_SELECT,
			orderBy: { bucketStart: "asc" },
		});
		return rows.map(toServerPoint);
	}

	public async instancePoints(instanceId: string, resolution: OpsResolution, from: EpochMs, to: EpochMs): Promise<readonly OpsInstancePoint[]> {
		const rows = await this.db.opsInstanceSample.findMany({
			where: { instanceId, resolution, bucketStart: { gte: BigInt(from), lte: BigInt(to) }, ...LIVE },
			select: INSTANCE_POINT_SELECT,
			orderBy: { bucketStart: "asc" },
		});
		return rows.map(toInstancePoint);
	}

	public async dependencyPoints(dependency: OpsDependency, resolution: OpsResolution, from: EpochMs, to: EpochMs): Promise<readonly OpsDependencyPoint[]> {
		const rows = await this.db.opsDependencySample.findMany({
			where: { dependency, resolution, bucketStart: { gte: BigInt(from), lte: BigInt(to) }, ...LIVE },
			select: DEPENDENCY_POINT_SELECT,
			orderBy: { bucketStart: "asc" },
		});
		return rows.map(toDependencyPoint);
	}

	public async serverMinutePointsBetween(from: EpochMs, to: EpochMs): Promise<ReadonlyMap<string, readonly OpsServerPoint[]>> {
		const rows = await this.db.opsServerSample.findMany({
			where: { resolution: "MINUTE", bucketStart: { gte: BigInt(from), lt: BigInt(to) }, ...LIVE },
			select: SERVER_POINT_SELECT,
			orderBy: { bucketStart: "asc" },
		});
		const grouped = groupBy(rows, (row) => row.serverId);
		return new Map([...grouped].map(([serverId, group]): [string, OpsServerPoint[]] => [serverId, group.map(toServerPoint)]));
	}

	public async instanceMinutePointsBetween(
		from: EpochMs,
		to: EpochMs,
	): Promise<ReadonlyMap<string, { readonly identity: InstanceIdentity; readonly points: readonly OpsInstancePoint[] }>> {
		const rows = await this.db.opsInstanceSample.findMany({
			where: { resolution: "MINUTE", bucketStart: { gte: BigInt(from), lt: BigInt(to) }, ...LIVE },
			select: INSTANCE_POINT_SELECT,
			orderBy: { bucketStart: "asc" },
		});
		const grouped = groupBy(rows, (row) => row.instanceId);
		return new Map(
			[...grouped].flatMap(([instanceId, group]): [string, { identity: InstanceIdentity; points: OpsInstancePoint[] }][] => {
				const [latest] = group.slice(-1);
				return latest === undefined
					? []
					: [[instanceId, { identity: { instanceId, service: latest.service, hostname: latest.hostname, version: latest.version }, points: group.map(toInstancePoint) }]];
			}),
		);
	}

	public async dependencyMinutePointsBetween(from: EpochMs, to: EpochMs): Promise<ReadonlyMap<OpsDependency, readonly OpsDependencyPoint[]>> {
		const rows = await this.db.opsDependencySample.findMany({
			where: { resolution: "MINUTE", bucketStart: { gte: BigInt(from), lt: BigInt(to) }, ...LIVE },
			select: DEPENDENCY_POINT_SELECT,
			orderBy: { bucketStart: "asc" },
		});
		const grouped = groupBy(rows, (row) => row.dependency);
		return new Map([...grouped].map(([dependency, group]): [OpsDependency, OpsDependencyPoint[]] => [dependency, group.map(toDependencyPoint)]));
	}

	public async recentServerCpu(serverId: string, minutes: number): Promise<readonly number[]> {
		const rows = await this.db.opsServerSample.findMany({
			where: { serverId, resolution: "MINUTE", ...LIVE },
			select: { cpuPercentAvg: true },
			orderBy: { bucketStart: "desc" },
			take: minutes,
		});
		return rows.map((row) => row.cpuPercentAvg);
	}

	/**
	 * Metric history is telemetry, not a business record: past its retention it is removed for good
	 * (ADR 068), like the other retention jobs (outbox, idempotency), never soft-deleted forever.
	 */
	public async prune(resolution: OpsResolution, before: EpochMs): Promise<number> {
		const where = { resolution, bucketStart: { lt: BigInt(before) } };
		const [servers, instances, dependencies] = await Promise.all([
			this.db.opsServerSample.deleteMany({ where }),
			this.db.opsInstanceSample.deleteMany({ where }),
			this.db.opsDependencySample.deleteMany({ where }),
		]);
		return servers.count + instances.count + dependencies.count;
	}
}

// ── Alerts ──────────────────────────────────────────────────────────────────

function toAlert(row: OpsAlertRow): OpsAlert {
	return {
		id: row.id,
		subjectKind: row.subjectKind,
		subjectId: row.subjectId,
		subjectName: row.subjectName,
		rule: row.rule,
		openedAt: epoch(row.openedAt),
		resolvedAt: epochOrNull(row.resolvedAt),
		thresholdValue: row.thresholdValue,
		peakValue: row.peakValue,
		lastValue: row.lastValue,
		message: row.message,
	};
}

/** The newest alerts a list shows. */
const ALERT_LIST_LIMIT = 200;
/** `OpsAlert.message` is `VarChar(500)`. */
const ALERT_MESSAGE_MAX_LENGTH = 500;
/** `OpsAlert.subjectName` / `subjectId` are `VarChar(200)`. */
const ALERT_SUBJECT_MAX_LENGTH = 200;

export class PrismaOpsAlertRepository implements OpsAlertRepository {
	public constructor(private readonly db: Db) {}

	public async list(status: OpsAlertStatusFilter): Promise<readonly OpsAlert[]> {
		const resolvedAt = status === "OPEN" ? null : status === "RESOLVED" ? { not: null } : undefined;
		const rows = await this.db.opsAlert.findMany({
			where: { ...LIVE, ...(resolvedAt === undefined ? {} : { resolvedAt }) },
			orderBy: { openedAt: "desc" },
			take: ALERT_LIST_LIMIT,
		});
		return rows.map(toAlert);
	}

	public async listOpen(): Promise<readonly OpsAlert[]> {
		return (await this.db.opsAlert.findMany({ where: { ...LIVE, resolvedAt: null }, orderBy: { openedAt: "desc" } })).map(toAlert);
	}

	public async open(breach: Breach, now: EpochMs): Promise<OpsAlert> {
		return toAlert(
			await this.db.opsAlert.create({
				data: {
					subjectKind: breach.subjectKind,
					subjectId: breach.subjectId.slice(0, ALERT_SUBJECT_MAX_LENGTH),
					subjectName: breach.subjectName.slice(0, ALERT_SUBJECT_MAX_LENGTH),
					rule: breach.rule,
					openedAt: BigInt(now),
					thresholdValue: breach.threshold,
					peakValue: breach.value,
					lastValue: breach.value,
					message: breach.message.slice(0, ALERT_MESSAGE_MAX_LENGTH),
				},
			}),
		);
	}

	public async update(alertId: string, values: { readonly lastValue: number | null; readonly peakValue: number | null }): Promise<void> {
		await this.db.opsAlert.update({ where: { id: alertId }, data: { lastValue: values.lastValue, peakValue: values.peakValue } });
	}

	public async resolve(alertId: string, now: EpochMs): Promise<OpsAlert> {
		return toAlert(await this.db.opsAlert.update({ where: { id: alertId }, data: { resolvedAt: BigInt(now) } }));
	}

	public async markNotified(alertId: string, kind: "open" | "resolve", now: EpochMs): Promise<void> {
		await this.db.opsAlert.update({ where: { id: alertId }, data: kind === "open" ? { openNotifiedAt: BigInt(now) } : { resolveNotifiedAt: BigInt(now) } });
	}
}

// ── Settings ────────────────────────────────────────────────────────────────

export class PrismaOpsSettingsRepository implements OpsSettingsRepository {
	public constructor(private readonly db: Db) {}

	/** The one row; created with the defaults the first time anything reads it (idempotent: upsert on the unique key). */
	public async get(): Promise<OpsSettingsRecord> {
		const row = await this.db.opsSettings.upsert({
			where: { key: SETTINGS_KEY },
			update: {},
			create: {
				key: SETTINGS_KEY,
				cpuPercent: OPS_DEFAULT_ALERT_SETTINGS.cpuPercent,
				cpuSustainMinutes: OPS_DEFAULT_ALERT_SETTINGS.cpuSustainMinutes,
				memoryPercent: OPS_DEFAULT_ALERT_SETTINGS.memoryPercent,
				diskPercent: OPS_DEFAULT_ALERT_SETTINGS.diskPercent,
				silentAfterMinutes: OPS_DEFAULT_ALERT_SETTINGS.silentAfterMinutes,
				tlsWarnDays: OPS_DEFAULT_ALERT_SETTINGS.tlsWarnDays,
				extraRecipients: [...OPS_DEFAULT_ALERT_SETTINGS.extraRecipients],
				backupHour: OPS_DEFAULT_BACKUP_SCHEDULE.backupHour,
				backupRetentionDays: OPS_DEFAULT_BACKUP_SCHEDULE.retentionDays,
				loadMaxVus: LOAD_TEST_DEFAULT_CAPS.maxVirtualUsers,
				loadMaxRps: LOAD_TEST_DEFAULT_CAPS.maxRequestsPerSecond,
				loadMaxMinutes: LOAD_TEST_DEFAULT_CAPS.maxMinutes,
				loadMaxSoakMinutes: LOAD_TEST_DEFAULT_CAPS.maxSoakMinutes,
			},
		});
		return {
			alerts: {
				cpuPercent: row.cpuPercent,
				cpuSustainMinutes: row.cpuSustainMinutes,
				memoryPercent: row.memoryPercent,
				diskPercent: row.diskPercent,
				silentAfterMinutes: row.silentAfterMinutes,
				tlsWarnDays: row.tlsWarnDays,
				extraRecipients: row.extraRecipients,
			},
			backup: { backupHour: row.backupHour, retentionDays: row.backupRetentionDays },
			loadTestCaps: { maxVirtualUsers: row.loadMaxVus, maxRequestsPerSecond: row.loadMaxRps, maxMinutes: row.loadMaxMinutes, maxSoakMinutes: row.loadMaxSoakMinutes },
		};
	}

	public async updateAlerts(settings: OpsAlertSettings): Promise<void> {
		await this.get();
		await this.db.opsSettings.update({ where: { key: SETTINGS_KEY }, data: { ...settings, extraRecipients: [...settings.extraRecipients] } });
	}

	public async updateBackupSchedule(schedule: OpsBackupSchedule): Promise<void> {
		await this.get();
		await this.db.opsSettings.update({ where: { key: SETTINGS_KEY }, data: { backupHour: schedule.backupHour, backupRetentionDays: schedule.retentionDays } });
	}

	public async updateLoadTestCaps(caps: LoadTestCaps): Promise<void> {
		await this.get();
		await this.db.opsSettings.update({
			where: { key: SETTINGS_KEY },
			data: { loadMaxVus: caps.maxVirtualUsers, loadMaxRps: caps.maxRequestsPerSecond, loadMaxMinutes: caps.maxMinutes, loadMaxSoakMinutes: caps.maxSoakMinutes },
		});
	}
}

/** The SuperAdmins: the `isSuperAdmin` flag, active and not deleted, never a load-test user. */
export class PrismaOpsAlertRecipientsReader implements OpsAlertRecipientsReader {
	public constructor(private readonly db: Db) {}

	public async superAdminEmails(): Promise<readonly string[]> {
		const rows = await this.db.user.findMany({
			where: { isSuperAdmin: true, isActive: true, isLoadTestUser: false, ...LIVE },
			select: { email: true },
			orderBy: { email: "asc" },
		});
		return rows.map((row) => row.email);
	}
}

// ── Backups ─────────────────────────────────────────────────────────────────

/** The newest backups a list shows. */
const BACKUP_LIST_LIMIT = 200;

type BackupRow = OpsBackupRow & { readonly requestedByName: string | null };

function toBackup(row: BackupRow): OpsBackupRecord {
	return {
		id: row.id,
		status: row.status,
		trigger: row.trigger,
		requestedByName: row.requestedByName,
		createdAt: epoch(row.createdAt),
		startedAt: epochOrNull(row.startedAt),
		finishedAt: epochOrNull(row.finishedAt),
		sizeBytes: numberOrNull(row.sizeBytes),
		checksum: row.checksum,
		pgDumpVersion: row.pgDumpVersion,
		serverVersion: row.serverVersion,
		pinned: row.pinned,
		error: row.error,
		storageContainer: row.storageContainer,
		storagePath: row.storagePath,
	};
}

export class PrismaOpsBackupRepository implements OpsBackupRepository {
	public constructor(private readonly db: Db) {}

	public async list(): Promise<readonly OpsBackupRecord[]> {
		return this.withNames(await this.db.opsBackup.findMany({ where: LIVE, orderBy: { createdAt: "desc" }, take: BACKUP_LIST_LIMIT }));
	}

	public async find(backupId: string): Promise<OpsBackupRecord | null> {
		const row = await this.db.opsBackup.findFirst({ where: { id: backupId, ...LIVE } });
		return row === null ? null : ((await this.withNames([row])).at(0) ?? null);
	}

	public async findActive(): Promise<OpsBackupRecord | null> {
		const row = await this.db.opsBackup.findFirst({ where: { status: { in: ["QUEUED", "RUNNING"] }, ...LIVE }, orderBy: { createdAt: "desc" } });
		return row === null ? null : ((await this.withNames([row])).at(0) ?? null);
	}

	public async lastScheduledAt(): Promise<EpochMs | null> {
		const row = await this.db.opsBackup.findFirst({ where: { trigger: "SCHEDULED" }, orderBy: { createdAt: "desc" }, select: { createdAt: true } });
		return row === null ? null : epoch(row.createdAt);
	}

	public async create(backup: { readonly trigger: "MANUAL" | "SCHEDULED"; readonly requestedById: string | null }): Promise<OpsBackupRecord> {
		const row = await this.db.opsBackup.create({ data: { status: "QUEUED", trigger: backup.trigger, requestedById: backup.requestedById } });
		return (await this.withNames([row])).at(0) ?? toBackup({ ...row, requestedByName: null });
	}

	public async markRunning(backupId: string, now: EpochMs, versions: { readonly pgDumpVersion: string; readonly serverVersion: string }): Promise<void> {
		await this.db.opsBackup.update({
			where: { id: backupId },
			data: {
				status: "RUNNING",
				startedAt: BigInt(now),
				pgDumpVersion: versions.pgDumpVersion.slice(0, VERSION_TEXT_MAX_LENGTH),
				serverVersion: versions.serverVersion.slice(0, VERSION_TEXT_MAX_LENGTH),
			},
		});
	}

	public async markFinished(
		backupId: string,
		outcome:
			| {
					readonly status: "SUCCEEDED";
					readonly at: EpochMs;
					readonly sizeBytes: number;
					readonly checksum: string;
					readonly storageContainer: string;
					readonly storagePath: string;
			  }
			| { readonly status: "FAILED"; readonly at: EpochMs; readonly error: string },
	): Promise<void> {
		await this.db.opsBackup.update({
			where: { id: backupId },
			data:
				outcome.status === "SUCCEEDED"
					? {
							status: "SUCCEEDED",
							finishedAt: BigInt(outcome.at),
							sizeBytes: whole(outcome.sizeBytes),
							checksum: outcome.checksum,
							storageContainer: outcome.storageContainer,
							storagePath: outcome.storagePath,
							error: null,
						}
					: { status: "FAILED", finishedAt: BigInt(outcome.at), error: outcome.error.slice(0, OPS_ERROR_MAX_LENGTH) },
		});
	}

	public async setPinned(backupId: string, pinned: boolean): Promise<OpsBackupRecord> {
		const row = await this.db.opsBackup.update({ where: { id: backupId }, data: { pinned } });
		return (await this.withNames([row])).at(0) ?? toBackup({ ...row, requestedByName: null });
	}

	public async remove(backupId: string, now: EpochMs, actorUserId: string | null): Promise<void> {
		await this.db.opsBackup.update({ where: { id: backupId }, data: { isDeleted: true, deletedAt: BigInt(now), deletedBy: actorUserId } });
	}

	private async withNames(rows: readonly OpsBackupRow[]): Promise<OpsBackupRecord[]> {
		const ids: string[] = [...new Set(rows.flatMap((row) => (row.requestedById === null ? [] : [row.requestedById])))];
		const users = ids.length === 0 ? [] : await this.db.user.findMany({ where: { id: { in: ids } }, select: { id: true, fullName: true } });
		const names = new Map<string, string>(users.map((user): [string, string] => [user.id, user.fullName]));
		return rows.map((row) => toBackup({ ...row, requestedByName: row.requestedById === null ? null : (names.get(row.requestedById) ?? null) }));
	}
}

// ── Load tests ──────────────────────────────────────────────────────────────

/** The newest runs a list shows. */
const LOAD_TEST_LIST_LIMIT = 100;

function toRun(row: LoadTestRunRow, requestedByName: string): LoadTestRunRecord {
	const weights = row.mixWeights === null ? null : LoadTestMixWeightsSchema.parse(row.mixWeights);
	return {
		id: row.id,
		name: row.name,
		target: row.target,
		scenario: row.scenario === null ? null : LoadTestScenarioSchema.parse(row.scenario),
		endpoint: row.endpoint,
		mixWeights: weights,
		shape: row.shape,
		virtualUsers: row.virtualUsers,
		requestsPerSecond: row.requestsPerSecond,
		durationSeconds: row.durationSeconds,
		thresholdP95Ms: row.thresholdP95Ms,
		thresholdErrorPercent: row.thresholdErrorPercent,
		status: row.status,
		requestedById: row.requestedById,
		requestedByName,
		createdAt: epoch(row.createdAt),
		startedAt: epochOrNull(row.startedAt),
		finishedAt: epochOrNull(row.finishedAt),
		abortReason: row.abortReason,
		abortRequestedAt: epochOrNull(row.abortRequestedAt),
		totalRequests: row.totalRequests,
		failedRequests: row.failedRequests,
		p50Ms: row.p50Ms,
		p95Ms: row.p95Ms,
		p99Ms: row.p99Ms,
		peakRps: row.peakRps,
		error: row.error,
	};
}

export class PrismaLoadTestRepository implements LoadTestRepository {
	public constructor(private readonly db: Db) {}

	public async list(): Promise<readonly LoadTestRunRecord[]> {
		return this.withNames(await this.db.loadTestRun.findMany({ where: LIVE, orderBy: { createdAt: "desc" }, take: LOAD_TEST_LIST_LIMIT }));
	}

	public async find(runId: string): Promise<LoadTestRunRecord | null> {
		const row = await this.db.loadTestRun.findFirst({ where: { id: runId, ...LIVE } });
		return row === null ? null : ((await this.withNames([row])).at(0) ?? null);
	}

	public async findActive(): Promise<LoadTestRunRecord | null> {
		const row = await this.db.loadTestRun.findFirst({ where: { status: { in: ["QUEUED", "RUNNING"] }, ...LIVE }, orderBy: { createdAt: "desc" } });
		return row === null ? null : ((await this.withNames([row])).at(0) ?? null);
	}

	public async create(run: NewLoadTestRun): Promise<LoadTestRunRecord> {
		const row = await this.db.loadTestRun.create({
			data: {
				name: run.name,
				target: run.target,
				scenario: run.scenario,
				endpoint: run.endpoint,
				...(run.mixWeights === null ? {} : { mixWeights: run.mixWeights }),
				shape: run.shape,
				virtualUsers: run.virtualUsers,
				requestsPerSecond: run.requestsPerSecond,
				durationSeconds: run.durationSeconds,
				thresholdP95Ms: run.thresholdP95Ms,
				thresholdErrorPercent: run.thresholdErrorPercent,
				status: "QUEUED",
				requestedById: run.requestedById,
			},
		});
		return (await this.withNames([row])).at(0) ?? toRun(row, "");
	}

	public async markRunning(runId: string, now: EpochMs): Promise<void> {
		await this.db.loadTestRun.updateMany({ where: { id: runId, status: "QUEUED" }, data: { status: "RUNNING", startedAt: BigInt(now) } });
	}

	public async requestAbort(runId: string, reason: string, now: EpochMs): Promise<LoadTestRunRecord> {
		const row = await this.db.loadTestRun.update({ where: { id: runId }, data: { abortRequestedAt: BigInt(now), abortReason: reason.slice(0, ABORT_REASON_MAX_LENGTH) } });
		return (await this.withNames([row])).at(0) ?? toRun(row, "");
	}

	public async recordProgress(runId: string, points: readonly LoadTestPoint[], steps: readonly LoadTestStepStat[]): Promise<void> {
		for (const point of points) {
			const data = {
				at: BigInt(point.at),
				virtualUsers: point.virtualUsers,
				requests: point.requests,
				failures: point.failures,
				p50Ms: point.p50Ms,
				p95Ms: point.p95Ms,
				p99Ms: point.p99Ms,
			};
			await this.db.loadTestPoint.upsert({ where: { runId_second: { runId, second: point.second } }, create: { runId, second: point.second, ...data }, update: data });
		}
		for (const step of steps) {
			const data = { requests: step.requests, failures: step.failures, p50Ms: step.p50Ms, p95Ms: step.p95Ms, p99Ms: step.p99Ms };
			await this.db.loadTestStepStat.upsert({ where: { runId_step: { runId, step: step.step } }, create: { runId, step: step.step, ...data }, update: data });
		}
	}

	public async finish(
		runId: string,
		outcome: {
			readonly status: "PASSED" | "FAILED" | "ABORTED" | "ERROR";
			readonly at: EpochMs;
			readonly abortReason: string | null;
			readonly error: string | null;
			readonly totals: {
				readonly requests: number;
				readonly failures: number;
				readonly p50Ms: number | null;
				readonly p95Ms: number | null;
				readonly p99Ms: number | null;
				readonly peakRps: number | null;
			};
		},
	): Promise<void> {
		// Only a run still queued or running ends: every API instance hears the runner's outcome, and the
		// first one to record it wins (the rest change nothing).
		await this.db.loadTestRun.updateMany({
			where: { id: runId, status: { in: ["QUEUED", "RUNNING"] } },
			data: {
				status: outcome.status,
				finishedAt: BigInt(outcome.at),
				...(outcome.abortReason === null ? {} : { abortReason: outcome.abortReason.slice(0, ABORT_REASON_MAX_LENGTH) }),
				error: outcome.error?.slice(0, OPS_ERROR_MAX_LENGTH) ?? null,
				totalRequests: outcome.totals.requests,
				failedRequests: outcome.totals.failures,
				p50Ms: outcome.totals.p50Ms,
				p95Ms: outcome.totals.p95Ms,
				p99Ms: outcome.totals.p99Ms,
				peakRps: outcome.totals.peakRps,
			},
		});
	}

	public async points(runId: string): Promise<readonly LoadTestPoint[]> {
		const rows = await this.db.loadTestPoint.findMany({ where: { runId, ...LIVE }, orderBy: { second: "asc" } });
		return rows.map((row) => ({
			second: row.second,
			at: epoch(row.at),
			virtualUsers: row.virtualUsers,
			requests: row.requests,
			failures: row.failures,
			p50Ms: row.p50Ms,
			p95Ms: row.p95Ms,
			p99Ms: row.p99Ms,
		}));
	}

	public async steps(runId: string): Promise<readonly LoadTestStepStat[]> {
		const rows = await this.db.loadTestStepStat.findMany({ where: { runId, ...LIVE }, orderBy: { step: "asc" } });
		return rows.map((row) => ({ step: row.step, requests: row.requests, failures: row.failures, p50Ms: row.p50Ms, p95Ms: row.p95Ms, p99Ms: row.p99Ms }));
	}

	private async withNames(rows: readonly LoadTestRunRow[]): Promise<LoadTestRunRecord[]> {
		const ids: string[] = [...new Set(rows.map((row) => row.requestedById))];
		const users = ids.length === 0 ? [] : await this.db.user.findMany({ where: { id: { in: ids } }, select: { id: true, fullName: true } });
		const names = new Map<string, string>(users.map((user): [string, string] => [user.id, user.fullName]));
		return rows.map((row) => toRun(row, names.get(row.requestedById) ?? "Unknown"));
	}
}
