import { AuthorizationPolicyScopeSchema, AuthorizationPolicyStatusSchema, JsonValueSchema, type EpochMs } from "@workspace/shared";
import { z } from "zod";

import { AggregateRoot } from "../../../../platform/domain/aggregate-root";
import {
	CorruptAuthorizationStateError,
	PolicyDraftNotPublishableError,
	PolicyImpersonationForbiddenError,
	PolicySelfApprovalForbiddenError,
	PolicySimulationFailedError,
	PolicySimulationRequiredError,
	PolicySimulationStaleError,
	TenantPolicyDraftOrganizationRequiredError,
} from "../errors/authorization.errors";
import { PolicyPublished } from "../events/policy-published.event";

/** `AuthorizationPolicyDraft.name` column width. */
export const POLICY_DRAFT_NAME_MAX_LENGTH = 120;

/** Minutes → ms, for the simulation validity window below. */
const MS_PER_MINUTE = 60_000;

/** A passing simulation older than this must be re-run before publish (memberships drift). */
export const SIMULATION_VALIDITY_MS: number = 60 * MS_PER_MINUTE;

export type AuthorizationPolicyScope = z.output<typeof AuthorizationPolicyScopeSchema>;

const PolicyDraftStateSchema = z
	.object({
		id: z.string().min(1),
		organizationId: z.string().min(1).nullable(),
		scope: AuthorizationPolicyScopeSchema,
		name: z.string().min(1).max(POLICY_DRAFT_NAME_MAX_LENGTH),
		description: z.string().nullable(),
		builderPayload: JsonValueSchema,
		cedarSource: z.string().min(1),
		sqlPredicate: z.string().nullable(),
		status: AuthorizationPolicyStatusSchema,
		createdById: z.string().min(1),
		approvedById: z.string().min(1).nullable(),
		createdAt: z.number().int().nonnegative(),
		updatedAt: z.number().int().nonnegative(),
	})
	// A TENANT draft always names its organization.
	.refine((draft): boolean => draft.scope !== "TENANT" || draft.organizationId !== null);

export type PolicyDraftState = z.output<typeof PolicyDraftStateSchema>;

/** The (organization, scope) slot a draft publishes into: at most one active version per slot. */
export interface PolicySlot {
	readonly organizationId: string | null;
	readonly scope: AuthorizationPolicyScope;
}

/** The SuperAdmin acting on the control plane. Impersonated sessions are refused outright. */
export interface PolicyControlPlaneActor {
	readonly userId: string;
	/** Any impersonation marker counts: a SuperAdmin impersonating another must never satisfy four-eyes alone. */
	readonly isImpersonating: boolean;
}

/** The latest stored simulation of a draft, as publish checks it. */
export interface PolicySimulationSnapshot {
	readonly passed: boolean;
	readonly createdAt: EpochMs;
	/** `null` for a simulation recorded before baseline tracking existed: never accepted for publish. */
	readonly baselineFingerprint: string | null;
}

/** What a draft is created from, after the template compiled and the engine validated it. */
export interface NewPolicyDraft {
	readonly id: string;
	readonly scope: AuthorizationPolicyScope;
	/** Required for TENANT, ignored (stored as `null`) for platform scopes. */
	readonly organizationId: string | null;
	readonly name: string;
	readonly description: string | null;
	readonly builderPayload: z.output<typeof JsonValueSchema>;
	readonly cedarSource: string;
	readonly sqlPredicate: string | null;
	readonly createdById: string;
}

/**
 * A policy draft on its way through draft → simulate → publish.
 *
 * Publishing is four-eyes: the author can never publish their own draft; a second SuperAdmin approves by
 * publishing and is recorded as approver. The latest simulation must have passed, be recent, and have run
 * against the baseline that is published now.
 */
export class AuthorizationPolicyDraftAggregate extends AggregateRoot<PolicyPublished> {
	private constructor(
		private state: PolicyDraftState,
		private readonly loadedStatus: PolicyDraftState["status"],
	) {
		super();
	}

