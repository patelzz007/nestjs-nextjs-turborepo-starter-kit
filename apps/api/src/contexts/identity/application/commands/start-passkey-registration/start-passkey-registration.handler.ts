import { Inject } from "@nestjs/common";
import { CommandHandler, type ICommandHandler } from "@nestjs/cqrs";
import { MAX_PASSKEYS_PER_ACCOUNT, type PasskeyRegistrationOptions, type PasskeyRegistrationOptionsResponse } from "@workspace/shared";

import { CLOCK, type Clock } from "../../../../../platform/application/clock.port";
import type { UnitOfWork } from "../../../../../platform/application/unit-of-work.port";
import type { Passkey } from "../../../domain/aggregates/passkey.aggregate";
import type { UserAccount } from "../../../domain/aggregates/user-account.aggregate";
import { WebAuthnChallenge } from "../../../domain/aggregates/web-authn-challenge.aggregate";
import { AccountNotFoundError, PasskeyLimitReachedError, PasskeyPasswordIncorrectError } from "../../../domain/errors/identity.errors";
import type { IdentityScope } from "../../identity-scope";
import type { CredentialCryptoPort } from "../../ports/credential-crypto.port";
import type { IdGeneratorPort } from "../../ports/id-generator.port";
import { CREDENTIAL_CRYPTO, ID_GENERATOR, IDENTITY_UNIT_OF_WORK, WEB_AUTHN } from "../../ports/identity.tokens";
import type { WebAuthnPort } from "../../ports/web-authn.port";
import { assertPasskeyChangeAllowed, credentialRefOf } from "../../services/passkey-ceremony";
import { StartPasskeyRegistrationCommand } from "./start-passkey-registration.command";

/**
 * Starts adding a passkey (ADR 080). Adding a sign-in credential is a privileged change, so the password
 * is checked again (a stolen session alone cannot add a passkey and keep access); never during
 * impersonation. The account's own passkeys are excluded, so an authenticator cannot register twice.
 */
@CommandHandler(StartPasskeyRegistrationCommand)
export class StartPasskeyRegistrationHandler implements ICommandHandler<StartPasskeyRegistrationCommand, PasskeyRegistrationOptionsResponse> {
	public constructor(
		@Inject(IDENTITY_UNIT_OF_WORK) private readonly uow: UnitOfWork<IdentityScope>,
		@Inject(WEB_AUTHN) private readonly webAuthn: WebAuthnPort,
		@Inject(CREDENTIAL_CRYPTO) private readonly crypto: CredentialCryptoPort,
		@Inject(ID_GENERATOR) private readonly ids: IdGeneratorPort,
		@Inject(CLOCK) private readonly clock: Clock,
	) {}

	public async execute(command: StartPasskeyRegistrationCommand): Promise<PasskeyRegistrationOptionsResponse> {
		const { actor, input } = command;
		assertPasskeyChangeAllowed(actor);
		const account: UserAccount | null = await this.uow.run(actor, (scope: IdentityScope) => scope.accounts.findById(input.userId));
		if (account === null || !account.canSignIn()) {
			throw new AccountNotFoundError();
		}
		// bcrypt runs outside the transaction: no row is held while the hash is computed.
		if (!(await this.crypto.compare(input.password, account.passwordHash))) {
			throw new PasskeyPasswordIncorrectError();
		}
		return this.uow.run(actor, async (scope: IdentityScope): Promise<PasskeyRegistrationOptionsResponse> => {
			const passkeys: readonly Passkey[] = await scope.passkeys.listLive(account.id);
			if (passkeys.length >= MAX_PASSKEYS_PER_ACCOUNT) {
				throw new PasskeyLimitReachedError(MAX_PASSKEYS_PER_ACCOUNT);
			}
			const options: PasskeyRegistrationOptions = await this.webAuthn.registrationOptions(
				{ userId: account.id, userName: account.email.value, displayName: account.fullName },
				passkeys.map(credentialRefOf),
			);
			const challenge: WebAuthnChallenge = WebAuthnChallenge.forRegistration(
				{ id: this.ids.next(), userId: account.id, challengeHash: this.crypto.hashTokenDigest(options.challenge) },
				this.clock.now(),
			);
			await scope.webAuthnChallenges.add(challenge);
			return { challengeId: challenge.id, options };
		});
	}
}
