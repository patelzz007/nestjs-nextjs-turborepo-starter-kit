import { Inject, Logger } from "@nestjs/common";
import { CommandHandler, type ICommandHandler } from "@nestjs/cqrs";
import type { EpochMs, ResetPasswordResponse } from "@workspace/shared";

import { CLOCK, type Clock } from "../../../../../platform/application/clock.port";
import type { UnitOfWork } from "../../../../../platform/application/unit-of-work.port";
import type { UserAccount } from "../../../domain/aggregates/user-account.aggregate";
import type { PasswordResetToken } from "../../../domain/entities/password-reset-token.entity";
import { PasswordResetTokenInvalidError } from "../../../domain/errors/identity.errors";
import { revokedBySystem } from "../../../domain/value-objects/session-revoker.value-object";
import type { IdentityScope } from "../../identity-scope";
import type { AuthFlowSubjectPort } from "../../ports/auth-flow.port";
import type { CredentialCryptoPort } from "../../ports/credential-crypto.port";
import { AUTH_FLOW_SUBJECT, CREDENTIAL_CRYPTO, IDENTITY_UNIT_OF_WORK, PUBLIC_AUTH_FLOW_OPERATION } from "../../ports/identity.tokens";
import { matchesRecentPassword } from "../../services/password-reuse.checker";
import { ResetPasswordCommand } from "./reset-password.command";

const RESET_PASSWORD_RESPONSE: ResetPasswordResponse = { message: "Password has been reset successfully. Please log in with your new password." };

/**
 * Resets the password with an emailed link. One transaction: the token is consumed by compare-and-set
 * on `used_at IS NULL` (D12: two resets with one token cannot both win), the password and token
 * generation change (compare-and-set on the loaded `tokenVersion`), the history row is written and
 * every session is signed out. After commit the credential change is broadcast to every instance.
 */
@CommandHandler(ResetPasswordCommand)
export class ResetPasswordHandler implements ICommandHandler<ResetPasswordCommand, ResetPasswordResponse> {
	private readonly logger: Logger = new Logger(ResetPasswordHandler.name);

	public constructor(
		@Inject(IDENTITY_UNIT_OF_WORK) private readonly uow: UnitOfWork<IdentityScope>,
		@Inject(CREDENTIAL_CRYPTO) private readonly crypto: CredentialCryptoPort,
		@Inject(AUTH_FLOW_SUBJECT) private readonly flowSubject: AuthFlowSubjectPort,
		@Inject(CLOCK) private readonly clock: Clock,
	) {}

	public async execute(command: ResetPasswordCommand): Promise<ResetPasswordResponse> {
		const { actor, input } = command;
		const tokenDigest: string = this.crypto.hashTokenDigest(input.token);
		const newPasswordHash: string = await this.crypto.hash(input.password);

		const userId: string = await this.uow.runSystemOperation(PUBLIC_AUTH_FLOW_OPERATION, actor, async (scope: IdentityScope): Promise<string> => {
			const now: EpochMs = this.clock.now();
			const token: PasswordResetToken | null = await scope.resetTokens.findUsableByDigest(tokenDigest, now);
			if (token === null || !(await this.crypto.compare(input.token, token.snapshot.tokenHash))) {
				throw new PasswordResetTokenInvalidError();
			}
			this.flowSubject.identify(token.userId);
			const account: UserAccount | null = await scope.accounts.findById(token.userId);
			if (account === null) {
				throw new PasswordResetTokenInvalidError();
			}

			token.consume(now);
			account.resetPassword(newPasswordHash, await matchesRecentPassword(scope, this.crypto, account.id, input.password), now);
			await scope.resetTokens.saveConsumed(token);
			await scope.accounts.save(account);
			// No signed-in actor (the reset link proved the email): a system sign-out of every device.
			await scope.sessions.revokeAllOf([account.id], revokedBySystem("system:logout-all"), now, null);
			await scope.emails.sendPasswordChangedEmail(account.email.value);
			scope.events.collectFrom(account);
			return account.id;
		});

		this.logger.log({ event: "auth.password_reset", userId });
		return RESET_PASSWORD_RESPONSE;
	}
}
