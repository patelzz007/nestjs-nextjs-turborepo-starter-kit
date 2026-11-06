import { describe, expect, it } from "vitest";
import { epochMs, type LoadTestJob, type StartLoadTestInput } from "@workspace/shared";

import { createTestTypedConfig } from "../../../../../e2e/support/test-api-env";
import type { ActorContext } from "../../../../platform/application/actor-context";
import type { SystemOperationName } from "../../../../platform/application/system-operation-names";
import type { UnitOfWork } from "../../../../platform/application/unit-of-work.port";
import { MAX_ACTIVE_SESSIONS_PER_USER } from "../../../identity/public-api";
import { LoadTestAlreadyRunningError, LoadTestOverCapError } from "../../domain/errors/operations.errors";
import { StartLoadTestCommand } from "../commands/load-tests/load-test.commands";
import { StartLoadTestHandler } from "../commands/load-tests/load-test.handlers";
import type { OperationsScope } from "../operations-scope";
import type { LoadTestProvisioningPort, LoadTestProvisionRequest, ProvisionedLoadTestTenant } from "../ports/load-test-tenant.port";
import type { LoadTestPasswordPort, LoadTestQueuePort, LoadTestRewardImagePort, LoadTestTrafficPort } from "../ports/load-test.ports";
import type { LoadTestRunRecord, NewLoadTestRun } from "../ports/operations-repositories.port";
import { FakeLiveStore, FakeOperationsUnitOfWork, UnusedLoadTests, superAdminActor } from "./fakes/operations.fakes";

const NOW = 1_800_000_000_000;
const OPERATOR_ID = "019a0000-0000-7000-8000-000000000004";
const TENANT_ID = "019a0000-0000-7000-8000-000000000001";
const PICTURE_ID = "019a0000-0000-7000-8000-000000000003";
const RUN_ID = "019a0000-0000-7000-8000-000000000009";

/** One transaction at a time, recording what ran inside one and what ran between them. */
class RecordingUnitOfWork implements UnitOfWork<OperationsScope> {
	public readonly log: string[] = [];
	public readonly operations: SystemOperationName[] = [];
	public open = false;

	public constructor(private readonly scope: OperationsScope) {}

	public run<TResult>(_actor: ActorContext, work: (scope: OperationsScope) => Promise<TResult>): Promise<TResult> {
		return this.transaction(work);
	}

	public runSystemOperation<TResult>(operation: SystemOperationName, _actor: ActorContext, work: (scope: OperationsScope) => Promise<TResult>): Promise<TResult> {
		this.operations.push(operation);
		return this.transaction(work);
	}

	private async transaction<TResult>(work: (scope: OperationsScope) => Promise<TResult>): Promise<TResult> {
		this.open = true;
		this.log.push("begin");
		try {
			return await work(this.scope);
		} finally {
			this.open = false;
			this.log.push("end");
		}
	}
}

/** The runs: `active` answers each `findActive` in turn (then none); `create` records the new run. */
class ScriptedLoadTests extends UnusedLoadTests {
	public readonly created: NewLoadTestRun[] = [];

	public constructor(private readonly active: (LoadTestRunRecord | null)[] = []) {
		super();
	}

	public override findActive(): Promise<LoadTestRunRecord | null> {
		return Promise.resolve(this.active.shift() ?? null);
	}

	public override create(run: NewLoadTestRun): Promise<LoadTestRunRecord> {
		this.created.push(run);
		return Promise.resolve(runRecord(run));
	}
}

function runRecord(run: NewLoadTestRun): LoadTestRunRecord {
	return {
		...run,
		id: RUN_ID,
		status: "QUEUED",
		requestedByName: "Operator",
		createdAt: epochMs(NOW),
		startedAt: null,
		finishedAt: null,
		abortReason: null,
		totalRequests: null,
		failedRequests: null,
		p50Ms: null,
		p95Ms: null,
		p99Ms: null,
		peakRps: null,
		error: null,
		abortRequestedAt: null,
	};
}

/** The Load Test tenant, recording each provisioning request. */
class RecordingLoadTestTenant implements LoadTestProvisioningPort {
	public readonly provisioned: LoadTestProvisionRequest[] = [];

	public constructor(private readonly uow: () => RecordingUnitOfWork) {}

	public ensureTenant(): Promise<string> {
		this.uow().log.push("ensure tenant");
		return Promise.resolve(TENANT_ID);
	}

	public provision(input: LoadTestProvisionRequest): Promise<ProvisionedLoadTestTenant> {
		this.uow().log.push("provision");
		this.provisioned.push(input);
		return Promise.resolve({
			tenantId: TENANT_ID,
			tenantSlug: "load-test",
			customerEmails: Array.from({ length: input.customers }, (_unused, index) => `customer-${String(index)}@loadtest.invalid`),
			customerPhones: Array.from({ length: input.customers }, (_unused, index) => `+6010900000${String(index)}`),
			staffEmails: Array.from({ length: input.staff }, (_unused, index) => `staff-${String(index)}@loadtest.invalid`),
		});
	}

	public loadTestUserCount(): Promise<number> {
		return Promise.resolve(0);
	}
}

/** The picture port: records each call and whether a transaction was open during it. */
class RecordingRewardImages implements LoadTestRewardImagePort {
	public readonly calls: { readonly tenantId: string; readonly uploadedById: string; readonly insideTransaction: boolean }[] = [];

