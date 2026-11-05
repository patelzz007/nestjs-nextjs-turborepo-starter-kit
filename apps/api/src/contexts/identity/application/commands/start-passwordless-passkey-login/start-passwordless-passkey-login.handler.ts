import { Inject } from "@nestjs/common";
import { CommandHandler, type ICommandHandler } from "@nestjs/cqrs";
import type { PasskeyAuthenticationOptions, PasskeyAuthenticationOptionsResponse } from "@workspace/shared";

import { CLOCK, type Clock } from "../../../../../platform/application/clock.port";
import type { UnitOfWork } from "../../../../../platform/application/unit-of-work.port";
import { WebAuthnChallenge } from "../../../domain/aggregates/web-authn-challenge.aggregate";
import type { IdentityScope } from "../../identity-scope";
import type { CredentialCryptoPort } from "../../ports/credential-crypto.port";
import type { IdGeneratorPort } from "../../ports/id-generator.port";
import { CREDENTIAL_CRYPTO, ID_GENERATOR, IDENTITY_UNIT_OF_WORK, PASSKEY_SIGN_IN_OPTIONS_OPERATION, WEB_AUTHN } from "../../ports/identity.tokens";
import type { WebAuthnPort } from "../../ports/web-authn.port";
import { StartPasswordlessPasskeyLoginCommand } from "./start-passwordless-passkey-login.command";

/**
 * The options of a passwordless sign-in (ADR 080): an empty `allowCredentials`, so the browser offers any
 * discoverable passkey of this RP ID and nothing reveals whether an account exists. The challenge is
 * stored without an account; the passkey that answers names it.
 */
@CommandHandler(StartPasswordlessPasskeyLoginCommand)
export class StartPasswordlessPasskeyLoginHandler implements ICommandHandler<StartPasswordlessPasskeyLoginCommand, PasskeyAuthenticationOptionsResponse> {
	public constructor(
		@Inject(IDENTITY_UNIT_OF_WORK) private readonly uow: UnitOfWork<IdentityScope>,
		@Inject(WEB_AUTHN) private readonly webAuthn: WebAuthnPort,
		@Inject(CREDENTIAL_CRYPTO) private readonly crypto: CredentialCryptoPort,
		@Inject(ID_GENERATOR) private readonly ids: IdGeneratorPort,
		@Inject(CLOCK) private readonly clock: Clock,
	) {}

	public async execute(command: StartPasswordlessPasskeyLoginCommand): Promise<PasskeyAuthenticationOptionsResponse> {
		const options: PasskeyAuthenticationOptions = await this.webAuthn.authenticationOptions([]);
		const challenge: WebAuthnChallenge = WebAuthnChallenge.forPasswordless(
			{ id: this.ids.next(), challengeHash: this.crypto.hashTokenDigest(options.challenge) },
			this.clock.now(),
		);
		await this.uow.runSystemOperation(PASSKEY_SIGN_IN_OPTIONS_OPERATION, command.actor, (scope: IdentityScope) => scope.webAuthnChallenges.add(challenge));
		return { challengeId: challenge.id, options };
	}
}
