import { Inject, Injectable } from "@nestjs/common";
import type { AuthorizationPolicyDraft, AuthorizationPolicySimulation } from "@prisma/client";
import {
	nowEpochMs,
	type CreatePolicyDraftInput,
	type EpochMs,
	type PolicyDraftCreatedResponse,
	type PolicyPublishResponse,
	type PolicySimulationResult,
} from "@workspace/shared";
import { createHash, randomUUID } from "node:crypto";

import { RequestContextService } from "../../../common/context/request-context";
import { AuthorizationError, ConflictError, NotFoundError, ValidationError } from "../../../common/errors/app-error";
import { TenantTransactionService } from "../../../prisma/tenant-transaction.service";
import { AuthorizationInvalidationService } from "../../authorization/cache/authorization-invalidation.service";
import {
	POLICY_AUDIT_ACTIONS,
	POLICY_DRAFT_AUDIT_RESOURCE,
	POLICY_PUBLISH_GLOBAL_LOCK_KEY,
	policySlotLockKey,
	SIMULATION_VALIDITY_MS,
} from "../constants/policy-control-plane.constants";
import { PolicyControlPlaneRepository, type PolicyControlPlaneDbClient, type PolicySlot } from "../repositories/policy-control-plane.repository";
import { PolicySimulationService, type PolicySimulationRun } from "./policy-simulation.service";
import { POLICY_ENGINE, type PolicyEngine, type PolicyValidationResult } from "../engine/policy-engine.port";
import { PolicyTemplateCompiler, PolicyTemplateError, type CompiledPolicy } from "./policy-template.compiler";

/**
 * The SuperAdmin acting on the control plane. Impersonated sessions are
 * refused outright: a SuperAdmin impersonating another SuperAdmin would
 * otherwise satisfy the four-eyes rule alone.
 */
export interface PolicyControlPlaneActor {
	readonly userId: string;
	readonly isImpersonating: boolean;
}

/** Stable error codes clients can match on. */
export const POLICY_ERROR_CODES = {
	impersonationForbidden: "POLICY_IMPERSONATION_FORBIDDEN",
	selfApprovalForbidden: "POLICY_SELF_APPROVAL_FORBIDDEN",
	draftNotPublishable: "POLICY_DRAFT_NOT_PUBLISHABLE",
	simulationRequired: "POLICY_SIMULATION_REQUIRED",
	simulationFailed: "POLICY_SIMULATION_FAILED",
	simulationStale: "POLICY_SIMULATION_STALE",
	invalidPolicy: "POLICY_VALIDATION_FAILED",
} satisfies Record<string, string>;

/**
 * Policy control plane: draft → simulate → publish.
 *
 * - Every operation is SuperAdmin-only (controller) and refused for
 *   impersonated sessions.
 * - Publishing is four-eyes: the draft's author can never publish it; a
 *   second SuperAdmin approves by publishing, and is recorded as approver.
 * - Publish is one transaction: advisory locks on the policy slot, a
 *   conditional claim of the draft, a simulation that passed against the
 *   CURRENT published baseline, the next version computed under the lock
 *   (uniqueness is also enforced by unique indexes, partial ones for the NULL-organization platform slots), and the
 *   audit row.
 */
@Injectable()
export class PolicyControlPlaneService {
	private readonly compiler: PolicyTemplateCompiler = new PolicyTemplateCompiler();

	public constructor(
		private readonly tenantTx: TenantTransactionService,
		private readonly repository: PolicyControlPlaneRepository,
		private readonly simulation: PolicySimulationService,
		private readonly invalidation: AuthorizationInvalidationService,
		private readonly requestContext: RequestContextService,
		@Inject(POLICY_ENGINE) private readonly engine: PolicyEngine,
	) {}

