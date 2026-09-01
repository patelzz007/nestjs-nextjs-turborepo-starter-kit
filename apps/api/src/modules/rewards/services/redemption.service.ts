import { ConflictException, Injectable, UnprocessableEntityException } from "@nestjs/common";

import type { RedemptionConfirmInput, RedemptionConfirmedResponse, RedemptionPreviewResponse, RedemptionValidateInput } from "@workspace/shared";
import { EpochMsSchema } from "@workspace/shared";

import { PrismaService } from "../../../prisma/prisma.service";
import { EmailSenderService } from "../../notifications/email/email-sender.service";
import { ReferrerRewardCreditedEmailTemplate } from "../../notifications/email/templates/referrer-reward-credited-email.template";
import { generateBackupCode, generateOpaqueToken, sha256Hex } from "../utils/reward-crypto.util";
import { ClaimService } from "./claim.service";
import { RewardNotificationService } from "./reward-notification.service";

const REFERRER_CLAIM_TTL_MS = 30 * 24 * 60 * 60 * 1000;
const REFERRER_CLAIM_EXPIRES_DAYS = 30;

@Injectable()
export class RedemptionService {
	public constructor(
		private readonly prisma: PrismaService,
		private readonly claimService: ClaimService,
		private readonly notificationService: RewardNotificationService,
		private readonly emailSender: EmailSenderService,
	) {}

	public async validate(merchantOrgId: string, terminalId: string, input: RedemptionValidateInput): Promise<RedemptionPreviewResponse> {
		const { claim, reward } = await this.claimService.findClaimByTokenOrBackup(input.token, input.backupCode);

		if (reward.merchantOrgId !== merchantOrgId) {
			throw new UnprocessableEntityException({ message: "Reward not valid for this merchant", error: "WRONG_MERCHANT" });
		}

		await this.prisma.rewardAuditLog.create({
			data: {
				merchantOrgId,
				action: "merchant.scan_qr",
				metadata: { claimId: claim.id, terminalId },
			},
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

		const existingRedemption = await this.prisma.rewardRedemption.findUnique({
			where: { claimId: claim.id },
		});

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

		const idempotencyRecord = await this.prisma.rewardRedemptionIdempotencyRecord.findUnique({
			where: {
				redemptionTokenHash_idempotencyKey: {
					redemptionTokenHash: claim.redemptionTokenHash,
					idempotencyKey: input.idempotencyKey,
				},
			},
		});

		if (idempotencyRecord !== null && idempotencyRecord.redemptionId !== null) {
			const redemption = await this.prisma.rewardRedemption.findUnique({ where: { id: idempotencyRecord.redemptionId } });
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

		const redemption = await this.prisma.$transaction(async (tx) => {
			const updated = await tx.rewardClaim.updateMany({
				where: { id: claim.id, status: "PENDING" },
				data: { status: "REDEEMED", redeemedAt: now },
			});

			if (updated.count === 0) {
				throw new ConflictException({ message: "Already redeemed", error: "ALREADY_REDEEMED" });
			}

			await tx.reward.update({
				where: { id: reward.id },
				data: {
					quantityReserved: { decrement: 1 },
					redemptionCount: { increment: 1 },
				},
			});

			const created = await tx.rewardRedemption.create({
				data: {
					claimId: claim.id,
					merchantOrgId,
					userId: claim.userId,
					terminalId,
					redemptionMethod: method,
					idempotencyKey: input.idempotencyKey,
					redeemedAt: now,
				},
			});

			await tx.rewardRedemptionIdempotencyRecord.create({
				data: {
					redemptionTokenHash: claim.redemptionTokenHash,
					idempotencyKey: input.idempotencyKey,
					redemptionId: created.id,
				},
			});

			await tx.rewardAuditLog.create({
				data: {
					merchantOrgId,
					action: "merchant.redeem_reward",
					metadata: { claimId: claim.id, redemptionId: created.id, terminalId },
				},
			});

			return created;
		});

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
		const referral = await this.prisma.rewardReferral.findFirst({
			where: { rewardId, refereeUserId, status: "PENDING" },
		});

		if (referral === null) {
			return;
		}

		const parentReward = await this.prisma.reward.findUnique({
			where: { id: rewardId },
			include: { referrerReward: true },
		});

		if (parentReward === null || parentReward.referrerRewardId === null || parentReward.referrerReward === null) {
			return;
		}

		if (parentReward.referralPoolRemaining === null || parentReward.referralPoolRemaining <= 0) {
			return;
		}

		const referrerReward = parentReward.referrerReward;
		const now = Date.now();
		const referrerClaimExpires = Math.min(now + REFERRER_CLAIM_TTL_MS, Number(referrerReward.expiryDate));

		const credited = await this.prisma.$transaction(async (tx) => {
			await tx.reward.update({
				where: { id: parentReward.id },
				data: { referralPoolRemaining: { decrement: 1 } },
			});

			const reserved = await tx.reward.updateMany({
				where: { id: referrerReward.id, quantityRemaining: { gt: 0 } },
				data: {
					quantityRemaining: { decrement: 1 },
					quantityReserved: { increment: 1 },
					claimCount: { increment: 1 },
				},
			});

			if (reserved.count === 0) {
				return false;
			}

			const token = generateOpaqueToken();
			const backupCode = generateBackupCode();

			await tx.rewardClaim.create({
				data: {
					userId: referral.referrerUserId,
					rewardId: referrerReward.id,
					redemptionTokenHash: sha256Hex(token),
					backupCodeHash: sha256Hex(backupCode),
					status: "PENDING",
					isReferrerCredit: true,
					claimedAt: now,
					claimExpiresAt: referrerClaimExpires,
				},
			});

			await tx.rewardReferral.update({
				where: { id: referral.id },
				data: { status: "CREDITED", creditedAt: now },
			});

			return true;
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

		const referrerUser = await this.prisma.user.findUnique({
			where: { id: referral.referrerUserId },
			select: { email: true },
		});

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
