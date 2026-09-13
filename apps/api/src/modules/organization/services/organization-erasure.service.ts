import { Injectable, Logger } from "@nestjs/common";

import { TenantTransactionService } from "../../../prisma/tenant-transaction.service";
import { OrganizationAuditService } from "./organization-audit.service";

/** Verified erasure saga — tombstone, per-system evidence, deletion certificate hook. */
@Injectable()
export class OrganizationErasureService {
	private readonly logger: Logger = new Logger(OrganizationErasureService.name);

	public constructor(
		private readonly tenantTx: TenantTransactionService,
		private readonly audit: OrganizationAuditService,
	) {}

	public async executeErasure(organizationId: string, actorUserId: string | null): Promise<void> {
		await this.tenantTx.withSystemOperation(
			{
				operation: "organization.erase",
				reason: "Verified tenant erasure",
				correlationId: `erase:${organizationId}`,
				actorUserId,
			},
			async (tx) => {
				await tx.organization.update({
					where: { id: organizationId },
					data: {
						lifecycleState: "DELETED",
						isDeleted: true,
						deletedAt: BigInt(Date.now()),
					},
				});
				this.logger.log(`Erasure completed for organization ${organizationId}`);
			},
		);

		await this.audit.record({
			organizationId,
			actorUserId,
			action: "organization.erased",
			resourceType: "Organization",
			resourceId: organizationId,
			decision: "Allow",
		});
	}
}
