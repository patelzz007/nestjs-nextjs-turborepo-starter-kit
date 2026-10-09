import { ConflictException, Injectable, Logger, NotFoundException, UnprocessableEntityException } from "@nestjs/common";
import type { Prisma } from "@prisma/client";

import type {
	RedemptionCheckoutInput,
	RedemptionCheckoutResponse,
	RedemptionCode,
	RedemptionInvalidReason,
	RedemptionPreviewResponse,
	RedemptionValidateInput,
} from "@workspace/shared";
import { EpochMsSchema, RewardPlatformEventSchema, SaleCurrencySchema } from "@workspace/shared";

import { PlatformOutboxService } from "../../../infrastructure/outbox/platform-outbox.service";

import { RewardAuditLogRepository } from "../repositories/reward-audit-log.repository";
import type { RewardClaimRedemptionLookup } from "../repositories/reward-claim.repository";
import { RewardReferralRepository, type CreditedReferral } from "../repositories/reward-referral.repository";
import { CheckoutClaimConflictError, isDuplicateSaleKeyError, RewardSaleRepository, type RewardSaleWithRedemptions } from "../repositories/reward-sale.repository";
import type { MerchantPosContext } from "../types/merchant-pos-context";
import { minorUnitsToNumber } from "../utils/minor-units.util";
import { checkoutRequestHash, redemptionInvalidReason } from "../utils/redemption-eligibility.util";
import { RewardCodeHasher } from "../crypto/reward-code-hasher";
import { generateBackupCode, generateOpaqueToken } from "../utils/reward-crypto.util";
import { ClaimService } from "./claim.service";
import { PosCodeLockoutService, posCodeLockedException } from "./pos-code-lockout.service";
import { REFERRER_CLAIM_TTL_DAYS, REFERRER_CLAIM_TTL_MS } from "./referral-credit.constants";
import { ReferralCreditNotificationService } from "./referral-credit-notification.service";
import { SignupReferralCheckoutService } from "../../auth/signup-referrals/signup-referral-checkout.service";

/** What the checkout transaction hands to the after-commit deliveries. */
interface CheckoutSideEffects {
	readonly credited: readonly CreditedReferral[];
	/** The signup referral this checkout stamped successful, or null (ADR 035). */
	readonly stampedSignupReferralId: string | null;
}

/** One presented code and the merchant claim it resolved to. */
interface ResolvedCode {
	readonly code: RedemptionCode;
	readonly lookup: RewardClaimRedemptionLookup;
}

/**
 * The single answer for a code this merchant cannot redeem because it does
 * not know it — whether the code does not exist at all or belongs to ANOTHER
 * merchant. Identical status, body and timing class, so the POS API is not an
 * oracle for other merchants' codes.
 */
function codeNotFound(): NotFoundException {
	return new NotFoundException({ message: "This code is not valid for this merchant", error: "REDEMPTION_TOKEN_INVALID" });
}

@Injectable()
export class RedemptionService {
	private readonly logger: Logger = new Logger(RedemptionService.name);

	public constructor(
		private readonly auditLogRepository: RewardAuditLogRepository,
		private readonly rewardReferralRepository: RewardReferralRepository,
		private readonly claimService: ClaimService,
		private readonly saleRepository: RewardSaleRepository,
		private readonly outbox: PlatformOutboxService,
		private readonly codeLockout: PosCodeLockoutService,
		private readonly referralNotifications: ReferralCreditNotificationService,
		private readonly signupReferralCheckout: SignupReferralCheckoutService,
		private readonly codeHasher: RewardCodeHasher,
	) {}

