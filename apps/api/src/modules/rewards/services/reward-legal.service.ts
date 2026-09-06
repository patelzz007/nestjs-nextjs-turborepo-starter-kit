import { Injectable } from "@nestjs/common";

import { RewardLegalAcceptanceRepository } from "../repositories/reward-legal-acceptance.repository";

@Injectable()
export class RewardLegalService {
	public constructor(private readonly legalAcceptanceRepository: RewardLegalAcceptanceRepository) {}

	public async hasAccepted(userId: string): Promise<boolean> {
		const row = await this.legalAcceptanceRepository.findActiveByUserId(userId);
		return row !== null;
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
