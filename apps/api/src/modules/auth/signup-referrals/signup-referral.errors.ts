import { SignupReferralErrorCodeSchema, type SignupReferralErrorCode } from "@workspace/shared";

import { ValidationError } from "../../../common/errors/app-error";

/** Why a presented referral code was refused (ADR 035, "Validity"). */
export type SignupReferralCodeRejection = "unrecognized" | "expired" | "unavailable";

/** Path of the signup body field every referral-code error points at. */
const REFERRAL_CODE_FIELD = "referralCode";

const REJECTIONS: Readonly<Record<SignupReferralCodeRejection, { readonly code: SignupReferralErrorCode; readonly message: string }>> = {
	unrecognized: { code: SignupReferralErrorCodeSchema.enum.REFERRAL_CODE_UNRECOGNIZED, message: "That referral code is not recognized." },
	expired: { code: SignupReferralErrorCodeSchema.enum.REFERRAL_CODE_EXPIRED, message: "That referral code has expired." },
	unavailable: { code: SignupReferralErrorCodeSchema.enum.REFERRAL_CODE_UNAVAILABLE, message: "That referral code is unavailable." },
};

/**
 * 400 — the presented referral code is unrecognized, expired or unavailable.
 * Safe to answer even when the email is already registered: it describes the
 * code, never whether the email exists.
 */
export class SignupReferralCodeError extends ValidationError {
	public constructor(public readonly rejection: SignupReferralCodeRejection) {
		const { code, message } = REJECTIONS[rejection];
		super({ code, message, details: { issues: [{ path: REFERRAL_CODE_FIELD, message, code: rejection }] } });
	}
}

/**
 * 400 — a referral code arrived on a signup that is not consumer web signup.
 * Only the web form asks for one; mobile and merchant signup never accept it.
 */
export class SignupReferralCodeNotAcceptedError extends ValidationError {
	public constructor() {
		const message = "Referral codes are accepted only on consumer web signup.";
		super({ message, details: { issues: [{ path: REFERRAL_CODE_FIELD, message, code: "not_accepted" }] } });
	}
}

/** Every generated candidate collided with an existing code — a programming or capacity problem, never a client error. */
export class SignupReferralCodeAllocationError extends Error {
	public constructor(public readonly attempts: number) {
		super(`Could not allocate a unique signup referral code after ${String(attempts)} attempts`);
		this.name = "SignupReferralCodeAllocationError";
	}
}
