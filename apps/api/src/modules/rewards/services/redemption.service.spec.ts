import { ConflictException, HttpException, HttpStatus, NotFoundException, UnprocessableEntityException } from "@nestjs/common";
import { LIST_SLOT_INDEX } from "@workspace/shared";
import { Prisma } from "@prisma/client";
import { Test } from "@nestjs/testing";
import { beforeEach, describe, expect, it, vi } from "vitest";

import type { RedemptionCheckoutInput, RedemptionCode } from "@workspace/shared";

import { PlatformOutboxService } from "../../../infrastructure/outbox/platform-outbox.service";
import { PrismaService } from "../../../prisma/prisma.service";
import { createTestTypedConfig } from "../../../../test/support/test-api-env";
import { RewardAuditLogRepository } from "../repositories/reward-audit-log.repository";
import type { RewardClaimRedemptionLookup } from "../repositories/reward-claim.repository";
import { RewardReferralRepository } from "../repositories/reward-referral.repository";
import { CheckoutClaimConflictError, RewardSaleRepository, type RewardSaleWithRedemptions } from "../repositories/reward-sale.repository";
import type { MerchantPosContext } from "../types/merchant-pos-context";
import { checkoutRequestHash } from "../utils/redemption-eligibility.util";
import { ClaimService } from "./claim.service";
import { PosCodeLockoutService, posCodeLockedException } from "./pos-code-lockout.service";
import { RewardCodeHasher } from "../crypto/reward-code-hasher";
import { ReferralCreditNotificationService } from "./referral-credit-notification.service";
import { SignupReferralCheckoutService } from "../../auth/signup-referrals/signup-referral-checkout.service";
import { RedemptionService } from "./redemption.service";

vi.mock("../../../prisma/prisma.service", () => ({ PrismaService: class {} }));

/** Stand-in transaction client handed to the checkout's in-transaction callback. */
const TX = new PrismaService(createTestTypedConfig());

const NOW = 1_790_000_000_000;
const HOUR_MS = 3_600_000;
const ORG = "0b6a3c55-2f1d-4e8a-a7b9-5c4d3e2f1a10";
const CUSTOMER = "1c8d3b6f-7a2e-4d3f-8e4b-2a3f4e5d6c7b";
const CLAIM_A = "3e0f5d8b-9c4a-4f6b-8a6d-4c5b6a7f8e9d";
const CLAIM_B = "4f1a6e9c-0d5b-4a7c-9b7e-5d6c7b8a9f0e";
const SALE_ID = "2d9e4c7a-8b3f-4e5a-9f5c-3b4a5f6e7d8c";
const STORE_A = "4d9a3f5e-2f6b-4c55-8f0c-9a4b1c2d3e4f";
const STORE_B = "5e0b4a6f-3a7c-4d66-9a1d-0b5c2d3e4f50";
const IDEMPOTENCY_KEY = "0b7c2a5e-6f1d-4c2e-9d3a-1f2e3d4c5b6a";
const BILL_MINOR = 2500;
const TOKEN_A = "token-a".padEnd(32, "x");
const TOKEN_B = "token-b".padEnd(32, "x");
const UNKNOWN_BACKUP = "ZZZZ2345";
const OTHER_UNKNOWN_BACKUP = "YYYY2345";

const POS: MerchantPosContext = { organizationId: ORG, terminalId: "KL-REGISTER-01", apiKeyId: "key-1", locationId: STORE_A };

function lookup(
	claimId: string,
	overrides: { readonly claim?: Partial<RewardClaimRedemptionLookup["claim"]>; readonly reward?: Partial<RewardClaimRedemptionLookup["reward"]> } = {},
): RewardClaimRedemptionLookup {
	return {
		claim: {
			id: claimId,
			userId: CUSTOMER,
			rewardId: `reward-of-${claimId}`,
			status: "PENDING",
			claimExpiresAt: BigInt(NOW + HOUR_MS),
			redemptionTokenHash: "hash",
			...overrides.claim,
		},
		reward: {
			id: `reward-of-${claimId}`,
			organizationId: ORG,
			title: `Reward ${claimId}`,
			rewardType: "FREE_ITEM",
			expiryDate: BigInt(NOW + HOUR_MS),
			locationScopeType: "ALL_LOCATIONS",
			locationIds: [],
			minSpendMinor: null,
			...overrides.reward,
		},
	};
}

