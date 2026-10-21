import { epochMs, type RedemptionCheckoutInput } from "@workspace/shared";
import { beforeEach, describe, expect, it } from "vitest";

import { FixedClock } from "../../../../platform/application/__tests__/fixed-clock";
import { AppError, ConflictError } from "../../../../platform/application/errors/app-error";
import type { CheckoutPoint } from "../../domain/aggregates/reward-sale.aggregate";
import { MinSpendNotMetError, PosCodeLockedError, RedemptionCodeNotFoundError } from "../../domain/errors/pos.errors";
import { POS_CODE_LOCKOUT_MS, POS_CODE_MAX_FAILURES } from "../../domain/policies/code-lockout.policy";
import { CheckoutSaleCommand } from "../commands/checkout-sale/checkout-sale.command";
import { CheckoutSaleHandler, SaleRedemptionUnresolvedError } from "../commands/checkout-sale/checkout-sale.handler";
import { ValidateRedemptionCodesCommand } from "../commands/validate-redemption-codes/validate-redemption-codes.command";
import { ValidateRedemptionCodesHandler } from "../commands/validate-redemption-codes/validate-redemption-codes.handler";
import type { StoredSale } from "../../domain/repositories/pos.repositories";
import { RedemptionCodeResolver } from "../services/redemption-code-resolver";
import { apiKeyActor, CUSTOMER, FIXTURE_CLAIM_TTL_MS, InMemoryPosStore, JoinedFingerprint, NOW, TENANT_ID, SequentialIds, STORE_A, STORE_B } from "./fakes/pos.fakes";

const POINT: CheckoutPoint = { tenantId: TENANT_ID, locationId: STORE_A, terminalId: "TERM-AAAA2222", apiKeyId: "key-1" };

function bill(codes: RedemptionCheckoutInput["codes"], patch: Partial<RedemptionCheckoutInput> = {}): RedemptionCheckoutInput {
	return { billTotalMinor: 5_000, currency: "MYR", idempotencyKey: "idem-1", codes, ...patch };
}

