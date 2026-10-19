import { DAY_MS, epochMs } from "@workspace/shared";
import { beforeEach, describe, expect, it } from "vitest";

import { systemActor } from "../../../../platform/application/actor-context";
import { ReferrerCredited } from "../../../referrals/public-api";
import { RewardClaim } from "../../domain/aggregates/reward-claim.aggregate";
import { SweepReferrerCreditEmailsCommand } from "../commands/sweep-referrer-credit-emails/sweep-referrer-credit-emails.command";
import { SweepReferrerCreditEmailsHandler } from "../commands/sweep-referrer-credit-emails/sweep-referrer-credit-emails.handler";
import { RequestReferrerCreditEmailOnReferrerCredited } from "../event-handlers/after-commit/request-referrer-credit-email.event-handler";
import { IssueReferrerCreditClaimOnReferrerCredited } from "../event-handlers/in-transaction/issue-referrer-credit-claim.in-transaction-handler";
import {
	REFERRER_CREDIT_EMAIL_BATCH,
	REFERRER_CREDIT_EMAIL_MAX_PAGES,
	REFERRER_CREDIT_EMAIL_OPERATION,
	ReferrerCreditEmailApplicationService,
	ReferrerCreditEmailNotRequestedError,
} from "../services/referrer-credit-email.application-service";
import { claimantProfile, FakeClaimCodes, InMemoryClaimsStore, NOW, SequentialIds } from "./fakes/claims.fakes";

const ACTOR = systemActor(REFERRER_CREDIT_EMAIL_OPERATION, "job", null, "Request owed referrer-credit emails", null);
const CREDIT_EXPIRES = epochMs(NOW + 30 * DAY_MS);

function credited(referralId = "referral-1"): ReferrerCredited {
	return new ReferrerCredited(NOW, referralId, "referrer-1", "reward-1", "Free latte", CREDIT_EXPIRES, 30);
}

describe("RewardClaim.createReferrerCredit", () => {
	it("is a PENDING referrer-credit claim expiring when the credit policy said", () => {
		const claim = RewardClaim.createReferrerCredit(
			{
				id: "claim-9",
				referrerUserId: "referrer-1",
				referrerRewardId: "reward-1",
				referralId: "referral-1",
				codes: { redemptionTokenHash: "t", backupCodeHash: "b" },
				claimExpiresAt: CREDIT_EXPIRES,
			},
			NOW,
		);

		expect(claim.snapshot()).toMatchObject({
			userId: "referrer-1",
			rewardId: "reward-1",
			referralId: "referral-1",
			status: "PENDING",
			isReferrerCredit: true,
			claimedAt: NOW,
			claimExpiresAt: CREDIT_EXPIRES,
		});
		expect(claim.isRedeemableAt(CREDIT_EXPIRES)).toBe(true);
		expect(claim.pullEvents().map((event) => event.eventName)).toEqual(["claims.RewardClaimed"]);
	});
});

describe("IssueReferrerCreditClaimOnReferrerCredited (in the checkout's transaction)", () => {
	it("issues the referrer's credit claim for the bonus the credit took", async () => {
		const store = new InMemoryClaimsStore();

		await new IssueReferrerCreditClaimOnReferrerCredited(new FakeClaimCodes(), new SequentialIds("claim")).handle(credited(), store.scope);

		expect([...store.claims.rows.values()]).toEqual([
			expect.objectContaining({ id: "claim-1", userId: "referrer-1", rewardId: "reward-1", referralId: "referral-1", isReferrerCredit: true, claimExpiresAt: CREDIT_EXPIRES }),
		]);
		expect(store.eventNames()).toEqual(["claims.RewardClaimed"]);
	});
});

