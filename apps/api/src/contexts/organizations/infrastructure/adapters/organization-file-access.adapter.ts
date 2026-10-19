import { MERCHANT_CAPABILITY_CEDAR_ACTIONS, type FileCategory, type MerchantCapability, type OrganizationMembershipRole } from "@workspace/shared";

import type { SystemOperationName } from "../../../../platform/application/system-operation-names";
import type { TenantTransactionService } from "../../../../prisma/tenant-transaction.service";
import type { FileCategoryAccessRule } from "../../../files/public-api";
import type {
	MembershipRoleLookupPort,
	MerchantCapabilityGatePort,
	OrganizationFileAccessPort,
	OrganizationFileCapabilities,
} from "../../application/ports/organization-file-access.port";
import { OrganizationFileAccessRule } from "../../application/services/organization-file-access.rule";
import type { OrganizationRewardAuthService } from "./organization-reward-auth.service";

/** Resolves the caller's organization role: a user cannot read other members' rows under RLS, so it runs as this allowlisted operation. */
const FILE_AUTHORIZATION_OPERATION: SystemOperationName = "files.authorization";

/** The live membership of the caller, read under {@link FILE_AUTHORIZATION_OPERATION}. */
class PrismaMembershipRoleLookup implements MembershipRoleLookupPort {
	public constructor(private readonly transactions: TenantTransactionService) {}

	public async activeRole(userId: string, organizationId: string): Promise<OrganizationMembershipRole | null> {
		const membership = await this.transactions.withSystemOperation(
			{ operation: FILE_AUTHORIZATION_OPERATION, reason: "Resolve the caller's organization role for a file operation", actorUserId: userId },
			async (tx) =>
				tx.organizationMembership.findFirst({
					where: { userId, organizationId, status: "ACTIVE", isDeleted: false, organization: { isDeleted: false } },
					select: { role: true },
				}),
		);
		return membership?.role ?? null;
	}
}

/** The role table, then the tenant Cedar policy through the same audited check every merchant route uses. */
class CedarMerchantCapabilityGate implements MerchantCapabilityGatePort {
	public constructor(private readonly organizationAuth: OrganizationRewardAuthService) {}

	public isMembershipOnly(capability: MerchantCapability): boolean {
		return MERCHANT_CAPABILITY_CEDAR_ACTIONS[capability] === null;
	}

	public requireMembershipCapability(
		subject: { readonly userId: string; readonly organizationId: string; readonly role: OrganizationMembershipRole },
		capability: MerchantCapability,
	): Promise<void> {
		return this.organizationAuth.requireMembershipCapability(subject, capability);
	}
}

/** {@link OrganizationFileAccessPort} over the membership table and the tenant Cedar policy. */
export class OrganizationFileAccessAdapter implements OrganizationFileAccessPort {
	private readonly memberships: MembershipRoleLookupPort;
	private readonly gate: MerchantCapabilityGatePort;

	public constructor(transactions: TenantTransactionService, organizationAuth: OrganizationRewardAuthService) {
		this.memberships = new PrismaMembershipRoleLookup(transactions);
		this.gate = new CedarMerchantCapabilityGate(organizationAuth);
	}

	public ruleFor(categories: readonly FileCategory[], capabilities: OrganizationFileCapabilities): FileCategoryAccessRule {
		return new OrganizationFileAccessRule(categories, capabilities, this.memberships, this.gate);
	}
}
