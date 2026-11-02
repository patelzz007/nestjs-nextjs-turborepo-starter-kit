import { epochMs } from "@workspace/shared";
import { beforeEach, describe, expect, it } from "vitest";

import { systemActor } from "../../../../platform/application/actor-context";
import { SignupReferralSucceeded } from "../../../referrals/public-api";
import { SweepSignupSuccessNoticesCommand } from "../commands/sweep-signup-success-notices/sweep-signup-success-notices.command";
import { SweepSignupSuccessNoticesHandler } from "../commands/sweep-signup-success-notices/sweep-signup-success-notices.handler";
import { DeliverSignupSuccessNoticeOnSignupReferralSucceeded } from "../event-handlers/after-commit/deliver-signup-success-notice.event-handler";
import {
	SIGNUP_SUCCESS_NOTICE_OPERATION,
	SIGNUP_SUCCESS_NOTICE_PAGE_SIZE,
	SignupSuccessNoticeApplicationService,
	SignupSuccessRefereeMissingError,
} from "../services/signup-success-notice.application-service";
import { InMemoryClaimsStore, NOW } from "./fakes/claims.fakes";

/** Signup referral ids are UUIDs: the notice's payload schema checks it. */
const SIGNUP_REFERRAL_ID = "0193f2c4-0000-7000-8000-0000000000b1";
const BROKEN_REFERRAL_ID = "0193f2c4-0000-7000-8000-0000000000b2";
const OK_REFERRAL_ID = "0193f2c4-0000-7000-8000-0000000000b3";
/** Width of a UUID's last group. */
const UUID_NODE_DIGITS = 12;

function signupReferralId(index: number): string {
	return `0193f2c4-0000-7000-8000-${String(index).padStart(UUID_NODE_DIGITS, "0")}`;
}

const ACTOR = systemActor(SIGNUP_SUCCESS_NOTICE_OPERATION, "cron", null, "Deliver owed notifications", null);

describe("SignupSuccessNoticeApplicationService.deliver", () => {
	let store: InMemoryClaimsStore;
	let service: SignupSuccessNoticeApplicationService;

	beforeEach(() => {
		store = new InMemoryClaimsStore();
		service = new SignupSuccessNoticeApplicationService(store.uow, store.clock);
		store.signupSuccessNotices.succeed(SIGNUP_REFERRAL_ID, "referrer-1", "referee-1");
		store.claimants.names.set("referee-1", "Aisha Rahman");
	});

	it("claims the notice and writes the referrer's inbox row in one system-operation transaction", async () => {
		await expect(service.deliver(ACTOR, SIGNUP_REFERRAL_ID)).resolves.toBe("delivered");

		expect(store.signupSuccessNotices.notified.get(SIGNUP_REFERRAL_ID)).toBe(NOW);
		expect(store.notify.notifications).toEqual([
			{
				userId: "referrer-1",
				typeKey: "referrals.signup-success",
				payload: { signupReferralId: SIGNUP_REFERRAL_ID, refereeName: "Aisha Rahman" },
				dedupeKey: `signup-success:${SIGNUP_REFERRAL_ID}`,
				tenantId: null,
			},
		]);
		expect(store.uow.committed).toEqual([{ operation: SIGNUP_SUCCESS_NOTICE_OPERATION }]);
	});

	it("writes it once: a second delivery finds it already claimed", async () => {
		await service.deliver(ACTOR, SIGNUP_REFERRAL_ID);

		await expect(service.deliver(ACTOR, SIGNUP_REFERRAL_ID)).resolves.toBe("already-delivered");
		expect(store.notify.notifications).toHaveLength(1);
	});

	it("rolls the claim back when the inbox row cannot be written, leaving the notice owed", async () => {
		store.notify.failingFor.add("referrer-1");

		await expect(service.deliver(ACTOR, SIGNUP_REFERRAL_ID)).rejects.toThrow("inbox unavailable");
		expect(store.signupSuccessNotices.notified.has(SIGNUP_REFERRAL_ID)).toBe(false);
	});

	it("refuses a referee with no account at all (corrupt data), leaving the notice owed", async () => {
		store.claimants.names.delete("referee-1");

		await expect(service.deliver(ACTOR, SIGNUP_REFERRAL_ID)).rejects.toBeInstanceOf(SignupSuccessRefereeMissingError);
		expect(store.signupSuccessNotices.notified.size).toBe(0);
		expect(store.notify.notifications).toEqual([]);
	});
});

