// ============================================
// application/commands/load-tests/load-test.handlers.ts — the load-test command handlers (ADR 068)
// ============================================
// Each handler is one use case (Single Responsibility). The rules are domain policies (caps,
// availability); the queue, passwords and the Load Test tenant are ports (Dependency Inversion).

import { randomBytes } from "node:crypto";

import { Inject } from "@nestjs/common";
import { CommandHandler, type ICommandHandler } from "@nestjs/cqrs";
import { API_VERSION_PREFIX, LOAD_TEST_READ_ENDPOINTS, type LoadTestCaps, type LoadTestPurgeResult, type LoadTestRun } from "@workspace/shared";

import { TypedConfigService } from "../../../../../config/typed-config.service";
import { CLOCK, type Clock } from "../../../../../platform/application/clock.port";
import type { UnitOfWork } from "../../../../../platform/application/unit-of-work.port";
import {
	LoadTestAlreadyRunningError,
	LoadTestEndpointInvalidError,
	LoadTestingDisabledError,
	LoadTestNotFoundError,
	LoadTestNotRunningError,
	LoadTestPurgeBlockedError,
} from "../../../domain/errors/operations.errors";
import { loadTestAvailability } from "../../../domain/policies/load-test-availability.policy";
import { assertWithinCaps } from "../../../domain/policies/load-test.policy";
import type { OperationsScope } from "../../operations-scope";
import {
	LOAD_TEST_PASSWORDS,
	LOAD_TEST_QUEUE,
	LOAD_TEST_TRAFFIC,
	type LoadTestPasswordPort,
	type LoadTestQueuePort,
	type LoadTestTrafficPort,
} from "../../ports/load-test.ports";
import type { LoadTestRunRecord } from "../../ports/operations-repositories.port";
import { OPS_LIVE_STORE, type OpsLiveStore } from "../../ports/ops-live-store.port";
import { LOAD_TEST_PURGE_OPERATION, LOAD_TEST_WRITE_OPERATION, OPS_SETTINGS_WRITE_OPERATION, OPS_UNIT_OF_WORK } from "../../ports/operations.tokens";
import { actingUserIdOf } from "../../services/ops-server-view";
import { AbortLoadTestCommand, PurgeLoadTestDataCommand, StartLoadTestCommand, UpdateLoadTestCapsCommand } from "./load-test.commands";

/** The public shape of a run. */
export function toLoadTestRun(record: LoadTestRunRecord): LoadTestRun {
	return {
		id: record.id,
		name: record.name,
		target: record.target,
		scenario: record.scenario,
		endpoint: record.endpoint,
		mixWeights: record.mixWeights,
		shape: record.shape,
		virtualUsers: record.virtualUsers,
		requestsPerSecond: record.requestsPerSecond,
		durationSeconds: record.durationSeconds,
		thresholdP95Ms: record.thresholdP95Ms,
		thresholdErrorPercent: record.thresholdErrorPercent,
		status: record.status,
		requestedByName: record.requestedByName,
		createdAt: record.createdAt,
		startedAt: record.startedAt,
		finishedAt: record.finishedAt,
		abortReason: record.abortReason,
		totalRequests: record.totalRequests,
		failedRequests: record.failedRequests,
		p50Ms: record.p50Ms,
		p95Ms: record.p95Ms,
		p99Ms: record.p99Ms,
		peakRps: record.peakRps,
		error: record.error,
	};
}

/** Random bytes of a run's traffic key (256 bits). */
const TRAFFIC_KEY_BYTES = 32;
/** A traffic key outlives its run by this much: the queue wait and the runner's ramp-down. */
const TRAFFIC_KEY_GRACE_MS = 10 * 60_000;
const MS_PER_SECOND = 1_000;

/** The Redis flag the runner polls to stop one run. */
export function loadTestStopKey(runId: string): string {
	return `load-test:${runId}`;
}

@CommandHandler(StartLoadTestCommand)
export class StartLoadTestHandler implements ICommandHandler<StartLoadTestCommand, LoadTestRun> {
	public constructor(
		@Inject(OPS_UNIT_OF_WORK) private readonly uow: UnitOfWork<OperationsScope>,
		@Inject(LOAD_TEST_QUEUE) private readonly queue: LoadTestQueuePort,
		@Inject(LOAD_TEST_PASSWORDS) private readonly passwords: LoadTestPasswordPort,
		@Inject(LOAD_TEST_TRAFFIC) private readonly traffic: LoadTestTrafficPort,
		@Inject(OPS_LIVE_STORE) private readonly live: OpsLiveStore,
		private readonly config: TypedConfigService,
	) {}