	public async createDraft(actor: PolicyControlPlaneActor, input: CreatePolicyDraftInput): Promise<PolicyDraftCreatedResponse> {
		this.assertNotImpersonating(actor);
		const organizationId: string | null = input.scope === "TENANT" ? (input.organizationId ?? null) : null;
		if (input.scope === "TENANT" && organizationId === null) {
			throw new ValidationError({ message: "A TENANT policy draft must name its organization" });
		}
		const compiled: CompiledPolicy = this.compileAndValidate(input);

		const draft: AuthorizationPolicyDraft = await this.tenantTx.withSystemOperation(
			{ operation: "policy.draft.create", reason: "Create policy draft", actorUserId: actor.userId },
			async (db: PolicyControlPlaneDbClient): Promise<AuthorizationPolicyDraft> => {
				const created = await this.repository.createDraft(
					{
						organizationId,
						scope: input.scope,
						name: input.name,
						description: input.description ?? null,
						builderPayload: input.builderPayload,
						cedarSource: compiled.cedarSource,
						sqlPredicate: compiled.sqlPredicate,
						createdById: actor.userId,
					},
					db,
				);
				await this.audit(db, created, POLICY_AUDIT_ACTIONS.draftCreated, actor.userId, [], { name: created.name });
				return created;
			},
		);

		return { draftId: draft.id };
	}

	public async simulate(draftId: string, actor: PolicyControlPlaneActor): Promise<PolicySimulationResult> {
		this.assertNotImpersonating(actor);
		const found: AuthorizationPolicyDraft | null = await this.tenantTx.withSystemOperation(
			{ operation: "policy.draft.simulate", reason: "Load policy draft for simulation", actorUserId: actor.userId },
			async (db: PolicyControlPlaneDbClient): Promise<AuthorizationPolicyDraft | null> => this.repository.findDraft(draftId, db),
		);
		const draft: AuthorizationPolicyDraft = this.requireDraft(found);
		if (draft.status !== "DRAFT") {
			throw new ConflictError({ code: POLICY_ERROR_CODES.draftNotPublishable, message: "Only an unpublished draft can be simulated" });
		}

		const run: PolicySimulationRun = await this.simulation.simulate(draft, actor.userId);
		const result: PolicySimulationResult = { simulationId: randomUUID(), ...run.outcome };

		await this.tenantTx.withSystemOperation(
			{ operation: "policy.simulation.record", reason: "Persist policy simulation result", actorUserId: actor.userId },
			async (db: PolicyControlPlaneDbClient): Promise<void> => {
				await this.repository.createSimulation(
					{
						id: result.simulationId,
						draftId,
						actorUserId: actor.userId,
						result,
						passed: result.passed,
						baselineFingerprint: run.baselineFingerprint,
					},
					db,
				);
				await this.audit(db, draft, POLICY_AUDIT_ACTIONS.draftSimulated, actor.userId, [], {
					simulationId: result.simulationId,
					passed: result.passed,
					evaluatedPrincipalCount: result.evaluatedPrincipalCount,
					affectedPrincipalCount: result.affectedPrincipalCount,
				});
			},
		);

		return result;
	}

	/** Approve-and-publish by a SECOND SuperAdmin (four-eyes). */
	public async publish(draftId: string, approver: PolicyControlPlaneActor, approvalNote: string | undefined): Promise<PolicyPublishResponse> {
		this.assertNotImpersonating(approver);
		const published: { readonly slot: PolicySlot; readonly version: number } = await this.tenantTx.withSystemOperation(
			{ operation: "policy.publish", reason: "Approve and publish policy draft", actorUserId: approver.userId },
			async (db: PolicyControlPlaneDbClient) => {
				const draft: AuthorizationPolicyDraft = this.requireDraft(await this.repository.findDraft(draftId, db));
				if (draft.createdById === approver.userId) {
					throw new AuthorizationError({ code: POLICY_ERROR_CODES.selfApprovalForbidden, message: "A policy draft must be approved by a SuperAdmin other than its author" });
				}
				const slot: PolicySlot = { organizationId: draft.organizationId, scope: draft.scope };
				await this.repository.lockForPublish(POLICY_PUBLISH_GLOBAL_LOCK_KEY, policySlotLockKey(slot.organizationId, slot.scope), slot.organizationId === null, db);

				const now: EpochMs = nowEpochMs();
				if ((await this.repository.claimDraftForPublish(draftId, approver.userId, now, db)) !== 1) {
					throw new ConflictError({ code: POLICY_ERROR_CODES.draftNotPublishable, message: "The policy draft is no longer publishable" });
				}
				await this.assertSimulationCurrent(draft, await this.repository.findLatestSimulation(draftId, db), now, db);

				const version: number = (await this.repository.findMaxVersion(slot, db)) + 1;
				await this.repository.supersedeActiveVersion(slot, now, db);
				const created = await this.repository.createVersion(
					{
						...slot,
						draftId,
						version,
						cedarSource: draft.cedarSource,
						sqlPredicate: draft.sqlPredicate,
						contentHash: createHash("sha256").update(draft.cedarSource).digest("hex"),
						publishedAt: now,
						publishedById: approver.userId,
					},
					db,
				);
				await this.audit(db, draft, POLICY_AUDIT_ACTIONS.draftPublished, approver.userId, [created.id], {
					version,
					authorUserId: draft.createdById,
					approverUserId: approver.userId,
					approvalNote: approvalNote ?? null,
				});
				return { slot, version };
			},
		);

		// After commit: drop the stale bundles on every instance (a platform slot is in every organization's bundle).
		await this.invalidation.invalidatePolicyBundles(
			published.slot.organizationId === null ? { kind: "all" } : { kind: "organization", organizationId: published.slot.organizationId },
		);
		return { version: published.version };
	}

