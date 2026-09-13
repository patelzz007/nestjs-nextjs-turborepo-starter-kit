import { HttpException, HttpStatus, Injectable } from "@nestjs/common";
import { epochMs, type OrganizationQuotaStatus } from "@workspace/shared";

import { TenantTransactionService } from "../../../prisma/tenant-transaction.service";

export type QuotaBehavior = "reject" | "queue" | "degrade" | "grace";

@Injectable()
export class OrganizationQuotaService {
	public constructor(private readonly tenantTx: TenantTransactionService) {}

	public async checkAndConsume(
		organizationId: string,
		userId: string,
		quotaKey: string,
		amount: bigint,
		behavior: QuotaBehavior,
	): Promise<void> {
		const windowStart = BigInt(Math.floor(Date.now() / 86_400_000) * 86_400_000);
		const windowEnd = windowStart + BigInt(86_400_000);

		const status = await this.tenantTx.withTenantTransaction(
			{
				userId,
				organizationId,
				purpose: "quota.check",
				policyVersion: 0,
			},
			async (tx) => {
				const quota = await tx.organizationQuota.upsert({
					where: { organizationId_quotaKey_windowStart: { organizationId, quotaKey, windowStart } },
					create: {
						organizationId,
						quotaKey,
						limitValue: BigInt(10_000),
						usedValue: amount,
						windowStart,
						windowEnd,
					},
					update: { usedValue: { increment: amount } },
				});

				return {
					quotaKey,
					limitValue: Number(quota.limitValue),
					usedValue: Number(quota.usedValue),
					windowEnd: epochMs(Number(quota.windowEnd)),
				} satisfies OrganizationQuotaStatus;
			},
		);

		if (status.usedValue > status.limitValue) {
			if (behavior === "reject") {
				throw new HttpException(
					{ message: "Quota exceeded", quotaKey, limit: status.limitValue },
					HttpStatus.TOO_MANY_REQUESTS,
				);
			}
		}
	}
}
