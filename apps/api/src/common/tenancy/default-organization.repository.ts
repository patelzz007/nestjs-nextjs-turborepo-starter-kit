import { Injectable } from "@nestjs/common";

import { TenantTransactionService } from "../../prisma/tenant-transaction.service";

/** Reads the organization a single-tenant deployment serves. */
@Injectable()
export class DefaultOrganizationRepository {
	public constructor(private readonly tenantTx: TenantTransactionService) {}

	/** Whether `organizationId` names a live (not soft-deleted) organization. */
	public async isLiveOrganization(organizationId: string): Promise<boolean> {
		const row = await this.tenantTx.withSystemOperation(
			{ operation: "tenancy.default_organization.verify", reason: "Verify the single-tenant organization at boot", actorUserId: null },
			async (tx) => tx.organization.findFirst({ where: { id: organizationId, isDeleted: false }, select: { id: true } }),
		);
		return row !== null;
	}
}
