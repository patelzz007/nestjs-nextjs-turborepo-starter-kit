import { describe, expect, it } from "vitest";
import { epochMs } from "@workspace/shared";

import { systemActor } from "../../../../platform/application/actor-context";
import { FixedClock } from "../../../../platform/application/__tests__/fixed-clock";
import { MaintainSignupReferralCodesCommand, SIGNUP_REFERRAL_CODE_JOB_PAGE_SIZE } from "../commands/maintain-signup-referral-codes/maintain-signup-referral-codes.command";
import { MaintainSignupReferralCodesHandler } from "../commands/maintain-signup-referral-codes/maintain-signup-referral-codes.handler";
import { ScriptedCodeMaintenance } from "./fakes/referrals.fakes";

const NOW = epochMs(1_800_000_000_000);
const CLOCK = new FixedClock(NOW);
const CODES_ACTOR = systemActor("maintenance.signup_referral_codes", "cron", null, "Issue due signup referral codes", null);

describe("MaintainSignupReferralCodesHandler", () => {
	it("counts first codes and successors, and pages after the last user until no user needs a code", async () => {
		const codes = new ScriptedCodeMaintenance(
			[["user-new", "user-expired"], []],
			new Map([
				["user-new", "first"],
				["user-expired", "successor"],
			]),
		);

		await expect(new MaintainSignupReferralCodesHandler(codes, CLOCK).execute(new MaintainSignupReferralCodesCommand(CODES_ACTOR))).resolves.toEqual({
			firstCodes: 1,
			successors: 1,
			failed: 0,
		});
		expect(codes.pageRequests).toEqual([
			{ now: NOW, limit: SIGNUP_REFERRAL_CODE_JOB_PAGE_SIZE, cursorId: null },
			{ now: NOW, limit: SIGNUP_REFERRAL_CODE_JOB_PAGE_SIZE, cursorId: "user-expired" },
		]);
	});

	it("counts nothing for a user another run already served (skipped under the lock)", async () => {
		const codes = new ScriptedCodeMaintenance([["user-raced"], []], new Map([["user-raced", "skipped"]]));

		await expect(new MaintainSignupReferralCodesHandler(codes, CLOCK).execute(new MaintainSignupReferralCodesCommand(CODES_ACTOR))).resolves.toEqual({
			firstCodes: 0,
			successors: 0,
			failed: 0,
		});
	});

	it("carries on past one user's failure, then fails the run so it is audited as failed", async () => {
		const codes = new ScriptedCodeMaintenance(
			[["user-broken", "user-ok"], []],
			new Map<string, "first" | Error>([
				["user-broken", new Error("allocation failed")],
				["user-ok", "first"],
			]),
		);

		await expect(new MaintainSignupReferralCodesHandler(codes, CLOCK).execute(new MaintainSignupReferralCodesCommand(CODES_ACTOR))).rejects.toMatchObject({
			name: "SignupReferralJobItemsFailedError",
			failed: 1,
			firstFailure: new Error("allocation failed"),
		});
		expect(codes.issued).toEqual(["user-broken", "user-ok"]);
	});
});
