import { ForbiddenException, Injectable, NotFoundException } from "@nestjs/common";
import type { CapabilitySlug, MerchantMembershipResponse } from "@workspace/shared";

import type { MerchantActor } from "../../api-keys/types/merchant-actor.types";
import type { MerchantApiKeyAuthContext } from "../../api-keys/types/api-key-auth.types";
import { MERCHANT_API_KEY_CAPABILITIES } from "../constants/merchant-api-key-capabilities";
import { AuthorizationCheckerService } from "../../authorization/services/authorization-checker.service";
import { MerchantMemberRepository } from "../repositories/merchant-member.repository";
import { MerchantOrgRepository } from "../repositories/merchant-org.repository";
import { MerchantCapabilityService } from "./merchant-capability.service";

@Injectable()
export class MerchantContextService {
	public constructor(
		private readonly merchantMemberRepository: MerchantMemberRepository,
		private readonly merchantOrgRepository: MerchantOrgRepository,
		private readonly authorizationChecker: AuthorizationCheckerService,
		private readonly merchantCapabilities: MerchantCapabilityService,
	) {}

	public resolveOrgIdFromApiKey(apiKeyAuth: MerchantApiKeyAuthContext, requestedOrgId: string | undefined): string {
		if (requestedOrgId !== undefined && requestedOrgId.length > 0 && requestedOrgId !== apiKeyAuth.merchantOrgId) {
			throw new ForbiddenException({
				message: "API key cannot access another merchant org",
				error: "MERCHANT_ORG_FORBIDDEN",
			});
		}

		return apiKeyAuth.merchantOrgId;
	}

	public async requireActorCapability(actor: MerchantActor, capability: CapabilitySlug): Promise<void> {
		if (actor.kind === "api_key") {
			if (!MERCHANT_API_KEY_CAPABILITIES.includes(capability)) {
				throw new ForbiddenException({
					message: "Insufficient merchant API key permissions",
					error: "MERCHANT_API_KEY_CAPABILITY_REQUIRED",
					capability,
				});
			}
			return;
		}

		if (actor.userId === null) {
			throw new ForbiddenException({
				message: "Merchant authentication required",
				error: "MERCHANT_AUTH_REQUIRED",
			});
		}

		await this.requireCapability(actor.userId, actor.merchantOrgId, capability);
	}

	public async resolveOrgIdForUser(userId: string, requestedOrgId: string | undefined): Promise<string> {
		const memberships = await this.merchantMemberRepository.listOrgRefsForUser(userId);

		if (memberships.length === 0) {
			if (requestedOrgId !== undefined && requestedOrgId.length > 0) {
				const canManageMerchants = await this.authorizationChecker.hasPermission(userId, "MANAGE", "MERCHANT_ORG");
				if (canManageMerchants) {
					await this.assertMerchantOrgExists(requestedOrgId);
					return requestedOrgId;
				}
			}

			throw new ForbiddenException({ message: "Not a merchant member", error: "MERCHANT_MEMBER_REQUIRED" });
		}

		if (requestedOrgId !== undefined && requestedOrgId.length > 0) {
			const match = memberships.find((row) => row.merchantOrgId === requestedOrgId);
			if (match === undefined) {
				const canManageMerchants = await this.authorizationChecker.hasPermission(userId, "MANAGE", "MERCHANT_ORG");
				if (canManageMerchants) {
					await this.assertMerchantOrgExists(requestedOrgId);
					return requestedOrgId;
				}

				throw new ForbiddenException({ message: "Invalid merchant org", error: "MERCHANT_ORG_FORBIDDEN" });
			}
			return requestedOrgId;
		}

		return memberships[0].merchantOrgId;
	}

	public async requireOwnerRole(userId: string, merchantOrgId: string): Promise<void> {
		const membership = await this.merchantMemberRepository.findRoleForUserInOrg(userId, merchantOrgId);

		if (membership?.role === "OWNER") {
			return;
		}

		const canManageMerchants = await this.authorizationChecker.hasPermission(userId, "MANAGE", "MERCHANT_ORG");
		if (canManageMerchants) {
			return;
		}

		throw new ForbiddenException({
			message: "Only merchant owners can perform this action",
			error: "MERCHANT_OWNER_REQUIRED",
		});
	}

	public async requireCapability(userId: string, merchantOrgId: string, capability: CapabilitySlug): Promise<void> {
		const allowed = await this.userHasCapability(userId, merchantOrgId, capability);
		if (!allowed) {
			throw new ForbiddenException({
				message: "Insufficient merchant permissions",
				error: "MERCHANT_CAPABILITY_REQUIRED",
				capability,
			});
		}
	}

	public async userHasCapability(userId: string, merchantOrgId: string, capability: CapabilitySlug, options?: { readonly isImpersonating?: boolean }): Promise<boolean> {
		const membership = await this.merchantMemberRepository.findRoleForUserInOrg(userId, merchantOrgId);

		if (membership !== null) {
			const capabilities = await this.merchantCapabilities.getCapabilitiesForRole(membership.role);
			return capabilities.includes(capability);
		}

		const canManageMerchants = await this.authorizationChecker.hasPermission(userId, "MANAGE", "MERCHANT_ORG");
		if (!canManageMerchants || options?.isImpersonating === true) {
			return false;
		}

		const org = await this.merchantOrgRepository.findActiveById(merchantOrgId);

		if (org === null) {
			return false;
		}

		const ownerCapabilities = await this.merchantCapabilities.getOwnerCapabilities();
		return ownerCapabilities.includes(capability);
	}

	public async listMembershipsForUser(userId: string, options?: { readonly isImpersonating?: boolean }): Promise<MerchantMembershipResponse[]> {
		const memberships = await this.merchantMemberRepository.listWithOrgForUser(userId);

		const memberRows: MerchantMembershipResponse[] = [];
		for (const row of memberships.filter((entry) => !entry.merchantOrg.isDeleted)) {
			const capabilities = await this.merchantCapabilities.getCapabilitiesForRole(row.role);
			memberRows.push({
				merchantOrgId: row.merchantOrgId,
				businessName: row.merchantOrg.businessName,
				city: row.merchantOrg.city,
				role: row.role,
				kybStatus: row.merchantOrg.kybStatus,
				status: row.merchantOrg.status,
				capabilities: [...capabilities],
			});
		}

		if (memberRows.length > 0) {
			return memberRows;
		}

		if (options?.isImpersonating === true) {
			return memberRows;
		}

		const canManageMerchants = await this.authorizationChecker.hasPermission(userId, "MANAGE", "MERCHANT_ORG");
		if (!canManageMerchants) {
			return memberRows;
		}

		const ownerCapabilities = await this.merchantCapabilities.getOwnerCapabilities();
		const orgs = await this.merchantOrgRepository.listActiveSummaries(100);

		return orgs.map((org) => ({
			merchantOrgId: org.id,
			businessName: org.businessName,
			city: org.city,
			role: "OWNER",
			kybStatus: org.kybStatus,
			status: org.status,
			capabilities: [...ownerCapabilities],
		}));
	}

	private async assertMerchantOrgExists(merchantOrgId: string): Promise<void> {
		const org = await this.merchantOrgRepository.findActiveById(merchantOrgId);

		if (org === null) {
			throw new NotFoundException({ message: "Merchant not found", error: "MERCHANT_NOT_FOUND" });
		}
	}
}
