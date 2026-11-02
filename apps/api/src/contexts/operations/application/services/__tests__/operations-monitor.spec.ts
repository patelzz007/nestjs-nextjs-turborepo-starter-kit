import { epochMs, type EpochMs, type OpsAlert, type OpsDependencyStatus, type OpsInstanceLive, type OpsServerLive } from "@workspace/shared";
import { describe, expect, it } from "vitest";

import type { ActorContext } from "../../../../../platform/application/actor-context";
import type { SystemOperationName } from "../../../../../platform/application/system-operation-names";
import type { UnitOfWork } from "../../../../../platform/application/unit-of-work.port";
import type { Breach } from "../../../domain/policies/alert-rules.policy";
import { FakeOperationsUnitOfWork, NotUsedHere, superAdminActor } from "../../__tests__/fakes/operations.fakes";
import type { OperationsScope } from "../../operations-scope";
import type { OpsLiveStore } from "../../ports/ops-live-store.port";
import type { OpsAlertRecipient, OpsAlertRepository } from "../../ports/operations-repositories.port";
import { OperationsMonitor } from "../operations-monitor";

const MINUTE_MS = 60_000;
const NOW = Date.UTC(2026, 10, 1, 9, 0);
const HOUR_MINUTES = 60;
const OLD_LAST_SEEN_MINUTES = 30;
const NEW_STARTED_MINUTES = 29;
const CRASHED_LAST_SEEN_MINUTES = 10;

function instance(instanceId: string, overrides: Partial<OpsInstanceLive> = {}): OpsInstanceLive {
	return {
		instanceId,
		service: "api",
		hostname: "web-01",
		pid: 1,
		version: "v1",
		startedAt: epochMs(NOW - HOUR_MINUTES * MINUTE_MS),
		sampledAt: epochMs(NOW),
		cpuPercent: 0,
		rssBytes: 0,
		heapUsedBytes: 0,
		heapTotalBytes: 0,
		eventLoopLagP99Ms: 0,
		gcPauseMs: 0,
		activeHandles: 0,
		dbPoolInUse: null,
		dbPoolWaiting: null,
		requestsPerMinute: 0,
		serverErrorsPerMinute: 0,
		clientErrorsPerMinute: 0,
		latencyP50Ms: null,
		latencyP95Ms: null,
		latencyP99Ms: null,
		slowestEndpoints: [],
		...overrides,
	};
}

/** The live store as the monitor uses it: instances by id, the minute always claimed, nothing else. */
class MonitorLiveStore implements OpsLiveStore {
	private readonly byId = new Map<string, OpsInstanceLive>();

	public putInstance(live: OpsInstanceLive): Promise<void> {
		this.byId.set(live.instanceId, live);
		return Promise.resolve();
	}

	public removeInstance(instanceId: string): Promise<void> {
		this.byId.delete(instanceId);
		return Promise.resolve();
	}

	public instances(): Promise<readonly OpsInstanceLive[]> {
		return Promise.resolve([...this.byId.values()]);
	}

	public serverLive(): Promise<ReadonlyMap<string, OpsServerLive>> {
		return Promise.resolve(new Map());
	}

	public putDependencies(_statuses: readonly OpsDependencyStatus[]): Promise<void> {
		return Promise.resolve();
	}

	public claimMinute(): Promise<boolean> {
		return Promise.resolve(true);
	}

	public putServerLive(): Promise<void> {
		return Promise.reject(new NotUsedHere("live.putServerLive"));
	}

	public pruneInstances(): Promise<number> {
		return Promise.reject(new NotUsedHere("live.pruneInstances"));
	}

	public dependencies(): Promise<readonly OpsDependencyStatus[]> {
		return Promise.reject(new NotUsedHere("live.dependencies"));
	}

	public requestStop(): Promise<void> {
		return Promise.reject(new NotUsedHere("live.requestStop"));
	}

	public stopFlagKey(): string {
		throw new NotUsedHere("live.stopFlagKey");
	}

	public putTicket(): Promise<void> {
		return Promise.reject(new NotUsedHere("live.putTicket"));
	}