	/** `POST /redemptions/validate` — preview one code before the bill is paid (redeems nothing). */
	public async validate(pos: MerchantPosContext, input: RedemptionValidateInput): Promise<RedemptionPreviewResponse> {
		const now = Date.now();
		const [resolved] = await this.resolveCodes(pos, [input], now);
		if (resolved === undefined) {
			throw codeNotFound();
		}
		const { claim, reward } = resolved.lookup;

		await this.auditLogRepository.create({
			organizationId: pos.organizationId,
			action: "merchant.scan_qr",
			metadata: { claimId: claim.id, terminalId: pos.terminalId, apiKeyId: pos.apiKeyId, locationId: pos.locationId },
		});

		const invalidReason = redemptionInvalidReason({ lookup: resolved.lookup, locationId: pos.locationId, now });

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

	/**
	 * `POST /redemptions/checkout` — the customer has paid: record the bill and
	 * redeem every presented reward, all-or-nothing, idempotently.
	 *
	 * Checks before writing (each fails the whole checkout): every code is one
	 * of THIS merchant's claims, codes are distinct claims of ONE customer,
	 * each claim is redeemable here (not redeemed/expired, valid at this store)
	 * and the bill meets each reward's minimum spend. The write is race-safe
	 * (see `RewardSaleRepository.checkoutInTransaction`) and, in the same
	 * transaction, enqueues the analytics event and credits any referrer the
	 * redeemed rewards earned, and stamps the customer's signup referral
	 * successful on their first redemption (ADR 035). Referrer emails and the
	 * signup-referral notification are delivered after the commit.
	 */
	public async checkout(pos: MerchantPosContext, input: RedemptionCheckoutInput): Promise<RedemptionCheckoutResponse> {
		const requestHash = checkoutRequestHash(input);
		const existing = await this.saleRepository.findByIdempotencyKey(pos.organizationId, input.idempotencyKey);
		if (existing !== null) {
			return replayCheckout(existing, requestHash);
		}

		const paidAt = Date.now();
		const resolved = await this.resolveCodes(pos, input.codes, paidAt);
		if (resolved.length !== input.codes.length) {
			throw codeNotFound();
		}
		this.assertCheckoutEligible(pos, input, resolved, paidAt);

		const [first] = resolved;
		if (first === undefined) {
			throw new UnprocessableEntityException({ message: "At least one reward code is required", error: "REDEMPTION_INPUT_REQUIRED" });
		}

		let outcome: { readonly sale: RewardSaleWithRedemptions; readonly result: CheckoutSideEffects };
		try {
			outcome = await this.saleRepository.checkoutInTransaction(
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
					lines: resolved.map(({ code, lookup }) => ({
						claimId: lookup.claim.id,
						rewardId: lookup.reward.id,
						redemptionMethod: code.backupCode !== undefined ? "MANUAL" : "SCAN",
					})),
				},
				async (tx: Prisma.TransactionClient, created: RewardSaleWithRedemptions): Promise<CheckoutSideEffects> => {
					await this.enqueueCheckoutEvent(tx, created);
					const credited = await this.creditReferrers(tx, resolved, paidAt);
					const stampedSignupReferralId = await this.signupReferralCheckout.markSuccessfulInTransaction(tx, created.userId, paidAt);
					return { credited, stampedSignupReferralId };
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

		await this.notifyCreditedReferrers(outcome.result.credited);
		await this.signupReferralCheckout.deliverAfterCheckout(outcome.result.stampedSignupReferralId);
		return toCheckoutResponse(outcome.sale);
	}

	/**
	 * Resolves every presented code to one of `pos.organizationId`'s claims.
	 * Unknown backup codes — including other merchants' codes, which are
	 * indistinguishable — are counted against the API key (brute-force lockout)
	 * BEFORE the request fails, all of them, so a multi-code checkout is
	 * counted as that many guesses. Returns only the codes that resolved.
	 */
	private async resolveCodes(pos: MerchantPosContext, codes: readonly RedemptionCode[], now: number): Promise<ResolvedCode[]> {
		await this.codeLockout.assertNotLocked(pos, now);

		const lookups = await Promise.all(codes.map(async (code: RedemptionCode) => ({ code, lookup: await this.claimService.findMerchantClaim(code, pos.organizationId) })));
		const resolved = lookups.flatMap(({ code, lookup }) => (lookup === null ? [] : [{ code, lookup }]));
		const unknownBackupCodes = lookups.filter(({ code, lookup }) => lookup === null && code.backupCode !== undefined).length;

		const lockedUntil = await this.codeLockout.recordUnknownBackupCodes(pos, unknownBackupCodes, now);
		if (lockedUntil !== null) {
			throw posCodeLockedException(lockedUntil);
		}
		return resolved;
	}

	private assertCheckoutEligible(pos: MerchantPosContext, input: RedemptionCheckoutInput, resolved: readonly ResolvedCode[], now: number): void {
		const claimIds = new Set<string>();
		const customers = new Set<string>();

		for (const { lookup } of resolved) {
			const { claim, reward } = lookup;

			if (claimIds.has(claim.id)) {
				throw new UnprocessableEntityException({ message: "The same reward was presented twice", error: "DUPLICATE_REWARD_CODE", claimId: claim.id });
			}
			claimIds.add(claim.id);
			customers.add(claim.userId);

			const reason = redemptionInvalidReason({ lookup, locationId: pos.locationId, now });
			if (reason !== null) {
				throw invalidReasonException(reason, claim.id);
			}

			// Each reward's minimum is checked against the WHOLE bill on its own; minimums do not add up across rewards on one bill.
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
				billTotalMinor: minorUnitsToNumber(sale.billTotalMinor),
				currency: sale.currency,
				claimIds: sale.redemptions.map((redemption) => redemption.claimId),
			},
		});
		await this.outbox.enqueueInTransaction(tx, { type: "reward.platform", payload });
	}

	/** Inside the checkout transaction: credit the referrer of every redeemed claim that was referred (see `RewardReferralRepository.creditReferrerForRedemption`). */
	private async creditReferrers(tx: Prisma.TransactionClient, resolved: readonly ResolvedCode[], now: number): Promise<readonly CreditedReferral[]> {
		const credited: CreditedReferral[] = [];
		for (const { lookup } of resolved) {
			const referral = await this.rewardReferralRepository.creditReferrerForRedemption(tx, {
				rewardId: lookup.reward.id,
				refereeUserId: lookup.claim.userId,
				now,
				redemptionTokenHash: this.codeHasher.hash(generateOpaqueToken()),
				backupCodeHash: this.codeHasher.hash(generateBackupCode()),
				claimTtlMs: REFERRER_CLAIM_TTL_MS,
				claimTtlDays: REFERRER_CLAIM_TTL_DAYS,
			});
			if (referral !== null) {
				credited.push(referral);
			}
		}
		return credited;
	}

	/**
	 * After the commit: try to deliver each credited referrer's email now. The
	 * sale is final either way — a failed delivery stays pending on the
	 * referral row and the `rewards.referral-credit-notify` job retries it, so
	 * it is logged here, not surfaced as an error for a bill that was recorded.
	 */
	private async notifyCreditedReferrers(credited: readonly CreditedReferral[]): Promise<void> {
		for (const referral of credited) {
			try {
				await this.referralNotifications.deliver(referral.referralId);
			} catch (error) {
				this.logger.error({
					event: "rewards.referral_credit_email_deferred",
					referralId: referral.referralId,
					error: error instanceof Error ? error.message : String(error),
				});
			}
		}
	}
}

const INVALID_REASON_ERRORS: Readonly<Record<RedemptionInvalidReason, { readonly message: string; readonly error: string; readonly status: "conflict" | "unprocessable" }>> = {
	ALREADY_REDEEMED: { message: "Already redeemed", error: "ALREADY_REDEEMED", status: "conflict" },
	EXPIRED: { message: "Claim expired", error: "CLAIM_EXPIRED", status: "unprocessable" },
	NOT_VALID_AT_STORE: { message: "This reward is not valid at this store", error: "REWARD_NOT_VALID_AT_STORE", status: "unprocessable" },
	STORE_REQUIRED: {
		message: "This reward is only valid at selected stores; register this terminal to its store before redeeming it",
		error: "STORE_REQUIRED",
		status: "unprocessable",
	},
};

function invalidReasonException(reason: RedemptionInvalidReason, claimId: string): ConflictException | UnprocessableEntityException {
	const { message, error, status } = INVALID_REASON_ERRORS[reason];
	const body = { message, error, claimId };
	return status === "conflict" ? new ConflictException(body) : new UnprocessableEntityException(body);
}

function toCheckoutResponse(sale: RewardSaleWithRedemptions): RedemptionCheckoutResponse {
	return {
		saleId: sale.id,
		billTotalMinor: minorUnitsToNumber(sale.billTotalMinor),
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
