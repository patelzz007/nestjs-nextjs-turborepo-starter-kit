import { MERCHANT_CAPABILITY, MembershipRoleSchema, type MerchantCapability, type MembershipRole } from "@workspace/shared";

import { MERCHANT_CAPABILITY_CEDAR_ACTIONS } from "@workspace/shared";
import { CEDAR_CAPABILITY_ACTIONS } from "./cedar-model";

/** Minutes → ms, for the bundle cache TTL below. */
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

/** At most this many locked-out tenants are named in the simulation errors. */
export const MAX_REPORTED_LOCKOUT_TENANTS = 20;

/**
 * Backstop lifetime of a compiled policy bundle in the per-process cache.
 * Publishes invalidate every instance immediately (`authz:invalidate`); this
 * bounds staleness when that at-most-once message is lost.
 */
export const POLICY_BUNDLE_CACHE_TTL_MS = MS_PER_MINUTE;

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
 * The action whose loss locks owners out of their tenant: without it no
 * owner can manage the team (and so cannot restore anyone's access).
 */
export const OWNER_CRITICAL_CEDAR_ACTION: string = cedarActionOf(MERCHANT_CAPABILITY.manageTeam);

/** Membership role whose lockout fails a simulation. */
export const OWNER_MEMBERSHIP_ROLE: MembershipRole = MembershipRoleSchema.enum.OWNER;
