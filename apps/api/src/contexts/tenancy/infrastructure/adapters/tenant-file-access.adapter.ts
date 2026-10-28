import type { FileCategory, MerchantCapability, MembershipRole } from "@workspace/shared";

import { FILES_AUTHORIZATION_OPERATION } from "../../../../platform/application/shared-system-operations";
import type { TenantTransactionService } from "../../../../prisma/tenant-transaction.service";
import type { FileCategoryAccessRule } from "../../../files/public-api";
import type { MembershipRoleLookupPort, MerchantCapabilityGatePort, TenantFileAccessPort, TenantFileCapabilities } from "../../application/ports/tenant-file-access.port";
import { TenantFileAccessRule } from "../../application/services/tenant-file-access.rule";
import type { TenantRewardAuthService } from "./tenant-reward-auth.service";

/** The live membership of the caller, read under {@link FILES_AUTHORIZATION_OPERATION}. */
class PrismaMembershipRoleLookup implements MembershipRoleLookupPort {
	public constructor(private readonly transactions: TenantTransactionService) {}

	public async activeRole(userId: string, tenantId: string): Promise<MembershipRole | null> {
		const membership = await this.transactions.withSystemOperation(
			{ operation: FILES_AUTHORIZATION_OPERATION, reason: "Resolve the caller's tenant role for a file operation", actorUserId: userId },
			async (tx) =>
				tx.membership.findFirst({
					where: { userId, tenantId, status: "ACTIVE", isDeleted: false, tenant: { isDeleted: false } },
					select: { role: true },
				}),
		);
		return membership?.role ?? null;
	}
}

/** The same audited capability check every merchant route uses (ADR 067: role, grant, share). */
class MerchantCapabilityGate implements MerchantCapabilityGatePort {
	public constructor(private readonly tenantAuth: TenantRewardAuthService) {}

	public requireMembershipCapability(
		subject: { readonly userId: string; readonly tenantId: string; readonly role: MembershipRole },
		capability: MerchantCapability,
	): Promise<void> {
		return this.tenantAuth.requireMembershipCapability(subject, capability);
	}
}

/** {@link TenantFileAccessPort} over the membership table and the merchant capability gate. */
export class TenantFileAccessAdapter implements TenantFileAccessPort {
	private readonly memberships: MembershipRoleLookupPort;
	private readonly gate: MerchantCapabilityGatePort;

	public constructor(transactions: TenantTransactionService, tenantAuth: TenantRewardAuthService) {
		this.memberships = new PrismaMembershipRoleLookup(transactions);
		this.gate = new MerchantCapabilityGate(tenantAuth);
	}

	public ruleFor(categories: readonly FileCategory[], capabilities: TenantFileCapabilities): FileCategoryAccessRule {
		return new TenantFileAccessRule(categories, capabilities, this.memberships, this.gate);
	}
}
