import { beforeEach, describe, expect, it } from "vitest";
import { DAY_MS, epochMs, type RewardClaimListQuery, type RewardClaimResponse, type PaginatedServiceResult } from "@workspace/shared";

import { systemActor, type ActorContext } from "../../../../platform/application/actor-context";
import type { TenantDisplayData, TenantReadPort } from "../../../tenancy/public-api";
import { ReferrerCredited } from "../../../referrals/public-api";
import { RewardApproved, RewardAutoPublished, RewardRejected } from "../../../rewards/public-api";
import {
	ClaimantNotFoundError,
	ClaimCustomerBannedError,
	ClaimLimitReachedError,
	ClaimNoLongerRedeemableError,
	ClaimNotActiveError,
	ClaimNotFoundError,
	ClaimRewardUnavailableError,
	LegalAcceptanceRequiredError,
	OtpInvalidError,
	OtpMissingError,
	OtpRequiredError,
} from "../../domain/errors/claims.errors";
import { ClaimRewardCommand } from "../commands/claim-reward/claim-reward.command";
import { ClaimRewardHandler } from "../commands/claim-reward/claim-reward.handler";
import { ExpireOverdueClaimsCommand } from "../commands/expire-overdue-claims/expire-overdue-claims.command";
import { ExpireOverdueClaimsHandler } from "../commands/expire-overdue-claims/expire-overdue-claims.handler";
import { IssueClaimQrCodesCommand } from "../commands/issue-claim-qr-codes/issue-claim-qr-codes.command";
import { IssueClaimQrCodesHandler } from "../commands/issue-claim-qr-codes/issue-claim-qr-codes.handler";
import { RequestClaimOtpCommand } from "../commands/request-claim-otp/request-claim-otp.command";
import { RequestClaimOtpHandler } from "../commands/request-claim-otp/request-claim-otp.handler";
import { RecordNotificationOnReferrerCredited, RecordOwnerNoticesOnRewardReview } from "../event-handlers/in-transaction/record-reward-notices.in-transaction-handlers";
import type { ClaimReadPort } from "../ports/claims-read.port";
import { GetMyClaimHandler } from "../queries/get-my-claim/get-my-claim.handler";
import { GetMyClaimQuery } from "../queries/get-my-claim/get-my-claim.query";
import { ClaimRedemptionApplicationService } from "../services/claim-redemption.application-service";
import { FakeClaimCodes, InMemoryClaimsStore, InMemoryInventory, NOW, SequentialIds, claimantProfile, customer } from "./fakes/claims.fakes";

const USER = "user-1";
const REWARD = "reward-1";
const PHONE = "+60123000000";

let store: InMemoryClaimsStore;
const codes = new FakeClaimCodes();

beforeEach(() => {
	store = new InMemoryClaimsStore();
	store.legal.accepted.add(USER);
	store.claimants.profiles.set(USER, claimantProfile({ phone: PHONE }));
});

function claim(phone: string = PHONE, otp?: string, actor: ActorContext = customer(USER)): ReturnType<ClaimRewardHandler["execute"]> {
	return new ClaimRewardHandler(store.uow, codes, new SequentialIds("claim"), store.clock).execute(
		new ClaimRewardCommand(actor, { rewardId: REWARD, phone, ...(otp === undefined ? {} : { otp }) }),
	);
}

