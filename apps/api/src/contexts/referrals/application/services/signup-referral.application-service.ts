import { Inject, Injectable } from "@nestjs/common";
import { AuthClientTypeSchema } from "@workspace/shared";

import { CLOCK, type Clock } from "../../../../platform/application/clock.port";
import { evaluateSignupReferralCode } from "../../domain/policies/signup-referral-code-validity.policy";
import { normalizeSignupReferralCodeInput } from "../../domain/value-objects/signup-referral-code.value-object";
import { SignupReferralCodeError, SignupReferralCodeNotAcceptedError } from "../errors/signup-referral.errors";
import type { AcceptedSignupReferral, SignupReferralPort, SignupReferralSummary } from "../ports/signup-referral.port";
import type { SignupReferralReadPort } from "../ports/signup-referral-read.port";
import { SIGNUP_REFERRAL_READS } from "../ports/referrals.tokens";

/** The client type whose signup form asks for a referral code (ADR 035, "Who receives a code"). */
const REFERRAL_CODE_CLIENT_TYPE = AuthClientTypeSchema.enum.web;

/** {@link SignupReferralPort}: what identity's signup and admin user list need from referrals, outside any transaction. */
@Injectable()
export class SignupReferralApplicationService implements SignupReferralPort {
	public constructor(
		@Inject(SIGNUP_REFERRAL_READS) private readonly reads: SignupReferralReadPort,
		@Inject(CLOCK) private readonly clock: Clock,
	) {}

	/**
	 * Validate the submitted code before the taken-email check, so a bad code is never disguised as a
	 * successful registration (ADR 035, "Validity"). `clientType` is the request's `X-Client-Type`
	 * (absent means web). Only consumer web signup may carry a code.
	 */
	public async acceptCodeForSignup(raw: string | null | undefined, clientType: string | undefined): Promise<AcceptedSignupReferral | null> {
		const normalized = normalizeSignupReferralCodeInput(raw);
		if (normalized.kind === "empty") {
			return null;
		}
		if (AuthClientTypeSchema.safeParse(clientType ?? REFERRAL_CODE_CLIENT_TYPE).data !== REFERRAL_CODE_CLIENT_TYPE) {
			throw new SignupReferralCodeNotAcceptedError();
		}
		if (normalized.kind === "invalid_shape") {
			throw new SignupReferralCodeError("unrecognized");
		}
		const validity = evaluateSignupReferralCode(await this.reads.findCodeForValidation(normalized.canonical), this.clock.now());
		if (validity.kind === "rejected") {
			throw new SignupReferralCodeError(validity.rejection);
		}
		return { canonical: normalized.canonical, referrerUserId: validity.referrerUserId, referralCodeId: validity.referralCodeId };
	}

	public summariesForReferees(refereeUserIds: readonly string[]): Promise<ReadonlyMap<string, SignupReferralSummary>> {
		return refereeUserIds.length === 0 ? Promise.resolve(new Map()) : this.reads.summariesForReferees(refereeUserIds);
	}

	public async summaryForReferee(refereeUserId: string): Promise<SignupReferralSummary | null> {
		return (await this.summariesForReferees([refereeUserId])).get(refereeUserId) ?? null;
	}
}
