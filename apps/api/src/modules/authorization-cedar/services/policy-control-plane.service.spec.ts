import { beforeEach, describe, expect, it, vi } from "vitest";
import type { AuthorizationPolicyDraft, AuthorizationPolicyScope, AuthorizationPolicySimulation } from "@prisma/client";
import { LIST_SLOT_INDEX, nowEpochMs, type EpochMs, type OrganizationMembershipRole, type PolicyBuilderPayload } from "@workspace/shared";
import { randomUUID } from "node:crypto";

import { createTestTypedConfig } from "../../../../test/support/test-api-env";
import { createTestPrisma } from "../../../../test/support/test-service-graph";
import { RequestContextService } from "../../../common/context/request-context";
import { AppError } from "../../../common/errors/app-error";
import { TenantTransactionService } from "../../../prisma/tenant-transaction.service";
import { AccessTokenStateService } from "../../auth/services/access-token-state.service";
import { AuthorizationCacheService } from "../../authorization/cache/authorization-cache.service";
import { AuthorizationInvalidationService } from "../../authorization/cache/authorization-invalidation.service";
import { REWARDHUB_DEFAULT_TENANT_CEDAR } from "../../organization/utils/rewardhub-policy-seed.util";
import {
	MAX_SIMULATED_PRINCIPALS,
	POLICY_PUBLISH_GLOBAL_LOCK_KEY,
	policySlotLockKey,
	SIMULATED_CEDAR_ACTIONS,
	SIMULATION_PAGE_SIZE,
	SIMULATION_VALIDITY_MS,
} from "../constants/policy-control-plane.constants";
import {
	PolicyControlPlaneRepository,
	type ActivePolicyVersion,
	type CreatePolicyDraftRecord,
	type CreatePolicySimulationRecord,
	type CreatePolicyVersionRecord,
	type PolicyAuditRecord,
	type PolicySlot,
	type SimulationPrincipal,
} from "../repositories/policy-control-plane.repository";
import { CedarWasmPolicyEngine } from "../engine/cedar-wasm-policy-engine";
import { CedarPolicyEvaluatorService } from "./cedar-policy-evaluator.service";
import { POLICY_ERROR_CODES, PolicyControlPlaneService, type PolicyControlPlaneActor } from "./policy-control-plane.service";
import { PolicyBundleCacheRegistration } from "./policy-bundle-cache.registration";
import { PolicySimulationService } from "./policy-simulation.service";

const tx = vi.hoisted(() => {
	const operations: string[] = [];
	const state: { run: <T>(work: () => Promise<T>) => Promise<T> } = { run: async <T>(work: () => Promise<T>): Promise<T> => work() };
	return { operations, state };
});

// Each system operation runs through the in-memory store's transaction (rollback on throw).
vi.mock("../../../prisma/tenant-transaction.service", () => ({
	TenantTransactionService: class {
		public readonly withSystemOperation = async <T>(context: { readonly operation: string }, work: (db: object) => Promise<T>): Promise<T> => {
			tx.operations.push(context.operation);
			return tx.state.run(async () => work({}));
		};
	},
}));

const AUTHOR: PolicyControlPlaneActor = { userId: "11111111-1111-4111-8111-111111111111", isImpersonating: false };
const APPROVER: PolicyControlPlaneActor = { userId: "22222222-2222-4222-8222-222222222222", isImpersonating: false };
const ORG_A = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const ORG_B = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";
const OWNER_A = "a0000000-0000-4000-8000-000000000001";
const ADMIN_A = "a0000000-0000-4000-8000-000000000002";
const CASHIER_A = "a0000000-0000-4000-8000-000000000003";
const OWNER_B = "b0000000-0000-4000-8000-000000000001";

const OWNERS_AND_ADMINS: PolicyBuilderPayload = { templateId: "tenant.role_capability", parameters: { allowedRoles: ["OWNER", "ADMIN"] } };
const CASHIERS_ONLY: PolicyBuilderPayload = { templateId: "tenant.role_capability", parameters: { allowedRoles: ["CASHIER"] } };
/** A valid published guardrail (Cedar, against the RewardHub schema). */
const GUARDRAIL_REMOVE_LAST_OWNER = 'forbid(principal, action == RewardHub::Action::"removeLastOwner", resource);';
const NO_ESCALATION: PolicyBuilderPayload = { templateId: "platform.guardrail.no_escalation", parameters: {} };

