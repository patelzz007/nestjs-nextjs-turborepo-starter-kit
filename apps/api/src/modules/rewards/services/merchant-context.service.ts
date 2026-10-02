import { ForbiddenException, Injectable } from "@nestjs/common";
import type { CapabilitySlug, OrganizationRewardMembershipResponse } from "@workspace/shared";

import type { MerchantActor } from "../../api-keys/types/merchant-actor.types";
import type { MerchantApiKeyAuthContext } from "../../api-keys/types/api-key-auth.types";
import { OrganizationContextService } from "../../organization/services/organization-context.service";
import { OrganizationRewardAuthService } from "../../organization/services/organization-reward-auth.service";
import { MERCHANT_API_KEY_CAPABILITIES } from "../constants/merchant-api-key-capabilities";

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
			if (!MERCHANT_API_KEY_CAPABILITIES.includes(capability)) {
				throw new ForbiddenException({
					message: "Insufficient organization API key permissions",
					error: "ORGANIZATION_API_KEY_CAPABILITY_REQUIRED",
					capability,
				});
			}
			return;
		}

		if (actor.userId === null) {
			throw new ForbiddenException({
				message: "Organization authentication required",
				error: "ORGANIZATION_AUTH_REQUIRED",
			});
		}

		const resolved = await this.organizationRewardAuth.resolveOrganizationFromSlug(actor.userId, actor.orgSlug ?? actor.organizationId);
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

	public async resolveLocationFilter(actor: MerchantActor, locationId: string | undefined): Promise<string | undefined> {
		if (locationId === undefined) {
			return undefined;
		}

		if (actor.kind === "user") {
			if (actor.userId === null || actor.orgSlug === null) {
				throw new ForbiddenException({
					message: "Organization authentication required",
					error: "ORGANIZATION_AUTH_REQUIRED",
				});
			}

			await this.organizationContext.assertAccessibleLocation(actor.userId, actor.orgSlug, locationId);
			return locationId;
		}

		return locationId;
	}
}
