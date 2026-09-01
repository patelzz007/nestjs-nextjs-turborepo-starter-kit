import { Injectable } from "@nestjs/common";

import { PrismaService } from "../../../prisma/prisma.service";

@Injectable()
export class RewardLegalService {
	public constructor(private readonly prisma: PrismaService) {}

	public async hasAccepted(userId: string): Promise<boolean> {
		const row = await this.prisma.rewardLegalAcceptance.findFirst({
			where: { userId, isDeleted: false },
		});
		return row !== null;
	}

	public async accept(userId: string, termsVersion: string, privacyVersion: string): Promise<{ ok: true }> {
		await this.prisma.rewardLegalAcceptance.create({
			data: {
				userId,
				termsVersion,
				privacyVersion,
				acceptedAt: Date.now(),
			},
		});
		return { ok: true };
	}
}