interface StoredVersion extends ActivePolicyVersion {
	readonly draftId: string;
	supersededAt: EpochMs | null;
	readonly publishedById: string;
}

interface StoreState {
	drafts: AuthorizationPolicyDraft[];
	versions: StoredVersion[];
	simulations: AuthorizationPolicySimulation[];
	audits: PolicyAuditRecord[];
}

/**
 * In-memory repository with the SQL semantics the service relies on: the
 * conditional claim, per-slot max version, and transactional rollback.
 */
class InMemoryPolicyRepository extends PolicyControlPlaneRepository {
	public state: StoreState = { drafts: [], versions: [], simulations: [], audits: [] };
	public principals: SimulationPrincipal[] = [];
	public readonly locks: { readonly globalKey: string; readonly slotKey: string; readonly exclusiveGlobal: boolean }[] = [];
	public readonly principalPageRequests: { readonly organizationId: string | null; readonly take: number }[] = [];
	/** Simulates a concurrent transaction that claimed the draft between our read and our claim. */
	public loseNextClaim = false;

	private queue: Promise<void> = Promise.resolve();

	/** Serialized like the advisory locks serialize real publishes; a throw rolls the store back. */
	public async transaction<T>(work: () => Promise<T>): Promise<T> {
		const run = this.queue.then(async (): Promise<T> => {
			const snapshot: StoreState = structuredClone(this.state);
			try {
				return await work();
			} catch (error) {
				this.state = snapshot;
				throw error;
			}
		});
		this.queue = run.then(
			() => undefined,
			() => undefined,
		);
		return run;
	}

	public override createDraft(record: CreatePolicyDraftRecord): Promise<AuthorizationPolicyDraft> {
		const now = BigInt(nowEpochMs());
		const draft: AuthorizationPolicyDraft = {
			id: randomUUID(),
			organizationId: record.organizationId,
			scope: record.scope,
			name: record.name,
			description: record.description,
			builderPayload: {},
			cedarSource: record.cedarSource,
			sqlPredicate: record.sqlPredicate,
			status: "DRAFT",
			createdById: record.createdById,
			approvedById: null,
			approvalKind: null,
			createdAt: now,
			updatedAt: now,
		};
		this.state.drafts.push(draft);
		return Promise.resolve({ ...draft });
	}

	public override findDraft(draftId: string): Promise<AuthorizationPolicyDraft | null> {
		const draft = this.state.drafts.find((row) => row.id === draftId);
		return Promise.resolve(draft === undefined ? null : { ...draft });
	}

	public override lockForPublish(globalKey: string, slotKey: string, exclusiveGlobal: boolean): Promise<void> {
		this.locks.push({ globalKey, slotKey, exclusiveGlobal });
		return Promise.resolve();
	}

	public override claimDraftForPublish(draftId: string, approverUserId: string, now: EpochMs): Promise<number> {
		if (this.loseNextClaim) {
			this.loseNextClaim = false;
			const raced = this.state.drafts.find((row) => row.id === draftId);
			if (raced !== undefined) {
				raced.status = "PUBLISHED";
			}
			return Promise.resolve(0);
		}
		const draft = this.state.drafts.find((row) => row.id === draftId && row.status === "DRAFT" && row.createdById !== approverUserId);
		if (draft === undefined) {
			return Promise.resolve(0);
		}
		draft.status = "PUBLISHED";
		draft.approvedById = approverUserId;
		draft.approvalKind = "FOUR_EYES";
		draft.updatedAt = BigInt(now);
		return Promise.resolve(1);
	}

	public override findLatestSimulation(draftId: string): Promise<AuthorizationPolicySimulation | null> {
		return Promise.resolve(this.state.simulations.filter((row) => row.draftId === draftId).at(-1) ?? null);
	}

	public override findActiveVersionsForOrganizations(organizationIds: readonly string[]): Promise<ActivePolicyVersion[]> {
		return Promise.resolve(
			this.active().filter(
				(row) => (row.organizationId !== null && organizationIds.includes(row.organizationId)) || (row.organizationId === null && row.scope === "PLATFORM_GUARDRAIL"),
			),
		);
	}

	public override findBaselineVersionIds(organizationId: string | null): Promise<string[]> {
		return Promise.resolve(
			this.active()
				.filter((row) => organizationId === null || row.organizationId === organizationId || (row.organizationId === null && row.scope === "PLATFORM_GUARDRAIL"))
				.map((row) => row.id),
		);
	}

