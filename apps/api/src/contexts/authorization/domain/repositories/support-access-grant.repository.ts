import type { SupportAccessGrantAggregate, SupportAccessGrantState } from "../aggregates/support-access-grant.aggregate";

/** Support access grants (bypass-write table), bound to one support-access transaction. */
export interface SupportAccessGrantRepository {
	findById(grantId: string): Promise<SupportAccessGrantAggregate | null>;
	add(grant: SupportAccessGrantAggregate): Promise<SupportAccessGrantState>;
	/**
	 * Compared-and-set on the status the grant was loaded with. `"lost"` means a concurrent transition
	 * committed first; the caller answers it exactly as it answers a grant that was already decided.
	 */
	save(grant: SupportAccessGrantAggregate): Promise<"saved" | "lost">;
}
