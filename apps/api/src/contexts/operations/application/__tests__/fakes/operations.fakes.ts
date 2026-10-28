// In-memory doubles of the operations context's ports, for handler and service tests. The servers,
// history and settings repositories behave like the Prisma ones; ports a test does not exercise fail
// loudly ("not used here") so a test can never pass by silently touching the wrong one.

import {
	epochMs,
	LOAD_TEST_DEFAULT_CAPS,
	OPS_DEFAULT_ALERT_SETTINGS,
	OPS_DEFAULT_BACKUP_SCHEDULE,
	type EmailSendResult,
	type EpochMs,
	type LoadTestCaps,
	type LoadTestPurgeResult,
	type LoadTestPoint,
	type LoadTestStepStat,
	type OpsAlert,
	type OpsAlertSettings,
	type OpsBackupSchedule,
	type OpsDependency,
	type OpsDependencyStatus,
	type OpsInstanceLive,
	type OpsServerLive,
	type OpsDependencyPoint,
	type OpsHostFacts,
	type OpsInstancePoint,
	type OpsResolution,
	type OpsServerPoint,
	type OpsServerProvider,
} from "@workspace/shared";

import type { ActorContext } from "../../../../../platform/application/actor-context";
import type { UnitOfWork } from "../../../../../platform/application/unit-of-work.port";
import type { SystemOperationName } from "../../../../../platform/application/system-operation-names";
import type { EmailRequestTransactionalPort } from "../../../../notifications/public-api";
import type { OperationsScope } from "../../operations-scope";
import type { OpsLiveStore } from "../../ports/ops-live-store.port";
import type { LoadTestProvisioningPort, LoadTestPurgePort, ProvisionedLoadTestTenant } from "../../ports/load-test-tenant.port";
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
} from "../../ports/operations-repositories.port";

export class NotUsedHere extends Error {
	public constructor(what: string) {
		super(`${what} is not used by this test`);
	}
}

function notUsed<T>(what: string): Promise<T> {
	return Promise.reject(new NotUsedHere(what));
}

const REQUEST = { requestId: "req-1", ip: "198.51.100.7", userAgent: "agent", deviceLabel: null, endpoint: null };

export function superAdminActor(userId = "00000000-0000-4000-8000-000000000001"): ActorContext {
	return { kind: "user", userId, sessionId: "session-1", tenantId: null, isSuperAdmin: true, accessScope: "tenant", impersonatorUserId: null, request: REQUEST };
}

export function anonymousActor(): ActorContext {
	return { kind: "anonymous", tenantId: null, request: REQUEST };
}

/** A stored server, overridable per test. */
export function serverRecord(overrides: Partial<OpsServerRecord> = {}): OpsServerRecord {
	return {
		id: "11111111-1111-4111-8111-111111111111",
		name: "web-01",
		provider: "DIGITALOCEAN",
		providerServerId: "512345678",
		agentTokenPrefix: "opsagent_abcdefg",
		lastSeenAt: null,
		agentVersion: null,
		hostname: null,
		os: null,
		kernel: null,
		cpuModel: null,
		cpuCores: null,
		memoryTotalBytes: null,
		uptimeSeconds: null,
		createdAt: epochMs(0),
		...overrides,
	};
}

export class FakeServerRepository implements OpsServerRepository {
	public readonly servers = new Map<string, OpsServerRecord & { tokenHash: string; revoked: boolean }>();
	private sequence = 0;

	public seed(record: OpsServerRecord, tokenHash: string): void {
		this.servers.set(record.id, { ...record, tokenHash, revoked: false });
	}

	public list(): Promise<readonly OpsServerRecord[]> {
		return Promise.resolve([...this.servers.values()].filter((server) => !server.revoked));
	}

	public find(serverId: string): Promise<OpsServerRecord | null> {
		const server = this.servers.get(serverId);
		return Promise.resolve(server === undefined || server.revoked ? null : server);
	}

	public findByTokenHash(tokenHash: string): Promise<OpsServerRecord | null> {
		return Promise.resolve([...this.servers.values()].find((server) => !server.revoked && server.tokenHash === tokenHash) ?? null);
	}

	public isNameTaken(name: string): Promise<boolean> {
		return Promise.resolve([...this.servers.values()].some((server) => !server.revoked && server.name === name));
	}

