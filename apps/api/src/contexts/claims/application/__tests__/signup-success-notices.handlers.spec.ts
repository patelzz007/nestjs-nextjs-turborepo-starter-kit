import { epochMs, SIGNUP_REFERRALS_SCREEN_PATH } from "@workspace/shared";
import { beforeEach, describe, expect, it } from "vitest";

import { systemActor } from "../../../../platform/application/actor-context";
import { SignupReferralSucceeded } from "../../../referrals/public-api";
import { SweepSignupSuccessNoticesCommand } from "../commands/sweep-signup-success-notices/sweep-signup-success-notices.command";
import { SweepSignupSuccessNoticesHandler } from "../commands/sweep-signup-success-notices/sweep-signup-success-notices.handler";
import { DeliverSignupSuccessNoticeOnSignupReferralSucceeded } from "../event-handlers/after-commit/deliver-signup-success-notice.event-handler";
import {
	SIGNUP_REFERRAL_SUCCESS_NOTIFICATION_TYPE,
	SIGNUP_SUCCESS_NOTICE_OPERATION,
	SIGNUP_SUCCESS_NOTICE_PAGE_SIZE,
	SignupSuccessNoticeApplicationService,
	SignupSuccessRefereeMissingError,
} from "../services/signup-success-notice.application-service";
import { InMemoryClaimsStore, NOW } from "./fakes/claims.fakes";

const ACTOR = systemActor(SIGNUP_SUCCESS_NOTICE_OPERATION, "cron", null, "Deliver owed notifications", null);

describe("SignupSuccessNoticeApplicationService.deliver", () => {
	let store: InMemoryClaimsStore;
	let service: SignupSuccessNoticeApplicationService;

	beforeEach(() => {
		store = new InMemoryClaimsStore();
		service = new SignupSuccessNoticeApplicationService(store.uow, store.clock);
		store.signupSuccessNotices.succeed("signup-referral-1", "referrer-1", "referee-1");
		store.claimants.names.set("referee-1", "Aisha Rahman");
	});

	it("claims the notice and writes the referrer's inbox row in one system-operation transaction", async () => {
		await expect(service.deliver(ACTOR, "signup-referral-1")).resolves.toBe("delivered");

		expect(store.signupSuccessNotices.notified.get("signup-referral-1")).toBe(NOW);
		expect(store.inbox.notices).toEqual([
			{
				id: "notice-1",
				readAt: null,
				userId: "referrer-1",
				type: SIGNUP_REFERRAL_SUCCESS_NOTIFICATION_TYPE,
				title: "Referral successful",
				body: "Aisha Rahman redeemed a reward. Your referral is successful.",
				metadata: { signupReferralId: "signup-referral-1", href: SIGNUP_REFERRALS_SCREEN_PATH },
			},
		]);
		expect(store.uow.committed).toEqual([{ operation: SIGNUP_SUCCESS_NOTICE_OPERATION }]);
	});

	it("writes it once: a second delivery finds it already claimed", async () => {
		await service.deliver(ACTOR, "signup-referral-1");

		await expect(service.deliver(ACTOR, "signup-referral-1")).resolves.toBe("already-delivered");
		expect(store.inbox.notices).toHaveLength(1);
	});

	it("rolls the claim back when the inbox row cannot be written, leaving the notice owed", async () => {
		store.inbox.failingFor.add("referrer-1");

		await expect(service.deliver(ACTOR, "signup-referral-1")).rejects.toThrow("inbox unavailable");
		expect(store.signupSuccessNotices.notified.has("signup-referral-1")).toBe(false);
	});

	it("refuses a referee with no account at all (corrupt data), leaving the notice owed", async () => {
		store.claimants.names.delete("referee-1");

		await expect(service.deliver(ACTOR, "signup-referral-1")).rejects.toBeInstanceOf(SignupSuccessRefereeMissingError);
		expect(store.signupSuccessNotices.notified.size).toBe(0);
		expect(store.inbox.notices).toEqual([]);
	});
});

describe("SweepSignupSuccessNoticesHandler", () => {
	it("delivers every owed notice page by page, oldest success first", async () => {
		const store = new InMemoryClaimsStore();
		for (let index = 0; index <= SIGNUP_SUCCESS_NOTICE_PAGE_SIZE; index += 1) {
			store.signupSuccessNotices.succeed(`signup-referral-${String(index).padStart(4, "0")}`, "referrer-1", "referee-1", epochMs(NOW + index));
		}
		store.claimants.names.set("referee-1", "Aisha Rahman");

		await expect(new SweepSignupSuccessNoticesHandler(store.uow, store.clock).execute(new SweepSignupSuccessNoticesCommand(ACTOR))).resolves.toEqual({
			delivered: SIGNUP_SUCCESS_NOTICE_PAGE_SIZE + 1,
			failed: 0,
		});
		expect(store.signupSuccessNotices.pages.map((page) => page.after?.signupReferralId ?? null)).toEqual([
			null,
			`signup-referral-${String(SIGNUP_SUCCESS_NOTICE_PAGE_SIZE - 1).padStart(4, "0")}`,
			`signup-referral-${String(SIGNUP_SUCCESS_NOTICE_PAGE_SIZE).padStart(4, "0")}`,
		]);
	});

	it("steps past a failing notice so it never blocks the rest, then fails the run with it still owed", async () => {
		const store = new InMemoryClaimsStore();
		store.signupSuccessNotices.succeed("broken", "referrer-broken", "referee-1", epochMs(NOW - 1)).succeed("ok", "referrer-1", "referee-1", NOW);
		store.claimants.names.set("referee-1", "Aisha Rahman");
		store.inbox.failingFor.add("referrer-broken");

		await expect(new SweepSignupSuccessNoticesHandler(store.uow, store.clock).execute(new SweepSignupSuccessNoticesCommand(ACTOR))).rejects.toMatchObject({
			name: "SignupSuccessNoticesFailedError",
			failed: 1,
		});
		expect(store.inbox.notices.map((notice) => notice.userId)).toEqual(["referrer-1"]);
		expect([...store.signupSuccessNotices.notified.keys()]).toEqual(["ok"]);
	});
});

describe("DeliverSignupSuccessNoticeOnSignupReferralSucceeded (after the checkout committed)", () => {
	it("delivers the stamped referral's notice right away as the notice system operation", async () => {
		const store = new InMemoryClaimsStore();
		store.signupSuccessNotices.succeed("signup-referral-1", "referrer-1", "referee-1");
		store.claimants.names.set("referee-1", "Aisha Rahman");

		await new DeliverSignupSuccessNoticeOnSignupReferralSucceeded(store.uow, store.clock).handle(new SignupReferralSucceeded(NOW, "signup-referral-1"));

		expect(store.inbox.notices).toHaveLength(1);
		expect(store.uow.committed).toEqual([{ operation: SIGNUP_SUCCESS_NOTICE_OPERATION }]);
	});

	it("never fails the sale: a failed delivery is logged and left owed for the sweeper", async () => {
		const store = new InMemoryClaimsStore();
		store.signupSuccessNotices.succeed("signup-referral-1", "referrer-1", "referee-1");
		store.claimants.names.set("referee-1", "Aisha Rahman");
		store.inbox.failingFor.add("referrer-1");

		await expect(
			new DeliverSignupSuccessNoticeOnSignupReferralSucceeded(store.uow, store.clock).handle(new SignupReferralSucceeded(NOW, "signup-referral-1")),
		).resolves.toBeUndefined();
		expect(store.signupSuccessNotices.notified.size).toBe(0);
	});
});
