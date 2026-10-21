import type { MembershipStatus, TenantLifecycleState } from "@workspace/shared";

/** Ordinary tenant routes, a lifecycle route, or the leave-tenant route (the only one that accepts an inactive membership). */
export type TenantLifecycleRouteKind = "ordinary" | "lifecycle" | "leave";

/** What C1 decides for one tenant route. `no_membership` leaves the existing non-member answer untouched. */
export type TenantLifecycleDecision =
	| { readonly kind: "allow" }
	| { readonly kind: "not_found" }
	| { readonly kind: "no_membership" }
	| { readonly kind: "tenant_suspended" }
	| { readonly kind: "tenant_banned" }
	| { readonly kind: "tenant_not_active" }
	| { readonly kind: "membership_inactive" };

export interface TenantLifecycleCheck {
	readonly lifecycleState: TenantLifecycleState;
	readonly isDeleted: boolean;
	readonly route: TenantLifecycleRouteKind;
	/** `none` is a caller with no membership row. An inactive row is `SUSPENDED` or `PENDING`. */
	readonly membershipStatus: MembershipStatus | "none";
}

const ORDINARY_STATES: readonly TenantLifecycleState[] = ["ACTIVE", "RESTRICTED"];

function ordinaryState(state: TenantLifecycleState): boolean {
	return ORDINARY_STATES.some((allowed) => allowed === state);
}

function lifecycleRoute(route: TenantLifecycleRouteKind): boolean {
	return route === "lifecycle" || route === "leave";
}

/**
 * C1. A deleted tenant is not found on every route. A caller with no membership
 * learns nothing else. An inactive membership is rejected except when leaving.
 * Ordinary routes accept only `ACTIVE` and `RESTRICTED`; lifecycle routes also
 * accept `PROVISIONING`, `SUSPENDED`, `BANNED` and `PENDING_DELETION` (a banned tenant's lifecycle
 * mutations — appeal, reactivate — are refused by the aggregate, so its members can only read the
 * status or leave).
 */
export function decideTenantLifecycle(check: TenantLifecycleCheck): TenantLifecycleDecision {
	if (check.isDeleted || check.lifecycleState === "DELETED") {
		return { kind: "not_found" };
	}
	if (check.membershipStatus === "none") {
		return { kind: "no_membership" };
	}
	if (check.membershipStatus !== "ACTIVE" && check.route !== "leave") {
		return { kind: "membership_inactive" };
	}
	if (ordinaryState(check.lifecycleState) || lifecycleRoute(check.route)) {
		return { kind: "allow" };
	}
	if (check.lifecycleState === "SUSPENDED") {
		return { kind: "tenant_suspended" };
	}
	if (check.lifecycleState === "BANNED") {
		return { kind: "tenant_banned" };
	}
	return { kind: "tenant_not_active" };
}