	public override countActivePrincipals(organizationId: string | null): Promise<number> {
		return Promise.resolve(this.principals.filter((row) => organizationId === null || row.organizationId === organizationId).length);
	}

	public override listActivePrincipals(organizationId: string | null, afterMembershipId: string | null, take: number): Promise<SimulationPrincipal[]> {
		this.principalPageRequests.push({ organizationId, take });
		return Promise.resolve(
			this.principals
				.filter((row) => (organizationId === null || row.organizationId === organizationId) && (afterMembershipId === null || row.id > afterMembershipId))
				.sort((left, right) => left.id.localeCompare(right.id))
				.slice(0, take),
		);
	}

	public override createSimulation(record: CreatePolicySimulationRecord): Promise<void> {
		this.state.simulations.push({
			id: record.id,
			draftId: record.draftId,
			actorUserId: record.actorUserId,
			result: {},
			passed: record.passed,
			baselineFingerprint: record.baselineFingerprint,
			createdAt: BigInt(nowEpochMs()),
		});
		return Promise.resolve();
	}

	public override findMaxVersion(slot: PolicySlot): Promise<number> {
		return Promise.resolve(Math.max(0, ...this.inSlot(slot).map((row) => row.version)));
	}

	public override supersedeActiveVersion(slot: PolicySlot, now: EpochMs): Promise<void> {
		for (const row of this.inSlot(slot).filter((version) => version.supersededAt === null)) {
			row.supersededAt = now;
		}
		return Promise.resolve();
	}

	public override createVersion(record: CreatePolicyVersionRecord): Promise<{ readonly id: string; readonly version: number }> {
		const id: string = randomUUID();
		this.state.versions.push({
			id,
			organizationId: record.organizationId,
			scope: record.scope,
			version: record.version,
			cedarSource: record.cedarSource,
			draftId: record.draftId,
			supersededAt: null,
			publishedById: record.publishedById,
		});
		return Promise.resolve({ id, version: record.version });
	}

	public override appendAudit(record: PolicyAuditRecord): Promise<void> {
		this.state.audits.push(record);
		return Promise.resolve();
	}

	public seedVersion(organizationId: string | null, scope: AuthorizationPolicyScope, version: number, cedarSource: string): void {
		this.state.versions.push({ id: randomUUID(), organizationId, scope, version, cedarSource, draftId: randomUUID(), supersededAt: null, publishedById: AUTHOR.userId });
	}

	public addPrincipal(organizationId: string, userId: string, role: OrganizationMembershipRole): void {
		this.principals.push({ id: randomUUID(), organizationId, userId, role, locationScope: "ALL_LOCATIONS", locationIds: [] });
	}

	private active(): StoredVersion[] {
		return this.state.versions.filter((row) => row.supersededAt === null);
	}

	private inSlot(slot: PolicySlot): StoredVersion[] {
		return this.state.versions.filter((row) => row.organizationId === slot.organizationId && row.scope === slot.scope);
	}
}

let repository: InMemoryPolicyRepository;
let cedar: CedarPolicyEvaluatorService;
let service: PolicyControlPlaneService;

function build(): void {
	repository = new InMemoryPolicyRepository();
	tx.state.run = async <T>(work: () => Promise<T>): Promise<T> => repository.transaction(work);
	tx.operations.length = 0;
	const tenantTx = new TenantTransactionService(createTestPrisma(), new RequestContextService());
	const engine = new CedarWasmPolicyEngine();
	cedar = new CedarPolicyEvaluatorService(tenantTx, engine);
	// Real invalidation service (single instance, no Redis) with the evaluator registered as a bundle cache.
	const config = createTestTypedConfig();
	const invalidation = new AuthorizationInvalidationService(
		new AuthorizationCacheService(config),
		new AccessTokenStateService(createTestPrisma(config), config),
		config,
		null,
		null,
	);
	new PolicyBundleCacheRegistration(invalidation, cedar).onModuleInit();
	service = new PolicyControlPlaneService(tenantTx, repository, new PolicySimulationService(tenantTx, repository, engine), invalidation, new RequestContextService(), engine);
}

async function expectAppError(promise: Promise<object>, code: string): Promise<void> {
	await expect(promise).rejects.toBeInstanceOf(AppError);
	await expect(promise).rejects.toMatchObject({ code });
}

