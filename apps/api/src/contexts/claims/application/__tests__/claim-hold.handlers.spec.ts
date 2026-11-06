import type { RequestClaimOtpResponse } from "@workspace/shared";
import { beforeEach, describe, expect, it } from "vitest";

import { systemActor } from "../../../../platform/application/actor-context";
import { ClaimHold } from "../../domain/aggregates/claim-hold.aggregate";
import { ClaimHoldLimitReachedError } from "../../domain/errors/claims.errors";
import { CLAIM_HOLD_TTL_MS, MAX_LIVE_CLAIM_HOLDS, MAX_REWARD_HOLDS_PER_WINDOW } from "../../domain/value-objects/claim-rules.value-object";
import { ClaimRewardCommand } from "../commands/claim-reward/claim-reward.command";
import { ClaimRewardHandler } from "../commands/claim-reward/claim-reward.handler";
import { ExpireOverdueClaimHoldsCommand } from "../commands/expire-overdue-claim-holds/expire-overdue-claim-holds.command";
import { ExpireOverdueClaimHoldsHandler } from "../commands/expire-overdue-claim-holds/expire-overdue-claim-holds.handler";
import { RequestClaimOtpCommand } from "../commands/request-claim-otp/request-claim-otp.command";
import { RequestClaimOtpHandler } from "../commands/request-claim-otp/request-claim-otp.handler";
import { FakeClaimCodes, InMemoryClaimsStore, NOW, SequentialIds, claimantProfile, customer } from "./fakes/claims.fakes";

const USER = "user-1";
const OTHER_USER = "user-2";
const REWARD = "reward-1";
const PHONE = "+60123000000";
const NEW_PHONE = "+60199999999";

let store: InMemoryClaimsStore;
const codes = new FakeClaimCodes();

beforeEach(() => {
	store = new InMemoryClaimsStore();
	store.legal.accepted.add(USER);
	store.legal.accepted.add(OTHER_USER);
	store.claimants.profiles.set(USER, claimantProfile({ phone: PHONE }));
	store.claimants.profiles.set(OTHER_USER, claimantProfile({ phone: PHONE }));
});

function requestOtp(userId: string = USER): Promise<RequestClaimOtpResponse> {
	return new RequestClaimOtpHandler(store.uow, codes, new SequentialIds(`hold-${String(store.holds.rows.size)}`), store.clock).execute(
		new RequestClaimOtpCommand(customer(userId), { rewardId: REWARD, phone: NEW_PHONE }),
	);
}

function claim(): ReturnType<ClaimRewardHandler["execute"]> {
	return new ClaimRewardHandler(store.uow, codes, new SequentialIds("claim"), store.clock).execute(new ClaimRewardCommand(customer(USER), { rewardId: REWARD, phone: PHONE }));
}

function expireHolds(): ReturnType<ExpireOverdueClaimHoldsHandler["execute"]> {
	return new ExpireOverdueClaimHoldsHandler(store.uow, store.clock).execute(
		new ExpireOverdueClaimHoldsCommand(systemActor("queue.claims.expire_holds", "job", null, "test", null)),
	);
}

function addHold(id: string, userId: string, rewardId: string): Promise<void> {
	return store.holds.add(ClaimHold.place(id, userId, rewardId, NOW));
}

describe("requesting a claim code", () => {
	it("holds one unit for as long as the code lasts, so the count drops for everyone", async () => {
		const before = store.inventory.remaining;
		const response = await requestOtp();

		expect(response).toEqual({ ok: true, holdExpiresAt: NOW + CLAIM_HOLD_TTL_MS });
		expect(store.inventory.remaining).toBe(before - 1);
		expect(store.inventory.reserved).toBe(1);
	});

	it("keeps the same hold when the code is asked for again, without extending it or taking a second unit", async () => {
		const first = await requestOtp();
		const second = await requestOtp();

		expect(second.holdExpiresAt).toBe(first.holdExpiresAt);
		expect(store.inventory.reserved).toBe(1);
		expect(store.holds.rows.size).toBe(1);
	});

	it("still sends a code for the last unit to the customer holding it", async () => {
		store.inventory.remaining = 1;
		await requestOtp();

		await expect(requestOtp()).resolves.toMatchObject({ ok: true });
		expect(store.inventory.remaining).toBe(0);
	});

	it("refuses the next customer once the last unit is held", async () => {
		store.inventory.remaining = 1;
		await requestOtp();

		await expect(requestOtp(OTHER_USER)).rejects.toThrow("REWARD_OUT_OF_STOCK");
	});

	it("caps the units one customer can hold at once", async () => {
		for (let index = 0; index < MAX_LIVE_CLAIM_HOLDS; index += 1) {
			await addHold(`hold-${String(index)}`, USER, `other-reward-${String(index)}`);
		}

		await expect(requestOtp()).rejects.toThrow(ClaimHoldLimitReachedError);
		expect(store.inventory.reserved).toBe(0);
	});

	it("caps repeat holds of one reward, so nobody keeps the last unit by re-requesting codes", async () => {
		for (let index = 0; index < MAX_REWARD_HOLDS_PER_WINDOW; index += 1) {
			const hold = ClaimHold.place(`spent-${String(index)}`, USER, REWARD, NOW);
			hold.expire(NOW);
			await store.holds.add(hold);
		}

		await expect(requestOtp()).rejects.toThrow(ClaimHoldLimitReachedError);
	});
});

describe("claiming with a hold", () => {
	it("turns the held unit into the claim without taking a second one", async () => {
		await requestOtp();
		const reservedAfterHold = store.inventory.reserved;

		await claim();

		expect(store.inventory.reserved).toBe(reservedAfterHold);
		expect(store.inventory.heldUnitsClaimed).toBe(1);
		expect([...store.holds.rows.values()].map((hold) => hold.status)).toEqual(["CONVERTED"]);
	});

	it("succeeds on the last unit, which the customer holds", async () => {
		store.inventory.remaining = 1;
		await requestOtp();

		await expect(claim()).resolves.toHaveProperty("backupCode");
		expect(store.inventory.remaining).toBe(0);
	});

	it("takes from stock when the expiry job settled the hold first", async () => {
		store.inventory.remaining = 2;
		await requestOtp();
		store.holds.loseNextSave = true;

		await claim();

		expect(store.inventory.heldUnitsClaimed).toBe(0);
		expect(store.inventory.reserved).toBe(2);
	});
});

describe("the hold expiry job", () => {
	it("gives an overdue hold's unit back, once", async () => {
		store.inventory.remaining = 1;
		await requestOtp();
		store.clock.advance(CLAIM_HOLD_TTL_MS + 1);

		await expect(expireHolds()).resolves.toEqual({ expired: 1, skipped: 0 });
		expect(store.inventory.remaining).toBe(1);
		expect(store.inventory.reserved).toBe(0);
		await expect(expireHolds()).resolves.toEqual({ expired: 0, skipped: 0 });
	});

	it("leaves a hold that is still running", async () => {
		await requestOtp();

		await expect(expireHolds()).resolves.toEqual({ expired: 0, skipped: 0 });
		expect(store.inventory.reserved).toBe(1);
	});

	it("skips a hold a claim settled in the meantime", async () => {
		await requestOtp();
		store.clock.advance(CLAIM_HOLD_TTL_MS + 1);
		store.holds.loseNextSave = true;

		await expect(expireHolds()).resolves.toEqual({ expired: 0, skipped: 1 });
		expect(store.inventory.reserved).toBe(1);
	});
});