function sale(input: { readonly requestHash: string; readonly claimIds: readonly string[] }): RewardSaleWithRedemptions {
	return {
		id: SALE_ID,
		organizationId: ORG,
		locationId: STORE_A,
		userId: CUSTOMER,
		terminalId: POS.terminalId,
		apiKeyId: POS.apiKeyId,
		billTotalMinor: BigInt(BILL_MINOR),
		currency: "MYR",
		idempotencyKey: IDEMPOTENCY_KEY,
		requestHash: input.requestHash,
		paidAt: BigInt(NOW),
		isDeleted: false,
		deletedAt: null,
		deletedBy: null,
		createdAt: BigInt(NOW),
		updatedAt: BigInt(NOW),
		redemptions: input.claimIds.map((claimId) => ({
			id: `redemption-${claimId}`,
			claimId,
			organizationId: ORG,
			locationId: STORE_A,
			userId: CUSTOMER,
			terminalId: POS.terminalId,
			redemptionMethod: "SCAN",
			saleId: SALE_ID,
			redeemedAt: BigInt(NOW),
			isDeleted: false,
			deletedAt: null,
			createdAt: BigInt(NOW),
			updatedAt: BigInt(NOW),
			claim: { rewardId: `reward-of-${claimId}`, reward: { title: `Reward ${claimId}` } },
		})),
	};
}

function checkoutInput(codes: RedemptionCode[], billTotalMinor: number = BILL_MINOR): RedemptionCheckoutInput {
	return { idempotencyKey: IDEMPOTENCY_KEY, billTotalMinor, currency: "MYR", codes };
}

/** A Prisma P2002 on the sale's idempotency-key index, as the Postgres driver adapter reports it. */
function duplicateSaleKeyError(): Prisma.PrismaClientKnownRequestError {
	return new Prisma.PrismaClientKnownRequestError("Unique constraint failed", {
		code: "P2002",
		clientVersion: "test",
		meta: { driverAdapterError: { cause: { constraint: { index: "reward_sales_organization_id_idempotency_key_key" } } } },
	});
}