	/** @throws PolicyImpersonationForbiddenError for any impersonated session. */
	public static assertActorMayChangePolicies(actor: PolicyControlPlaneActor): void {
		if (actor.isImpersonating) {
			throw new PolicyImpersonationForbiddenError();
		}
	}

	/** The organization a draft of `scope` belongs to. @throws TenantPolicyDraftOrganizationRequiredError for a TENANT draft without one. */
	public static organizationFor(scope: AuthorizationPolicyScope, requestedOrganizationId: string | null): string | null {
		if (scope !== "TENANT") {
			return null;
		}
		if (requestedOrganizationId === null) {
			throw new TenantPolicyDraftOrganizationRequiredError();
		}
		return requestedOrganizationId;
	}

	public static create(draft: NewPolicyDraft, now: EpochMs): AuthorizationPolicyDraftAggregate {
		const organizationId: string | null = AuthorizationPolicyDraftAggregate.organizationFor(draft.scope, draft.organizationId);
		const state: PolicyDraftState = PolicyDraftStateSchema.parse({
			id: draft.id,
			organizationId,
			scope: draft.scope,
			name: draft.name,
			description: draft.description,
			builderPayload: draft.builderPayload,
			cedarSource: draft.cedarSource,
			sqlPredicate: draft.sqlPredicate,
			status: "DRAFT",
			createdById: draft.createdById,
			approvedById: null,
			createdAt: now,
			updatedAt: now,
		});
		return new AuthorizationPolicyDraftAggregate(state, state.status);
	}

	public static rehydrate(state: PolicyDraftState): AuthorizationPolicyDraftAggregate {
		const parsed = PolicyDraftStateSchema.safeParse(state);
		if (!parsed.success) {
			throw new CorruptAuthorizationStateError("AuthorizationPolicyDraft", state.id);
		}
		return new AuthorizationPolicyDraftAggregate(parsed.data, parsed.data.status);
	}

	public get id(): string {
		return this.state.id;
	}

	public get slot(): PolicySlot {
		return { organizationId: this.state.organizationId, scope: this.state.scope };
	}

	/** Status the draft was loaded with; publish compares it (CAS). */
	public get concurrencyToken(): PolicyDraftState["status"] {
		return this.loadedStatus;
	}

	public snapshot(): PolicyDraftState {
		return { ...this.state };
	}

	/** @throws PolicyDraftNotPublishableError unless the draft is still an unpublished draft. */
	public assertSimulatable(): void {
		if (this.state.status !== "DRAFT") {
			throw new PolicyDraftNotPublishableError("not_a_draft");
		}
	}

	/** Four-eyes, checked before any lock is taken. @throws PolicySelfApprovalForbiddenError for the author. */
	public assertApprovableBy(approverUserId: string): void {
		if (this.state.createdById === approverUserId) {
			throw new PolicySelfApprovalForbiddenError();
		}
	}

	/**
	 * Approve and publish as `version` of the slot. Called under the slot's advisory locks, on a draft
	 * re-read under them: a concurrent publish that already claimed it shows as no longer a draft.
	 */
	public publish(approverUserId: string, version: number, latestSimulation: PolicySimulationSnapshot | null, currentBaseline: string, now: EpochMs): void {
		this.assertApprovableBy(approverUserId);
		if (this.state.status !== "DRAFT") {
			throw new PolicyDraftNotPublishableError("claimed");
		}
		if (latestSimulation === null) {
			throw new PolicySimulationRequiredError();
		}
		if (!latestSimulation.passed) {
			throw new PolicySimulationFailedError();
		}
		if (now - latestSimulation.createdAt > SIMULATION_VALIDITY_MS || latestSimulation.baselineFingerprint !== currentBaseline) {
			throw new PolicySimulationStaleError();
		}
		this.state = { ...this.state, status: "PUBLISHED", approvedById: approverUserId, updatedAt: now };
		this.record(new PolicyPublished(now, this.state.id, this.state.organizationId, version));
	}
}