describe("ValidateRedemptionCodesHandler", () => {
	let store: InMemoryPosStore;
	let handler: ValidateRedemptionCodesHandler;

	beforeEach(() => {
		store = new InMemoryPosStore();
		handler = new ValidateRedemptionCodesHandler(store.uow, new RedemptionCodeResolver(), new FixedClock(NOW));
	});

	it("previews a redeemable code and audits the scan under the key's own principal", async () => {
		const { token } = store.claims.seed("claim-01", { reward: { minSpendMinor: 2_000 } });

		await expect(handler.execute(new ValidateRedemptionCodesCommand(apiKeyActor(), POINT, { token }))).resolves.toEqual({
			claimId: "claim-01",
			rewardTitle: "Free latte",
			rewardType: "FREE_ITEM",
			claimExpiresAt: NOW + FIXTURE_CLAIM_TTL_MS,
			valid: true,
			invalidReason: null,
			minSpendMinor: 2_000,
		});
		expect(store.audit.entries).toEqual([
			{
				tenantId: TENANT_ID,
				actorUserId: null,
				action: "merchant.scan_qr",
				metadata: { claimId: "claim-01", terminalId: POINT.terminalId, apiKeyId: "key-1", locationId: STORE_A },
			},
		]);
		expect(store.uow.committed).toEqual([{ operation: null, actor: apiKeyActor() }]);
	});

	it("says why a found code cannot be redeemed here, without failing", async () => {
		const { backupCode } = store.claims.seed("claim-01", { reward: { locationScopeType: "SELECTED", locationIds: [STORE_B] } });

		await expect(handler.execute(new ValidateRedemptionCodesCommand(apiKeyActor(), POINT, { backupCode }))).resolves.toMatchObject({
			valid: false,
			invalidReason: "NOT_VALID_AT_STORE",
		});
	});

	it("says a customer the merchant banned cannot redeem, without failing the scan", async () => {
		const { token } = store.claims.seed("claim-01");
		store.customerStanding.ban(TENANT_ID, CUSTOMER);

		await expect(handler.execute(new ValidateRedemptionCodesCommand(apiKeyActor(), POINT, { token }))).resolves.toMatchObject({
			valid: false,
			invalidReason: "CUSTOMER_BANNED",
		});
	});

	it("answers an unknown code (and another merchant's) as not valid for this merchant, counting an unknown backup code", async () => {
		store.claims.seed("claim-01", { reward: { tenantId: "another-org" } });

		await expect(handler.execute(new ValidateRedemptionCodesCommand(apiKeyActor(), POINT, { backupCode: "BACKUP01" }))).rejects.toBeInstanceOf(RedemptionCodeNotFoundError);
		await expect(handler.execute(new ValidateRedemptionCodesCommand(apiKeyActor(), POINT, { token: "nope" }))).rejects.toBeInstanceOf(RedemptionCodeNotFoundError);

		expect(store.lockout.failures.get("key-1")).toBe(1);
		expect(store.audit.actions()).toEqual(["pos.backup_code_rejected"]);
	});

	it("previews a claim expiring exactly now as valid, and one a millisecond past as EXPIRED", async () => {
		const due = store.claims.seed("claim-01", { claimExpiresAt: NOW });

		await expect(handler.execute(new ValidateRedemptionCodesCommand(apiKeyActor(), POINT, { token: due.token }))).resolves.toMatchObject({ valid: true, invalidReason: null });
		const past = new ValidateRedemptionCodesHandler(store.uow, new RedemptionCodeResolver(), new FixedClock(epochMs(NOW + 1)));
		await expect(past.execute(new ValidateRedemptionCodesCommand(apiKeyActor(), POINT, { token: due.token }))).resolves.toMatchObject({
			valid: false,
			invalidReason: "EXPIRED",
		});
	});

	it("locks the key when an unknown backup code fills its window, committing the lock before answering 429", async () => {
		store.lockout.failures.set("key-1", POS_CODE_MAX_FAILURES - 1);

		await expect(handler.execute(new ValidateRedemptionCodesCommand(apiKeyActor(), POINT, { backupCode: "UNKNWN22" }))).rejects.toMatchObject({
			lockedUntil: NOW + POS_CODE_LOCKOUT_MS,
		});
		expect(store.lockout.locks.get("key-1")).toBe(NOW + POS_CODE_LOCKOUT_MS);
		expect(store.audit.actions()).toEqual(["pos.backup_code_rejected", "pos.api_key_code_locked"]);
		expect(store.uow.committed).toHaveLength(1);
	});

	it("refuses a locked key before looking at the code", async () => {
		store.lockout.locks.set("key-1", epochMs(NOW + 1));
		const { token } = store.claims.seed("claim-01");

		await expect(handler.execute(new ValidateRedemptionCodesCommand(apiKeyActor(), POINT, { token }))).rejects.toBeInstanceOf(PosCodeLockedError);
		expect(store.audit.entries).toEqual([]);
	});
});

