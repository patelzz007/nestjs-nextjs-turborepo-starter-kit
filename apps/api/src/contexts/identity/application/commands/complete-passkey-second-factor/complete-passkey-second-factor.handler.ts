import { Inject } from "@nestjs/common";
import { CommandHandler, type ICommandHandler } from "@nestjs/cqrs";
import type { EpochMs, LoginRestrictedEnrollmentResponse, LoginServiceResponse, LoginVerificationPendingResponse } from "@workspace/shared";

import { CLOCK, type Clock } from "../../../../../platform/application/clock.port";
import type { UnitOfWork } from "../../../../../platform/application/unit-of-work.port";
import type { Passkey, PasskeyAssertion } from "../../../domain/aggregates/passkey.aggregate";
import type { WebAuthnChallenge } from "../../../domain/aggregates/web-authn-challenge.aggregate";
import { PasskeyChallengeInvalidError, PasskeyVerificationFailedError } from "../../../domain/errors/identity.errors";
import type { IdentityScope } from "../../identity-scope";
import type { CredentialCryptoPort } from "../../ports/credential-crypto.port";
import type { VerifiedChallengeRef } from "../../ports/identity-tokens.port";
import { CREDENTIAL_CRYPTO, IDENTITY_UNIT_OF_WORK, LOGIN_MFA_COMPLETE_OPERATION, WEB_AUTHN } from "../../ports/identity.tokens";
import type { CeremonyVerification, WebAuthnPort } from "../../ports/web-authn.port";
import { MfaLoginCompletion, type MfaLoginParts } from "../../services/mfa-login-completion";
import { challengeCheckOf, storedKeyOf } from "../../services/passkey-ceremony";
import { CompletePasskeySecondFactorCommand } from "./complete-passkey-second-factor.command";

type MfaLoginResult = LoginServiceResponse | LoginRestrictedEnrollmentResponse | LoginVerificationPendingResponse;

/**
 * Completes a password sign-in with a passkey (ADR 080). The WebAuthn challenge must belong to this very
 * login challenge and is spent whatever the outcome; the passkey must be the account's own; a signature
 * counter that did not move forward is refused. A failure counts against the login challenge like a wrong
 * TOTP code (its last allowed failure locks the account, D19); success consumes the login challenge by
 * compare-and-set (D13) and continues exactly like the TOTP path.
 */
@CommandHandler(CompletePasskeySecondFactorCommand)
export class CompletePasskeySecondFactorHandler implements ICommandHandler<CompletePasskeySecondFactorCommand, MfaLoginResult> {
	public constructor(
		@Inject(IDENTITY_UNIT_OF_WORK) private readonly uow: UnitOfWork<IdentityScope>,
		@Inject(WEB_AUTHN) private readonly webAuthn: WebAuthnPort,
		@Inject(CREDENTIAL_CRYPTO) private readonly crypto: CredentialCryptoPort,
		@Inject(CLOCK) private readonly clock: Clock,
		private readonly completion: MfaLoginCompletion,
	) {}

	public async execute(command: CompletePasskeySecondFactorCommand): Promise<MfaLoginResult> {
		const { actor, input } = command;
		const ref: VerifiedChallengeRef = await this.completion.verifyLoginRef(input.tempToken);
		const passed: boolean = await this.uow.runSystemOperation(LOGIN_MFA_COMPLETE_OPERATION, actor, async (scope: IdentityScope): Promise<boolean> => {
			const now: EpochMs = this.clock.now();
			const parts: MfaLoginParts = await this.completion.loadParts(scope, ref, now);
			const challenge: WebAuthnChallenge | null = await scope.webAuthnChallenges.findById(input.challengeId);
			if (challenge === null) {
				throw new PasskeyChallengeInvalidError();
			}
			challenge.consumeFor({ purpose: "SECOND_FACTOR", userId: parts.challenge.userId, loginChallengeId: parts.challenge.id }, now);
			await scope.webAuthnChallenges.saveConsumed(challenge);
			const passkey: Passkey | null = await scope.passkeys.findLiveByCredentialId(input.response.id);
			if (passkey === null || !passkey.isOwnedBy(parts.challenge.userId)) {
				return false;
			}
			const verification: CeremonyVerification<PasskeyAssertion> = await this.webAuthn.verifyAuthentication(
				input.response,
				storedKeyOf(passkey),
				challengeCheckOf(challenge, this.crypto),
			);
			if (!verification.verified || !passkey.acceptsCounter(verification.value.newCounter)) {
				return false;
			}
			passkey.recordUse(verification.value, now);
			await scope.passkeys.save(passkey);
			await this.completion.finish(scope, parts, now);
			return true;
		});
		if (!passed) {
			throw await this.completion.countWrongCode(actor, ref, new PasskeyVerificationFailedError());
		}
		return this.completion.continueLogin(actor, ref, "passkey", input.device);
	}
}