describe("ClaimRewardHandler", () => {
	it("claims with the verified phone: one unit reserved, the claim stored with its code hashes, the codes returned once", async () => {
		const created = await claim();

		expect(created).toMatchObject({ claim: { id: "claim-1", status: "PENDING" }, qrDeepLink: "/rewards/claims/claim-1/qr" });
		expect(store.claims.rows.get("claim-1")?.codes.backupCodeHash).toBe(`hash:${created.backupCode}`);
		expect(store.inventory).toMatchObject({ remaining: 9, reserved: 1 });
		expect(store.claimants.locks).toEqual([USER]);
		expect(store.eventNames()).toEqual(["claims.RewardClaimed"]);
	});

	it("refuses before claiming without accepted terms, or without an account", async () => {
		store.legal.accepted.clear();
		await expect(claim()).rejects.toBeInstanceOf(LegalAcceptanceRequiredError);

		store.legal.accepted.add("ghost");
		await expect(claim(PHONE, undefined, customer("ghost"))).rejects.toBeInstanceOf(ClaimantNotFoundError);
		expect(store.inventory.remaining).toBe(10);
	});

	it("refuses a customer the merchant banned, without reserving a unit", async () => {
		store.customerStanding.ban("org-1", USER);

		await expect(claim()).rejects.toBeInstanceOf(ClaimCustomerBannedError);

		expect(store.inventory).toMatchObject({ remaining: 10, reserved: 0 });
		expect(store.claims.rows.size).toBe(0);
	});

	it("answers a merchant that does not operate (suspended, banned) like a missing reward", async () => {
		store.customerStanding.stop("org-1");

		await expect(claim()).rejects.toBeInstanceOf(ClaimRewardUnavailableError);

		expect(store.inventory.remaining).toBe(10);
		expect(store.claims.rows.size).toBe(0);
	});

	it("caps the claims one customer holds, rolling the reservation back", async () => {
		store.inventory.facts = { ...store.inventory.facts, maxClaimsPerUser: 1 };
		await claim();

		await expect(claim()).rejects.toBeInstanceOf(ClaimLimitReachedError);

		expect(store.inventory).toMatchObject({ remaining: 9, reserved: 1 });
		expect(store.claims.rows.size).toBe(1);
	});

	it("needs an OTP for an unverified phone, and commits a wrong attempt before refusing", async () => {
		const otherPhone = "+60999000111";
		await expect(claim(otherPhone)).rejects.toBeInstanceOf(OtpRequiredError);
		await expect(claim(otherPhone, "111111")).rejects.toBeInstanceOf(OtpMissingError);

		await new RequestClaimOtpHandler(store.uow, codes, new SequentialIds("otp"), store.clock).execute(
			new RequestClaimOtpCommand(customer(USER), { rewardId: REWARD, phone: otherPhone }),
		);
		await expect(claim(otherPhone, "111111")).rejects.toBeInstanceOf(OtpInvalidError);

		expect(store.otpChallenges.rows.get("otp-1")).toMatchObject({ attempts: 1, failedAttempts: 1, consumedAt: null });
		expect(store.claims.rows.size).toBe(0);
	});

	it("claims with the right OTP and records the phone as verified", async () => {
		const otherPhone = "+60999000111";
		await new RequestClaimOtpHandler(store.uow, codes, new SequentialIds("otp"), store.clock).execute(
			new RequestClaimOtpCommand(customer(USER), { rewardId: REWARD, phone: otherPhone }),
		);

		await claim(otherPhone, "123456");

		expect(store.claimants.profiles.get(USER)).toMatchObject({ phone: otherPhone, phoneVerifiedAt: NOW });
		expect(store.otpChallenges.rows.get("otp-1")?.consumedAt).toBe(NOW);
	});

	it("attaches a live referral attribution and spends it", async () => {
		store.claimants.profiles.set(USER, claimantProfile({ phone: PHONE, pendingAttributionToken: "attr-1", pendingAttributionExpiresAt: epochMs(NOW + 1) }));
		store.attribution.referrals.set(`attr-1:${REWARD}`, "referral-9");

		await claim();

		expect(store.claims.rows.get("claim-1")?.referralId).toBe("referral-9");
		expect(store.claimants.profiles.get(USER)?.pendingAttributionToken).toBeNull();
	});

	it("never uses an expired attribution", async () => {
		store.claimants.profiles.set(USER, claimantProfile({ phone: PHONE, pendingAttributionToken: "attr-1", pendingAttributionExpiresAt: epochMs(NOW - 1) }));

		await claim();

		expect(store.attribution.attached).toEqual([]);
	});
});

describe("RequestClaimOtpHandler", () => {
	it("stores the challenge and requests the OTP email in the same unit of work", async () => {
		await expect(
			new RequestClaimOtpHandler(store.uow, codes, new SequentialIds("otp"), store.clock).execute(
				new RequestClaimOtpCommand(customer(USER), { rewardId: REWARD, phone: PHONE }),
			),
		).resolves.toEqual({ ok: true });

		expect(store.otpChallenges.rows.get("otp-1")).toMatchObject({ userId: USER, phone: PHONE, codeHash: "hash:123456" });
		const [email] = store.emails.sent;
		expect(store.emails.sent).toHaveLength(1);
		expect(email?.props).toMatchObject({ to: "jane@example.com", otpCode: "123456" });
	});
});

