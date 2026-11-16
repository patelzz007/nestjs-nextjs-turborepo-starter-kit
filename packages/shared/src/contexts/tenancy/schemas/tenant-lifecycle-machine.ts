import { defineStateMachine, type StateMachine } from "../../../lib/state-machine";
import { TenantLifecycleStateSchema, type TenantLifecycleState } from "./tenant";

/** The named moves of a tenant's lifecycle — one per command that makes it. */
export type TenantLifecycleEvent = "activate" | "suspend" | "reinstate" | "ban" | "unban" | "reactivate";

/**
 * A tenant's lifecycle (multi-tenancy plan MT-23). The API's `Tenant` aggregate enforces it; the
 * admin merchant page and the merchant lifecycle screen offer only the moves it allows.
 *
 * - `activate`: onboarding completes.
 * - `suspend` / `reinstate`: a platform admin (a suspended tenant may appeal).
 * - `ban` / `unban`: a super admin — harder than a suspension: no appeal, no owner reactivation.
 * - `reactivate`: the owner cancels a pending deletion while its grace period runs.
 */
export const TENANT_LIFECYCLE: StateMachine<TenantLifecycleState, TenantLifecycleEvent> = defineStateMachine({
	name: "TenantLifecycle",
	states: TenantLifecycleStateSchema.options,
	// PROVISIONING at signup; the platform's own tenants (default, load test) are created ACTIVE.
	initial: ["PROVISIONING", "ACTIVE"],
	terminal: ["DELETED"],
	transitions: {
		activate: { from: ["PROVISIONING"], to: "ACTIVE" },
		suspend: { from: ["ACTIVE", "RESTRICTED"], to: "SUSPENDED" },
		reinstate: { from: ["SUSPENDED"], to: "ACTIVE" },
		ban: { from: ["ACTIVE", "RESTRICTED", "SUSPENDED"], to: "BANNED" },
		unban: { from: ["BANNED"], to: "ACTIVE" },
		reactivate: { from: ["PENDING_DELETION"], to: "ACTIVE" },
	},
	enteredOutsideMachine: {
		RESTRICTED: "No command restricts a tenant yet; only seed data holds it.",
		PENDING_DELETION: "The owner deletion request was removed with the dead organization lifecycle service (migration plan D26); only seed data holds it.",
		DELETED: "No job finishes a deletion yet; only seed data holds it.",
	},
});
