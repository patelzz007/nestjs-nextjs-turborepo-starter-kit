import { Inject, Injectable } from "@nestjs/common";
import type { EpochMs } from "@workspace/shared";
import type { Prisma } from "@prisma/client";

import type { SystemDatabaseContext } from "../../../../prisma/tenant-context";
import { TenantTransactionService } from "../../../../prisma/tenant-transaction.service";
import type { ImpersonationTenantFacts } from "../../application/ports/impersonation-tenant-facts.port";
import type { ApprovedSupportGrant } from "../../domain/policies/impersonation-start.policy";
import { AUTH_MEMBERSHIP_LOOKUP_OPERATION, SUPPORT_ACCESS_VERIFY_OPERATION } from "../../../../platform/application/shared-system-operations";

interface ImpersonationFactTransactions {
	withSystemOperation<TResult>(context: SystemDatabaseContext, work: (tx: Prisma.TransactionClient) => Promise<TResult>): Promise<TResult>;
}

/** Membership and support-grant reads for impersonation, each under its own allowlisted operation. */
@Injectable()
export class PrismaImpersonationTenantFacts implements ImpersonationTenantFacts {
	public constructor(@Inject(TenantTransactionService) private readonly transactions: ImpersonationFactTransactions) {}

	public async membershipTenantIds(userId: string): Promise<readonly string[]> {
		const rows = await this.transactions.withSystemOperation(
			{ operation: AUTH_MEMBERSHIP_LOOKUP_OPERATION, reason: "List the tenants an impersonation target belongs to", actorUserId: userId },
			(tx) => tx.membership.findMany({ where: { userId, status: "ACTIVE", isDeleted: false }, select: { tenantId: true } }),
		);
		return rows.map((row): string => row.tenantId);
	}

	public async approvedGrants(supportUserId: string, now: EpochMs): Promise<readonly ApprovedSupportGrant[]> {
		const rows = await this.transactions.withSystemOperation(
			{ operation: SUPPORT_ACCESS_VERIFY_OPERATION, reason: "List the impersonator's approved support grants", actorUserId: supportUserId },
			(tx) =>
				tx.supportAccessGrant.findMany({
					where: { supportUserId, status: "ACTIVE", isDeleted: false, revokedAt: null, expiresAt: { gt: BigInt(now) } },
					select: { id: true, tenantId: true },
					orderBy: { id: "asc" },
				}),
		);
		return rows.map((row): ApprovedSupportGrant => ({ grantId: row.id, tenantId: row.tenantId }));
	}
}