describe("RedemptionService", () => {
	let service: RedemptionService;
	const claims = { findMerchantClaim: vi.fn<ClaimService["findMerchantClaim"]>() };
	const sales = {
		findByIdempotencyKey: vi.fn<RewardSaleRepository["findByIdempotencyKey"]>(),
		checkoutInTransaction: vi.fn<RewardSaleRepository["checkoutInTransaction"]>(),
	};
	const referrals = { creditReferrerForRedemption: vi.fn<RewardReferralRepository["creditReferrerForRedemption"]>() };
	const audit = { create: vi.fn<RewardAuditLogRepository["create"]>() };
	const outbox = { enqueueInTransaction: vi.fn<PlatformOutboxService["enqueueInTransaction"]>() };
	const lockout = {
		assertNotLocked: vi.fn<PosCodeLockoutService["assertNotLocked"]>(),
		recordUnknownBackupCodes: vi.fn<PosCodeLockoutService["recordUnknownBackupCodes"]>(),
	};
	const notifications = { deliver: vi.fn<ReferralCreditNotificationService["deliver"]>() };
	const signupReferralCheckout = {
		markSuccessfulInTransaction: vi.fn<SignupReferralCheckoutService["markSuccessfulInTransaction"]>(),
		deliverAfterCheckout: vi.fn<SignupReferralCheckoutService["deliverAfterCheckout"]>(),
	};
	/** Code → claim this merchant owns (anything else, incl. other merchants' codes, resolves to null). */
	let known: Map<string, RewardClaimRedemptionLookup>;

	beforeEach(async () => {
		vi.clearAllMocks();
		vi.spyOn(Date, "now").mockReturnValue(NOW);
		known = new Map();
		claims.findMerchantClaim.mockImplementation(async (code) => Promise.resolve(known.get(code.token ?? code.backupCode ?? "") ?? null));
		sales.findByIdempotencyKey.mockResolvedValue(null);
		audit.create.mockResolvedValue(undefined);
		outbox.enqueueInTransaction.mockResolvedValue("00000000-0000-4000-8000-000000000001");
		lockout.assertNotLocked.mockResolvedValue(undefined);
		lockout.recordUnknownBackupCodes.mockResolvedValue(null);
		referrals.creditReferrerForRedemption.mockResolvedValue(null);
		notifications.deliver.mockResolvedValue("delivered");
		signupReferralCheckout.markSuccessfulInTransaction.mockResolvedValue(null);
		signupReferralCheckout.deliverAfterCheckout.mockResolvedValue(undefined);

		const moduleRef = await Test.createTestingModule({
			providers: [
				RedemptionService,
				{ provide: RewardAuditLogRepository, useValue: audit },
				{ provide: RewardReferralRepository, useValue: referrals },
				{ provide: ClaimService, useValue: claims },
				{ provide: RewardSaleRepository, useValue: sales },
				{ provide: PlatformOutboxService, useValue: outbox },
				{ provide: PosCodeLockoutService, useValue: lockout },
				{ provide: ReferralCreditNotificationService, useValue: notifications },
				{ provide: SignupReferralCheckoutService, useValue: signupReferralCheckout },
				{ provide: RewardCodeHasher, useValue: new RewardCodeHasher({ 1: Buffer.alloc(32, 7).toString("base64") }) },
			],
		}).compile();
		service = moduleRef.get(RedemptionService);
	});

	/** Runs the real in-transaction callback against TX, as the repository would. */
	function commitCheckout(claimIds: readonly string[], requestHash: string): void {
		sales.checkoutInTransaction.mockImplementation(async (_input, withinTransaction) => {
			const created = sale({ requestHash, claimIds });
			return { sale: created, result: await withinTransaction(TX, created) };
		});
	}

	describe("validate", () => {
		it("previews a known code and audits the scan", async () => {
			known.set(TOKEN_A, lookup(CLAIM_A));

			const preview = await service.validate(POS, { token: TOKEN_A });

			expect(preview).toMatchObject({ claimId: CLAIM_A, valid: true, invalidReason: null });
			expect(audit.create).toHaveBeenCalledWith(expect.objectContaining({ organizationId: ORG, action: "merchant.scan_qr" }));
		});

		it("answers an unknown code — and another merchant's code, which the scoped lookup cannot see — with one uniform 404, counting the backup-code guess", async () => {
			const unknown = service.validate(POS, { backupCode: UNKNOWN_BACKUP });

			await expect(unknown).rejects.toBeInstanceOf(NotFoundException);
			await expect(service.validate(POS, { backupCode: UNKNOWN_BACKUP })).rejects.toMatchObject({ response: { error: "REDEMPTION_TOKEN_INVALID" } });
			expect(claims.findMerchantClaim).toHaveBeenCalledWith({ backupCode: UNKNOWN_BACKUP }, ORG);
			expect(lockout.recordUnknownBackupCodes).toHaveBeenCalledWith(POS, 1, NOW);
			expect(audit.create).not.toHaveBeenCalled();
		});

		it("does not count an unknown QR token as a backup-code guess", async () => {
			await expect(service.validate(POS, { token: TOKEN_A })).rejects.toBeInstanceOf(NotFoundException);
			expect(lockout.recordUnknownBackupCodes).toHaveBeenCalledWith(POS, 0, NOW);
		});

		it("refuses a locked key before looking anything up", async () => {
			lockout.assertNotLocked.mockRejectedValue(posCodeLockedException(NOW + HOUR_MS));

			await expect(service.validate(POS, { backupCode: UNKNOWN_BACKUP })).rejects.toMatchObject({ status: HttpStatus.TOO_MANY_REQUESTS });
			expect(claims.findMerchantClaim).not.toHaveBeenCalled();
		});

		it("reports STORE_REQUIRED for a store-limited reward when the till's store is unknown", async () => {
			known.set(TOKEN_A, lookup(CLAIM_A, { reward: { locationScopeType: "SELECTED", locationIds: [STORE_A] } }));

			const preview = await service.validate({ ...POS, locationId: null }, { token: TOKEN_A });

			expect(preview).toMatchObject({ valid: false, invalidReason: "STORE_REQUIRED" });
		});
	});

	describe("checkout", () => {
		it("stamps the customer's signup referral in the SAME transaction and delivers only that referral's notification after the commit", async () => {
			known.set(TOKEN_A, lookup(CLAIM_A));
			const input = checkoutInput([{ token: TOKEN_A }]);
			commitCheckout([CLAIM_A], checkoutRequestHash(input));
			signupReferralCheckout.markSuccessfulInTransaction.mockResolvedValue("signup-referral-1");

			await service.checkout(POS, input);

			expect(signupReferralCheckout.markSuccessfulInTransaction).toHaveBeenCalledWith(TX, CUSTOMER, NOW);
			expect(signupReferralCheckout.deliverAfterCheckout).toHaveBeenCalledWith("signup-referral-1");
		});

		it("hands null to the after-commit delivery when the checkout stamped no signup referral", async () => {
			known.set(TOKEN_A, lookup(CLAIM_A));
			const input = checkoutInput([{ token: TOKEN_A }]);
			commitCheckout([CLAIM_A], checkoutRequestHash(input));

			await service.checkout(POS, input);

			expect(signupReferralCheckout.deliverAfterCheckout).toHaveBeenCalledWith(null);
		});

		it("records the bill, enqueues the event and credits referrers in the SAME transaction, then delivers the referrer email", async () => {
			known.set(TOKEN_A, lookup(CLAIM_A));
			const input = checkoutInput([{ token: TOKEN_A }]);
			commitCheckout([CLAIM_A], checkoutRequestHash(input));
			referrals.creditReferrerForRedemption.mockResolvedValue({ referralId: "referral-1", referrerUserId: "referrer-1", referrerRewardId: "reward-r" });

			const response = await service.checkout(POS, input);

			expect(response).toMatchObject({ saleId: SALE_ID, billTotalMinor: BILL_MINOR, redemptions: [{ claimId: CLAIM_A, rewardTitle: `Reward ${CLAIM_A}` }] });
			expect(outbox.enqueueInTransaction).toHaveBeenCalledWith(TX, expect.objectContaining({ type: "reward.platform" }));
			expect(referrals.creditReferrerForRedemption).toHaveBeenCalledWith(TX, expect.objectContaining({ rewardId: `reward-of-${CLAIM_A}`, refereeUserId: CUSTOMER, now: NOW }));
			// The referrer's new claim codes are stored as keyed hashes, never plain SHA-256.
			const [, creditInput] = referrals.creditReferrerForRedemption.mock.calls[LIST_SLOT_INDEX.first] ?? [];
			expect(creditInput?.redemptionTokenHash).toMatch(/^v1:[0-9a-f]{64}$/u);
			expect(notifications.deliver).toHaveBeenCalledWith("referral-1");
			const [lineInput] = sales.checkoutInTransaction.mock.calls[LIST_SLOT_INDEX.first] ?? [];
			expect(lineInput?.lines).toEqual([{ claimId: CLAIM_A, rewardId: `reward-of-${CLAIM_A}`, redemptionMethod: "SCAN" }]);
		});

		it("keeps a recorded sale successful when the referrer email cannot be delivered right away (the job retries it)", async () => {
			known.set(TOKEN_A, lookup(CLAIM_A));
			const input = checkoutInput([{ token: TOKEN_A }]);
			commitCheckout([CLAIM_A], checkoutRequestHash(input));
			referrals.creditReferrerForRedemption.mockResolvedValue({ referralId: "referral-1", referrerUserId: "referrer-1", referrerRewardId: "reward-r" });
			notifications.deliver.mockRejectedValue(new Error("database unavailable"));

			await expect(service.checkout(POS, input)).resolves.toMatchObject({ saleId: SALE_ID });
		});

		it("counts EVERY unknown backup code of a multi-code checkout as a guess and writes nothing", async () => {
			known.set(TOKEN_A, lookup(CLAIM_A));

			await expect(service.checkout(POS, checkoutInput([{ token: TOKEN_A }, { backupCode: UNKNOWN_BACKUP }, { backupCode: OTHER_UNKNOWN_BACKUP }]))).rejects.toBeInstanceOf(
				NotFoundException,
			);
			expect(lockout.recordUnknownBackupCodes).toHaveBeenCalledWith(POS, 2, NOW);
			expect(sales.checkoutInTransaction).not.toHaveBeenCalled();
		});

		it("answers 429 when the guesses in this checkout lock the key", async () => {
			lockout.recordUnknownBackupCodes.mockResolvedValue(NOW + HOUR_MS);

			const failure = service.checkout(POS, checkoutInput([{ backupCode: UNKNOWN_BACKUP }]));

			await expect(failure).rejects.toBeInstanceOf(HttpException);
			await expect(service.checkout(POS, checkoutInput([{ backupCode: UNKNOWN_BACKUP }]))).rejects.toMatchObject({ response: { error: "POS_CODE_LOCKED" } });
		});

		it("replays an identical retry and rejects a reused key with a different bill", async () => {
			const input = checkoutInput([{ token: TOKEN_A }]);
			sales.findByIdempotencyKey.mockResolvedValue(sale({ requestHash: checkoutRequestHash(input), claimIds: [CLAIM_A] }));

			await expect(service.checkout(POS, input)).resolves.toMatchObject({ saleId: SALE_ID });
			await expect(service.checkout(POS, checkoutInput([{ token: TOKEN_A }], BILL_MINOR + 1))).rejects.toMatchObject({ response: { error: "IDEMPOTENCY_KEY_REUSED" } });
			expect(claims.findMerchantClaim).not.toHaveBeenCalled();
			// A replay neither stamps a signup referral again nor sends another notification.
			expect(signupReferralCheckout.markSuccessfulInTransaction).not.toHaveBeenCalled();
			expect(signupReferralCheckout.deliverAfterCheckout).not.toHaveBeenCalled();
		});

		it("replays the winner when a concurrent request with the same key committed first", async () => {
			known.set(TOKEN_A, lookup(CLAIM_A));
			const input = checkoutInput([{ token: TOKEN_A }]);
			sales.checkoutInTransaction.mockRejectedValue(duplicateSaleKeyError());
			sales.findByIdempotencyKey.mockResolvedValueOnce(null).mockResolvedValueOnce(sale({ requestHash: checkoutRequestHash(input), claimIds: [CLAIM_A] }));

			await expect(service.checkout(POS, input)).resolves.toMatchObject({ saleId: SALE_ID });
		});

		it("reports ALREADY_REDEEMED when a different checkout redeemed one of the claims first", async () => {
			known.set(TOKEN_A, lookup(CLAIM_A));
			sales.checkoutInTransaction.mockRejectedValue(new CheckoutClaimConflictError(CLAIM_A));

			await expect(service.checkout(POS, checkoutInput([{ token: TOKEN_A }]))).rejects.toMatchObject({ response: { error: "ALREADY_REDEEMED", claimId: CLAIM_A } });
		});

		it("rethrows a unique violation of any OTHER index instead of treating it as a duplicate key", async () => {
			known.set(TOKEN_A, lookup(CLAIM_A));
			const otherIndex = new Prisma.PrismaClientKnownRequestError("Unique constraint failed", {
				code: "P2002",
				clientVersion: "test",
				meta: { driverAdapterError: { cause: { constraint: { index: "reward_redemptions_claim_id_key" } } } },
			});
			sales.checkoutInTransaction.mockRejectedValue(otherIndex);

			await expect(service.checkout(POS, checkoutInput([{ token: TOKEN_A }]))).rejects.toBe(otherIndex);
			expect(sales.findByIdempotencyKey).toHaveBeenCalledTimes(1);
		});

		it.each([
			[
				"the same reward twice",
				(): RedemptionCode[] => [{ token: TOKEN_A }, { token: TOKEN_B }],
				(): void => {
					known.set(TOKEN_A, lookup(CLAIM_A));
					known.set(TOKEN_B, lookup(CLAIM_A));
				},
				"DUPLICATE_REWARD_CODE",
			],
			[
				"rewards of two customers",
				(): RedemptionCode[] => [{ token: TOKEN_A }, { token: TOKEN_B }],
				(): void => {
					known.set(TOKEN_A, lookup(CLAIM_A));
					known.set(TOKEN_B, lookup(CLAIM_B, { claim: { userId: "customer-2" } }));
				},
				"MULTIPLE_CUSTOMERS",
			],
			[
				"a bill below the minimum spend",
				(): RedemptionCode[] => [{ token: TOKEN_A }],
				(): void => {
					known.set(TOKEN_A, lookup(CLAIM_A, { reward: { minSpendMinor: BILL_MINOR + 1 } }));
				},
				"MIN_SPEND_NOT_MET",
			],
			[
				"a reward of another store",
				(): RedemptionCode[] => [{ token: TOKEN_A }],
				(): void => {
					known.set(TOKEN_A, lookup(CLAIM_A, { reward: { locationScopeType: "SELECTED", locationIds: [STORE_B] } }));
				},
				"REWARD_NOT_VALID_AT_STORE",
			],
		])("rejects %s before writing anything", async (_label, codes, arrange, error) => {
			arrange();

			await expect(service.checkout(POS, checkoutInput(codes()))).rejects.toBeInstanceOf(UnprocessableEntityException);
			await expect(service.checkout(POS, checkoutInput(codes()))).rejects.toMatchObject({ response: { error } });
			expect(sales.checkoutInTransaction).not.toHaveBeenCalled();
		});

		it("fails closed with STORE_REQUIRED for a store-limited reward when the store is unknown", async () => {
			known.set(TOKEN_A, lookup(CLAIM_A, { reward: { locationScopeType: "SELECTED", locationIds: [STORE_A] } }));

			await expect(service.checkout({ ...POS, locationId: null }, checkoutInput([{ token: TOKEN_A }]))).rejects.toMatchObject({ response: { error: "STORE_REQUIRED" } });
		});

		it("rejects an already redeemed claim with 409", async () => {
			known.set(TOKEN_A, lookup(CLAIM_A, { claim: { status: "REDEEMED" } }));

			await expect(service.checkout(POS, checkoutInput([{ token: TOKEN_A }]))).rejects.toBeInstanceOf(ConflictException);
		});
	});
});