	public create(server: {
		readonly name: string;
		readonly provider: OpsServerProvider;
		readonly providerServerId: string | null;
		readonly tokenHash: string;
		readonly tokenPrefix: string;
	}): Promise<OpsServerRecord> {
		this.sequence += 1;
		const record = serverRecord({
			id: `22222222-2222-4222-8222-${String(this.sequence).padStart(12, "0")}`,
			name: server.name,
			provider: server.provider,
			providerServerId: server.providerServerId,
			agentTokenPrefix: server.tokenPrefix,
		});
		this.seed(record, server.tokenHash);
		return Promise.resolve(record);
	}

	public replaceToken(serverId: string, token: { readonly tokenHash: string; readonly tokenPrefix: string }): Promise<OpsServerRecord> {
		const server = this.servers.get(serverId);
		if (server === undefined) {
			return Promise.reject(new Error(`no server ${serverId}`));
		}
		const next = { ...server, tokenHash: token.tokenHash, agentTokenPrefix: token.tokenPrefix };
		this.servers.set(serverId, next);
		return Promise.resolve(next);
	}

	public revoke(serverId: string): Promise<void> {
		const server = this.servers.get(serverId);
		if (server !== undefined) {
			this.servers.set(serverId, { ...server, revoked: true });
		}
		return Promise.resolve();
	}

	public recordReport(serverId: string, report: { readonly agentVersion: string; readonly host: OpsHostFacts; readonly at: EpochMs }): Promise<void> {
		const server = this.servers.get(serverId);
		if (server !== undefined) {
			this.servers.set(serverId, {
				...server,
				agentVersion: report.agentVersion,
				hostname: report.host.hostname,
				os: report.host.os,
				kernel: report.host.kernel,
				cpuModel: report.host.cpuModel,
				cpuCores: report.host.cpuCores,
				memoryTotalBytes: report.host.memoryTotalBytes,
				uptimeSeconds: report.host.uptimeSeconds,
				lastSeenAt: report.at,
			});
		}
		return Promise.resolve();
	}
}

export class FakeHistoryRepository implements OpsHistoryRepository {
	/** Every server point written, in order. */
	public readonly written: { readonly serverId: string; readonly resolution: OpsResolution; readonly point: OpsServerPoint }[] = [];

	public putServerPoint(serverId: string, resolution: OpsResolution, point: OpsServerPoint): Promise<void> {
		this.written.push({ serverId, resolution, point });
		return Promise.resolve();
	}

	public putInstancePoint(_instance: InstanceIdentity, _resolution: OpsResolution, _point: OpsInstancePoint): Promise<void> {
		return notUsed("putInstancePoint");
	}

	public putDependencyPoint(_dependency: OpsDependency, _resolution: OpsResolution, _point: OpsDependencyPoint): Promise<void> {
		return notUsed("putDependencyPoint");
	}

	public serverPoints(serverId: string, resolution: OpsResolution, from: EpochMs, to: EpochMs): Promise<readonly OpsServerPoint[]> {
		return Promise.resolve(
			this.written
				.filter((entry) => entry.serverId === serverId && entry.resolution === resolution && entry.point.bucketStart >= from && entry.point.bucketStart <= to)
				.map((entry) => entry.point),
		);
	}

	public instancePoints(): Promise<readonly OpsInstancePoint[]> {
		return Promise.resolve([]);
	}

	public dependencyPoints(): Promise<readonly OpsDependencyPoint[]> {
		return Promise.resolve([]);
	}

	public serverMinutePointsBetween(): Promise<ReadonlyMap<string, readonly OpsServerPoint[]>> {
		return notUsed("serverMinutePointsBetween");
	}

	public instanceMinutePointsBetween(): Promise<ReadonlyMap<string, { readonly identity: InstanceIdentity; readonly points: readonly OpsInstancePoint[] }>> {
		return notUsed("instanceMinutePointsBetween");
	}

	public dependencyMinutePointsBetween(): Promise<ReadonlyMap<OpsDependency, readonly OpsDependencyPoint[]>> {
		return notUsed("dependencyMinutePointsBetween");
	}

	public recentServerCpu(): Promise<readonly number[]> {
		return notUsed("recentServerCpu");
	}

	public prune(): Promise<number> {
		return notUsed("prune");
	}
}