describe("SweepSignupSuccessNoticesHandler", () => {
	it("delivers every owed notice page by page, oldest success first", async () => {
		const store = new InMemoryClaimsStore();
		for (let index = 0; index <= SIGNUP_SUCCESS_NOTICE_PAGE_SIZE; index += 1) {
			store.signupSuccessNotices.succeed(signupReferralId(index), "referrer-1", "referee-1", epochMs(NOW + index));
		}
		store.claimants.names.set("referee-1", "Aisha Rahman");

		await expect(new SweepSignupSuccessNoticesHandler(store.uow, store.clock).execute(new SweepSignupSuccessNoticesCommand(ACTOR))).resolves.toEqual({
			delivered: SIGNUP_SUCCESS_NOTICE_PAGE_SIZE + 1,
			failed: 0,
		});
		expect(store.signupSuccessNotices.pages.map((page) => page.after?.signupReferralId ?? null)).toEqual([
			null,
			signupReferralId(SIGNUP_SUCCESS_NOTICE_PAGE_SIZE - 1),
			signupReferralId(SIGNUP_SUCCESS_NOTICE_PAGE_SIZE),
		]);
	});

	it("steps past a failing notice so it never blocks the rest, then fails the run with it still owed", async () => {
		const store = new InMemoryClaimsStore();
		store.signupSuccessNotices.succeed(BROKEN_REFERRAL_ID, "referrer-broken", "referee-1", epochMs(NOW - 1)).succeed(OK_REFERRAL_ID, "referrer-1", "referee-1", NOW);
		store.claimants.names.set("referee-1", "Aisha Rahman");
		store.notify.failingFor.add("referrer-broken");

		await expect(new SweepSignupSuccessNoticesHandler(store.uow, store.clock).execute(new SweepSignupSuccessNoticesCommand(ACTOR))).rejects.toMatchObject({
			name: "SignupSuccessNoticesFailedError",
			failed: 1,
		});
		expect(store.notify.notifications.map((notice) => notice.userId)).toEqual(["referrer-1"]);
		expect([...store.signupSuccessNotices.notified.keys()]).toEqual([OK_REFERRAL_ID]);
	});
});

describe("DeliverSignupSuccessNoticeOnSignupReferralSucceeded (after the checkout committed)", () => {
	it("delivers the stamped referral's notice right away as the notice system operation", async () => {
		const store = new InMemoryClaimsStore();
		store.signupSuccessNotices.succeed(SIGNUP_REFERRAL_ID, "referrer-1", "referee-1");
		store.claimants.names.set("referee-1", "Aisha Rahman");

		await new DeliverSignupSuccessNoticeOnSignupReferralSucceeded(store.uow, store.clock).handle(new SignupReferralSucceeded(NOW, SIGNUP_REFERRAL_ID));

		expect(store.notify.notifications).toHaveLength(1);
		expect(store.uow.committed).toEqual([{ operation: SIGNUP_SUCCESS_NOTICE_OPERATION }]);
	});

	it("never fails the sale: a failed delivery is logged and left owed for the sweeper", async () => {
		const store = new InMemoryClaimsStore();
		store.signupSuccessNotices.succeed(SIGNUP_REFERRAL_ID, "referrer-1", "referee-1");
		store.claimants.names.set("referee-1", "Aisha Rahman");
		store.notify.failingFor.add("referrer-1");

		await expect(
			new DeliverSignupSuccessNoticeOnSignupReferralSucceeded(store.uow, store.clock).handle(new SignupReferralSucceeded(NOW, SIGNUP_REFERRAL_ID)),
		).resolves.toBeUndefined();
		expect(store.signupSuccessNotices.notified.size).toBe(0);
	});
});