describe("IssueClaimQrCodesHandler", () => {
	const issue = (claimId = "claim-1", userId = USER): ReturnType<IssueClaimQrCodesHandler["execute"]> =>
		new IssueClaimQrCodesHandler(store.uow, codes, store.clock).execute(new IssueClaimQrCodesCommand(customer(userId), { claimId }));

	it("rotates the stored hashes and returns the new codes", async () => {
		store.claims.seed({ id: "claim-1", userId: USER, rewardId: REWARD });

		const issued = await issue();

		expect(store.claims.rows.get("claim-1")?.codes).toEqual({ redemptionTokenHash: `hash:${issued.qrPayload}`, backupCodeHash: `hash:${issued.backupCode}` });
	});

	it("refuses another customer's claim, and a claim redeemed meanwhile", async () => {
		store.claims.seed({ id: "claim-1", userId: USER, rewardId: REWARD });
		await expect(issue("claim-1", "user-2")).rejects.toBeInstanceOf(ClaimNotFoundError);

		const before = store.claims.rows.get("claim-1")?.codes;
		store.claims.moveBeforeNextSave("claim-1", "REDEEMED");
		await expect(issue()).rejects.toBeInstanceOf(ClaimNotActiveError);
		expect(store.claims.rows.get("claim-1")?.codes).toEqual(before);
	});
});

describe("Claim expiry", () => {
	it("expires overdue claims, returning their units and auditing each", async () => {
		store.claims.seed({ id: "claim-1", userId: USER, rewardId: REWARD, claimExpiresAt: epochMs(NOW - 1) });
		store.claims.seed({ id: "claim-2", userId: USER, rewardId: REWARD });
		store.inventory.reserved = 2;
		store.inventory.remaining = 8;
		const job = systemActor("queue.claims.expire_pending", "job", null, "expire claims", null);

		await expect(new ExpireOverdueClaimsHandler(store.uow, store.clock).execute(new ExpireOverdueClaimsCommand(job))).resolves.toEqual({ expired: 1, skipped: 0 });

		expect(store.claims.rows.get("claim-1")?.status).toBe("EXPIRED");
		expect(store.claims.rows.get("claim-2")?.status).toBe("PENDING");
		expect(store.inventory).toMatchObject({ remaining: 9, reserved: 1 });
		expect(store.rewardAudit.entries.map((entry) => [entry.action, entry.tenantId])).toEqual([["reward.claim_expired", "org-1"]]);
	});
});

describe("ClaimRedemptionApplicationService", () => {
	function service(inventory: InMemoryInventory = store.inventory): ClaimRedemptionApplicationService {
		return new ClaimRedemptionApplicationService(store.claims, store.claims, inventory, codes, store.events);
	}

	it("finds a claim by its QR token or backup code for the reward's own merchant only", async () => {
		store.claims.seed({ id: "claim-1", userId: USER, rewardId: REWARD, codes: { redemptionTokenHash: "hash:qr-x", backupCodeHash: "hash:BACKUPXX" } });

		await expect(service().findMerchantClaim({ token: "qr-x" }, "org-1")).resolves.toMatchObject({
			claim: { id: "claim-1", status: "PENDING" },
			reward: { tenantId: "org-1" },
		});
		await expect(service().findMerchantClaim({ backupCode: "BACKUPXX" }, "org-1")).resolves.toMatchObject({ claim: { id: "claim-1" } });
		await expect(service().findMerchantClaim({ token: "qr-x" }, "org-2")).resolves.toBeNull();
		await expect(service().findMerchantClaim({ token: "unknown" }, "org-1")).resolves.toBeNull();
	});

	it("redeems every claim of a checkout, refusing one that is no longer redeemable", async () => {
		store.claims.seed({ id: "claim-1", userId: USER, rewardId: REWARD });
		store.claims.seed({ id: "claim-2", userId: USER, rewardId: REWARD, status: "EXPIRED" });

		await service().redeem(["claim-1"], NOW);
		expect(store.claims.rows.get("claim-1")).toMatchObject({ status: "REDEEMED", redeemedAt: NOW });
		expect(store.eventNames()).toEqual(["claims.ClaimRedeemed"]);
		await expect(service().redeem(["claim-2"], NOW)).rejects.toBeInstanceOf(ClaimNoLongerRedeemableError);
		await expect(service().redeem(["claim-1"], NOW)).rejects.toBeInstanceOf(ClaimNoLongerRedeemableError);
	});
});