export class FakeSettingsRepository implements OpsSettingsRepository {
	public settings: OpsSettingsRecord = { alerts: OPS_DEFAULT_ALERT_SETTINGS, backup: OPS_DEFAULT_BACKUP_SCHEDULE, loadTestCaps: LOAD_TEST_DEFAULT_CAPS };

	public get(): Promise<OpsSettingsRecord> {
		return Promise.resolve(this.settings);
	}

	public updateAlerts(settings: OpsAlertSettings): Promise<void> {
		this.settings = { ...this.settings, alerts: settings };
		return Promise.resolve();
	}

	public updateBackupSchedule(schedule: OpsBackupSchedule): Promise<void> {
		this.settings = { ...this.settings, backup: schedule };
		return Promise.resolve();
	}

	public updateLoadTestCaps(caps: LoadTestCaps): Promise<void> {
		this.settings = { ...this.settings, loadTestCaps: caps };
		return Promise.resolve();
	}
}

class UnusedAlerts implements OpsAlertRepository {
	public list(): Promise<readonly OpsAlert[]> {
		return notUsed("alerts.list");
	}

	public listOpen(): Promise<readonly OpsAlert[]> {
		return notUsed("alerts.listOpen");
	}

	public open(): Promise<OpsAlert> {
		return notUsed("alerts.open");
	}

	public update(): Promise<void> {
		return notUsed("alerts.update");
	}

	public resolve(): Promise<OpsAlert> {
		return notUsed("alerts.resolve");
	}

	public markNotified(): Promise<void> {
		return notUsed("alerts.markNotified");
	}
}

class UnusedRecipients implements OpsAlertRecipientsReader {
	public superAdminEmails(): Promise<readonly string[]> {
		return notUsed("recipients.superAdminEmails");
	}
}

class UnusedBackups implements OpsBackupRepository {
	public list(): Promise<readonly OpsBackupRecord[]> {
		return notUsed("backups.list");
	}

	public find(): Promise<OpsBackupRecord | null> {
		return notUsed("backups.find");
	}

	public findActive(): Promise<OpsBackupRecord | null> {
		return notUsed("backups.findActive");
	}

	public lastScheduledAt(): Promise<EpochMs | null> {
		return notUsed("backups.lastScheduledAt");
	}

	public create(): Promise<OpsBackupRecord> {
		return notUsed("backups.create");
	}

	public markRunning(): Promise<void> {
		return notUsed("backups.markRunning");
	}

	public markFinished(): Promise<void> {
		return notUsed("backups.markFinished");
	}

	public setPinned(): Promise<OpsBackupRecord> {
		return notUsed("backups.setPinned");
	}

	public remove(): Promise<void> {
		return notUsed("backups.remove");
	}
}

class UnusedLoadTests implements LoadTestRepository {
	public list(): Promise<readonly LoadTestRunRecord[]> {
		return notUsed("loadTests.list");
	}

	public find(): Promise<LoadTestRunRecord | null> {
		return notUsed("loadTests.find");
	}

	public findActive(): Promise<LoadTestRunRecord | null> {
		return notUsed("loadTests.findActive");
	}

	public create(_run: NewLoadTestRun): Promise<LoadTestRunRecord> {
		return notUsed("loadTests.create");
	}

	public markRunning(): Promise<void> {
		return notUsed("loadTests.markRunning");
	}

	public requestAbort(): Promise<LoadTestRunRecord> {
		return notUsed("loadTests.requestAbort");
	}

	public recordProgress(): Promise<void> {
		return notUsed("loadTests.recordProgress");
	}

	public finish(): Promise<void> {
		return notUsed("loadTests.finish");
	}

	public points(): Promise<readonly LoadTestPoint[]> {
		return notUsed("loadTests.points");
	}

	public steps(): Promise<readonly LoadTestStepStat[]> {
		return notUsed("loadTests.steps");
	}
}

class UnusedLoadTestTenant implements LoadTestProvisioningPort {
	public provision(): Promise<ProvisionedLoadTestTenant> {
		return notUsed("loadTestTenant.provision");
	}

	public loadTestUserCount(): Promise<number> {
		return notUsed("loadTestTenant.loadTestUserCount");
	}
}

class UnusedEmails implements EmailRequestTransactionalPort {
	public request(): Promise<EmailSendResult> {
		return notUsed("emails.request");
	}
}

