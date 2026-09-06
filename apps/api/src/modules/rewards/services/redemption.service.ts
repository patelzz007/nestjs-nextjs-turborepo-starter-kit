import { ConflictException, Injectable, UnprocessableEntityException } from "@nestjs/common";

import type { RedemptionConfirmInput, RedemptionConfirmedResponse, RedemptionPreviewResponse, RedemptionValidateInput } from "@workspace/shared";
import { EpochMsSchema } from "@workspace/shared";

import { EmailSenderService } from "../../notifications/email/email-sender.service";
import { ReferrerRewardCreditedEmailTemplate } from "../../notifications/email/templates/referrer-reward-credited-email.template";
import { RewardAuditLogRepository } from "../repositories/reward-audit-log.repository";
import { RewardRedemptionIdempotencyRepository } from "../repositories/reward-redemption-idempotency.repository";
import { RewardRedemptionRepository } from "../repositories/reward-redemption.repository";
import { RewardReferralRepository } from "../repositories/reward-referral.repository";
import { RewardRepository } from "../repositories/reward.repository";
import { RewardUserRepository } from "../repositories/reward-user.repository";
import { generateBackupCode, generateOpaqueToken, sha256Hex } from "../utils/reward-crypto.util";
import { ClaimService } from "./claim.service";
import { RewardNotificationService } from "./reward-notification.service";

const REFERRER_CLAIM_TTL_MS = 30 * 24 * 60 * 60 * 1000;
const REFERRER_CLAIM_EXPIRES_DAYS = 30;

@Injectable()
export class RedemptionService {
	public constructor(
		private readonly auditLogRepository: RewardAuditLogRepository,
		private readonly redemptionRepository: RewardRedemptionRepository,
		private readonly idempotencyRepository: RewardRedemptionIdempotencyRepository,
		private readonly rewardReferralRepository: RewardReferralRepository,
		private readonly rewardRepository: RewardRepository,
		private readonly rewardUserRepository: RewardUserRepository,
		private readonly claimService: ClaimService,
		private readonly notificationService: RewardNotificationService,
		private readonly emailSender: EmailSenderService,
	) {}

	public async validate(merchantOrgId: string, terminalId: string, input: RedemptionValidateInput): Promise<RedemptionPreviewResponse> {
		const { claim, reward } = await this.claimService.findClaimByTokenOrBackup(input.token, input.backupCode);

		if (reward.merchantOrgId !== merchantOrgId) {
			throw new UnprocessableEntityException({ message: "Reward not valid for this merchant", error: "WRONG_MERCHANT" });
		}

		await this.auditLogRepository.create({
			merchantOrgId,
			action: "merchant.scan_qr",
			metadata: { claimId: claim.id, terminalId },
		});

		const valid = claim.status === "PENDING" && Number(claim.claimExpiresAt) >= Date.now();

		return {
			claimId: claim.id,
			rewardTitle: reward.title,
			rewardType: reward.rewardType,
			claimExpiresAt: EpochMsSchema.parse(Number(claim.claimExpiresAt)),
			valid,
		};
	}

