import { Inject } from "@nestjs/common";
import { CommandHandler, type ICommandHandler } from "@nestjs/cqrs";
import type { TwoFactorSetupResponse } from "@workspace/shared";

import { CLOCK, type Clock } from "../../../../../platform/application/clock.port";
import type { UnitOfWork } from "../../../../../platform/application/unit-of-work.port";
import type { TwoFactorEnrollment } from "../../../domain/aggregates/two-factor-enrollment.aggregate";
import type { UserAccount } from "../../../domain/aggregates/user-account.aggregate";
import { AccountNotFoundError } from "../../../domain/errors/identity.errors";
import type { IdentityScope } from "../../identity-scope";
import type { AuthenticatorPort, TotpSecretCipherPort } from "../../ports/authenticator.port";
import type { CredentialCryptoPort } from "../../ports/credential-crypto.port";
import type { IdentitySettings } from "../../ports/identity-settings.port";
import { AUTHENTICATOR, CREDENTIAL_CRYPTO, IDENTITY_SETTINGS, IDENTITY_UNIT_OF_WORK, TOTP_SECRET_CIPHER } from "../../ports/identity.tokens";
import { generateTwoFactorSetup } from "../../services/two-factor-setup.factory";
import { StartTwoFactorSetupCommand } from "./start-two-factor-setup.command";

@CommandHandler(StartTwoFactorSetupCommand)
export class StartTwoFactorSetupHandler implements ICommandHandler<StartTwoFactorSetupCommand, TwoFactorSetupResponse> {
	public constructor(
		@Inject(IDENTITY_UNIT_OF_WORK) private readonly uow: UnitOfWork<IdentityScope>,
		@Inject(AUTHENTICATOR) private readonly authenticator: AuthenticatorPort,
		@Inject(TOTP_SECRET_CIPHER) private readonly cipher: TotpSecretCipherPort,
		@Inject(CREDENTIAL_CRYPTO) private readonly crypto: CredentialCryptoPort,
		@Inject(IDENTITY_SETTINGS) private readonly settings: IdentitySettings,
		@Inject(CLOCK) private readonly clock: Clock,
	) {}

	public async execute(command: StartTwoFactorSetupCommand): Promise<TwoFactorSetupResponse> {
		const { actor, input } = command;
		return this.uow.run(actor, async (scope: IdentityScope): Promise<TwoFactorSetupResponse> => {
			const account: UserAccount | null = await scope.accounts.findById(input.userId);
			const enrollment: TwoFactorEnrollment | null = await scope.twoFactor.findByUserId(input.userId);
			if (account === null || enrollment === null) {
				throw new AccountNotFoundError();
			}
			const setup = await generateTwoFactorSetup(
				{ authenticator: this.authenticator, cipher: this.cipher, crypto: this.crypto },
				{ issuer: this.settings.twoFactorIssuer, email: account.email.value },
			);
			enrollment.startSetup(setup.encryptedSecret, setup.backupCodeHashes, this.clock.now());
			await scope.twoFactor.save(enrollment);
			return setup.response;
		});
	}
}
