import { Injectable } from "@nestjs/common";
import type { RewardRedemptionIdempotencyRecord } from "@prisma/client";

import { PrismaService } from "../../../prisma/prisma.service";

@Injectable()
export class RewardRedemptionIdempotencyRepository {
	public constructor(private readonly prisma: PrismaService) {}

	public async findByTokenAndKey(redemptionTokenHash: string, idempotencyKey: string): Promise<RewardRedemptionIdempotencyRecord | null> {
		return this.prisma.rewardRedemptionIdempotencyRecord.findUnique({
			where: {
				redemptionTokenHash_idempotencyKey: {
					redemptionTokenHash,
					idempotencyKey,
				},
			},
		});
	}
}
