import { Inject, Logger } from "@nestjs/common";
import { CommandHandler, type ICommandHandler } from "@nestjs/cqrs";
import type { EpochMs, TwoFactorSetupResponse } from "@workspace/shared";

import { CLOCK, type Clock } from "../../../../../platform/application/clock.port";
import type { UnitOfWork } from "../../../../../platform/application/unit-of-work.port";
import type { RotationSecondFactor, TwoFactorEnrollment } from "../../../domain/aggregates/two-factor-enrollment.aggregate";
import type { UserAccount } from "../../../domain/aggregates/user-account.aggregate";
import { AccountNotFoundError } from "../../../domain/errors/identity.errors";
import type { IdentityScope } from "../../identity-scope";
import type { AuthenticatorPort, TotpSecretCipherPort } from "../../ports/authenticator.port";
import type { CredentialCryptoPort } from "../../ports/credential-crypto.port";
import type { IdentitySettings } from "../../ports/identity-settings.port";
import { AUTHENTICATOR, CREDENTIAL_CRYPTO, IDENTITY_SETTINGS, IDENTITY_UNIT_OF_WORK, TOTP_SECRET_CIPHER } from "../../ports/identity.tokens";
import { findMatchingBackupCode, generateTwoFactorSetup } from "../../services/two-factor-setup.factory";
import { RotateTwoFactorCommand } from "./rotate-two-factor.command";

/**
 * Re-enrolls 2FA. D16 + D17 in ONE transaction: the backup-code proof is consumed by compare-and-set
 * (a reused code is refused), the old secret and codes are retired, `tokenVersion` moves, and the new
 * pending setup is stored. After commit the credential change is broadcast to every instance.
 */
@CommandHandler(RotateTwoFactorCommand)
export class RotateTwoFactorHandler implements ICommandHandler<RotateTwoFactorCommand, TwoFactorSetupResponse> {
	private readonly logger: Logger = new Logger(RotateTwoFactorHandler.name);

	public constructor(
		@Inject(IDENTITY_UNIT_OF_WORK) private readonly uow: UnitOfWork<IdentityScope>,
		@Inject(AUTHENTICATOR) private readonly authenticator: AuthenticatorPort,
		@Inject(TOTP_SECRET_CIPHER) private readonly cipher: TotpSecretCipherPort,
		@Inject(CREDENTIAL_CRYPTO) private readonly crypto: CredentialCryptoPort,
		@Inject(IDENTITY_SETTINGS) private readonly settings: IdentitySettings,
		@Inject(CLOCK) private readonly clock: Clock,
	) {}

	public async execute(command: RotateTwoFactorCommand): Promise<TwoFactorSetupResponse> {
		const { actor, input } = command;
		return this.uow.run(actor, async (scope: IdentityScope): Promise<TwoFactorSetupResponse> => {
			const now: EpochMs = this.clock.now();
			const account: UserAccount | null = await scope.accounts.findById(input.userId);
			const enrollment: TwoFactorEnrollment | null = await scope.twoFactor.findByUserId(input.userId);
			if (account === null || enrollment === null) {
				throw new AccountNotFoundError();
			}
			const passwordMatches: boolean = await this.crypto.compare(input.password, account.passwordHash);
			const proof: RotationSecondFactor = await this.secondFactorProof(enrollment, input.token, input.backupCode, passwordMatches);
			const setup = await generateTwoFactorSetup(
				{ authenticator: this.authenticator, cipher: this.cipher, crypto: this.crypto },
				{ issuer: this.settings.twoFactorIssuer, email: account.email.value },
			);
			enrollment.rotate(passwordMatches, proof, { secret: setup.encryptedSecret, backupCodeHashes: setup.backupCodeHashes }, now);
			await scope.twoFactor.save(enrollment);
			scope.events.collectFrom(enrollment);
			this.logger.log({ event: "mfa.rotation", userId: input.userId, verificationMethod: proof.kind });
			return setup.response;
		});
	}

	/** The rotation's second-factor proof. Skipped when the password is wrong (the rotation is refused for that first). */
	private async secondFactorProof(
		enrollment: TwoFactorEnrollment,
		token: string | undefined,
		backupCode: string | undefined,
		passwordMatches: boolean,
	): Promise<RotationSecondFactor> {
		if (token !== undefined) {
			if (!passwordMatches || !enrollment.enabled) {
				return { kind: "totp", verification: { valid: false } };
			}
			const secret: string = this.cipher.decrypt(enrollment.enabledSecretForRotation(), "totp-secret");
			return { kind: "totp", verification: this.authenticator.verify(token, secret, enrollment.lastTotpStep) };
		}
		const matchedCodeId: string | null =
			backupCode === undefined || !passwordMatches ? null : await findMatchingBackupCode(this.crypto, enrollment.activeBackupCodes, backupCode);
		return { kind: "backup_code", matchedCodeId };
	}
}
