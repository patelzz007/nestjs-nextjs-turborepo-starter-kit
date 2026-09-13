import { ForbiddenException, Injectable } from "@nestjs/common";
import type { CapabilitySlug, OrganizationRewardMembershipResponse } from "@workspace/shared";

import type { MerchantActor } from "../../api-keys/types/merchant-actor.types";
import type { MerchantApiKeyAuthContext } from "../../api-keys/types/api-key-auth.types";
import { OrganizationContextService } from "../../organization/services/organization-context.service";
import { OrganizationRewardAuthService } from "../../organization/services/organization-reward-auth.service";
import { MERCHANT_API_KEY_CAPABILITIES } from "../constants/merchant-api-key-capabilities";

const CAPABILITY_TO_CEDAR_ACTION: Partial<Record<CapabilitySlug, string>> = {
	"merchant:view_rewards": "rewardhub:view_rewards",
	"merchant:manage_rewards": "rewardhub:manage_rewards",
	"merchant:view_redemptions": "rewardhub:view_redemptions",
	"merchant:manage_api_keys": "rewardhub:manage_api_keys",
	"merchant:view_analytics": "rewardhub:view_analytics",
	"merchant:manage_kyb": "rewardhub:manage_kyb",
};

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

		const cedarAction = CAPABILITY_TO_CEDAR_ACTION[capability];
		if (cedarAction === undefined) {
			throw new ForbiddenException({
				message: "Unknown reward hub capability",
				error: "ORGANIZATION_CAPABILITY_UNKNOWN",
				capability,
			});
		}

		const resolved = await this.organizationRewardAuth.resolveOrganizationFromSlug(actor.userId, actor.orgSlug ?? actor.organizationId);
		await this.organizationRewardAuth.requireCedarAction(actor.userId, actor.organizationId, cedarAction, "RewardHub", actor.organizationId, resolved.membership);
	}

	public async resolveOrgIdForUser(userId: string, orgSlug: string): Promise<string> {
		const resolved = await this.organizationRewardAuth.resolveOrganizationFromSlug(userId, orgSlug);
		return resolved.organizationId;
	}

	public async requireUserCapability(userId: string, orgSlug: string, capability: CapabilitySlug): Promise<void> {
		const resolved = await this.organizationRewardAuth.resolveOrganizationFromSlug(userId, orgSlug);
		const cedarAction = CAPABILITY_TO_CEDAR_ACTION[capability];
		if (cedarAction === undefined) {
			throw new ForbiddenException({
				message: "Unknown reward hub capability",
				error: "ORGANIZATION_CAPABILITY_UNKNOWN",
				capability,
			});
		}
		await this.organizationRewardAuth.requireCedarAction(userId, resolved.organizationId, cedarAction, "RewardHub", resolved.organizationId, resolved.membership);
	}

	public async requireOwnerRole(userId: string, organizationId: string, orgSlug: string): Promise<void> {
		const resolved = await this.organizationRewardAuth.resolveOrganizationFromSlug(userId, orgSlug);
		if (resolved.organizationId !== organizationId) {
			throw new ForbiddenException({ message: "Invalid organization", error: "ORGANIZATION_FORBIDDEN" });
		}
		if (resolved.membership.role !== "OWNER") {
			throw new ForbiddenException({
				message: "Only organization owners can perform this action",
				error: "ORGANIZATION_OWNER_REQUIRED",
			});
		}
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
