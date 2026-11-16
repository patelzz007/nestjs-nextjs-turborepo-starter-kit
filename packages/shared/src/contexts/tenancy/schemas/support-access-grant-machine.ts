import { defineStateMachine, type StateMachine } from "../../../lib/state-machine";
import { SupportAccessGrantStatusSchema, type SupportAccessGrantStatus } from "./tenant";

/** The named moves of a just-in-time support access grant. */
export type SupportAccessGrantEvent = "approve" | "expire" | "revoke";

/**
 * A support access grant's lifecycle (docs/architecture/state-machines.md). A SuperAdmin requests a
 * grant; an owner of its tenant approves it; a SuperAdmin revokes it or the expiry job ends it once
 * its time runs out. The API's `SupportAccessGrantAggregate` and expiry query enforce this table;
 * the admin console offers "Revoke" and the merchant card lists approvals from it.
 */
export const SUPPORT_ACCESS_GRANT_LIFECYCLE: StateMachine<SupportAccessGrantStatus, SupportAccessGrantEvent> = defineStateMachine({
	name: "SupportAccessGrantLifecycle",
	states: SupportAccessGrantStatusSchema.options,
	initial: ["PENDING_TENANT_APPROVAL"],
	terminal: ["EXPIRED", "REVOKED", "DENIED"],
	transitions: {
		approve: { from: ["PENDING_TENANT_APPROVAL"], to: "ACTIVE" },
		expire: { from: ["PENDING_APPROVAL", "PENDING_TENANT_APPROVAL", "ACTIVE"], to: "EXPIRED" },
		revoke: { from: ["PENDING_APPROVAL", "PENDING_TENANT_APPROVAL", "ACTIVE"], to: "REVOKED" },
	},
	enteredOutsideMachine: {
		PENDING_APPROVAL: "Rows from before owner approval existed; nothing sets it now, and such a grant can still expire or be revoked.",
		DENIED: "No command denies a grant (an owner simply does not approve it, and it expires); kept in the enum for stored rows.",
	},
});
