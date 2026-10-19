import { Inject } from "@nestjs/common";
import { CommandHandler, type ICommandHandler } from "@nestjs/cqrs";
import type { EpochMs, LoginRestrictedEnrollmentResponse, LoginServiceResponse, LoginVerificationPendingResponse } from "@workspace/shared";

import { CLOCK, type Clock } from "../../../../../platform/application/clock.port";
import type { UnitOfWork } from "../../../../../platform/application/unit-of-work.port";
import type { TotpVerification } from "../../../domain/aggregates/two-factor-enrollment.aggregate";
import { InvalidTwoFactorCodeError } from "../../../domain/errors/identity.errors";
import type { IdentityScope } from "../../identity-scope";
import type { AuthenticatorPort, TotpSecretCipherPort } from "../../ports/authenticator.port";
import type { VerifiedChallengeRef } from "../../ports/identity-tokens.port";
import { AUTHENTICATOR, IDENTITY_UNIT_OF_WORK, PUBLIC_AUTH_FLOW_OPERATION, TOTP_SECRET_CIPHER } from "../../ports/identity.tokens";
import { MfaLoginCompletion } from "../../services/mfa-login-completion";
import { CompleteTotpLoginCommand } from "./complete-totp-login.command";

type MfaLoginResult = LoginServiceResponse | LoginRestrictedEnrollmentResponse | LoginVerificationPendingResponse;

/**
 * Completes a login with a TOTP code. D13: the challenge is consumed by compare-and-set (a second,
 * concurrent completion is refused with `MfaChallengeAlreadyUsedError` and issues no session) and
 * the code's time step is stored only when newer than the last one (a replayed code is refused).
 */
@CommandHandler(CompleteTotpLoginCommand)
export class CompleteTotpLoginHandler implements ICommandHandler<CompleteTotpLoginCommand, MfaLoginResult> {
	public constructor(
		@Inject(IDENTITY_UNIT_OF_WORK) private readonly uow: UnitOfWork<IdentityScope>,
		@Inject(AUTHENTICATOR) private readonly authenticator: AuthenticatorPort,
		@Inject(TOTP_SECRET_CIPHER) private readonly cipher: TotpSecretCipherPort,
		@Inject(CLOCK) private readonly clock: Clock,
		private readonly completion: MfaLoginCompletion,
	) {}

	public async execute(command: CompleteTotpLoginCommand): Promise<MfaLoginResult> {
		const { actor, input } = command;
		const ref: VerifiedChallengeRef = await this.completion.verifyLoginRef(input.tempToken);
		const passed: boolean = await this.uow.runSystemOperation(PUBLIC_AUTH_FLOW_OPERATION, actor, async (scope: IdentityScope): Promise<boolean> => {
			const now: EpochMs = this.clock.now();
			const parts = await this.completion.loadParts(scope, ref, now);
			const secret: string = this.cipher.decrypt(parts.enrollment.enabledSecretForLogin(), "totp-secret");
			const verification: TotpVerification = this.authenticator.verify(input.token, secret, parts.enrollment.lastTotpStep);
			if (!parts.enrollment.acceptLoginCode(verification, now)) {
				return false;
			}
			await this.completion.finish(scope, parts, now);
			return true;
		});
		if (!passed) {
			throw await this.completion.countWrongCode(actor, ref, new InvalidTwoFactorCodeError());
		}
		return this.completion.continueLogin(actor, ref, "totp", input.device);
	}
}
