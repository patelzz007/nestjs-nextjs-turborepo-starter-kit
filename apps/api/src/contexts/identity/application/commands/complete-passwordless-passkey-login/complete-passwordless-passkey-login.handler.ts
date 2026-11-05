import { Inject, Logger } from "@nestjs/common";
import { CommandHandler, type ICommandHandler } from "@nestjs/cqrs";
import type { EpochMs, LoginRestrictedEnrollmentResponse, LoginServiceResponse, LoginVerificationPendingResponse } from "@workspace/shared";

import { CLOCK, type Clock } from "../../../../../platform/application/clock.port";
import { USER_GRANTS_READ, type UserGrantsReadPort } from "../../../../../platform/application/ports/authorization.port";
import type { UnitOfWork } from "../../../../../platform/application/unit-of-work.port";
import type { Passkey, PasskeyAssertion } from "../../../domain/aggregates/passkey.aggregate";
import type { UserAccount } from "../../../domain/aggregates/user-account.aggregate";
import type { WebAuthnChallenge } from "../../../domain/aggregates/web-authn-challenge.aggregate";
import { PasskeyChallengeInvalidError, PasskeyVerificationFailedError } from "../../../domain/errors/identity.errors";
import type { IdentityScope } from "../../identity-scope";
import type { AuthFlowSubjectPort } from "../../ports/auth-flow.port";
import type { CredentialCryptoPort } from "../../ports/credential-crypto.port";
import { AUTH_FLOW_SUBJECT, CREDENTIAL_CRYPTO, IDENTITY_UNIT_OF_WORK, PASSKEY_SIGN_IN_OPERATION, WEB_AUTHN } from "../../ports/identity.tokens";
import type { CeremonyVerification, WebAuthnPort } from "../../ports/web-authn.port";
import { assertAdminPanelSignIn } from "../../services/admin-panel-sign-in";
import { LoginVerificationGate } from "../../services/login-verification.gate";
import { challengeCheckOf, storedKeyOf } from "../../services/passkey-ceremony";
import { CompletePasswordlessPasskeyLoginCommand } from "./complete-passwordless-passkey-login.command";

type LoginResult = LoginServiceResponse | LoginRestrictedEnrollmentResponse | LoginVerificationPendingResponse;

/**
 * A passwordless sign-in (ADR 080). A user-verified passkey proves possession of the private key and the
 * person's PIN or biometric, so it is a complete multi-factor sign-in on its own: the session carries a
 * fresh MFA assurance and the TOTP step is not asked for. The single-use challenge is spent whatever the
 * outcome; the authenticator's user handle (when sent) must name the passkey's account; a locked, inactive
 * or deleted account is refused; every refusal is the same `PasskeyVerificationFailedError` (no account
 * probing). A failed assertion does not count towards the account lockout: credential ids are not
 * secret, so anyone could otherwise lock an account out (per-IP rate limits bound the attempts instead).
 * The admin panel's gate and login verification apply exactly as after a password.
 */
@CommandHandler(CompletePasswordlessPasskeyLoginCommand)
export class CompletePasswordlessPasskeyLoginHandler implements ICommandHandler<CompletePasswordlessPasskeyLoginCommand, LoginResult> {
	private readonly logger: Logger = new Logger(CompletePasswordlessPasskeyLoginHandler.name);

	public constructor(
		@Inject(IDENTITY_UNIT_OF_WORK) private readonly uow: UnitOfWork<IdentityScope>,
		@Inject(WEB_AUTHN) private readonly webAuthn: WebAuthnPort,
		@Inject(CREDENTIAL_CRYPTO) private readonly crypto: CredentialCryptoPort,
		@Inject(USER_GRANTS_READ) private readonly grants: UserGrantsReadPort,
		@Inject(AUTH_FLOW_SUBJECT) private readonly flowSubject: AuthFlowSubjectPort,
		@Inject(CLOCK) private readonly clock: Clock,
		private readonly verification: LoginVerificationGate,
	) {}

	public async execute(command: CompletePasswordlessPasskeyLoginCommand): Promise<LoginResult> {
		const { actor, input } = command;
		const account: UserAccount | null = await this.uow.runSystemOperation(PASSKEY_SIGN_IN_OPERATION, actor, async (scope: IdentityScope): Promise<UserAccount | null> => {
			const now: EpochMs = this.clock.now();
			const challenge: WebAuthnChallenge | null = await scope.webAuthnChallenges.findById(input.challengeId);
			if (challenge === null) {
				throw new PasskeyChallengeInvalidError();
			}
			challenge.consumeFor({ purpose: "PASSWORDLESS" }, now);
			await scope.webAuthnChallenges.saveConsumed(challenge);
			const passkey: Passkey | null = await scope.passkeys.findLiveByCredentialId(input.response.id);
			if (passkey === null) {
				return null;
			}
			const { userHandle } = input.response.response;
			if (userHandle !== undefined && userHandle !== this.webAuthn.userHandleOf(passkey.userId)) {
				return null;
			}
			const owner: UserAccount | null = await scope.accounts.findById(passkey.userId);
			if (owner === null || !owner.canSignIn() || owner.lockout.isLockedAt(now)) {
				return null;
			}
			const assertion: CeremonyVerification<PasskeyAssertion> = await this.webAuthn.verifyAuthentication(
				input.response,
				storedKeyOf(passkey),
				challengeCheckOf(challenge, this.crypto),
			);
			if (!assertion.verified || !passkey.acceptsCounter(assertion.value.newCounter)) {
				return null;
			}
			passkey.recordUse(assertion.value, now);
			await scope.passkeys.save(passkey);
			await scope.accounts.resetLockout(owner.id, now);
			owner.recordMfaAssurance(now);
			await scope.accounts.save(owner);
			return owner;
		});
		if (account === null) {
			this.logger.warn({ event: "passkey.sign_in.rejected", challengeId: input.challengeId });
			throw new PasskeyVerificationFailedError();
		}
		this.flowSubject.identify(account.id);
		await assertAdminPanelSignIn(input.clientType, account, this.grants);
		return this.verification.continueLogin(actor, {
			userId: account.id,
			clientType: input.clientType ?? null,
			deviceInfo: input.device.userAgent,
			ipAddress: input.device.ipAddress,
			signInMethod: "PASSKEY",
			device: input.device,
			mfaAssured: true,
			isLoadTestUser: account.isLoadTestUser,
		});
	}
}
