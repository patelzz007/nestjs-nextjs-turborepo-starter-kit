import { describe, expect, it } from "vitest";
import { epochMs, SIGNUP_REFERRAL_CODE_TTL_MS } from "@workspace/shared";

import { FixedClock } from "../../../../platform/application/__tests__/fixed-clock";
import type { SignupReferralCodeForValidation } from "../../domain/policies/signup-referral-code-validity.policy";
import { SignupReferralCodeNotAcceptedError } from "../errors/signup-referral.errors";
import type { AcceptedSignupReferral, SignupReferralSummary } from "../ports/signup-referral.port";
import { SignupReferralApplicationService } from "../services/signup-referral.application-service";
import { InMemorySignupReferralReads } from "./fakes/referrals.fakes";

const NOW = epochMs(1_800_000_000_000);
const OWNER_ID = "owner-a";
const CODE_ID = "code-a";
const ACCEPTED: AcceptedSignupReferral = { canonical: "AB23CD45", referrerUserId: OWNER_ID, referralCodeId: CODE_ID };

function codeRow(owner: Partial<SignupReferralCodeForValidation["owner"]> = {}): SignupReferralCodeForValidation {
	return {
		id: CODE_ID,
		userId: OWNER_ID,
		expiresAt: BigInt(NOW + SIGNUP_REFERRAL_CODE_TTL_MS),
		isDeleted: false,
		owner: { isDeleted: false, isActive: true, latestCodeId: CODE_ID, ...owner },
	};
}

function service(reads: InMemorySignupReferralReads): SignupReferralApplicationService {
	return new SignupReferralApplicationService(reads, new FixedClock(NOW));
}

describe("SignupReferralApplicationService.acceptCodeForSignup", () => {
	it("treats an omitted, null or blank code as no referral without reading the database", async () => {
		const reads = new InMemorySignupReferralReads();

		await expect(service(reads).acceptCodeForSignup(undefined, "web")).resolves.toBeNull();
		await expect(service(reads).acceptCodeForSignup(null, "mobile")).resolves.toBeNull();
		await expect(service(reads).acceptCodeForSignup("   ", "merchant")).resolves.toBeNull();
		expect(reads.validations).toEqual([]);
	});

	it("accepts a folded, trimmed code of an active owner from consumer web signup (and from a request with no client type)", async () => {
		const reads = new InMemorySignupReferralReads(new Map([["AB23CD45", codeRow()]]));

		await expect(service(reads).acceptCodeForSignup(" ab23cd45 ", "web")).resolves.toEqual(ACCEPTED);
		await expect(service(reads).acceptCodeForSignup("AB23CD45", undefined)).resolves.toEqual(ACCEPTED);
		expect(reads.validations).toEqual(["AB23CD45", "AB23CD45"]);
	});

	it("refuses a code from mobile, merchant or an unknown client type", async () => {
		const reads = new InMemorySignupReferralReads(new Map([["AB23CD45", codeRow()]]));

		await expect(service(reads).acceptCodeForSignup("AB23CD45", "mobile")).rejects.toBeInstanceOf(SignupReferralCodeNotAcceptedError);
		await expect(service(reads).acceptCodeForSignup("AB23CD45", "merchant")).rejects.toBeInstanceOf(SignupReferralCodeNotAcceptedError);
		await expect(service(reads).acceptCodeForSignup("AB23CD45", "something-else")).rejects.toBeInstanceOf(SignupReferralCodeNotAcceptedError);
		expect(reads.validations).toEqual([]);
	});

	it("answers a malformed code as unrecognized without reading the database", async () => {
		const reads = new InMemorySignupReferralReads();

		await expect(service(reads).acceptCodeForSignup("AB23OD45", "web")).rejects.toMatchObject({ code: "REFERRAL_CODE_UNRECOGNIZED" });
		expect(reads.validations).toEqual([]);
	});

	it("maps each validity rejection to its error code", async () => {
		await expect(service(new InMemorySignupReferralReads()).acceptCodeForSignup("ZZZZZZZZ", "web")).rejects.toMatchObject({ code: "REFERRAL_CODE_UNRECOGNIZED" });
		await expect(
			service(new InMemorySignupReferralReads(new Map([["AB23CD45", codeRow({ latestCodeId: "code-newer" })]]))).acceptCodeForSignup("AB23CD45", "web"),
		).rejects.toMatchObject({ code: "REFERRAL_CODE_EXPIRED" });
		await expect(service(new InMemorySignupReferralReads(new Map([["AB23CD45", codeRow({ isActive: false })]]))).acceptCodeForSignup("AB23CD45", "web")).rejects.toMatchObject(
			{ code: "REFERRAL_CODE_UNAVAILABLE" },
		);
	});
});

describe("SignupReferralApplicationService summaries", () => {
	const SUMMARY: SignupReferralSummary = { referrer: { id: OWNER_ID, fullName: "Alice" }, status: "redeemed" };

	it("reads a whole page of referees in one batched lookup", async () => {
		const reads = new InMemorySignupReferralReads(new Map(), new Map([["referee-1", SUMMARY]]));

		const summaries = await service(reads).summariesForReferees(["referee-1", "referee-2"]);

		expect([...summaries]).toEqual([["referee-1", SUMMARY]]);
		expect(reads.summaryLookups).toEqual([["referee-1", "referee-2"]]);
	});

	it("skips the read for an empty page, and answers null for a referee with no signup referral", async () => {
		const reads = new InMemorySignupReferralReads(new Map(), new Map([["referee-1", SUMMARY]]));

		await expect(service(reads).summariesForReferees([])).resolves.toEqual(new Map());
		expect(reads.summaryLookups).toEqual([]);
		await expect(service(reads).summaryForReferee("referee-1")).resolves.toEqual(SUMMARY);
		await expect(service(reads).summaryForReferee("referee-2")).resolves.toBeNull();
	});
});