	public async confirm(merchantOrgId: string, terminalId: string, input: RedemptionConfirmInput): Promise<RedemptionConfirmedResponse> {
		const { claim, reward } = await this.claimService.findClaimByTokenOrBackup(input.token, input.backupCode);

		if (input.backupCode !== undefined) {
			this.assertBackupNotLocked(claim);
		}

		if (reward.merchantOrgId !== merchantOrgId) {
			throw new UnprocessableEntityException({ message: "Reward not valid for this merchant", error: "WRONG_MERCHANT" });
		}

		const existingRedemption = await this.redemptionRepository.findByClaimId(claim.id);

		if (existingRedemption !== null) {
			if (existingRedemption.idempotencyKey !== input.idempotencyKey) {
				throw new ConflictException({
					message: "Token already redeemed with different idempotency key",
					error: "IDEMPOTENCY_KEY_MISMATCH",
					redemptionId: existingRedemption.id,
				});
			}
			return {
				redemptionId: existingRedemption.id,
				claimId: existingRedemption.claimId,
				redeemedAt: EpochMsSchema.parse(Number(existingRedemption.redeemedAt)),
				idempotencyKey: existingRedemption.idempotencyKey,
			};
		}

		if (claim.status !== "PENDING") {
			throw new ConflictException({ message: "Already redeemed", error: "ALREADY_REDEEMED" });
		}

		if (Number(claim.claimExpiresAt) < Date.now()) {
			throw new UnprocessableEntityException({ message: "Claim expired", error: "CLAIM_EXPIRED" });
		}

		const idempotencyRecord = await this.idempotencyRepository.findByTokenAndKey(claim.redemptionTokenHash, input.idempotencyKey);

		if (idempotencyRecord !== null && idempotencyRecord.redemptionId !== null) {
			const redemption = await this.redemptionRepository.findById(idempotencyRecord.redemptionId);
			if (redemption !== null) {
				return {
					redemptionId: redemption.id,
					claimId: redemption.claimId,
					redeemedAt: EpochMsSchema.parse(Number(redemption.redeemedAt)),
					idempotencyKey: redemption.idempotencyKey,
				};
			}
		}

		const now = Date.now();
		const method = input.backupCode !== undefined ? "MANUAL" : "SCAN";

		const redemption = await this.redemptionRepository.confirmInTransaction({
			claimId: claim.id,
			rewardId: reward.id,
			merchantOrgId,
			userId: claim.userId,
			terminalId,
			redemptionMethod: method,
			idempotencyKey: input.idempotencyKey,
			redemptionTokenHash: claim.redemptionTokenHash,
			redeemedAt: now,
		});

		if (redemption === null) {
			throw new ConflictException({ message: "Already redeemed", error: "ALREADY_REDEEMED" });
		}

		await this.processReferralCredit(claim.id, claim.userId, reward.id);

		return {
			redemptionId: redemption.id,
			claimId: redemption.claimId,
			redeemedAt: EpochMsSchema.parse(Number(redemption.redeemedAt)),
			idempotencyKey: redemption.idempotencyKey,
		};
	}

	private assertBackupNotLocked(claim: { backupLockedUntil: bigint | null }): void {
		if (claim.backupLockedUntil !== null && Number(claim.backupLockedUntil) > Date.now()) {
			throw new UnprocessableEntityException({ message: "Backup code locked", error: "BACKUP_LOCKED" });
		}
	}

	private async processReferralCredit(claimId: string, refereeUserId: string, rewardId: string): Promise<void> {
		const referral = await this.rewardReferralRepository.findPendingByRewardAndReferee(rewardId, refereeUserId);

		if (referral === null) {
			return;
		}

		const parentReward = await this.rewardRepository.findWithReferrerReward(rewardId);

		if (parentReward?.referrerRewardId == null || parentReward.referrerReward == null) {
			return;
		}

		if (parentReward.referralPoolRemaining === null || parentReward.referralPoolRemaining <= 0) {
			return;
		}

		const referrerReward = parentReward.referrerReward;
		const now = Date.now();
		const referrerClaimExpires = Math.min(now + REFERRER_CLAIM_TTL_MS, Number(referrerReward.expiryDate));
		const token = generateOpaqueToken();
		const backupCode = generateBackupCode();

		const credited = await this.rewardReferralRepository.creditReferrerInTransaction({
			parentRewardId: parentReward.id,
			referrerRewardId: referrerReward.id,
			referralId: referral.id,
			referrerUserId: referral.referrerUserId,
			redemptionTokenHash: sha256Hex(token),
			backupCodeHash: sha256Hex(backupCode),
			claimedAt: now,
			claimExpiresAt: referrerClaimExpires,
		});

		if (!credited) {
			return;
		}

		await this.notificationService.notify(
			referral.referrerUserId,
			"referrer_reward_credited",
			"You earned a referrer reward!",
			`Your referral redeemed a reward. Claim "${referrerReward.title}" within 30 days.`,
			{ rewardId: referrerReward.id },
		);

		const referrerUser = await this.rewardUserRepository.findEmailById(referral.referrerUserId);

		if (referrerUser !== null) {
			await this.emailSender.send(
				new ReferrerRewardCreditedEmailTemplate({
					to: referrerUser.email,
					rewardTitle: referrerReward.title,
					claimExpiresDays: REFERRER_CLAIM_EXPIRES_DAYS,
				}),
			);
		}
	}
}
