import { Injectable } from "@nestjs/common";
import type { RewardClaimCheckoutStatus } from "@workspace/shared";

import { RewardLegalAcceptanceRepository } from "../repositories/reward-legal-acceptance.repository";
import { RewardUserRepository } from "../repositories/reward-user.repository";

@Injectable()
export class RewardLegalService {
	public constructor(
		private readonly legalAcceptanceRepository: RewardLegalAcceptanceRepository,
		private readonly rewardUserRepository: RewardUserRepository,
	) {}

	public async hasAccepted(userId: string): Promise<boolean> {
		const row = await this.legalAcceptanceRepository.findActiveByUserId(userId);
		return row !== null;
	}

	public async getCheckoutStatus(userId: string): Promise<RewardClaimCheckoutStatus> {
		const acceptance = await this.legalAcceptanceRepository.findActiveByUserId(userId);
		const user = await this.rewardUserRepository.findClaimCheckoutById(userId);
		const phoneVerified = user?.phoneVerifiedAt !== null && user?.phoneVerifiedAt !== undefined;

		return {
			hasAcceptedLegal: acceptance !== null,
			termsVersion: acceptance?.termsVersion ?? null,
			privacyVersion: acceptance?.privacyVersion ?? null,
			phone: user?.phone ?? null,
			phoneVerified,
		};
	}

	public async accept(userId: string, termsVersion: string, privacyVersion: string): Promise<{ ok: true }> {
		await this.legalAcceptanceRepository.create({
			userId,
			termsVersion,
			privacyVersion,
			acceptedAt: Date.now(),
		});
		return { ok: true };
	}
}
