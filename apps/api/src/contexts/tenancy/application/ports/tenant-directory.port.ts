import type { MembershipResponse } from "@workspace/shared";

import type { ActorContext } from "../../../../platform/application/actor-context";

/** The caller's membership in the tenant a route key names, with the tenant policy version it is authorized under. */
export interface ResolvedTenantMember {
	readonly tenantId: string;
	readonly slug: string;
	readonly displayName: string;
	readonly userId: string;
	readonly membership: MembershipResponse;
}

/** Route-key resolution for tenant use cases (a slug or an id in the URL). */
export interface TenantDirectoryPort {
	/** The tenant a route key names; uniform 404 when there is none. */
	resolveTenantId(routeKey: string): Promise<string>;
	/** The caller's active membership in that tenant; uniform 404 for a missing tenant and a non-member. */
	resolveMember(actor: ActorContext, routeKey: string): Promise<ResolvedTenantMember>;
	/** Throws unless the caller's membership scope covers the location. */
	assertAccessibleLocation(actor: ActorContext, routeKey: string, locationId: string): Promise<void>;
}
