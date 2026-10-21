import type { PaginatedServiceResult, SupportAccessGrantDetail, SupportAccessGrantListQuery } from "@workspace/shared";

import type { ActorContext } from "../../../../platform/application/actor-context";

/** The support access lists: every grant for platform admins, one tenant's grants for its owner. */
export interface SupportAccessReadPort {
	/** Every grant, newest first, under `support_access.admin_read` (the route checked the SuperAdmin). */
	listForAdmin(actor: ActorContext, query: SupportAccessGrantListQuery): Promise<PaginatedServiceResult<SupportAccessGrantDetail>>;
	/**
	 * The tenant's grants (newest first, at most `TENANT_SUPPORT_ACCESS_LIST_LIMIT`) when `userId` is an
	 * active OWNER of the live tenant `routeKey` names — the same owner check approval runs; otherwise `null`.
	 */
	listForTenantOwner(actor: ActorContext, routeKey: string, userId: string): Promise<readonly SupportAccessGrantDetail[] | null>;
}