class UnusedPurge implements LoadTestPurgePort {
	public purge(): Promise<LoadTestPurgeResult> {
		return notUsed("purge.purge");
	}
}

/** One scope over the in-memory repositories (each test reads them back through `scope`). */
export class FakeOperationsUnitOfWork implements UnitOfWork<OperationsScope> {
	public readonly servers = new FakeServerRepository();
	public readonly history = new FakeHistoryRepository();
	public readonly settings = new FakeSettingsRepository();
	public readonly operations: SystemOperationName[] = [];
	public readonly scope: OperationsScope = {
		servers: this.servers,
		history: this.history,
		alerts: new UnusedAlerts(),
		settings: this.settings,
		recipients: new UnusedRecipients(),
		backups: new UnusedBackups(),
		loadTests: new UnusedLoadTests(),
		loadTestTenant: new UnusedLoadTestTenant(),
		emails: new UnusedEmails(),
		purge: new UnusedPurge(),
	};

	public run<TResult>(_actor: ActorContext, work: (scope: OperationsScope) => Promise<TResult>): Promise<TResult> {
		return work(this.scope);
	}

	public runSystemOperation<TResult>(operation: SystemOperationName, _actor: ActorContext, work: (scope: OperationsScope) => Promise<TResult>): Promise<TResult> {
		this.operations.push(operation);
		return work(this.scope);
	}
}

/** A clock the test moves. */
export class FakeClock {
	public constructor(public current: number) {}

	public now(): EpochMs {
		return epochMs(this.current);
	}
}

/** The live store: the latest sample per server, instances, dependency statuses, minute claims, stops and tickets. */
export class FakeLiveStore implements OpsLiveStore {
	public readonly serverSamples = new Map<string, OpsServerLive>();
	public readonly instanceMap = new Map<string, OpsInstanceLive>();
	public readonly stopped = new Set<string>();
	private dependencyList: readonly OpsDependencyStatus[] = [];
	private readonly claimed = new Set<string>();
	private readonly tickets = new Map<string, string>();

	public putServerLive(serverId: string, live: OpsServerLive): Promise<void> {
		this.serverSamples.set(serverId, live);
		return Promise.resolve();
	}

	public serverLive(serverIds: readonly string[]): Promise<ReadonlyMap<string, OpsServerLive>> {
		return Promise.resolve(
			new Map(
				serverIds.flatMap((id): [string, OpsServerLive][] => {
					const live = this.serverSamples.get(id);
					return live === undefined ? [] : [[id, live]];
				}),
			),
		);
	}

	public putInstance(live: OpsInstanceLive): Promise<void> {
		this.instanceMap.set(live.instanceId, live);
		return Promise.resolve();
	}

	public removeInstance(instanceId: string): Promise<void> {
		this.instanceMap.delete(instanceId);
		return Promise.resolve();
	}

	public instances(): Promise<readonly OpsInstanceLive[]> {
		return Promise.resolve([...this.instanceMap.values()]);
	}

	public pruneInstances(before: number): Promise<number> {
		const stale = [...this.instanceMap.values()].filter((live) => live.sampledAt < before);
		for (const live of stale) {
			this.instanceMap.delete(live.instanceId);
		}
		return Promise.resolve(stale.length);
	}

	public putDependencies(statuses: readonly OpsDependencyStatus[]): Promise<void> {
		this.dependencyList = statuses;
		return Promise.resolve();
	}

	public dependencies(): Promise<readonly OpsDependencyStatus[]> {
		return Promise.resolve(this.dependencyList);
	}

	public claimMinute(job: string, bucketStart: number): Promise<boolean> {
		const key = `${job}:${String(bucketStart)}`;
		const first = !this.claimed.has(key);
		this.claimed.add(key);
		return Promise.resolve(first);
	}

	public requestStop(key: string): Promise<void> {
		this.stopped.add(key);
		return Promise.resolve();
	}

	public stopFlagKey(key: string): string {
		return key;
	}

	public putTicket(ticket: string, value: string): Promise<void> {
		this.tickets.set(ticket, value);
		return Promise.resolve();
	}

	public takeTicket(ticket: string): Promise<string | null> {
		const value = this.tickets.get(ticket) ?? null;
		this.tickets.delete(ticket);
		return Promise.resolve(value);
	}
}
