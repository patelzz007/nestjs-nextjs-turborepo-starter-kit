import { Injectable } from "@nestjs/common";
import type { RewardLegalAcceptance } from "@prisma/client";

import { PrismaService } from "../../../prisma/prisma.service";

@Injectable()
export class RewardLegalAcceptanceRepository {
	public constructor(private readonly prisma: PrismaService) {}

	public async findActiveByUserId(userId: string): Promise<RewardLegalAcceptance | null> {
		return this.prisma.rewardLegalAcceptance.findFirst({
			where: { userId, isDeleted: false },
		});
	}

	public async create(input: { readonly userId: string; readonly termsVersion: string; readonly privacyVersion: string; readonly acceptedAt: number }): Promise<void> {
		await this.prisma.rewardLegalAcceptance.create({
			data: {
				userId: input.userId,
				termsVersion: input.termsVersion,
				privacyVersion: input.privacyVersion,
				acceptedAt: input.acceptedAt,
			},
		});
	}
}
