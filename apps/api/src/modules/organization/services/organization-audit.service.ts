import { Injectable } from "@nestjs/common";

import { TenantTransactionService } from "../../../prisma/tenant-transaction.service";

export interface OrganizationAuditInput {
	readonly organizationId: string;
	readonly actorUserId: string | null;
	readonly action: string;
	readonly resourceType: string;
	readonly resourceId?: string;
	readonly decision?: string;
	readonly policyVersion?: number;
	readonly correlationId?: string;
	readonly metadata?: Record<string, string | number | boolean | null>;
}

@Injectable()
export class OrganizationAuditService {
	public constructor(private readonly tenantTx: TenantTransactionService) {}

	public async record(input: OrganizationAuditInput): Promise<void> {
		await this.tenantTx.withTenantTransaction(
			{
				userId: input.actorUserId ?? "system",
				organizationId: input.organizationId,
				purpose: "audit.append",
				policyVersion: input.policyVersion ?? 0,
			},
			async (tx) => {
				await tx.organizationAuditLog.create({
					data: {
						organizationId: input.organizationId,
						actorUserId: input.actorUserId,
						action: input.action,
						resourceType: input.resourceType,
						resourceId: input.resourceId ?? null,
						decision: input.decision ?? null,
						policyVersion: input.policyVersion ?? null,
						correlationId: input.correlationId ?? null,
						metadata: input.metadata ?? undefined,
					},
				});
			},
		);
	}
}