describe("CheckoutSaleHandler", () => {
	let store: InMemoryPosStore;
	let handler: CheckoutSaleHandler;

	beforeEach(() => {
		store = new InMemoryPosStore();
		handler = new CheckoutSaleHandler(store.uow, new RedemptionCodeResolver(), new SequentialIds("sale"), new JoinedFingerprint(), new FixedClock(NOW));
	});

	it("records the bill and redeems every code in one unit of work, crediting referrals and stamping the signup referral", async () => {
		const first = store.claims.seed("claim-01");
		const second = store.claims.seed("claim-02", { rewardId: "reward-2" });
		store.rewards.titles.set("reward-2", "Free cake");

		const sale = await handler.execute(new CheckoutSaleCommand(apiKeyActor(), POINT, bill([{ token: first.token }, { backupCode: second.backupCode }])));

		expect(sale).toEqual({
			saleId: "sale-1",
			billTotalMinor: 5_000,
			currency: "MYR",
			paidAt: NOW,
			idempotencyKey: "idem-1",
			redemptions: [
				{ redemptionId: "redemption-1", claimId: "claim-01", rewardId: "reward-1", rewardTitle: "Free latte" },
				{ redemptionId: "redemption-2", claimId: "claim-02", rewardId: "reward-2", rewardTitle: "Free cake" },
			],
		});
		expect([...store.claims.claims.values()].map((lookup) => lookup.claim.status)).toEqual(["REDEEMED", "REDEEMED"]);
		expect(store.rewards.redemptions).toEqual(["reward-1", "reward-2"]);
		expect(store.audit.entries).toEqual([
			{
				tenantId: TENANT_ID,
				actorUserId: null,
				action: "merchant.checkout",
				metadata: {
					saleId: "sale-1",
					claimIds: ["claim-01", "claim-02"],
					terminalId: POINT.terminalId,
					apiKeyId: "key-1",
					locationId: STORE_A,
					billTotalMinor: 5_000,
					currency: "MYR",
				},
			},
		]);
		expect(store.referrals.credited).toEqual([
			{ rewardId: "reward-1", refereeUserId: CUSTOMER },
			{ rewardId: "reward-2", refereeUserId: CUSTOMER },
		]);
		expect(store.referrals.stamped).toEqual([CUSTOMER]);
		expect(store.eventNames()).toEqual(["pos.SaleCheckedOut"]);
	});

	it("records each reward's redemption in reward-id order (overlapping checkouts lock rewards in one order)", async () => {
		const later = store.claims.seed("claim-01", { rewardId: "reward-z" });
		const earlier = store.claims.seed("claim-02", { rewardId: "reward-a" });
		store.rewards.titles.set("reward-z", "Z").set("reward-a", "A");

		await handler.execute(new CheckoutSaleCommand(apiKeyActor(), POINT, bill([{ token: later.token }, { token: earlier.token }])));

		expect(store.rewards.redemptions).toEqual(["reward-a", "reward-z"]);
	});

	it("replays a retried key for the identical bill without redeeming twice", async () => {
		const { token } = store.claims.seed("claim-01");
		const first = await handler.execute(new CheckoutSaleCommand(apiKeyActor(), POINT, bill([{ token }])));

		await expect(handler.execute(new CheckoutSaleCommand(apiKeyActor(), POINT, bill([{ token }])))).resolves.toEqual(first);
		expect(store.rewards.redemptions).toEqual(["reward-1"]);
	});

	it("refuses a reused key with a different bill as IDEMPOTENCY_KEY_REUSED (409)", async () => {
		const { token } = store.claims.seed("claim-01");
		await handler.execute(new CheckoutSaleCommand(apiKeyActor(), POINT, bill([{ token }])));

		await expect(handler.execute(new CheckoutSaleCommand(apiKeyActor(), POINT, bill([{ token }], { billTotalMinor: 9_999 })))).rejects.toMatchObject({
			code: "IDEMPOTENCY_KEY_REUSED",
			httpStatus: 409,
			details: { saleId: "sale-1" },
		});
	});

	it("re-codes a refused claim with its legacy reason code and status", async () => {
		const { token } = store.claims.seed("claim-01", { status: "REDEEMED" });
		const expired = store.claims.seed("claim-02", { reward: { locationScopeType: "SELECTED", locationIds: [STORE_B] } });

		await expect(handler.execute(new CheckoutSaleCommand(apiKeyActor(), POINT, bill([{ token }])))).rejects.toMatchObject({
			code: "ALREADY_REDEEMED",
			httpStatus: 409,
			details: { claimId: "claim-01" },
		});
		await expect(handler.execute(new CheckoutSaleCommand(apiKeyActor(), POINT, bill([{ token: expired.token }], { idempotencyKey: "idem-2" })))).rejects.toMatchObject({
			code: "REWARD_NOT_VALID_AT_STORE",
			httpStatus: 422,
		});
		await expect(
			handler.execute(new CheckoutSaleCommand(apiKeyActor(), { ...POINT, locationId: null }, bill([{ token: expired.token }], { idempotencyKey: "idem-3" }))),
		).rejects.toMatchObject({ code: "STORE_REQUIRED", httpStatus: 422 });
	});

	it("refuses a banned customer's codes at checkout (403 CUSTOMER_BANNED), redeeming nothing", async () => {
		const { token } = store.claims.seed("claim-01");
		store.customerStanding.ban(TENANT_ID, CUSTOMER);

		await expect(handler.execute(new CheckoutSaleCommand(apiKeyActor(), POINT, bill([{ token }])))).rejects.toMatchObject({
			code: "CUSTOMER_BANNED",
			httpStatus: 403,
			details: { claimId: "claim-01" },
		});
		expect(store.sales.rows.size).toBe(0);
	});

	it("is all-or-nothing: a refused minimum leaves every claim, counter and audit untouched", async () => {
		const ok = store.claims.seed("claim-01");
		const pricey = store.claims.seed("claim-02", { reward: { minSpendMinor: 9_000 } });

		await expect(handler.execute(new CheckoutSaleCommand(apiKeyActor(), POINT, bill([{ token: ok.token }, { token: pricey.token }])))).rejects.toBeInstanceOf(
			MinSpendNotMetError,
		);

		expect([...store.claims.claims.values()].map((lookup) => lookup.claim.status)).toEqual(["PENDING", "PENDING"]);
		expect(store.rewards.redemptions).toEqual([]);
		expect(store.audit.entries).toEqual([]);
		expect(store.sales.rows.size).toBe(0);
	});

	it("counts every unknown backup code of a checkout in its own commit, then fails", async () => {
		const { token } = store.claims.seed("claim-01");

		await expect(
			handler.execute(new CheckoutSaleCommand(apiKeyActor(), POINT, bill([{ token }, { backupCode: "UNKNWN22" }, { backupCode: "UNKNWN33" }]))),
		).rejects.toBeInstanceOf(RedemptionCodeNotFoundError);

		expect(store.lockout.failures.get("key-1")).toBe(2);
		expect(store.audit.entries).toEqual([
			{
				tenantId: TENANT_ID,
				actorUserId: null,
				action: "pos.backup_code_rejected",
				metadata: { apiKeyId: "key-1", terminalId: POINT.terminalId, locationId: STORE_A, unknownBackupCodes: 2, failuresInWindow: 2 },
			},
		]);
		expect(store.claims.claims.get("claim-01")?.claim.status).toBe("PENDING");
	});

	it("locks the key once the window reaches the limit, audits the lock and answers 429 until it runs out", async () => {
		const guesses = Array.from({ length: POS_CODE_MAX_FAILURES }, (_unused, index) => ({ backupCode: `GUESS${String(index).padStart(3, "2")}` }));

		await expect(handler.execute(new CheckoutSaleCommand(apiKeyActor(), POINT, bill(guesses)))).rejects.toMatchObject({ lockedUntil: NOW + POS_CODE_LOCKOUT_MS });

		expect(store.lockout.locks.get("key-1")).toBe(NOW + POS_CODE_LOCKOUT_MS);
		expect(store.audit.actions()).toEqual(["pos.backup_code_rejected", "pos.api_key_code_locked"]);
		const { token } = store.claims.seed("claim-01");
		await expect(handler.execute(new CheckoutSaleCommand(apiKeyActor(), POINT, bill([{ token }], { idempotencyKey: "idem-2" })))).rejects.toBeInstanceOf(PosCodeLockedError);
	});

	it("replays the winner when a concurrent checkout with the same key inserted first", async () => {
		const { token } = store.claims.seed("claim-01");
		const winner: StoredSale = {
			id: "sale-0",
			billTotalMinor: 5_000,
			currency: "MYR",
			paidAt: NOW,
			idempotencyKey: "idem-1",
			requestHash: new JoinedFingerprint().of(bill([{ token }])),
			lines: [{ redemptionId: "redemption-0", claimId: "claim-01", method: "SCAN" }],
		};
		store.sales.concurrentWinner = winner;

		await expect(handler.execute(new CheckoutSaleCommand(apiKeyActor(), POINT, bill([{ token }])))).resolves.toMatchObject({
			saleId: "sale-0",
			redemptions: [{ redemptionId: "redemption-0" }],
		});
		expect(store.rewards.redemptions).toEqual([]);
	});

	it("answers ALREADY_REDEEMED when a concurrent checkout with another key redeemed the claim first", async () => {
		const { token } = store.claims.seed("claim-01");
		store.claims.takenConcurrently.add("claim-01");

		const attempt = handler.execute(new CheckoutSaleCommand(apiKeyActor(), POINT, bill([{ token }])));

		await expect(attempt).rejects.toBeInstanceOf(AppError);
		await expect(handler.execute(new CheckoutSaleCommand(apiKeyActor(), POINT, bill([{ token }])))).rejects.toMatchObject({
			code: "ALREADY_REDEEMED",
			details: { claimId: "claim-01" },
		});
		expect(store.sales.rows.size).toBe(0);
	});

	it("answers 409 IDEMPOTENCY_KEY_REUSED without a sale id when the winner under the key is a sale this till cannot read", async () => {
		const { token } = store.claims.seed("claim-01");
		const hidden: StoredSale = {
			id: "sale-store-b",
			billTotalMinor: 5_000,
			currency: "MYR",
			paidAt: NOW,
			idempotencyKey: "idem-1",
			requestHash: "another-bill",
			lines: [],
		};
		store.sales.concurrentWinner = hidden;
		store.sales.hiddenFromReplay.add("sale-store-b");

		const refused = handler.execute(new CheckoutSaleCommand(apiKeyActor(), POINT, bill([{ token }])));

		await expect(refused).rejects.toBeInstanceOf(AppError);
		await expect(refused).rejects.toMatchObject({ code: "IDEMPOTENCY_KEY_REUSED", httpStatus: 409, details: undefined });
		expect(store.claims.claims.get("claim-01")?.claim.status).toBe("PENDING");
		expect(store.rewards.redemptions).toEqual([]);
	});

	it("answers a lost race whose winner carries another bill as IDEMPOTENCY_KEY_REUSED naming the winner", async () => {
		const { token } = store.claims.seed("claim-01");
		store.sales.concurrentWinner = {
			id: "sale-0",
			billTotalMinor: 1,
			currency: "MYR",
			paidAt: NOW,
			idempotencyKey: "idem-1",
			requestHash: "another-bill",
			lines: [],
		};

		await expect(handler.execute(new CheckoutSaleCommand(apiKeyActor(), POINT, bill([{ token }])))).rejects.toMatchObject({
			code: "IDEMPOTENCY_KEY_REUSED",
			httpStatus: 409,
			details: { saleId: "sale-0" },
		});
	});

	it("locks every reward of the sale in one call before recording any redemption", async () => {
		const later = store.claims.seed("claim-01", { rewardId: "reward-z" });
		const earlier = store.claims.seed("claim-02", { rewardId: "reward-a" });
		store.rewards.titles.set("reward-z", "Z").set("reward-a", "A");

		await handler.execute(new CheckoutSaleCommand(apiKeyActor(), POINT, bill([{ token: later.token }, { token: earlier.token }])));

		expect(store.rewards.checkoutLocks).toEqual([["reward-z", "reward-a"]]);
	});

	it("rolls back the redeemed claims when a later write of the checkout fails", async () => {
		const first = store.claims.seed("claim-01");
		const second = store.claims.seed("claim-02", { rewardId: "reward-2" });
		store.rewards.titles.set("reward-2", "Free cake");
		store.rewards.failRedemption = { rewardId: "reward-2", error: new Error("database went away") };

		await expect(handler.execute(new CheckoutSaleCommand(apiKeyActor(), POINT, bill([{ token: first.token }, { token: second.token }])))).rejects.toThrow(
			"database went away",
		);

		expect([...store.claims.claims.values()].map((lookup) => lookup.claim.status)).toEqual(["PENDING", "PENDING"]);
		expect(store.rewards.redemptions).toEqual([]);
		expect(store.rewards.reserved.get("reward-1")).toBe(1);
		expect(store.sales.rows.size).toBe(0);
		expect(store.audit.entries).toEqual([]);
		expect(store.referrals.credited).toEqual([]);
		expect(store.eventNames()).toEqual([]);
		expect(store.uow.rolledBack).toEqual([{ operation: null, actor: apiKeyActor() }]);
	});

	it("propagates a lost compare-and-set on a reward (409) after rolling everything back", async () => {
		const { token } = store.claims.seed("claim-01");
		store.rewards.failRedemption = { rewardId: "reward-1", error: new ConflictError({ message: "The reward was changed by another request." }) };

		await expect(handler.execute(new CheckoutSaleCommand(apiKeyActor(), POINT, bill([{ token }])))).rejects.toBeInstanceOf(ConflictError);
		expect(store.claims.claims.get("claim-01")?.claim.status).toBe("PENDING");
	});

	it("refuses a redemption whose reward has no reserved unit left, leaving the claim pending", async () => {
		const { token } = store.claims.seed("claim-01");
		store.rewards.reserved.set("reward-1", 0);

		await expect(handler.execute(new CheckoutSaleCommand(apiKeyActor(), POINT, bill([{ token }])))).rejects.toThrow("no reserved unit");
		expect(store.claims.claims.get("claim-01")?.claim.status).toBe("PENDING");
	});

	it("answers another tenant's code as not valid for this merchant, saving nothing", async () => {
		const { token } = store.claims.seed("claim-01", { reward: { tenantId: "another-org" } });

		await expect(handler.execute(new CheckoutSaleCommand(apiKeyActor(), POINT, bill([{ token }])))).rejects.toBeInstanceOf(RedemptionCodeNotFoundError);
		expect(store.sales.rows.size).toBe(0);
		expect(store.claims.claims.get("claim-01")?.claim.status).toBe("PENDING");
	});

	it("runs the replay lookup and the checkout as the till's own principal", async () => {
		const { token } = store.claims.seed("claim-01");

		await handler.execute(new CheckoutSaleCommand(apiKeyActor(), POINT, bill([{ token }])));

		expect(store.uow.committed).toEqual([
			{ operation: null, actor: apiKeyActor() },
			{ operation: null, actor: apiKeyActor() },
		]);
	});

	it("credits a PENDING referral and stamps the signup referral inside the sale's unit of work", async () => {
		const { token } = store.claims.seed("claim-01");
		store.referrals.pendingReferrals.set("reward-1", "referral-1");
		store.referrals.pendingSignupReferral = "signup-referral-1";

		await handler.execute(new CheckoutSaleCommand(apiKeyActor(), POINT, bill([{ token }])));

		expect(store.referrals.pendingReferrals.size).toBe(0);
		expect(store.referrals.pendingSignupReferral).toBeNull();
	});

	it("keeps a referral PENDING when the sale rolls back", async () => {
		const { token } = store.claims.seed("claim-01");
		store.referrals.pendingReferrals.set("reward-1", "referral-1");
		store.referrals.pendingSignupReferral = "signup-referral-1";
		store.rewards.titles.clear();

		await expect(handler.execute(new CheckoutSaleCommand(apiKeyActor(), POINT, bill([{ token }])))).rejects.toBeInstanceOf(SaleRedemptionUnresolvedError);

		expect(store.referrals.pendingReferrals.get("reward-1")).toBe("referral-1");
		expect(store.referrals.pendingSignupReferral).toBe("signup-referral-1");
		expect(store.sales.rows.size).toBe(0);
	});
});
