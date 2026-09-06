import { Injectable } from "@nestjs/common";
import type { RewardOtpChallenge } from "@prisma/client";

import { PrismaService } from "../../../prisma/prisma.service";

@Injectable()
export class RewardOtpChallengeRepository {
	public constructor(private readonly prisma: PrismaService) {}

	public async create(input: {
		readonly userId: string;
		readonly phone: string;
		readonly purpose: "CLAIM";
		readonly rewardId: string;
		readonly codeHash: string;
		readonly expiresAt: number;
	}): Promise<void> {
		await this.prisma.rewardOtpChallenge.create({
			data: {
				userId: input.userId,
				phone: input.phone,
				purpose: input.purpose,
				rewardId: input.rewardId,
				codeHash: input.codeHash,
				expiresAt: input.expiresAt,
			},
		});
	}

	public async findActiveClaimChallenge(userId: string, phone: string, rewardId: string, now: number): Promise<RewardOtpChallenge | null> {
		return this.prisma.rewardOtpChallenge.findFirst({
			where: {
				userId,
				phone,
				rewardId,
				purpose: "CLAIM",
				consumedAt: null,
				isDeleted: false,
				expiresAt: { gte: now },
			},
			orderBy: { createdAt: "desc" },
		});
	}

	public async recordVerificationAttempt(
		challengeId: string,
		data: { readonly attempts: number; readonly failedAttempts: number | { increment: number }; readonly consumedAt: bigint | number | null },
	): Promise<void> {
		await this.prisma.rewardOtpChallenge.update({
			where: { id: challengeId },
			data,
		});
	}
}
