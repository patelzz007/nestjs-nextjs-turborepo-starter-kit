import { Injectable } from "@nestjs/common";

import { TenantTransactionService } from "../../../prisma/tenant-transaction.service";
import { TenantJobContextService } from "./tenant-job-context.service";

@Injectable()
export class TenantEnumeratorService {
	public constructor(
		private readonly tenantTx: TenantTransactionService,
		private readonly jobContext: TenantJobContextService,
	) {}

	public async listActiveTenantIds(): Promise<string[]> {
		const rows = await this.tenantTx.withSystemOperation(
			{
				operation: "tenant.enumerate",
				reason: "Scheduler fan-out",
				actorUserId: null,
			},
			async (tx) =>
				tx.tenant.findMany({
					where: { lifecycleState: { in: ["ACTIVE", "RESTRICTED"] }, isDeleted: false },
					select: { id: true },
				}),
		);
		return rows.map((r) => r.id);
	}

	public buildTenantJobContext(tenantId: string, purpose: string): ReturnType<TenantJobContextService["sign"]> {
		const now = Date.now();
		return this.jobContext.sign({
			tenantId,
			initiatingActorId: null,
			purpose,
			correlationId: `${purpose}:${tenantId}:${String(now)}`,
			issuedAt: now,
			expiresAt: now + 300_000,
		});
	}
}
