import { Inject, Logger } from "@nestjs/common";
import { CommandHandler, type ICommandHandler } from "@nestjs/cqrs";
import { MAX_PASSKEYS_PER_ACCOUNT, type EpochMs, type Passkey as PasskeyView } from "@workspace/shared";

import { CLOCK, type Clock } from "../../../../../platform/application/clock.port";
import type { UnitOfWork } from "../../../../../platform/application/unit-of-work.port";
import { Passkey, type VerifiedPasskeyCredential } from "../../../domain/aggregates/passkey.aggregate";
import type { UserAccount } from "../../../domain/aggregates/user-account.aggregate";
import type { WebAuthnChallenge } from "../../../domain/aggregates/web-authn-challenge.aggregate";
import { PasskeyChallengeInvalidError, PasskeyLimitReachedError, PasskeyVerificationFailedError } from "../../../domain/errors/identity.errors";
import type { IdentityScope } from "../../identity-scope";
import type { CredentialCryptoPort } from "../../ports/credential-crypto.port";
import type { IdGeneratorPort } from "../../ports/id-generator.port";
import { CREDENTIAL_CRYPTO, ID_GENERATOR, IDENTITY_UNIT_OF_WORK, WEB_AUTHN } from "../../ports/identity.tokens";
import type { CeremonyVerification, WebAuthnPort } from "../../ports/web-authn.port";
import { assertPasskeyChangeAllowed, challengeCheckOf, toPasskeyView } from "../../services/passkey-ceremony";
import { CompletePasskeyRegistrationCommand } from "./complete-passkey-registration.command";

/**
 * Finishes adding a passkey (ADR 080). The challenge is consumed by compare-and-set whether or not the
 * response verifies (a challenge is never tried twice), the credential id stays unique for ever, and the
 * owner is emailed that a new sign-in credential exists (NIST SP 800-63B §6.1.2.1) in the same transaction.
 */
@CommandHandler(CompletePasskeyRegistrationCommand)
export class CompletePasskeyRegistrationHandler implements ICommandHandler<CompletePasskeyRegistrationCommand, PasskeyView> {
	private readonly logger: Logger = new Logger(CompletePasskeyRegistrationHandler.name);

	public constructor(
		@Inject(IDENTITY_UNIT_OF_WORK) private readonly uow: UnitOfWork<IdentityScope>,
		@Inject(WEB_AUTHN) private readonly webAuthn: WebAuthnPort,
		@Inject(CREDENTIAL_CRYPTO) private readonly crypto: CredentialCryptoPort,
		@Inject(ID_GENERATOR) private readonly ids: IdGeneratorPort,
		@Inject(CLOCK) private readonly clock: Clock,
	) {}

	public async execute(command: CompletePasskeyRegistrationCommand): Promise<PasskeyView> {
		const { actor, input } = command;
		assertPasskeyChangeAllowed(actor);
		const registered: Passkey | null = await this.uow.run(actor, async (scope: IdentityScope): Promise<Passkey | null> => {
			const now: EpochMs = this.clock.now();
			const challenge: WebAuthnChallenge | null = await scope.webAuthnChallenges.findById(input.challengeId);
			if (challenge === null) {
				throw new PasskeyChallengeInvalidError();
			}
			challenge.consumeFor({ purpose: "REGISTRATION", userId: input.userId }, now);
			await scope.webAuthnChallenges.saveConsumed(challenge);
			const verification: CeremonyVerification<VerifiedPasskeyCredential> = await this.webAuthn.verifyRegistration(input.response, challengeCheckOf(challenge, this.crypto));
			if (!verification.verified) {
				return null;
			}
			if ((await scope.passkeys.countLive(input.userId)) >= MAX_PASSKEYS_PER_ACCOUNT) {
				throw new PasskeyLimitReachedError(MAX_PASSKEYS_PER_ACCOUNT);
			}
			const passkey: Passkey = Passkey.register({ id: this.ids.next(), userId: input.userId, name: input.name, credential: verification.value }, now);
			await scope.passkeys.add(passkey);
			const account: UserAccount | null = await scope.accounts.findById(input.userId);
			if (account !== null) {
				await scope.emails.sendPasskeyAddedEmail(account.email.value, passkey.name);
			}
			return passkey;
		});
		if (registered === null) {
			throw new PasskeyVerificationFailedError();
		}
		this.logger.log({ event: "passkey.registered", userId: input.userId, passkeyId: registered.id });
		return toPasskeyView(registered);
	}
}
