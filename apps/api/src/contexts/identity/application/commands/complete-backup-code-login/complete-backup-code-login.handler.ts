import { Inject, Logger } from "@nestjs/common";
import { CommandHandler, type ICommandHandler } from "@nestjs/cqrs";
import type { EpochMs, LoginRestrictedEnrollmentResponse, LoginServiceResponse, LoginVerificationPendingResponse } from "@workspace/shared";

import { CLOCK, type Clock } from "../../../../../platform/application/clock.port";
import type { UnitOfWork } from "../../../../../platform/application/unit-of-work.port";
import type { IdentityScope } from "../../identity-scope";
import type { CredentialCryptoPort } from "../../ports/credential-crypto.port";
import type { VerifiedChallengeRef } from "../../ports/identity-tokens.port";
import { CREDENTIAL_CRYPTO, IDENTITY_UNIT_OF_WORK, LOGIN_MFA_COMPLETE_OPERATION } from "../../ports/identity.tokens";
import { MfaLoginCompletion } from "../../services/mfa-login-completion";
import { findMatchingBackupCode } from "../../services/two-factor-setup.factory";
import { CompleteBackupCodeLoginCommand } from "./complete-backup-code-login.command";

type MfaLoginResult = LoginServiceResponse | LoginRestrictedEnrollmentResponse | LoginVerificationPendingResponse;

/** Completes a login with a one-time backup code: the code and the challenge are consumed by compare-and-set in one transaction. */
@CommandHandler(CompleteBackupCodeLoginCommand)
export class CompleteBackupCodeLoginHandler implements ICommandHandler<CompleteBackupCodeLoginCommand, MfaLoginResult> {
	private readonly logger: Logger = new Logger(CompleteBackupCodeLoginHandler.name);

	public constructor(
		@Inject(IDENTITY_UNIT_OF_WORK) private readonly uow: UnitOfWork<IdentityScope>,
		@Inject(CREDENTIAL_CRYPTO) private readonly crypto: CredentialCryptoPort,
		@Inject(CLOCK) private readonly clock: Clock,
		private readonly completion: MfaLoginCompletion,
	) {}

	public async execute(command: CompleteBackupCodeLoginCommand): Promise<MfaLoginResult> {
		const { actor, input } = command;
		const ref: VerifiedChallengeRef = await this.completion.verifyLoginRef(input.tempToken);
		await this.uow.runSystemOperation(LOGIN_MFA_COMPLETE_OPERATION, actor, async (scope: IdentityScope): Promise<void> => {
			const now: EpochMs = this.clock.now();
			const parts = await this.completion.loadParts(scope, ref, now);
			const matchedCodeId: string | null = await findMatchingBackupCode(this.crypto, parts.enrollment.activeBackupCodes, input.backupCode);
			if (matchedCodeId === null) {
				this.logger.log({ event: "mfa.challenge.fail", userId: ref.userId, challengeId: ref.challengeId, method: "backup_code" });
			}
			parts.enrollment.consumeBackupCodeForLogin(matchedCodeId, now);
			await this.completion.finish(scope, parts, now);
		});
		return this.completion.continueLogin(actor, ref, "backup_code", input.device);
	}
}