describe("Reward notices (ADR 070)", () => {
	const REVIEWED_REWARD = "0193f2c4-0000-7000-8000-0000000000a1";
	const REFERRER_REWARD = "0193f2c4-0000-7000-8000-0000000000a2";
	const facts = { rewardId: REVIEWED_REWARD, tenantId: "org-1", title: "Free latte" };
	const tenants: TenantReadPort = {
		getDisplayData: (tenantIds: readonly string[]): Promise<ReadonlyMap<string, TenantDisplayData>> =>
			Promise.resolve(
				new Map(
					tenantIds.map((tenantId: string): [string, TenantDisplayData] => [
						tenantId,
						{ tenantId, slug: "sunrise-cafe", displayName: "Sunrise Cafe", timeZone: "Asia/Kuala_Lumpur", logo: null },
					]),
				),
			),
		listOwnerUserIds: (): Promise<readonly string[]> => Promise.resolve(["owner-1", "owner-2"]),
	};

	it("tells every owner about each review decision, with the tenant's slug for the merchant link", async () => {
		await new RecordOwnerNoticesOnRewardReview(tenants).handle(new RewardApproved(NOW, facts, "admin-1"), store.scope);
		await new RecordOwnerNoticesOnRewardReview(tenants).handle(new RewardRejected(epochMs(NOW + 1), facts, "admin-1", "Blurry photo"), store.scope);

		expect(store.notify.notifications.map((notification) => [notification.userId, notification.typeKey, notification.tenantId])).toEqual([
			["owner-1", "rewards.reward-approved", "org-1"],
			["owner-2", "rewards.reward-approved", "org-1"],
			["owner-1", "rewards.reward-rejected", "org-1"],
			["owner-2", "rewards.reward-rejected", "org-1"],
		]);
		expect(store.notify.notifications.at(2)?.payload).toEqual({ rewardId: REVIEWED_REWARD, rewardTitle: "Free latte", tenantSlug: "sunrise-cafe", reason: "Blurry photo" });
	});

	it("keeps each review of the same reward apart, and a repeat of one decision writes nothing", async () => {
		const handler = new RecordOwnerNoticesOnRewardReview(tenants);
		await handler.handle(new RewardRejected(NOW, facts, "admin-1", "Blurry photo"), store.scope);
		await handler.handle(new RewardRejected(NOW, facts, "admin-1", "Blurry photo"), store.scope);
		await handler.handle(new RewardRejected(epochMs(NOW + DAY_MS), facts, "admin-1", "Still blurry"), store.scope);

		expect(store.notify.notifications.filter((notification) => notification.userId === "owner-1").map((notification) => notification.dedupeKey)).toEqual([
			`reward-rejected:${REVIEWED_REWARD}:${String(NOW)}`,
			`reward-rejected:${REVIEWED_REWARD}:${String(NOW + DAY_MS)}`,
		]);
	});

	it("writes nothing for a tenant without owners", async () => {
		const ownerless: TenantReadPort = { ...tenants, listOwnerUserIds: (): Promise<readonly string[]> => Promise.resolve([]) };

		await new RecordOwnerNoticesOnRewardReview(ownerless).handle(new RewardAutoPublished(NOW, facts), store.scope);

		expect(store.notify.notifications).toEqual([]);
	});

	it("tells the referrer their credit, once per referral", async () => {
		const credited = new ReferrerCredited(NOW, "referral-1", "referrer-1", REFERRER_REWARD, "Free cake", epochMs(NOW + DAY_MS), 7);
		await new RecordNotificationOnReferrerCredited().handle(credited, store.scope);
		await new RecordNotificationOnReferrerCredited().handle(credited, store.scope);

		expect(store.notify.notifications).toEqual([
			{
				userId: "referrer-1",
				typeKey: "rewards.referrer-credited",
				payload: { rewardId: REFERRER_REWARD, rewardTitle: "Free cake", claimTtlDays: 7 },
				dedupeKey: "referrer-credited:referral-1",
				tenantId: null,
			},
		]);
	});
});

describe("GetMyClaimHandler", () => {
	it("answers not found when the read model has no such claim for the caller", async () => {
		const reads: ClaimReadPort = {
			listForUser: (_actor: ActorContext, _userId: string, _query: RewardClaimListQuery): Promise<PaginatedServiceResult<RewardClaimResponse>> =>
				Promise.reject(new Error("not used")),
			findForUser: (): Promise<RewardClaimResponse | null> => Promise.resolve(null),
		};

		await expect(new GetMyClaimHandler(reads).execute(new GetMyClaimQuery(customer(USER), { claimId: "claim-9" }))).rejects.toBeInstanceOf(ClaimNotFoundError);
	});
});
