import type { PaginatedServiceResult, TenantCustomerBanListQuery, TenantCustomerBanResponse } from "@workspace/shared";

/** The tenant's active customer bans, as the banned-customers page shows them (read after the route's capability check). */
export interface CustomerBanReadPort {
	/** One page of the tenant's active bans, newest first. */
	listActive(tenantId: string, query: TenantCustomerBanListQuery): Promise<PaginatedServiceResult<TenantCustomerBanResponse>>;
	/** One ban of the tenant (active or not), or `null`. */
	findById(tenantId: string, banId: string): Promise<TenantCustomerBanResponse | null>;
}
