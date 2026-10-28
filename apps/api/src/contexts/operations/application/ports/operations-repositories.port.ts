// ============================================
// application/ports/operations-repositories.port.ts — what the operations console stores
// ============================================
// Design patterns:
//   - REPOSITORY + Dependency Inversion: the application depends on these interfaces; Prisma
//     implements them (infrastructure/persistence). Tests implement them in memory.
//   - Interface Segregation: one small repository per kind of record, so a handler depends only on
//     what it touches.

import type {
	EpochMs,
	LoadTestCaps,
	LoadTestMixWeights,
	LoadTestPoint,
	LoadTestRun,
	LoadTestScenario,
	LoadTestShape,
	LoadTestStatus,
	LoadTestStepStat,
	LoadTestTarget,
	OpsAlert,
	OpsAlertSettings,
	OpsAlertStatusFilter,
	OpsBackup,
	OpsBackupSchedule,
	OpsBackupStatus,
	OpsBackupTrigger,
	OpsDependency,
	OpsDependencyPoint,
	OpsHostFacts,
	OpsInstancePoint,
	OpsResolution,
	OpsServerPoint,
	OpsServerProvider,
} from "@workspace/shared";

import type { Breach } from "../../domain/policies/alert-rules.policy";

// ── Servers ─────────────────────────────────────────────────────────────────

/** A registered server as stored. */
export interface OpsServerRecord {
	readonly id: string;
	readonly name: string;
	readonly provider: OpsServerProvider;
	readonly providerServerId: string | null;
	readonly agentTokenPrefix: string;
	readonly lastSeenAt: EpochMs | null;
	readonly agentVersion: string | null;
	readonly hostname: string | null;
	readonly os: string | null;
	readonly kernel: string | null;
	readonly cpuModel: string | null;
	readonly cpuCores: number | null;
	readonly memoryTotalBytes: number | null;
	readonly uptimeSeconds: number | null;
	readonly createdAt: EpochMs;
}

export interface OpsServerRepository {
	/** Every live (not revoked) server, by name. */
	list(): Promise<readonly OpsServerRecord[]>;
	find(serverId: string): Promise<OpsServerRecord | null>;
	/** The live server whose agent token has this digest. */
	findByTokenHash(tokenHash: string): Promise<OpsServerRecord | null>;
	isNameTaken(name: string): Promise<boolean>;
	create(server: {
		readonly name: string;
		readonly provider: OpsServerProvider;
		readonly providerServerId: string | null;
		readonly tokenHash: string;
		readonly tokenPrefix: string;
	}): Promise<OpsServerRecord>;
	replaceToken(serverId: string, token: { readonly tokenHash: string; readonly tokenPrefix: string }): Promise<OpsServerRecord>;
	/** Soft-deletes the server: its token stops working at once. */
	revoke(serverId: string, now: EpochMs, actorUserId: string): Promise<void>;
	/** Records an agent report's host facts and the time it arrived. */
	recordReport(serverId: string, report: { readonly agentVersion: string; readonly host: OpsHostFacts; readonly at: EpochMs }): Promise<void>;
}

// ── History ─────────────────────────────────────────────────────────────────

/** One instance's identity on its history rows. */
export interface InstanceIdentity {
	readonly instanceId: string;
	readonly service: string;
	readonly hostname: string;
	readonly version: string;
}

export interface OpsHistoryRepository {
	/** Writes (or overwrites — a retried report) one server bucket. */
	putServerPoint(serverId: string, resolution: OpsResolution, point: OpsServerPoint): Promise<void>;
	putInstancePoint(instance: InstanceIdentity, resolution: OpsResolution, point: OpsInstancePoint): Promise<void>;
	putDependencyPoint(dependency: OpsDependency, resolution: OpsResolution, point: OpsDependencyPoint): Promise<void>;
	serverPoints(serverId: string, resolution: OpsResolution, from: EpochMs, to: EpochMs): Promise<readonly OpsServerPoint[]>;
	instancePoints(instanceId: string, resolution: OpsResolution, from: EpochMs, to: EpochMs): Promise<readonly OpsInstancePoint[]>;
	dependencyPoints(dependency: OpsDependency, resolution: OpsResolution, from: EpochMs, to: EpochMs): Promise<readonly OpsDependencyPoint[]>;
	/** Every server's minute points between `from` and `to`, by server id (for the hourly rollup and the load-test overlay). */
	serverMinutePointsBetween(from: EpochMs, to: EpochMs): Promise<ReadonlyMap<string, readonly OpsServerPoint[]>>;
	instanceMinutePointsBetween(from: EpochMs, to: EpochMs): Promise<ReadonlyMap<string, { readonly identity: InstanceIdentity; readonly points: readonly OpsInstancePoint[] }>>;
	dependencyMinutePointsBetween(from: EpochMs, to: EpochMs): Promise<ReadonlyMap<OpsDependency, readonly OpsDependencyPoint[]>>;
	/** The CPU averages of a server's latest minute buckets, newest first. */
	recentServerCpu(serverId: string, minutes: number): Promise<readonly number[]>;
	/** Deletes rows of a resolution older than `before`; returns how many. */
	prune(resolution: OpsResolution, before: EpochMs): Promise<number>;
}

