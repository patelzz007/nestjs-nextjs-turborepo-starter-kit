import type { CustomerBan } from "../aggregates/customer-ban.aggregate";

/** Persistence port of the {@link CustomerBan} aggregate (bound to one unit of work). */
export interface CustomerBanRepository {
	nextId(): string;
	/** Inserts an active ban. A second active ban of the same customer throws `TenantCustomerAlreadyBannedError`. */
	add(ban: CustomerBan): Promise<void>;
	/** The tenant's active ban under its row lock, or `null` (lifted, missing, or another tenant's). */
	findActiveForUpdate(tenantId: string, banId: string): Promise<CustomerBan | null>;
	/** Writes the lift: compare-and-set on the ban still being active (`TenantCustomerBanNotFoundError` when it is not). */
	save(ban: CustomerBan): Promise<void>;
}
