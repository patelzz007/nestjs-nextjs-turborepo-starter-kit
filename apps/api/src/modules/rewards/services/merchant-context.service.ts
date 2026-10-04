import { ForbiddenException, Injectable } from "@nestjs/common";
import type { CapabilitySlug, OrganizationRewardMembershipResponse } from "@workspace/shared";

import type { MerchantActor } from "../../api-keys/types/merchant-actor.types";
import type { MerchantApiKeyAuthContext } from "../../api-keys/types/api-key-auth.types";
import { OrganizationContextService } from "../../organization/services/organization-context.service";
import { OrganizationRewardAuthService } from "../../organization/services/organization-reward-auth.service";
import { MERCHANT_API_KEY_SCOPE_CAPABILITIES } from "../constants/merchant-api-key-capabilities";
import { ALL_LOCATIONS_SCOPE, selectedLocationsScope, type MerchantLocationScope } from "../types/merchant-location-scope";

/** A store-scoped API key asked for another store's data. */
function keyLocationForbidden(): ForbiddenException {
	return new ForbiddenException({
		message: "This API key is limited to a different store",
		error: "API_KEY_LOCATION_FORBIDDEN",
	});
}

@Injectable()
export class MerchantContextService {
	public constructor(
		private readonly organizationRewardAuth: OrganizationRewardAuthService,
		private readonly organizationContext: OrganizationContextService,
	) {}

	public resolveOrgIdFromApiKey(apiKeyAuth: MerchantApiKeyAuthContext, requestedOrgId: string | undefined): string {
		if (requestedOrgId !== undefined && requestedOrgId.length > 0 && requestedOrgId !== apiKeyAuth.organizationId) {
			throw new ForbiddenException({
				message: "API key cannot access another organization",
				error: "ORGANIZATION_FORBIDDEN",
			});
		}

		return apiKeyAuth.organizationId;
	}

	public async requireActorCapability(actor: MerchantActor, capability: CapabilitySlug): Promise<void> {
		if (actor.kind === "api_key") {
			if (!MERCHANT_API_KEY_SCOPE_CAPABILITIES[actor.keyScope].includes(capability)) {
				throw new ForbiddenException({
					message: "Insufficient organization API key permissions",
					error: "ORGANIZATION_API_KEY_CAPABILITY_REQUIRED",
					capability,
				});
			}
			return;
		}

		const resolved = await this.organizationRewardAuth.resolveOrganizationFromSlug(actor.userId, actor.orgSlug);
		await this.organizationRewardAuth.requireMembershipCapability({ userId: actor.userId, organizationId: actor.organizationId, role: resolved.membership.role }, capability);
	}

	public async resolveOrgIdForUser(userId: string, orgSlug: string): Promise<string> {
		const resolved = await this.organizationRewardAuth.resolveOrganizationFromSlug(userId, orgSlug);
		return resolved.organizationId;
	}

	public async requireUserCapability(userId: string, orgSlug: string, capability: CapabilitySlug): Promise<void> {
		await this.organizationRewardAuth.requireCapabilityForSlug(userId, orgSlug, capability);
	}

	public async listMembershipsForUser(userId: string): Promise<OrganizationRewardMembershipResponse[]> {
		return this.organizationRewardAuth.listMembershipsForUser(userId);
	}

	public async assertAccessibleLocationForUser(userId: string, orgSlug: string, locationId: string): Promise<void> {
		await this.organizationContext.assertAccessibleLocation(userId, orgSlug, locationId);
	}

	/**
	 * The stores `actor` may see for this request (see {@link MerchantLocationScope}).
	 *
	 * - Member, `locationId` given: that store, after checking it is an active
	 *   store of the organization (404) inside the member's scope (403).
	 * - Member, no `locationId`: every store for an `ALL_LOCATIONS` member,
	 *   otherwise exactly the member's stores — never "no filter".
	 * - Store-scoped API key: always its own store; asking for another is 403.
	 * - Organization-wide API key: the requested store, or every store. Every
	 *   query also filters by the key's organization, so a foreign store id
	 *   matches nothing.
	 */
	public async resolveLocationScope(actor: MerchantActor, locationId: string | undefined): Promise<MerchantLocationScope> {
		if (actor.kind === "user") {
			return this.resolveUserLocationScope(actor.userId, actor.orgSlug, locationId);
		}

		if (actor.keyLocationId !== null) {
			if (locationId !== undefined && locationId !== actor.keyLocationId) {
				throw keyLocationForbidden();
			}
			return selectedLocationsScope([actor.keyLocationId]);
		}

		return locationId === undefined ? ALL_LOCATIONS_SCOPE : selectedLocationsScope([locationId]);
	}

	/** {@link resolveLocationScope} for member-only routes (API keys, terminals). */
	public async resolveUserLocationScope(userId: string, orgSlug: string, locationId: string | undefined): Promise<MerchantLocationScope> {
		if (locationId !== undefined) {
			await this.organizationContext.assertAccessibleLocation(userId, orgSlug, locationId);
			return selectedLocationsScope([locationId]);
		}

		const resolved = await this.organizationContext.resolveBySlug(userId, orgSlug);
		if (resolved.membership.locationScopeType === "ALL_LOCATIONS") {
			return ALL_LOCATIONS_SCOPE;
		}
		return selectedLocationsScope(resolved.membership.locationIds);
	}
}
