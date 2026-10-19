import type { EpochMs, JsonValue, OrganizationMembershipRole, PolicyBuilderPayload, PolicySimulationResult } from "@workspace/shared";

import type { AuthorizationPolicyScope, PolicySimulationSnapshot, PolicySlot } from "../../domain/aggregates/authorization-policy-draft.aggregate";

/** One published (or candidate) policy version that contributes to runtime bundles. */
export interface PolicyBundleSource {
	readonly organizationId: string | null;
	readonly scope: AuthorizationPolicyScope;
	readonly version: number;
	readonly cedarSource: string;
}

/** A published policy version that contributes to runtime bundles. */
export interface ActivePolicyVersion extends PolicyBundleSource {
	readonly id: string;
}

/** An active membership: a principal the runtime evaluates, with the same location scope the runtime reads. */
export interface SimulationPrincipal {
	readonly id: string;
	readonly organizationId: string;
	readonly userId: string;
	readonly role: OrganizationMembershipRole;
	readonly locationScope: string;
	readonly locationIds: readonly string[];
}

export interface NewPolicyVersion extends PolicySlot {
	readonly draftId: string;
	readonly version: number;
	readonly cedarSource: string;
	readonly sqlPredicate: string | null;
	readonly contentHash: string;
	readonly publishedAt: EpochMs;
	readonly publishedById: string;
}

/** Published versions of the policy slots, bound to one control-plane transaction. */
export interface PolicyVersionStore {
	/**
	 * Transaction-scoped advisory locks serializing publishes: the global key (shared for a tenant slot,
	 * exclusive for a platform slot, which changes every organization's bundle), then the slot key.
	 * The fixed order rules out lock-order deadlocks.
	 */
	lockSlotForPublish(slot: PolicySlot): Promise<void>;
	/** Highest version ever published in the slot (0 when none). Call only under the slot lock. */
	maxVersion(slot: PolicySlot): Promise<number>;
	supersedeActive(slot: PolicySlot, now: EpochMs): Promise<void>;
	create(version: NewPolicyVersion): Promise<{ readonly id: string; readonly version: number }>;
	/** Ids of the active versions a simulation's decisions depend on: one organization's bundle, or (`null`) every bundle. */
	baselineVersionIds(organizationId: string | null): Promise<string[]>;
	/** Active versions in the bundles of `organizationIds` (their own plus the platform guardrails). */
	activeVersionsForOrganizations(organizationIds: readonly string[]): Promise<ActivePolicyVersion[]>;
}

export interface NewPolicySimulation {
	readonly id: string;
	readonly draftId: string;
	readonly actorUserId: string;
	readonly result: PolicySimulationResult;
	readonly baselineFingerprint: string;
}

export interface PolicySimulationStore {
	record(simulation: NewPolicySimulation): Promise<void>;
	latestFor(draftId: string): Promise<PolicySimulationSnapshot | null>;
}

/** The principals a simulation evaluates: active organization memberships, read in keyset pages. */
export interface PolicyPrincipalReader {
	countActive(organizationId: string | null): Promise<number>;
	listActive(organizationId: string | null, afterMembershipId: string | null, take: number): Promise<SimulationPrincipal[]>;
}

/** One `AuthorizationAudit` row (bypass-only) for a control-plane change. */
export interface PolicyAuditRecord {
	readonly draftId: string;
	readonly organizationId: string | null;
	readonly scope: AuthorizationPolicyScope;
	readonly action: string;
	readonly actorUserId: string;
	/** Ids of the versions the change produced (empty until publish). */
	readonly policyVersionIds: readonly string[];
	readonly details: Readonly<Record<string, JsonValue>>;
}

/** Appends on the caller's transaction, stamping the request's ip, user agent and correlation id. */
export interface PolicyAuditWriter {
	append(record: PolicyAuditRecord): Promise<void>;
}

/** Resource name written on the authorization audit trail (`AuthorizationAudit`) for policy drafts. */
export const POLICY_DRAFT_AUDIT_RESOURCE = "AuthorizationPolicyDraft";

/** Audit actions of the policy control plane (`AuthorizationAudit.action`). */
export const POLICY_AUDIT_ACTIONS = {
	draftCreated: "policy.draft.created",
	draftSimulated: "policy.draft.simulated",
	draftPublished: "policy.draft.published",
} satisfies Record<string, string>;

/** The fields of a draft the simulation reads. */
export interface SimulatedDraft {
	readonly organizationId: string | null;
	readonly scope: AuthorizationPolicyScope;
	readonly cedarSource: string;
}

/** The simulation result before it is persisted (the handler assigns the id). */
export type PolicySimulationOutcome = Omit<PolicySimulationResult, "simulationId">;

export interface PolicySimulationRun {
	readonly outcome: PolicySimulationOutcome;
	/** Fingerprint of the published versions the draft was compared against. */
	readonly baselineFingerprint: string;
}

/**
 * Evaluates a draft against the published policy set over the real principals in its scope, with the
 * same engine the runtime decides with. Reads through the stores it is given (the simulation's ONE
 * transaction, D37).
 */
export interface PolicySimulatorPort {
	simulate(draft: SimulatedDraft, versions: PolicyVersionStore, principals: PolicyPrincipalReader): Promise<PolicySimulationRun>;
	/** The baseline fingerprint as published now (publish compares it with the simulated one). */
	currentBaselineFingerprint(slot: PolicySlot, versions: PolicyVersionStore): Promise<string>;
}

export interface CompiledPolicy {
	readonly cedarSource: string;
	readonly sqlPredicate: string | null;
}

export type PolicyCompilation = { readonly kind: "compiled"; readonly policy: CompiledPolicy } | { readonly kind: "invalid"; readonly message: string };

/** Compiles constrained builder templates to Cedar source and SQL visibility predicates. */
export interface PolicyTemplateCompilerPort {
	compile(payload: PolicyBuilderPayload, organizationId: string | null): PolicyCompilation;
}
