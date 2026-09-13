import { Injectable } from "@nestjs/common";

import { TenantTransactionService } from "../../prisma/tenant-transaction.service";
import { TenantJobContextService } from "./tenant-job-context.service";

@Injectable()
export class TenantEnumeratorService {
	public constructor(
		private readonly tenantTx: TenantTransactionService,
		private readonly jobContext: TenantJobContextService,
	) {}

	public async listActiveOrganizationIds(): Promise<string[]> {
		const rows = await this.tenantTx.withSystemOperation(
			{
				operation: "tenant.enumerate",
				reason: "Scheduler fan-out",
				correlationId: `enumerate:${String(Date.now())}`,
				actorUserId: null,
			},
			async (tx) =>
				tx.organization.findMany({
					where: { lifecycleState: { in: ["ACTIVE", "RESTRICTED"] }, isDeleted: false },
					select: { id: true },
				}),
		);
		return rows.map((r) => r.id);
	}

	public buildTenantJobContext(organizationId: string, purpose: string, policyVersion: number): ReturnType<TenantJobContextService["sign"]> {
		const now = Date.now();
		return this.jobContext.sign({
			organizationId,
			initiatingActorId: null,
			purpose,
			policyVersion,
			correlationId: `${purpose}:${organizationId}:${String(now)}`,
			issuedAt: now,
			expiresAt: now + 300_000,
		});
	}
}
