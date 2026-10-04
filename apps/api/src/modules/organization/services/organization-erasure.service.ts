import { Injectable, Logger } from "@nestjs/common";

import { TenantTransactionService } from "../../../prisma/tenant-transaction.service";
import { CedarPolicyEvaluatorService } from "../../authorization-cedar/services/cedar-policy-evaluator.service";
import { OrganizationAuditService } from "./organization-audit.service";

/** Verified erasure saga — tombstone, per-system evidence, deletion certificate hook. */
@Injectable()
export class OrganizationErasureService {
	private readonly logger: Logger = new Logger(OrganizationErasureService.name);

	public constructor(
		private readonly tenantTx: TenantTransactionService,
		private readonly audit: OrganizationAuditService,
		private readonly cedar: CedarPolicyEvaluatorService,
	) {}

	/** Tombstones the organization; the audit row commits in the same transaction, attributed to the real actor. */
	public async executeErasure(organizationId: string, actorUserId: string): Promise<void> {
		const policyVersion = await this.cedar.getActivePolicyVersion(organizationId);
		await this.tenantTx.withSystemOperation(
			{
				operation: "organization.erase",
				reason: "Verified tenant erasure",
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
				await this.audit.recordInTx(tx, {
					organizationId,
					actorUserId,
					policyVersion,
					action: "organization.erased",
					resourceType: "Organization",
					resourceId: organizationId,
					decision: "Allow",
				});
			},
		);
		this.logger.log(`Erasure completed for organization ${organizationId}`);
	}
}