describe("ReferrerCreditEmailApplicationService", () => {
	let store: InMemoryClaimsStore;
	let service: ReferrerCreditEmailApplicationService;

	beforeEach(() => {
		store = new InMemoryClaimsStore();
		service = new ReferrerCreditEmailApplicationService(store.uow, store.clock);
		store.claimants.profiles.set("referrer-1", claimantProfile({ email: "ref@example.com" }));
		store.claims.seed({ id: "credit-claim", userId: "referrer-1", rewardId: "reward-1", referralId: "referral-1", isReferrerCredit: true });
		store.referrerCreditNotices.credit("referral-1", "referrer-1");
	});

	it("requests the email and marks the referral in one system-operation transaction", async () => {
		await expect(service.request(ACTOR, { referralId: "referral-1", referrerUserId: "referrer-1" })).resolves.toBe("requested");

		expect(store.emails.sent).toEqual([{ key: "referrer-reward-credited", props: { to: "ref@example.com", rewardTitle: "Free latte", claimExpiresDays: 30 } }]);
		expect(store.referrerCreditNotices.notified.get("referral-1")).toBe(NOW);
		expect(store.uow.committed).toEqual([{ operation: REFERRER_CREDIT_EMAIL_OPERATION }]);
	});

	it("requests it once: a second request finds it already marked", async () => {
		await service.request(ACTOR, { referralId: "referral-1", referrerUserId: "referrer-1" });

		await expect(service.request(ACTOR, { referralId: "referral-1", referrerUserId: "referrer-1" })).resolves.toBe("already-requested");
		expect(store.emails.sent).toHaveLength(1);
	});

	it("marks without an email when the referrer or the credit claim's reward is gone", async () => {
		store.claimants.profiles.delete("referrer-1");

		await expect(service.request(ACTOR, { referralId: "referral-1", referrerUserId: "referrer-1" })).resolves.toBe("skipped");
		expect(store.emails.sent).toEqual([]);
		expect(store.referrerCreditNotices.notified.has("referral-1")).toBe(true);
	});

	it("rolls the mark back when the email log cannot be written, leaving the referral owed", async () => {
		store.emails.failing = true;

		await expect(service.request(ACTOR, { referralId: "referral-1", referrerUserId: "referrer-1" })).rejects.toBeInstanceOf(ReferrerCreditEmailNotRequestedError);
		expect(store.referrerCreditNotices.notified.has("referral-1")).toBe(false);
	});

	it("sweeps every owed referral, one transaction each, then rethrows the first failure", async () => {
		store.referrerCreditNotices.credit("referral-2", "referrer-2");

		await expect(new SweepReferrerCreditEmailsHandler(store.uow, store.clock).execute(new SweepReferrerCreditEmailsCommand(ACTOR))).resolves.toEqual({
			requested: 1,
			alreadyRequested: 0,
			skipped: 1,
			failed: 0,
		});
		expect(store.referrerCreditNotices.notified.size).toBe(2);

		store.claims.seed({ id: "credit-claim-3", userId: "referrer-1", rewardId: "reward-1", referralId: "referral-3", isReferrerCredit: true });
		store.referrerCreditNotices.credit("referral-3", "referrer-1");
		store.emails.failing = true;
		await expect(new SweepReferrerCreditEmailsHandler(store.uow, store.clock).execute(new SweepReferrerCreditEmailsCommand(ACTOR))).rejects.toBeInstanceOf(
			ReferrerCreditEmailNotRequestedError,
		);
	});
});