// ── Alerts ──────────────────────────────────────────────────────────────────

export interface OpsAlertRepository {
	list(status: OpsAlertStatusFilter): Promise<readonly OpsAlert[]>;
	/** Every open alert (unresolved). */
	listOpen(): Promise<readonly OpsAlert[]>;
	open(breach: Breach, now: EpochMs): Promise<OpsAlert>;
	update(alertId: string, values: { readonly lastValue: number | null; readonly peakValue: number | null }): Promise<void>;
	resolve(alertId: string, now: EpochMs): Promise<OpsAlert>;
	markNotified(alertId: string, kind: "open" | "resolve", now: EpochMs): Promise<void>;
}

/** The settings row: alert thresholds, the backup schedule and the load-test caps. */
export interface OpsSettingsRecord {
	readonly alerts: OpsAlertSettings;
	readonly backup: OpsBackupSchedule;
	readonly loadTestCaps: LoadTestCaps;
}

export interface OpsSettingsRepository {
	/** The settings, created with the defaults (ADR 068) on first use. */
	get(): Promise<OpsSettingsRecord>;
	updateAlerts(settings: OpsAlertSettings): Promise<void>;
	updateBackupSchedule(schedule: OpsBackupSchedule): Promise<void>;
	updateLoadTestCaps(caps: LoadTestCaps): Promise<void>;
}

/** Who gets alert emails: every live SuperAdmin plus the extra recipients. */
export interface OpsAlertRecipientsReader {
	superAdminEmails(): Promise<readonly string[]>;
}

// ── Backups ─────────────────────────────────────────────────────────────────

export interface OpsBackupRecord extends OpsBackup {
	readonly storageContainer: string | null;
	readonly storagePath: string | null;
}

export interface OpsBackupRepository {
	list(): Promise<readonly OpsBackupRecord[]>;
	find(backupId: string): Promise<OpsBackupRecord | null>;
	/** A backup that is queued or running, if any. */
	findActive(): Promise<OpsBackupRecord | null>;
	/** When the latest scheduled backup was queued. */
	lastScheduledAt(): Promise<EpochMs | null>;
	create(backup: { readonly trigger: OpsBackupTrigger; readonly requestedById: string | null }): Promise<OpsBackupRecord>;
	markRunning(backupId: string, now: EpochMs, versions: { readonly pgDumpVersion: string; readonly serverVersion: string }): Promise<void>;
	markFinished(
		backupId: string,
		outcome:
			| {
					readonly status: Extract<OpsBackupStatus, "SUCCEEDED">;
					readonly at: EpochMs;
					readonly sizeBytes: number;
					readonly checksum: string;
					readonly storageContainer: string;
					readonly storagePath: string;
			  }
			| { readonly status: Extract<OpsBackupStatus, "FAILED">; readonly at: EpochMs; readonly error: string },
	): Promise<void>;
	setPinned(backupId: string, pinned: boolean): Promise<OpsBackupRecord>;
	/** Soft-deletes the row (its stored file is deleted by the caller). */
	remove(backupId: string, now: EpochMs, actorUserId: string | null): Promise<void>;
}

// ── Load tests ──────────────────────────────────────────────────────────────

export interface LoadTestRunRecord extends LoadTestRun {
	readonly requestedById: string;
	readonly abortRequestedAt: EpochMs | null;
}

export interface NewLoadTestRun {
	readonly name: string;
	readonly target: LoadTestTarget;
	readonly scenario: LoadTestScenario | null;
	readonly endpoint: string | null;
	readonly mixWeights: LoadTestMixWeights | null;
	readonly shape: LoadTestShape;
	readonly virtualUsers: number;
	readonly requestsPerSecond: number;
	readonly durationSeconds: number;
	readonly thresholdP95Ms: number;
	readonly thresholdErrorPercent: number;
	readonly requestedById: string;
}

export interface LoadTestRepository {
	list(): Promise<readonly LoadTestRunRecord[]>;
	find(runId: string): Promise<LoadTestRunRecord | null>;
	/** The run that is queued or running, if any. */
	findActive(): Promise<LoadTestRunRecord | null>;
	create(run: NewLoadTestRun): Promise<LoadTestRunRecord>;
	markRunning(runId: string, now: EpochMs): Promise<void>;
	requestAbort(runId: string, reason: string, now: EpochMs): Promise<LoadTestRunRecord>;
	/** Writes (or overwrites) seconds and step totals as the runner reports them. */
	recordProgress(runId: string, points: readonly LoadTestPoint[], steps: readonly LoadTestStepStat[]): Promise<void>;
	finish(
		runId: string,
		outcome: {
			readonly status: Extract<LoadTestStatus, "PASSED" | "FAILED" | "ABORTED" | "ERROR">;
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
	): Promise<void>;
	points(runId: string): Promise<readonly LoadTestPoint[]>;
	steps(runId: string): Promise<readonly LoadTestStepStat[]>;
}
