import { Inject, Injectable, Logger } from "@nestjs/common";
import type { EpochMs, LoginRestrictedEnrollmentResponse, LoginServiceResponse, LoginVerificationPendingResponse } from "@workspace/shared";

import type { ActorContext } from "../../../../platform/application/actor-context";
import { CLOCK, type Clock } from "../../../../platform/application/clock.port";
import type { UnitOfWork } from "../../../../platform/application/unit-of-work.port";
import type { TwoFactorEnrollment } from "../../domain/aggregates/two-factor-enrollment.aggregate";
import type { TwoFactorLoginChallenge } from "../../domain/aggregates/two-factor-login-challenge.aggregate";
import type { UserAccount } from "../../domain/aggregates/user-account.aggregate";
import { InvalidCredentialsError, MfaChallengeNotFoundError, MfaChallengePurposeMismatchError, TwoFactorNotEnabledForLoginError } from "../../domain/errors/identity.errors";
import type { FailedChallengeAttempt } from "../../domain/repositories/two-factor.repository";
import type { SessionDeviceContext } from "../../domain/value-objects/session-device.value-object";
import type { IdentityScope } from "../identity-scope";
import type { IdentityTokensPort, VerifiedChallengeRef } from "../ports/identity-tokens.port";
import { IDENTITY_TOKENS, IDENTITY_UNIT_OF_WORK, PUBLIC_AUTH_FLOW_OPERATION } from "../ports/identity.tokens";
import { LoginVerificationGate } from "./login-verification.gate";
import type { PendingSignInMethod } from "./pending-sign-in";

type MfaLoginResult = LoginServiceResponse | LoginRestrictedEnrollmentResponse | LoginVerificationPendingResponse;

/** The second factor that completed a login challenge. */
export type MfaLoginMethod = "totp" | "backup_code";

const MFA_LOGIN_SIGN_IN_METHOD: Readonly<Record<MfaLoginMethod, PendingSignInMethod>> = {
	totp: "PASSWORD_TOTP",
	backup_code: "PASSWORD_BACKUP_CODE",
};

/** What one completion loaded in its transaction. */
export interface MfaLoginParts {
	readonly challenge: TwoFactorLoginChallenge;
	readonly enrollment: TwoFactorEnrollment;
	readonly account: UserAccount;
}

/**
 * The steps every second-factor login completion shares: verifying the challenge reference, loading
 * the open challenge, counting a wrong code, and — once the factor passed — consuming the challenge
 * by compare-and-set (D13), resetting the lockout, stamping the MFA assurance, then login verification.
 */
@Injectable()
export class MfaLoginCompletion {
	private readonly logger: Logger = new Logger(MfaLoginCompletion.name);

	public constructor(
		@Inject(IDENTITY_UNIT_OF_WORK) private readonly uow: UnitOfWork<IdentityScope>,
		@Inject(IDENTITY_TOKENS) private readonly tokens: IdentityTokensPort,
		@Inject(CLOCK) private readonly clock: Clock,
		private readonly verification: LoginVerificationGate,
	) {}

	/** A verified LOGIN challenge reference. */
	public async verifyLoginRef(tempToken: string): Promise<VerifiedChallengeRef> {
		const ref: VerifiedChallengeRef = await this.tokens.verifyChallengeRef(tempToken);
		if (ref.purpose !== "LOGIN") {
			throw new MfaChallengePurposeMismatchError();
		}
		return ref;
	}

	/** Loads the open challenge, the enrollment and the account (in the caller's transaction). */
	public async loadParts(scope: IdentityScope, ref: VerifiedChallengeRef, now: EpochMs): Promise<MfaLoginParts> {
		const challenge: TwoFactorLoginChallenge | null = await scope.challenges.findById(ref.challengeId);
		if (challenge === null) {
			throw new MfaChallengeNotFoundError();
		}
		challenge.assertActiveAt(now);
		const enrollment: TwoFactorEnrollment | null = await scope.twoFactor.findByUserId(challenge.userId);
		const account: UserAccount | null = await scope.accounts.findById(challenge.userId);
		if (enrollment === null || account === null) {
			throw new TwoFactorNotEnabledForLoginError();
		}
		return { challenge, enrollment, account };
	}

	/**
	 * Counts a wrong TOTP code on the challenge (one conditional increment). The last allowed failure
	 * consumes the challenge and counts a failed sign-in on the account (D19), which answers
	 * `INVALID_CREDENTIALS`; any other failure answers with `refusal`. Returns the error the caller throws.
	 */
	public async countWrongCode(actor: ActorContext, ref: VerifiedChallengeRef, refusal: Error): Promise<Error> {
		const exhausted: boolean = await this.uow.runSystemOperation(PUBLIC_AUTH_FLOW_OPERATION, actor, async (scope: IdentityScope): Promise<boolean> => {
			const now: EpochMs = this.clock.now();
			const attempt: FailedChallengeAttempt = await scope.challenges.recordFailedAttempt(ref.challengeId, now);
			const challenge: TwoFactorLoginChallenge | null = await scope.challenges.findById(ref.challengeId);
			if (challenge === null) {
				throw new MfaChallengeNotFoundError();
			}
			if (attempt === null) {
				challenge.assertActiveAt(now);
				return false;
			}
			if (!challenge.isExhaustedBy(attempt.attemptCount)) {
				return false;
			}
			challenge.consume(now);
			await scope.challenges.saveConsumed(challenge);
			const outcome = await scope.accounts.recordFailedSignIn(challenge.userId, now);
			const account: UserAccount | null = await scope.accounts.findById(challenge.userId);
			if (outcome?.lockedNow === true && outcome.state.lockedUntil !== null && account !== null) {
				await scope.emails.sendAccountLockedEmail(account.email.value, outcome.state.lockedUntil);
			}
			return true;
		});
		this.logger.log({ event: "mfa.challenge.fail", userId: ref.userId, challengeId: ref.challengeId });
		return exhausted ? new InvalidCredentialsError() : refusal;
	}

	/** The factor passed (the caller already recorded its own write on the enrollment): consume, reset, assure — in the caller's transaction. */
	public async finish(scope: IdentityScope, parts: MfaLoginParts, now: EpochMs): Promise<void> {
		parts.challenge.consume(now);
		await scope.challenges.saveConsumed(parts.challenge);
		await scope.twoFactor.save(parts.enrollment);
		await scope.accounts.resetLockout(parts.account.id, now);
		parts.account.recordMfaAssurance(now);
		await scope.accounts.save(parts.account);
	}

	/** After commit: login verification, then the session (stored for `device`, the request presenting the factor). */
	public async continueLogin(actor: ActorContext, ref: VerifiedChallengeRef, method: MfaLoginMethod, device: SessionDeviceContext): Promise<MfaLoginResult> {
		this.logger.log({ event: "mfa.challenge.success", userId: ref.userId, challengeId: ref.challengeId, method });
		return this.verification.continueLogin(actor, {
			userId: ref.userId,
			clientType: ref.clientType,
			deviceInfo: ref.deviceInfo,
			ipAddress: ref.ipAddress,
			signInMethod: MFA_LOGIN_SIGN_IN_METHOD[method],
			device,
			mfaAssured: true,
		});
	}
}