	/**
	 * Refuses unless load testing is on, the run fits the caps, it names a read endpoint (for a
	 * single-endpoint test) and no other run is queued or running; then provisions the Load Test
	 * tenant with one load-test customer per virtual user and a fresh password, records the run and
	 * hands it to the load runner.
	 */
	public async execute({ actor, input }: StartLoadTestCommand): Promise<LoadTestRun> {
		const { loadTesting } = this.config.operations;
		const availability = loadTestAvailability({
			enabled: loadTesting.enabled,
			allowProduction: loadTesting.allowProduction,
			isProduction: this.config.runtime.isProduction,
			queueAvailable: this.queue.available,
		});
		if (!availability.enabled) {
			throw new LoadTestingDisabledError(availability.reason);
		}
		if (input.endpoint !== null && !LOAD_TEST_READ_ENDPOINTS.includes(input.endpoint)) {
			throw new LoadTestEndpointInvalidError(input.endpoint);
		}
		const userId: string = actingUserIdOf(actor);
		const credentials = await this.passwords.issue();
		const { run, tenant } = await this.uow.runSystemOperation(LOAD_TEST_WRITE_OPERATION, actor, async (scope) => {
			const { loadTestCaps } = await scope.settings.get();
			assertWithinCaps(input, loadTestCaps);
			const active = await scope.loadTests.findActive();
			if (active !== null) {
				throw new LoadTestAlreadyRunningError(active.id);
			}
			const provisioned = await scope.loadTestTenant.provision({ customers: input.virtualUsers, passwordHash: credentials.hash });
			const created = await scope.loadTests.create({ ...input, requestedById: userId });
			return { run: created, tenant: provisioned };
		});
		const trafficKey: string = randomBytes(TRAFFIC_KEY_BYTES).toString("base64url");
		await this.traffic.issue(trafficKey, input.durationSeconds * MS_PER_SECOND + TRAFFIC_KEY_GRACE_MS);
		await this.queue.enqueue({
			runId: run.id,
			trafficKey,
			baseUrl: loadTesting.targetUrl ?? this.config.http.publicUrl,
			target: input.target,
			scenario: input.scenario,
			endpoint: input.endpoint,
			mixWeights: input.mixWeights,
			shape: input.shape,
			virtualUsers: input.virtualUsers,
			requestsPerSecond: input.requestsPerSecond,
			durationSeconds: input.durationSeconds,
			tenantSlug: tenant.tenantSlug,
			customers: tenant.customerEmails.map((email, index) => ({ email, password: credentials.password, phone: tenant.customerPhones.at(index) ?? null })),
			staff: tenant.staffEmails.map((email) => ({ email, password: credentials.password, phone: null })),
			abortKey: this.live.stopFlagKey(loadTestStopKey(run.id)),
			origins: { web: this.config.clientApps.webUrl, merchant: this.config.clientApps.merchantUrl },
			apiPrefix: API_VERSION_PREFIX,
		});
		return toLoadTestRun(run);
	}
}

@CommandHandler(AbortLoadTestCommand)
export class AbortLoadTestHandler implements ICommandHandler<AbortLoadTestCommand, LoadTestRun> {
	public constructor(
		@Inject(OPS_UNIT_OF_WORK) private readonly uow: UnitOfWork<OperationsScope>,
		@Inject(LOAD_TEST_QUEUE) private readonly queue: LoadTestQueuePort,
		@Inject(OPS_LIVE_STORE) private readonly live: OpsLiveStore,
		@Inject(CLOCK) private readonly clock: Clock,
	) {}

	/** A queued run is taken off the queue and ends at once; a running one is told to stop (the runner ends it within a second). */
	public async execute({ actor, runId }: AbortLoadTestCommand): Promise<LoadTestRun> {
		const now = this.clock.now();
		const run = await this.uow.runSystemOperation(LOAD_TEST_WRITE_OPERATION, actor, async (scope) => {
			const found = await scope.loadTests.find(runId);
			if (found === null) {
				throw new LoadTestNotFoundError(runId);
			}
			if (found.status !== "QUEUED" && found.status !== "RUNNING") {
				throw new LoadTestNotRunningError(runId);
			}
			return scope.loadTests.requestAbort(runId, "Aborted by an operator", now);
		});
		await this.live.requestStop(loadTestStopKey(runId));
		if (run.status === "QUEUED" && (await this.queue.removeWaiting(runId))) {
			await this.uow.runSystemOperation(LOAD_TEST_WRITE_OPERATION, actor, (scope) =>
				scope.loadTests.finish(runId, {
					status: "ABORTED",
					at: now,
					abortReason: "Aborted by an operator before it started",
					error: null,
					totals: { requests: 0, failures: 0, p50Ms: null, p95Ms: null, p99Ms: null, peakRps: null },
				}),
			);
		}
		const updated = await this.uow.runSystemOperation(LOAD_TEST_WRITE_OPERATION, actor, (scope) => scope.loadTests.find(runId));
		return toLoadTestRun(updated ?? run);
	}
}

@CommandHandler(UpdateLoadTestCapsCommand)
export class UpdateLoadTestCapsHandler implements ICommandHandler<UpdateLoadTestCapsCommand, LoadTestCaps> {
	public constructor(@Inject(OPS_UNIT_OF_WORK) private readonly uow: UnitOfWork<OperationsScope>) {}

	public async execute({ actor, caps }: UpdateLoadTestCapsCommand): Promise<LoadTestCaps> {
		await this.uow.runSystemOperation(OPS_SETTINGS_WRITE_OPERATION, actor, (scope) => scope.settings.updateLoadTestCaps(caps));
		return caps;
	}
}

@CommandHandler(PurgeLoadTestDataCommand)
export class PurgeLoadTestDataHandler implements ICommandHandler<PurgeLoadTestDataCommand, LoadTestPurgeResult> {
	public constructor(@Inject(OPS_UNIT_OF_WORK) private readonly uow: UnitOfWork<OperationsScope>) {}

	/** Refused while a run is queued or running: it would delete rows the run is still writing. */
	public async execute({ actor }: PurgeLoadTestDataCommand): Promise<LoadTestPurgeResult> {
		return this.uow.runSystemOperation(LOAD_TEST_PURGE_OPERATION, actor, async (scope) => {
			if ((await scope.loadTests.findActive()) !== null) {
				throw new LoadTestPurgeBlockedError();
			}
			return scope.purge.purge();
		});
	}
}