	public constructor(private readonly uow: () => RecordingUnitOfWork) {}

	public ensure(_actor: ActorContext, tenantId: string, uploadedById: string): Promise<string> {
		this.uow().log.push("picture");
		this.calls.push({ tenantId, uploadedById, insideTransaction: this.uow().open });
		return Promise.resolve(PICTURE_ID);
	}
}

class RecordingQueue implements LoadTestQueuePort {
	public readonly available = true;
	public readonly jobs: LoadTestJob[] = [];

	public enqueue(job: LoadTestJob): Promise<void> {
		this.jobs.push(job);
		return Promise.resolve();
	}

	public removeWaiting(): Promise<boolean> {
		return Promise.resolve(false);
	}
}

const PASSWORDS: LoadTestPasswordPort = { issue: () => Promise.resolve({ password: "run-password", hash: "run-hash" }) };
const TRAFFIC: LoadTestTrafficPort = { issue: () => Promise.resolve() };

function input(overrides: Partial<StartLoadTestInput> = {}): StartLoadTestInput {
	return {
		name: "Nightly mix",
		target: "MIX",
		scenario: null,
		endpoint: null,
		mixWeights: { "sign-in": 1, "browse-marketplace": 1, "claim-reward": 1, "merchant-dashboard": 1, "merchant-rewards": 1 },
		shape: "CONSTANT",
		virtualUsers: 26,
		requestsPerSecond: 50,
		durationSeconds: 120,
		thresholdP95Ms: 1_000,
		thresholdErrorPercent: 1,
		...overrides,
	};
}

interface Fixture {
	readonly handler: StartLoadTestHandler;
	readonly uow: RecordingUnitOfWork;
	readonly tenant: RecordingLoadTestTenant;
	readonly pictures: RecordingRewardImages;
	readonly runs: ScriptedLoadTests;
	readonly queue: RecordingQueue;
}

function setup(active: (LoadTestRunRecord | null)[] = []): Fixture {
	const ops = new FakeOperationsUnitOfWork();
	const runs = new ScriptedLoadTests(active);
	let uow: RecordingUnitOfWork | null = null;
	const current = (): RecordingUnitOfWork => {
		if (uow === null) {
			throw new Error("unit of work not built yet");
		}
		return uow;
	};
	const tenant = new RecordingLoadTestTenant(current);
	const pictures = new RecordingRewardImages(current);
	uow = new RecordingUnitOfWork({ ...ops.scope, loadTests: runs, loadTestTenant: tenant });
	const queue = new RecordingQueue();
	const config = createTestTypedConfig({ LOAD_TESTING_ENABLED: "true" });
	return { handler: new StartLoadTestHandler(uow, queue, PASSWORDS, TRAFFIC, pictures, new FakeLiveStore(), config), uow, tenant, pictures, runs, queue };
}

describe("StartLoadTestHandler", () => {
	it("stores the rewards' picture between two transactions — never inside one — and provisions the rewards with it", async () => {
		const { handler, uow, tenant, pictures } = setup();

		await handler.execute(new StartLoadTestCommand(superAdminActor(OPERATOR_ID), input()));

		expect(uow.log).toEqual(["begin", "ensure tenant", "end", "picture", "begin", "provision", "end"]);
		expect(uow.operations).toEqual(["load_test.write", "load_test.write"]);
		expect(pictures.calls).toEqual([{ tenantId: TENANT_ID, uploadedById: OPERATOR_ID, insideTransaction: false }]);
		expect(tenant.provisioned.map((request) => request.rewardImageFileId)).toEqual([PICTURE_ID]);
	});

	it("provisions and hands the runner enough staff that no account carries more sessions than a user may keep", async () => {
		const { handler, tenant, queue } = setup();

		await handler.execute(new StartLoadTestCommand(superAdminActor(OPERATOR_ID), input({ virtualUsers: 26 })));

		const staff = Math.ceil(26 / MAX_ACTIVE_SESSIONS_PER_USER);
		expect(tenant.provisioned.map((request) => ({ customers: request.customers, staff: request.staff }))).toEqual([{ customers: 26, staff }]);
		const [job] = queue.jobs;
		expect(job?.staff).toHaveLength(staff);
		expect(job?.staff.every((member) => member.password === "run-password")).toBe(true);
	});

	it("refuses a run over the caps before anything is provisioned or stored", async () => {
		const { handler, tenant, pictures } = setup();

		await expect(handler.execute(new StartLoadTestCommand(superAdminActor(OPERATOR_ID), input({ virtualUsers: 301 })))).rejects.toBeInstanceOf(LoadTestOverCapError);

		expect(pictures.calls).toEqual([]);
		expect(tenant.provisioned).toEqual([]);
	});

	it("checks again after storing the picture: a run started meanwhile wins and nothing is provisioned", async () => {
		const { handler, tenant, runs, queue } = setup([null, runRecord({ ...input(), requestedById: OPERATOR_ID })]);

		await expect(handler.execute(new StartLoadTestCommand(superAdminActor(OPERATOR_ID), input()))).rejects.toBeInstanceOf(LoadTestAlreadyRunningError);

		expect(tenant.provisioned).toEqual([]);
		expect(runs.created).toEqual([]);
		expect(queue.jobs).toEqual([]);
	});
});
