import { MERCHANT_CAPABILITY, OrganizationMembershipRoleSchema, type MerchantCapability, type OrganizationMembershipRole } from "@workspace/shared";

import { MERCHANT_CAPABILITY_CEDAR_ACTIONS } from "../../organization/constants/merchant-capability-cedar-actions";
import { CEDAR_CAPABILITY_ACTIONS } from "../cedar/rewardhub-cedar-model";

const MS_PER_MINUTE = 60_000;

/**
 * Memberships read per simulation page (one short read transaction each). Small
 * enough that one page of engine calls never blocks the event loop for long:
 * every page boundary awaits the database.
 */
export const SIMULATION_PAGE_SIZE = 100;

/**
 * Upper bound on principals one simulation evaluates. A scope with more
 * principals fails the simulation (and therefore cannot be published) instead
 * of running an unbounded evaluation on the request path.
 */
export const MAX_SIMULATED_PRINCIPALS = 10_000;

/** At most this many individual decision changes are returned / stored per simulation. */
export const MAX_REPORTED_DECISION_CHANGES = 100;

/** At most this many locked-out organizations are named in the simulation errors. */
export const MAX_REPORTED_LOCKOUT_ORGANIZATIONS = 20;

/**
 * Backstop lifetime of a compiled policy bundle in the per-process cache.
 * Publishes invalidate every instance immediately (`authz:invalidate`); this
 * bounds staleness when that at-most-once message is lost.
 */
export const POLICY_BUNDLE_CACHE_TTL_MS = MS_PER_MINUTE;

/** A passing simulation older than this must be re-run before publish (memberships drift). */
export const SIMULATION_VALIDITY_MS = 60 * MS_PER_MINUTE;

/** The Cedar action a capability is checked with; fails at module load if the mapping is removed. */
function cedarActionOf(capability: MerchantCapability): string {
	const action: string | null = MERCHANT_CAPABILITY_CEDAR_ACTIONS[capability];
	if (action === null) {
		throw new Error(`Merchant capability ${capability} has no Cedar action; the policy simulation needs one`);
	}
	return action;
}

/** The capability actions the runtime evaluates; the simulation evaluates every principal against each. */
export const SIMULATED_CEDAR_ACTIONS: readonly string[] = CEDAR_CAPABILITY_ACTIONS;

/**
 * The action whose loss locks owners out of their organization: without it no
 * owner can manage the team (and so cannot restore anyone's access).
 */
export const OWNER_CRITICAL_CEDAR_ACTION: string = cedarActionOf(MERCHANT_CAPABILITY.manageTeam);

/** Membership role whose lockout fails a simulation. */
export const OWNER_MEMBERSHIP_ROLE: OrganizationMembershipRole = OrganizationMembershipRoleSchema.enum.OWNER;

/** Resource name written on the authorization audit trail (`authorization_audits`) for policy drafts. */
export const POLICY_DRAFT_AUDIT_RESOURCE = "AuthorizationPolicyDraft";

/** Audit actions of the policy control plane. */
export const POLICY_AUDIT_ACTIONS = {
	draftCreated: "policy.draft.created",
	draftSimulated: "policy.draft.simulated",
	draftPublished: "policy.draft.published",
} satisfies Record<string, string>;

/** Advisory-lock namespace shared by every policy publish (taken shared by tenant slots, exclusive by platform slots). */
export const POLICY_PUBLISH_GLOBAL_LOCK_KEY = "authorization_policy_publish:all";

/** Advisory-lock key of one (organization, scope) policy slot. */
export function policySlotLockKey(organizationId: string | null, scope: string): string {
	return `authorization_policy_publish:${scope}:${organizationId ?? "platform"}`;
}
