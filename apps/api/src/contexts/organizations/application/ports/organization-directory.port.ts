import type { OrganizationMembershipResponse } from "@workspace/shared";

import type { ActorContext } from "../../../../platform/application/actor-context";

/** The caller's membership in the organization a route key names, with the tenant policy version it is authorized under. */
export interface ResolvedOrganizationMember {
	readonly organizationId: string;
	readonly slug: string;
	readonly displayName: string;
	readonly userId: string;
	readonly membership: OrganizationMembershipResponse;
	/** Active tenant Cedar policy version (organization audit rows carry it). */
	readonly policyVersion: number;
}

/** Route-key resolution for organization use cases (a slug or an id in the URL). */
export interface OrganizationDirectoryPort {
	/** The organization a route key names; uniform 404 when there is none. */
	resolveOrganizationId(routeKey: string): Promise<string>;
	/** The caller's active membership in that organization; uniform 404 for a missing organization and a non-member. */
	resolveMember(actor: ActorContext, routeKey: string): Promise<ResolvedOrganizationMember>;
	/** Throws unless the caller's membership scope covers the location. */
	assertAccessibleLocation(actor: ActorContext, routeKey: string, locationId: string): Promise<void>;
}