async function tenantDraft(payload: PolicyBuilderPayload = OWNERS_AND_ADMINS, organizationId: string = ORG_A): Promise<string> {
	const created = await service.createDraft(AUTHOR, { scope: "TENANT", organizationId, name: "Tenant policy", builderPayload: payload });
	return created.draftId;
}

describe("PolicyControlPlaneService", () => {
	beforeEach(() => {
		build();
		repository.seedVersion(ORG_A, "TENANT", 1, REWARDHUB_DEFAULT_TENANT_CEDAR);
		repository.addPrincipal(ORG_A, OWNER_A, "OWNER");
		repository.addPrincipal(ORG_A, ADMIN_A, "ADMIN");
		repository.addPrincipal(ORG_A, CASHIER_A, "CASHIER");
	});

	describe("createDraft", () => {
		it("stores a TENANT draft against the requested organization and audits it with the real actor", async () => {
			const draftId = await tenantDraft();
			const draft = repository.state.drafts.find((row) => row.id === draftId);
			expect(draft?.organizationId).toBe(ORG_A);
			expect(draft?.createdById).toBe(AUTHOR.userId);
			expect(repository.state.audits).toEqual([expect.objectContaining({ draftId, action: "policy.draft.created", actorUserId: AUTHOR.userId })]);
			expect(repository.state.audits[LIST_SLOT_INDEX.first]).toMatchObject({ organizationId: ORG_A, resourceType: "AuthorizationPolicyDraft", policyVersionIds: [] });
			expect(repository.state.audits[LIST_SLOT_INDEX.first]?.details).toMatchObject({ scope: "TENANT", name: "Tenant policy" });
		});

		it("stores a platform-scope draft without an organization", async () => {
			const { draftId } = await service.createDraft(AUTHOR, { scope: "PLATFORM_GUARDRAIL", name: "Guardrail", builderPayload: NO_ESCALATION });
			expect(repository.state.drafts.find((row) => row.id === draftId)?.organizationId).toBeNull();
		});

		it.each([
			["an unknown template", { templateId: "tenant.permit_everything", parameters: {} }],
			["a role outside the membership roles", { templateId: "tenant.role_capability", parameters: { allowedRoles: ['OWNER" || true || "'] } }],
		])("rejects %s with POLICY_VALIDATION_FAILED and stores nothing", async (_label, builderPayload) => {
			await expectAppError(service.createDraft(AUTHOR, { scope: "TENANT", organizationId: ORG_A, name: "Bad", builderPayload }), POLICY_ERROR_CODES.invalidPolicy);
			expect(repository.state.drafts).toHaveLength(0);
			expect(repository.state.audits).toHaveLength(0);
		});

		it("refuses impersonated sessions", async () => {
			await expectAppError(
				service.createDraft({ ...AUTHOR, isImpersonating: true }, { scope: "TENANT", organizationId: ORG_A, name: "x", builderPayload: OWNERS_AND_ADMINS }),
				POLICY_ERROR_CODES.impersonationForbidden,
			);
			expect(repository.state.drafts).toHaveLength(0);
		});
	});

	describe("simulate", () => {
		it("evaluates the draft against the published policy over the organization's real principals", async () => {
			const draftId = await tenantDraft(OWNERS_AND_ADMINS);

			const result = await service.simulate(draftId, APPROVER);

			expect(result.passed).toBe(true);
			expect(result.evaluatedPrincipalCount).toBe(3);
			// Only the cashier loses access: every runtime action flips Allow → Deny.
			expect(result.affectedPrincipalCount).toBe(1);
			expect(result.wouldLockOutOwners).toBe(false);
			expect(result.decisionChanges).toHaveLength(SIMULATED_CEDAR_ACTIONS.length);
			expect(result.decisionChanges.every((change) => change.userId === CASHIER_A && change.before === "Allow" && change.after === "Deny")).toBe(true);
			expect(repository.principalPageRequests).toEqual([{ organizationId: ORG_A, take: SIMULATION_PAGE_SIZE }]);
			expect(repository.state.simulations).toEqual([expect.objectContaining({ id: result.simulationId, draftId, passed: true, actorUserId: APPROVER.userId })]);
			expect(repository.state.simulations[LIST_SLOT_INDEX.first]?.baselineFingerprint).toMatch(/^[0-9a-f]{64}$/);
			expect(repository.state.audits.at(-1)).toMatchObject({ action: "policy.draft.simulated", actorUserId: APPROVER.userId });
		});

		it("fails the simulation when owners would lose the ability to manage their organization", async () => {
			const draftId = await tenantDraft(CASHIERS_ONLY);

			const result = await service.simulate(draftId, APPROVER);

			expect(result.wouldLockOutOwners).toBe(true);
			expect(result.passed).toBe(false);
			expect(result.affectedPrincipalCount).toBe(2);
			expect(result.errors.join(" ")).toContain(ORG_A);
		});

		it("evaluates a platform guardrail over the principals of every organization", async () => {
			repository.seedVersion(ORG_B, "TENANT", 1, REWARDHUB_DEFAULT_TENANT_CEDAR);
			repository.addPrincipal(ORG_B, OWNER_B, "OWNER");
			const { draftId } = await service.createDraft(AUTHOR, { scope: "PLATFORM_GUARDRAIL", name: "Guardrail", builderPayload: NO_ESCALATION });

			const result = await service.simulate(draftId, APPROVER);

			expect(result.evaluatedPrincipalCount).toBe(4);
			expect(repository.principalPageRequests.every((request) => request.organizationId === null)).toBe(true);
			// The guardrail forbids only guardrail actions: no capability decision changes in either organization.
			expect(result.affectedPrincipalCount).toBe(0);
			expect(result.wouldLockOutOwners).toBe(false);
			expect(result.passed).toBe(true);
		});

		it("refuses to evaluate more principals than the named limit", async () => {
			for (let index = 0; index <= MAX_SIMULATED_PRINCIPALS; index += 1) {
				repository.addPrincipal(ORG_A, randomUUID(), "MEMBER");
			}
			const draftId = await tenantDraft();

			const result = await service.simulate(draftId, APPROVER);

			expect(result.passed).toBe(false);
			expect(result.errors.join(" ")).toContain(String(MAX_SIMULATED_PRINCIPALS));
			// Rejected by the COUNT before any principal is read or evaluated.
			expect(result.evaluatedPrincipalCount).toBe(0);
			expect(repository.principalPageRequests).toEqual([]);
		});

		it("rejects a draft that is no longer a draft", async () => {
			const draftId = await tenantDraft();
			await service.simulate(draftId, APPROVER);
			await service.publish(draftId, APPROVER, undefined);
			await expectAppError(service.simulate(draftId, APPROVER), POLICY_ERROR_CODES.draftNotPublishable);
		});
	});

	describe("publish", () => {
		it("rejects the draft's author approving their own draft (four-eyes) and changes nothing", async () => {
			const draftId = await tenantDraft();
			await service.simulate(draftId, AUTHOR);

			await expectAppError(service.publish(draftId, AUTHOR, undefined), POLICY_ERROR_CODES.selfApprovalForbidden);

			expect(repository.state.drafts.find((row) => row.id === draftId)?.status).toBe("DRAFT");
			expect(repository.state.versions).toHaveLength(1);
		});

		it("publishes the next version when a second SuperAdmin approves, recording the approver", async () => {
			const draftId = await tenantDraft();
			await service.simulate(draftId, APPROVER);
			const invalidate = vi.spyOn(cedar, "invalidateOrganization");

			const published = await service.publish(draftId, APPROVER, "Reviewed");

			expect(published).toEqual({ version: 2 });
			const draft = repository.state.drafts.find((row) => row.id === draftId);
			expect(draft).toMatchObject({ status: "PUBLISHED", approvedById: APPROVER.userId, approvalKind: "FOUR_EYES" });
			expect(repository.state.versions.filter((row) => row.supersededAt === null)).toEqual([expect.objectContaining({ draftId, version: 2, publishedById: APPROVER.userId })]);
			expect(repository.locks).toEqual([{ globalKey: POLICY_PUBLISH_GLOBAL_LOCK_KEY, slotKey: policySlotLockKey(ORG_A, "TENANT"), exclusiveGlobal: false }]);
			expect(repository.state.audits.at(-1)).toMatchObject({ action: "policy.draft.published", actorUserId: APPROVER.userId });
			const publishedVersionId = repository.state.versions.find((row) => row.draftId === draftId)?.id;
			expect(repository.state.audits.at(-1)?.policyVersionIds).toEqual([publishedVersionId]);
			expect(repository.state.audits.at(-1)?.details).toMatchObject({ version: 2, authorUserId: AUTHOR.userId, approverUserId: APPROVER.userId, approvalNote: "Reviewed" });
			expect(invalidate).toHaveBeenCalledWith(ORG_A);
		});

		it("numbers platform versions per platform slot and serializes them on the exclusive global lock", async () => {
			repository.seedVersion(null, "PLATFORM_GUARDRAIL", 1, GUARDRAIL_REMOVE_LAST_OWNER);
			const { draftId } = await service.createDraft(AUTHOR, { scope: "PLATFORM_GUARDRAIL", name: "Guardrail", builderPayload: NO_ESCALATION });
			await service.simulate(draftId, APPROVER);
			const invalidateAll = vi.spyOn(cedar, "invalidateAll");

			const published = await service.publish(draftId, APPROVER, undefined);

			expect(published).toEqual({ version: 2 });
			expect(repository.locks).toEqual([{ globalKey: POLICY_PUBLISH_GLOBAL_LOCK_KEY, slotKey: policySlotLockKey(null, "PLATFORM_GUARDRAIL"), exclusiveGlobal: true }]);
			expect(repository.state.versions.filter((row) => row.organizationId === null && row.supersededAt === null)).toEqual([expect.objectContaining({ version: 2, draftId })]);
			expect(invalidateAll).toHaveBeenCalledOnce();
		});

		it("fails with a conflict and writes nothing when a concurrent publish already claimed the draft", async () => {
			const draftId = await tenantDraft();
			await service.simulate(draftId, APPROVER);
			repository.loseNextClaim = true;
			const auditsBefore = repository.state.audits.length;

			await expectAppError(service.publish(draftId, APPROVER, undefined), POLICY_ERROR_CODES.draftNotPublishable);

			expect(repository.state.versions).toHaveLength(1);
			expect(repository.state.audits).toHaveLength(auditsBefore);
		});

		it("lets only one of two publishes of the same draft succeed", async () => {
			const draftId = await tenantDraft();
			await service.simulate(draftId, APPROVER);

			const outcomes = await Promise.allSettled([service.publish(draftId, APPROVER, undefined), service.publish(draftId, APPROVER, undefined)]);

			expect(outcomes.filter((outcome) => outcome.status === "fulfilled")).toHaveLength(1);
			expect(repository.state.versions.filter((row) => row.draftId === draftId)).toHaveLength(1);
		});

		it("requires a simulation", async () => {
			const draftId = await tenantDraft();
			await expectAppError(service.publish(draftId, APPROVER, undefined), POLICY_ERROR_CODES.simulationRequired);
			expect(repository.state.drafts.find((row) => row.id === draftId)?.status).toBe("DRAFT");
		});

		it("requires the latest simulation to have passed", async () => {
			const draftId = await tenantDraft(CASHIERS_ONLY);
			await service.simulate(draftId, APPROVER);
			await expectAppError(service.publish(draftId, APPROVER, undefined), POLICY_ERROR_CODES.simulationFailed);
		});

		it("rejects a simulation run against a baseline that has since changed", async () => {
			const draftId = await tenantDraft();
			await service.simulate(draftId, APPROVER);
			repository.seedVersion(null, "PLATFORM_GUARDRAIL", 1, GUARDRAIL_REMOVE_LAST_OWNER);

			await expectAppError(service.publish(draftId, APPROVER, undefined), POLICY_ERROR_CODES.simulationStale);
		});

		it("rejects an expired simulation", async () => {
			const draftId = await tenantDraft();
			await service.simulate(draftId, APPROVER);
			const simulation = repository.state.simulations.at(-1);
			if (simulation !== undefined) {
				simulation.createdAt -= BigInt(SIMULATION_VALIDITY_MS + 1);
			}

			await expectAppError(service.publish(draftId, APPROVER, undefined), POLICY_ERROR_CODES.simulationStale);
		});

		it("refuses impersonated sessions (an impersonated SuperAdmin cannot be the second approver)", async () => {
			const draftId = await tenantDraft();
			await service.simulate(draftId, APPROVER);
			await expectAppError(service.publish(draftId, { ...APPROVER, isImpersonating: true }, undefined), POLICY_ERROR_CODES.impersonationForbidden);
		});

		it("runs every step under the policy system operations", async () => {
			const draftId = await tenantDraft();
			await service.simulate(draftId, APPROVER);
			await service.publish(draftId, APPROVER, undefined);
			expect(new Set(tx.operations)).toEqual(new Set(["policy.draft.create", "policy.draft.simulate", "policy.simulation.record", "policy.publish"]));
		});
	});
});
