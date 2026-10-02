import { ConflictException, Injectable, UnprocessableEntityException } from "@nestjs/common";
import type { Prisma } from "@prisma/client";

import type {
	RedemptionCheckoutInput,
	RedemptionCheckoutResponse,
	RedemptionCode,
	RedemptionConfirmInput,
	RedemptionConfirmedResponse,
	RedemptionInvalidReason,
	RedemptionPreviewResponse,
	RedemptionValidateInput,
} from "@workspace/shared";
import { EpochMsSchema, RewardPlatformEventSchema, SaleCurrencySchema } from "@workspace/shared";

import { PlatformOutboxService } from "../../../infrastructure/outbox/platform-outbox.service";

import { EmailSenderService } from "../../notifications/email/email-sender.service";
import { ReferrerRewardCreditedEmailTemplate } from "../../notifications/email/templates/referrer-reward-credited-email.template";
import { RewardAuditLogRepository } from "../repositories/reward-audit-log.repository";
import { RewardRedemptionIdempotencyRepository } from "../repositories/reward-redemption-idempotency.repository";
import { RewardRedemptionRepository } from "../repositories/reward-redemption.repository";
import { RewardReferralRepository } from "../repositories/reward-referral.repository";
import { RewardRepository } from "../repositories/reward.repository";
import { RewardUserRepository } from "../repositories/reward-user.repository";
import type { RewardClaimRedemptionLookup } from "../repositories/reward-claim.repository";
import { CheckoutClaimConflictError, isDuplicateSaleKeyError, RewardSaleRepository, type RewardSaleWithRedemptions } from "../repositories/reward-sale.repository";
import type { MerchantPosContext } from "../types/merchant-pos-context";
import { checkoutRequestHash, redemptionInvalidReason } from "../utils/redemption-eligibility.util";
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
		private readonly saleRepository: RewardSaleRepository,
		private readonly outbox: PlatformOutboxService,
	) {}

	public async validate(pos: MerchantPosContext, input: RedemptionValidateInput): Promise<RedemptionPreviewResponse> {
		const lookup = await this.claimService.findClaimByTokenOrBackup(input.token, input.backupCode);
		const { claim, reward } = lookup;
		assertSameMerchant(reward.organizationId, pos.organizationId);

		await this.auditLogRepository.create({
			organizationId: pos.organizationId,
			action: "merchant.scan_qr",
			metadata: { claimId: claim.id, terminalId: pos.terminalId, locationId: pos.locationId },
		});

		const invalidReason = redemptionInvalidReason({ lookup, locationId: pos.locationId, usedBackupCode: input.backupCode !== undefined, now: Date.now() });

		return {
			claimId: claim.id,
			rewardTitle: reward.title,
			rewardType: reward.rewardType,
			claimExpiresAt: EpochMsSchema.parse(Number(claim.claimExpiresAt)),
			valid: invalidReason === null,
			invalidReason,
			minSpendMinor: reward.minSpendMinor,
		};
	}

	/** Single-reward redemption that records no sale. Prefer {@link checkout}, which also reports the bill. */
	public async confirm(pos: MerchantPosContext, input: RedemptionConfirmInput): Promise<RedemptionConfirmedResponse> {
		const { organizationId, terminalId } = pos;
		const lookup = await this.claimService.findClaimByTokenOrBackup(input.token, input.backupCode);
		const { claim, reward } = lookup;

		if (input.backupCode !== undefined) {
			this.assertBackupNotLocked(claim);
		}

		assertSameMerchant(reward.organizationId, organizationId);

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

		if (redemptionInvalidReason({ lookup, locationId: pos.locationId, usedBackupCode: false, now: Date.now() }) === "NOT_VALID_AT_STORE") {
			throw invalidReasonException("NOT_VALID_AT_STORE", claim.id);
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
			organizationId,
			locationId: pos.locationId,
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

	/**
	 * `POST /redemptions/checkout` — the customer has paid: record the bill and
	 * redeem every presented reward, all-or-nothing, idempotently.
	 *
	 * Checks before writing (each fails the whole checkout): every code exists
	 * and belongs to this merchant, codes are distinct claims of ONE customer,
	 * each claim is redeemable here (not redeemed/expired/locked, valid at this
	 * store) and the bill meets each reward's minimum spend. The write itself is
	 * race-safe (see `RewardSaleRepository.checkoutInTransaction`).
	 */
	public async checkout(pos: MerchantPosContext, input: RedemptionCheckoutInput): Promise<RedemptionCheckoutResponse> {
		const requestHash = checkoutRequestHash(input);
		const existing = await this.saleRepository.findByIdempotencyKey(pos.organizationId, input.idempotencyKey);
		if (existing !== null) {
			return replayCheckout(existing, requestHash);
		}

		const lookups = await Promise.all(
			input.codes.map(async (code: RedemptionCode) => ({ code, lookup: await this.claimService.findClaimByTokenOrBackup(code.token, code.backupCode) })),
		);
		const paidAt = Date.now();
		this.assertCheckoutEligible(pos, input, lookups, paidAt);

		const [first] = lookups;
		if (first === undefined) {
			throw new UnprocessableEntityException({ message: "At least one reward code is required", error: "REDEMPTION_INPUT_REQUIRED" });
		}

		let sale: RewardSaleWithRedemptions;
		try {
			sale = await this.saleRepository.checkoutInTransaction(
				{
					organizationId: pos.organizationId,
					locationId: pos.locationId,
					userId: first.lookup.claim.userId,
					terminalId: pos.terminalId,
					apiKeyId: pos.apiKeyId,
					billTotalMinor: input.billTotalMinor,
					currency: input.currency,
					idempotencyKey: input.idempotencyKey,
					requestHash,
					paidAt,
					lines: lookups.map(({ code, lookup }) => ({
						claimId: lookup.claim.id,
						rewardId: lookup.reward.id,
						redemptionMethod: code.backupCode !== undefined && code.token === undefined ? "MANUAL" : "SCAN",
					})),
				},
				async (tx: Prisma.TransactionClient, created: RewardSaleWithRedemptions): Promise<void> => {
					await this.enqueueCheckoutEvent(tx, created);
				},
			);
		} catch (error) {
			// A concurrent request with the same key won the race: replay its result.
			if (error instanceof CheckoutClaimConflictError || (error instanceof Error && isDuplicateSaleKeyError(error))) {
				const winner = await this.saleRepository.findByIdempotencyKey(pos.organizationId, input.idempotencyKey);
				if (winner !== null) {
					return replayCheckout(winner, requestHash);
				}
			}
			if (error instanceof CheckoutClaimConflictError) {
				throw invalidReasonException("ALREADY_REDEEMED", error.claimId);
			}
			throw error;
		}

		for (const { lookup } of lookups) {
			await this.processReferralCredit(lookup.claim.id, lookup.claim.userId, lookup.reward.id);
		}

		return toCheckoutResponse(sale);
	}

	private assertCheckoutEligible(
		pos: MerchantPosContext,
		input: RedemptionCheckoutInput,
		lookups: readonly { readonly code: RedemptionCode; readonly lookup: RewardClaimRedemptionLookup }[],
		now: number,
	): void {
		const claimIds = new Set<string>();
		const customers = new Set<string>();

		for (const { code, lookup } of lookups) {
			const { claim, reward } = lookup;
			assertSameMerchant(reward.organizationId, pos.organizationId);

			if (claimIds.has(claim.id)) {
				throw new UnprocessableEntityException({ message: "The same reward was presented twice", error: "DUPLICATE_REWARD_CODE", claimId: claim.id });
			}
			claimIds.add(claim.id);
			customers.add(claim.userId);

			const reason = redemptionInvalidReason({ lookup, locationId: pos.locationId, usedBackupCode: code.backupCode !== undefined && code.token === undefined, now });
			if (reason !== null) {
				throw invalidReasonException(reason, claim.id);
			}

			if (reward.minSpendMinor !== null && input.billTotalMinor < reward.minSpendMinor) {
				throw new UnprocessableEntityException({
					message: `"${reward.title}" needs a bill of at least ${String(reward.minSpendMinor)} (minor units)`,
					error: "MIN_SPEND_NOT_MET",
					claimId: claim.id,
					minSpendMinor: reward.minSpendMinor,
				});
			}
		}

		if (customers.size > 1) {
			throw new UnprocessableEntityException({ message: "All rewards on one bill must belong to the same customer", error: "MULTIPLE_CUSTOMERS" });
		}
	}

	/** Same-transaction outbox write: the analytics pipeline sees every paid bill exactly once (see `PlatformOutboxService`). */
	private async enqueueCheckoutEvent(tx: Prisma.TransactionClient, sale: RewardSaleWithRedemptions): Promise<void> {
		const payload = RewardPlatformEventSchema.parse({
			event: "merchant.redeem_reward",
			actorUserId: null,
			organizationId: sale.organizationId,
			metadata: {
				saleId: sale.id,
				customerUserId: sale.userId,
				locationId: sale.locationId,
				terminalId: sale.terminalId,
				billTotalMinor: sale.billTotalMinor,
				currency: sale.currency,
				claimIds: sale.redemptions.map((redemption) => redemption.claimId),
			},
		});
		await this.outbox.enqueueInTransaction(tx, { type: "reward.platform", payload });
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

function assertSameMerchant(rewardOrganizationId: string, posOrganizationId: string): void {
	if (rewardOrganizationId !== posOrganizationId) {
		throw new UnprocessableEntityException({ message: "Reward not valid for this merchant", error: "WRONG_MERCHANT" });
	}
}

const INVALID_REASON_ERRORS: Readonly<Record<RedemptionInvalidReason, { readonly message: string; readonly error: string; readonly status: "conflict" | "unprocessable" }>> = {
	ALREADY_REDEEMED: { message: "Already redeemed", error: "ALREADY_REDEEMED", status: "conflict" },
	EXPIRED: { message: "Claim expired", error: "CLAIM_EXPIRED", status: "unprocessable" },
	BACKUP_LOCKED: { message: "Backup code locked", error: "BACKUP_LOCKED", status: "unprocessable" },
	NOT_VALID_AT_STORE: { message: "This reward is not valid at this store", error: "REWARD_NOT_VALID_AT_STORE", status: "unprocessable" },
};

function invalidReasonException(reason: RedemptionInvalidReason, claimId: string): ConflictException | UnprocessableEntityException {
	const { message, error, status } = INVALID_REASON_ERRORS[reason];
	const body = { message, error, claimId };
	return status === "conflict" ? new ConflictException(body) : new UnprocessableEntityException(body);
}

function toCheckoutResponse(sale: RewardSaleWithRedemptions): RedemptionCheckoutResponse {
	return {
		saleId: sale.id,
		billTotalMinor: sale.billTotalMinor,
		currency: SaleCurrencySchema.parse(sale.currency),
		paidAt: EpochMsSchema.parse(Number(sale.paidAt)),
		idempotencyKey: sale.idempotencyKey,
		redemptions: sale.redemptions.map((redemption) => ({
			redemptionId: redemption.id,
			claimId: redemption.claimId,
			rewardId: redemption.claim.rewardId,
			rewardTitle: redemption.claim.reward.title,
		})),
	};
}

/** A retried key replays the original bill — but only for the identical request (a reused key with a different bill is a client bug). */
function replayCheckout(sale: RewardSaleWithRedemptions, requestHash: string): RedemptionCheckoutResponse {
	if (sale.requestHash !== requestHash) {
		throw new ConflictException({ message: "This idempotency key was already used for a different checkout", error: "IDEMPOTENCY_KEY_REUSED", saleId: sale.id });
	}
	return toCheckoutResponse(sale);
}
