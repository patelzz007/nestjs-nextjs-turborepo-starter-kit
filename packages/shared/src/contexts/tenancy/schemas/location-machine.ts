import { defineStateMachine, type StateMachine } from "../../../lib/state-machine";
import { LocationStatusSchema, type LocationStatus } from "./tenant";

/** The named moves of a store location. */
export type LocationEvent = "approve" | "reject" | "resubmit" | "completeOnboarding" | "close";

const EVERY_LOCATION_STATUS: readonly LocationStatus[] = LocationStatusSchema.options;

/**
 * A store location's lifecycle (docs/architecture/state-machines.md). A member's request waits for
 * review; a platform admin approves or rejects it; the merchant corrects a rejected one and sends it
 * again; closing a store makes it INACTIVE and soft-deletes it. The API's `Location` aggregate
 * enforces this table; the merchant store list offers "Resubmit" from it.
 *
 * `completeOnboarding` and `close` have no status guard in the aggregate today, so they start from
 * every status (a closed store is soft-deleted, so loads never return it). Narrowing them is a
 * tracked follow-up in the catalog, not a silent behaviour change.
 */
export const LOCATION_LIFECYCLE: StateMachine<LocationStatus, LocationEvent> = defineStateMachine({
	name: "LocationLifecycle",
	states: EVERY_LOCATION_STATUS,
	// A request waits for review; the onboarding primary store and an admin's "approve now" start ACTIVE.
	initial: ["PENDING_APPROVAL", "ACTIVE"],
	terminal: [],
	transitions: {
		approve: { from: ["PENDING_APPROVAL"], to: "ACTIVE" },
		reject: { from: ["PENDING_APPROVAL"], to: "REJECTED" },
		resubmit: { from: ["REJECTED"], to: "PENDING_APPROVAL" },
		completeOnboarding: { from: EVERY_LOCATION_STATUS, to: "ACTIVE" },
		close: { from: EVERY_LOCATION_STATUS, to: "INACTIVE" },
	},
});