	public takeTicket(): Promise<string | null> {
		return Promise.reject(new NotUsedHere("live.takeTicket"));
	}
}

/** The alerts the minute opened, in memory: nothing was open before. */
class RecordingAlerts implements OpsAlertRepository {
	public readonly opened: Breach[] = [];

	public list(): Promise<readonly OpsAlert[]> {
		return Promise.reject(new NotUsedHere("alerts.list"));
	}

	public update(): Promise<void> {
		return Promise.reject(new NotUsedHere("alerts.update"));
	}

	public resolve(): Promise<OpsAlert> {
		return Promise.reject(new NotUsedHere("alerts.resolve"));
	}

	public listOpen(): Promise<readonly OpsAlert[]> {
		return Promise.resolve([]);
	}

	public open(breach: Breach, now: number): Promise<OpsAlert> {
		this.opened.push(breach);
		return Promise.resolve({
			id: "0193f2c4-0000-7000-8000-00000000a1e7",
			subjectKind: breach.subjectKind,
			subjectId: breach.subjectId,
			subjectName: breach.subjectName,
			rule: breach.rule,
			openedAt: epochMs(now),
			resolvedAt: null,
			thresholdValue: breach.threshold,
			peakValue: breach.value,
			lastValue: breach.value,
			message: breach.message,
		});
	}

	public markNotified(): Promise<void> {
		return Promise.resolve();
	}
}

/** The fakes' unit of work with alerts that record, and nobody to notify. */
class MonitorUnitOfWork implements UnitOfWork<OperationsScope> {
	public readonly alerts = new RecordingAlerts();
	private readonly scope: OperationsScope;

	public constructor() {
		const base = new FakeOperationsUnitOfWork().scope;
		this.scope = {
			...base,
			alerts: this.alerts,
			recipients: { alertRecipients: (): Promise<readonly OpsAlertRecipient[]> => Promise.resolve([]) },
		};
	}

	public run<TResult>(_actor: ActorContext, work: (scope: OperationsScope) => Promise<TResult>): Promise<TResult> {
		return work(this.scope);
	}

	public runSystemOperation<TResult>(_operation: SystemOperationName, _actor: ActorContext, work: (scope: OperationsScope) => Promise<TResult>): Promise<TResult> {
		return work(this.scope);
	}
}

async function collect(instances: readonly OpsInstanceLive[]): Promise<{ readonly uow: MonitorUnitOfWork; readonly live: MonitorLiveStore }> {
	const live = new MonitorLiveStore();
	for (const one of instances) {
		await live.putInstance(one);
	}
	const uow = new MonitorUnitOfWork();
	const monitor = new OperationsMonitor({
		uow,
		live,
		probes: [],
		clock: { now: (): EpochMs => epochMs(NOW) },
		actor: superAdminActor(),
		adminAppUrl: "https://admin.example.com",
	});
	expect(await monitor.collectMinute()).toBe(true);
	return { uow, live };
}

describe("OperationsMonitor: instances that stopped reporting", () => {
	it("forgets a process a restart replaced, and opens no alert for it", async () => {
		const old = instance("old", { pid: 4242, sampledAt: epochMs(NOW - OLD_LAST_SEEN_MINUTES * MINUTE_MS) });
		const restarted = instance("new", { pid: 4243, startedAt: epochMs(NOW - NEW_STARTED_MINUTES * MINUTE_MS) });

		const { uow, live } = await collect([old, restarted]);

		expect(uow.alerts.opened).toEqual([]);
		expect((await live.instances()).map((one) => one.instanceId)).toEqual(["new"]);
	});

	it("still alerts for a process nothing replaced, and keeps it", async () => {
		const crashed = instance("crashed", { sampledAt: epochMs(NOW - CRASHED_LAST_SEEN_MINUTES * MINUTE_MS) });
		const sibling = instance("sibling");

		const { uow, live } = await collect([crashed, sibling]);

		expect(uow.alerts.opened.map((breach) => `${breach.subjectId}:${breach.rule}`)).toEqual(["crashed:SILENT"]);
		expect((await live.instances()).map((one) => one.instanceId).toSorted()).toEqual(["crashed", "sibling"]);
	});
});
