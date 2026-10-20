import { Inject, Logger } from "@nestjs/common";
import { CommandHandler, type ICommandHandler } from "@nestjs/cqrs";
import type { EpochMs, TwoFactorMessageResponse } from "@workspace/shared";

import { CLOCK, type Clock } from "../../../../../platform/application/clock.port";
import type { UnitOfWork } from "../../../../../platform/application/unit-of-work.port";
import type { TwoFactorEnrollment } from "../../../domain/aggregates/two-factor-enrollment.aggregate";
import type { UserAccount } from "../../../domain/aggregates/user-account.aggregate";
import { TwoFactorSetupExpiredError } from "../../../domain/errors/identity.errors";
import type { IdentityScope } from "../../identity-scope";
import type { AuthenticatorPort, TotpSecretCipherPort } from "../../ports/authenticator.port";
import { AUTHENTICATOR, IDENTITY_UNIT_OF_WORK, TOTP_SECRET_CIPHER } from "../../ports/identity.tokens";
import { EnableTwoFactorCommand } from "./enable-two-factor.command";

const ENABLED_RESPONSE: TwoFactorMessageResponse = { message: "Two-factor authentication enabled successfully" };

/**
 * Confirms a pending enrollment. D16: 2FA on, the new backup codes, the cleared pending setup and the
 * `tokenVersion` bump commit in ONE transaction; after commit `UserCredentialsChanged` drops the
 * cached access-token state on every instance, so tokens issued before the enrollment are refused.
 */
@CommandHandler(EnableTwoFactorCommand)
export class EnableTwoFactorHandler implements ICommandHandler<EnableTwoFactorCommand, TwoFactorMessageResponse> {
	private readonly logger: Logger = new Logger(EnableTwoFactorHandler.name);

	public constructor(
		@Inject(IDENTITY_UNIT_OF_WORK) private readonly uow: UnitOfWork<IdentityScope>,
		@Inject(AUTHENTICATOR) private readonly authenticator: AuthenticatorPort,
		@Inject(TOTP_SECRET_CIPHER) private readonly cipher: TotpSecretCipherPort,
		@Inject(CLOCK) private readonly clock: Clock,
	) {}

	public async execute(command: EnableTwoFactorCommand): Promise<TwoFactorMessageResponse> {
		const { actor, input } = command;
		await this.uow.run(actor, async (scope: IdentityScope): Promise<void> => {
			const now: EpochMs = this.clock.now();
			const enrollment: TwoFactorEnrollment | null = await scope.twoFactor.findByUserId(input.userId);
			if (enrollment === null) {
				throw new TwoFactorSetupExpiredError();
			}
			const secret: string = this.cipher.decrypt(enrollment.pendingSecretAt(now), "totp-pending");
			enrollment.enable(this.authenticator.verify(input.token, secret, null), this.cipher.encrypt(secret, "totp-secret"), now);
			await scope.twoFactor.save(enrollment);
			const account: UserAccount | null = await scope.accounts.findById(input.userId);
			if (account !== null) {
				await scope.emails.sendTwoFactorEnabledEmail(account.email.value);
			}
			scope.events.collectFrom(enrollment);
			this.logger.log({ event: "mfa.enrollment", userId: input.userId, enrolledAt: now });
		});
		return ENABLED_RESPONSE;
	}
}