describe("ReferrerCreditEmailApplicationService.sweep paging and permanent failures", () => {
	let store: InMemoryClaimsStore;

	beforeEach(() => {
		store = new InMemoryClaimsStore();
	});

	/** `count` owed credits, each with its credit claim and referrer, credited a millisecond apart. */
	function owe(count: number, email: (index: number) => string = (index) => `ref-${String(index)}@example.com`): void {
		for (let index = 0; index < count; index += 1) {
			const referralId = `referral-${String(index).padStart(4, "0")}`;
			store.claimants.profiles.set(`referrer-${String(index)}`, claimantProfile({ email: email(index) }));
			store.claims.seed({ id: `credit-claim-${String(index)}`, userId: `referrer-${String(index)}`, rewardId: "reward-1", referralId, isReferrerCredit: true });
			store.referrerCreditNotices.credit(referralId, `referrer-${String(index)}`, epochMs(NOW + index));
		}
	}

	it("marks an email that can never be built as undeliverable instead of retrying it, and keeps going", async () => {
		owe(2, (index) => (index === 0 ? "broken" : "ok@example.com"));
		store.emails.invalidFor.add("broken");
		const service = new ReferrerCreditEmailApplicationService(store.uow, store.clock);

		await expect(service.sweep(ACTOR)).resolves.toEqual({ requested: 1, alreadyRequested: 0, skipped: 1, failed: 0 });
		expect(store.referrerCreditNotices.notified.size).toBe(2);
		expect(store.emails.sent).toHaveLength(1);
	});

	it("pages past transiently failing credits so a full page of failures never blocks the ones behind it", async () => {
		owe(REFERRER_CREDIT_EMAIL_BATCH + 1);
		const lastEmail = `ref-${String(REFERRER_CREDIT_EMAIL_BATCH)}@example.com`;
		for (let index = 0; index < REFERRER_CREDIT_EMAIL_BATCH; index += 1) {
			store.emails.failingFor.add(`ref-${String(index)}@example.com`);
		}
		const service = new ReferrerCreditEmailApplicationService(store.uow, store.clock);

		await expect(service.sweep(ACTOR)).rejects.toBeInstanceOf(ReferrerCreditEmailNotRequestedError);

		expect(store.emails.sent.map((email) => email.props.to)).toEqual([lastEmail]);
		expect(store.referrerCreditNotices.pages).toEqual([
			{ take: REFERRER_CREDIT_EMAIL_BATCH, after: null },
			{
				take: REFERRER_CREDIT_EMAIL_BATCH,
				after: { creditedAt: NOW + REFERRER_CREDIT_EMAIL_BATCH - 1, referralId: `referral-${String(REFERRER_CREDIT_EMAIL_BATCH - 1).padStart(4, "0")}` },
			},
		]);
	});

	it("reads at most the page limit in one run", async () => {
		owe(REFERRER_CREDIT_EMAIL_BATCH * (REFERRER_CREDIT_EMAIL_MAX_PAGES + 1));
		const service = new ReferrerCreditEmailApplicationService(store.uow, store.clock);

		await expect(service.sweep(ACTOR)).resolves.toMatchObject({ requested: REFERRER_CREDIT_EMAIL_BATCH * REFERRER_CREDIT_EMAIL_MAX_PAGES });
		expect(store.referrerCreditNotices.pages).toHaveLength(REFERRER_CREDIT_EMAIL_MAX_PAGES);
	});
});

describe("RequestReferrerCreditEmailOnReferrerCredited (after the checkout committed)", () => {
	it("requests the email right away as the email system operation", async () => {
		const store = new InMemoryClaimsStore();
		store.claimants.profiles.set("referrer-1", claimantProfile());
		store.claims.seed({ id: "credit-claim", userId: "referrer-1", rewardId: "reward-1", referralId: "referral-1", isReferrerCredit: true });
		store.referrerCreditNotices.credit("referral-1", "referrer-1");

		await new RequestReferrerCreditEmailOnReferrerCredited(store.uow, store.clock).handle(credited());

		expect(store.emails.sent).toHaveLength(1);
		expect(store.uow.committed).toEqual([{ operation: REFERRER_CREDIT_EMAIL_OPERATION }]);
	});

	it("never fails the sale: a failed request is logged and left owed for the sweeper", async () => {
		const store = new InMemoryClaimsStore();
		store.claimants.profiles.set("referrer-1", claimantProfile());
		store.claims.seed({ id: "credit-claim", userId: "referrer-1", rewardId: "reward-1", referralId: "referral-1", isReferrerCredit: true });
		store.referrerCreditNotices.credit("referral-1", "referrer-1");
		store.emails.failing = true;

		await expect(new RequestReferrerCreditEmailOnReferrerCredited(store.uow, store.clock).handle(credited())).resolves.toBeUndefined();
		expect(store.referrerCreditNotices.notified.has("referral-1")).toBe(false);
	});
});