	/** Compile the builder payload and strictly validate the result against the Cedar schema; reject (400) before anything is stored. */
	private compileAndValidate(input: CreatePolicyDraftInput): CompiledPolicy {
		let compiled: CompiledPolicy;
		try {
			compiled = this.compiler.compile(input.builderPayload, input.scope === "TENANT" ? (input.organizationId ?? null) : null);
		} catch (error) {
			if (error instanceof PolicyTemplateError) {
				throw new ValidationError({ code: POLICY_ERROR_CODES.invalidPolicy, message: error.message, cause: error });
			}
			throw error;
		}
		const validation: PolicyValidationResult = this.engine.validate(compiled.cedarSource);
		if (!validation.valid) {
			throw new ValidationError({
				code: POLICY_ERROR_CODES.invalidPolicy,
				message: "The compiled policy does not validate against the RewardHub Cedar schema",
				details: { errors: [...validation.errors] },
			});
		}
		return compiled;
	}

	private assertNotImpersonating(actor: PolicyControlPlaneActor): void {
		if (actor.isImpersonating) {
			throw new AuthorizationError({ code: POLICY_ERROR_CODES.impersonationForbidden, message: "Policies cannot be changed from an impersonated session" });
		}
	}

	private requireDraft(draft: AuthorizationPolicyDraft | null): AuthorizationPolicyDraft {
		if (draft === null) {
			throw new NotFoundError({ message: "Policy draft not found" });
		}
		return draft;
	}

	/** The latest simulation must have passed, be recent, and have run against the baseline that is published NOW. */
	private async assertSimulationCurrent(
		draft: AuthorizationPolicyDraft,
		latest: AuthorizationPolicySimulation | null,
		now: EpochMs,
		db: PolicyControlPlaneDbClient,
	): Promise<void> {
		if (latest === null) {
			throw new ConflictError({ code: POLICY_ERROR_CODES.simulationRequired, message: "The policy draft must be simulated before it is published" });
		}
		if (!latest.passed) {
			throw new ConflictError({ code: POLICY_ERROR_CODES.simulationFailed, message: "The latest simulation of the policy draft failed" });
		}
		const baseline: string = await this.simulation.currentBaselineFingerprint(draft, db);
		if (now - Number(latest.createdAt) > SIMULATION_VALIDITY_MS || latest.baselineFingerprint !== baseline) {
			throw new ConflictError({ code: POLICY_ERROR_CODES.simulationStale, message: "The published policies or the simulation are out of date; simulate the draft again" });
		}
	}

	private async audit(
		db: PolicyControlPlaneDbClient,
		draft: AuthorizationPolicyDraft,
		action: string,
		actorUserId: string,
		policyVersionIds: readonly string[],
		details: Readonly<Record<string, string | number | boolean | null>>,
	): Promise<void> {
		const request = this.requestContext.current();
		await this.repository.appendAudit(
			{
				draftId: draft.id,
				organizationId: draft.organizationId,
				action,
				resourceType: POLICY_DRAFT_AUDIT_RESOURCE,
				actorUserId,
				policyVersionIds,
				details: { ...details, scope: draft.scope },
				ipAddress: request?.ip ?? null,
				userAgent: request?.userAgent ?? null,
				correlationId: request?.correlationId ?? null,
			},
			db,
		);
	}
}
