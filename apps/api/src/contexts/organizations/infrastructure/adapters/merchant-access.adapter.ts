import { ForbiddenException, UnauthorizedException } from "@nestjs/common";

import type { ActorContext } from "../../../../platform/application/actor-context";
import type { ApiKeyCapabilitiesPort } from "../../application/ports/api-key-capabilities.port";
import type { MerchantAccessGrant, MerchantAccessPort, MerchantAccessRequest } from "../../application/ports/merchant-access.port";
import type { OrganizationContextService } from "./organization-context.service";
import type { OrganizationRewardAuthService } from "./organization-reward-auth.service";

/** The answer for a caller that is neither a merchant member nor a live merchant API key. */
function merchantAuthRequired(): UnauthorizedException {
	return new UnauthorizedException({ message: "Merchant authentication required", error: "MERCHANT_AUTH_REQUIRED" });
}

/**
 * `MerchantAccessPort` over the organization's capability check: membership
 * (uniform 404 for a non-member), the role table, then the tenant Cedar action
 * with its `authorize.<action>` organization audit row; for an API key, its
 * scope's capability table. The grant is the caller's store scope; a
 * `locationId` must be a live ACTIVE store inside it (404 / 403).
 */
export class MerchantAccessAdapter implements MerchantAccessPort {
	public constructor(
		private readonly auth: OrganizationRewardAuthService,
		private readonly context: OrganizationContextService,
		private readonly apiKeys: ApiKeyCapabilitiesPort,
	) {}

	public async assertCapability(actor: ActorContext, request: MerchantAccessRequest): Promise<MerchantAccessGrant> {
		if (actor.kind === "user") {
			return this.assertMember(actor.userId, request);
		}
		if (actor.kind === "api_key") {
			return this.assertApiKey(actor, request);
		}
		throw merchantAuthRequired();
	}

	private async assertMember(userId: string, request: MerchantAccessRequest): Promise<MerchantAccessGrant> {
		const { organizationId, locationId } = request;
		await this.auth.requireCapabilityForSlug(userId, organizationId, request.capability);
		if (locationId !== undefined && locationId !== null) {
			await this.context.assertAccessibleLocation(userId, organizationId, locationId);
			return { organizationId, locationScope: "SELECTED", locationIds: [locationId] };
		}
		const resolved = await this.context.resolveBySlug(userId, organizationId);
		return { organizationId, locationScope: resolved.membership.locationScopeType, locationIds: resolved.membership.locationIds };
	}

	private async assertApiKey(actor: Extract<ActorContext, { kind: "api_key" }>, request: MerchantAccessRequest): Promise<MerchantAccessGrant> {
		if (actor.organizationId !== request.organizationId) {
			throw new ForbiddenException({ message: "API key cannot access another organization", error: "ORGANIZATION_FORBIDDEN" });
		}
		const capabilities = await this.apiKeys.capabilitiesOf(actor);
		if (capabilities === null) {
			throw merchantAuthRequired();
		}
		if (!capabilities.includes(request.capability)) {
			throw new ForbiddenException({
				message: "Insufficient organization API key permissions",
				error: "ORGANIZATION_API_KEY_CAPABILITY_REQUIRED",
				capability: request.capability,
			});
		}
		const locationId = request.locationId ?? null;
		if (actor.locationId !== null) {
			if (locationId !== null && locationId !== actor.locationId) {
				throw new ForbiddenException({ message: "This API key is limited to a different store", error: "API_KEY_LOCATION_FORBIDDEN" });
			}
			return { organizationId: request.organizationId, locationScope: "SELECTED", locationIds: [actor.locationId] };
		}
		return locationId === null
			? { organizationId: request.organizationId, locationScope: "ALL_LOCATIONS", locationIds: [] }
			: { organizationId: request.organizationId, locationScope: "SELECTED", locationIds: [locationId] };
	}
}
