import { Inject } from "@nestjs/common";
import { CommandHandler, type ICommandHandler } from "@nestjs/cqrs";
import type { EpochMs, PasskeyAuthenticationOptions, PasskeyAuthenticationOptionsResponse } from "@workspace/shared";

import { CLOCK, type Clock } from "../../../../../platform/application/clock.port";
import type { UnitOfWork } from "../../../../../platform/application/unit-of-work.port";
import type { Passkey } from "../../../domain/aggregates/passkey.aggregate";
import type { TwoFactorLoginChallenge } from "../../../domain/aggregates/two-factor-login-challenge.aggregate";
import { WebAuthnChallenge } from "../../../domain/aggregates/web-authn-challenge.aggregate";
import { MfaChallengeNotFoundError, NoPasskeyRegisteredError } from "../../../domain/errors/identity.errors";
import type { IdentityScope } from "../../identity-scope";
import type { CredentialCryptoPort } from "../../ports/credential-crypto.port";
import type { IdGeneratorPort } from "../../ports/id-generator.port";
import type { VerifiedChallengeRef } from "../../ports/identity-tokens.port";
import { CREDENTIAL_CRYPTO, ID_GENERATOR, IDENTITY_UNIT_OF_WORK, LOGIN_PASSKEY_OPTIONS_OPERATION, WEB_AUTHN } from "../../ports/identity.tokens";
import type { WebAuthnPort } from "../../ports/web-authn.port";
import { MfaLoginCompletion } from "../../services/mfa-login-completion";
import { credentialRefOf } from "../../services/passkey-ceremony";
import { StartPasskeySecondFactorCommand } from "./start-passkey-second-factor.command";

/**
 * The options of a passkey second factor (ADR 080): only for an open LOGIN challenge, naming the account's
 * own passkeys (`allowCredentials`), with a single-use WebAuthn challenge bound to that login challenge.
 */
@CommandHandler(StartPasskeySecondFactorCommand)
export class StartPasskeySecondFactorHandler implements ICommandHandler<StartPasskeySecondFactorCommand, PasskeyAuthenticationOptionsResponse> {
	public constructor(
		@Inject(IDENTITY_UNIT_OF_WORK) private readonly uow: UnitOfWork<IdentityScope>,
		@Inject(WEB_AUTHN) private readonly webAuthn: WebAuthnPort,
		@Inject(CREDENTIAL_CRYPTO) private readonly crypto: CredentialCryptoPort,
		@Inject(ID_GENERATOR) private readonly ids: IdGeneratorPort,
		@Inject(CLOCK) private readonly clock: Clock,
		private readonly completion: MfaLoginCompletion,
	) {}

	public async execute(command: StartPasskeySecondFactorCommand): Promise<PasskeyAuthenticationOptionsResponse> {
		const { actor, input } = command;
		const ref: VerifiedChallengeRef = await this.completion.verifyLoginRef(input.tempToken);
		return this.uow.runSystemOperation(LOGIN_PASSKEY_OPTIONS_OPERATION, actor, async (scope: IdentityScope): Promise<PasskeyAuthenticationOptionsResponse> => {
			const now: EpochMs = this.clock.now();
			const login: TwoFactorLoginChallenge | null = await scope.challenges.findById(ref.challengeId);
			if (login === null) {
				throw new MfaChallengeNotFoundError();
			}
			login.assertActiveAt(now);
			const passkeys: readonly Passkey[] = await scope.passkeys.listLive(login.userId);
			if (passkeys.length === 0) {
				throw new NoPasskeyRegisteredError();
			}
			const options: PasskeyAuthenticationOptions = await this.webAuthn.authenticationOptions(passkeys.map(credentialRefOf));
			const challenge: WebAuthnChallenge = WebAuthnChallenge.forSecondFactor(
				{ id: this.ids.next(), userId: login.userId, loginChallengeId: login.id, challengeHash: this.crypto.hashTokenDigest(options.challenge) },
				now,
			);
			await scope.webAuthnChallenges.add(challenge);
			return { challengeId: challenge.id, options };
		});
	}
}
