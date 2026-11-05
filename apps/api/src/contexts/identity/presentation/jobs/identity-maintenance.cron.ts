import { Inject, Injectable, Logger } from "@nestjs/common";
import { Cron, CronExpression } from "@nestjs/schedule";

import { systemActor } from "../../../../platform/application/actor-context";
import { SystemCommandDispatcher } from "../../../../platform/application/system-command-dispatcher";
import { CompleteDueMfaRecoveriesCommand } from "../../application/commands/complete-due-mfa-recoveries/complete-due-mfa-recoveries.command";
import { PurgeStalePasswordResetTokensCommand } from "../../application/commands/purge-stale-password-reset-tokens/purge-stale-password-reset-tokens.command";
import { PurgeStaleWebAuthnChallengesCommand } from "../../application/commands/purge-stale-web-authn-challenges/purge-stale-web-authn-challenges.command";
import { MFA_RECOVERY_UNLOCK_OPERATION, PASSWORD_RESET_CLEANUP_OPERATION, WEB_AUTHN_CHALLENGE_CLEANUP_OPERATION } from "../../application/ports/identity.tokens";

const MFA_RECOVERY_REASON = "Complete approved MFA recoveries whose security delay has elapsed";
const RESET_TOKEN_REASON = "Retire used and expired password reset tokens";
const WEB_AUTHN_CHALLENGE_REASON = "Retire expired WebAuthn ceremony challenges";

/**
 * Identity housekeeping, as audited system commands (decision #27):
 * - every 10 minutes, approved MFA recoveries whose security delay elapsed are completed;
 * - hourly, used (after 7 days) and expired (after a 1 hour grace) password reset tokens are soft-deleted;
 * - hourly, WebAuthn challenges an hour past their expiry are soft-deleted (ADR 080).
 * Both are safe on every replica at once: each recovery is completed under compare-and-set, and the
 * token retirement is one set-based update.
 */
@Injectable()
export class IdentityMaintenanceCron {
	private readonly logger: Logger = new Logger(IdentityMaintenanceCron.name);

	public constructor(@Inject(SystemCommandDispatcher) private readonly dispatcher: Pick<SystemCommandDispatcher, "dispatch">) {}

	@Cron(CronExpression.EVERY_10_MINUTES)
	public async completeDueMfaRecoveries(): Promise<void> {
		const completed = await this.dispatcher.dispatch(
			new CompleteDueMfaRecoveriesCommand(systemActor(MFA_RECOVERY_UNLOCK_OPERATION, "cron", null, MFA_RECOVERY_REASON, null), { reason: MFA_RECOVERY_REASON }),
			{ kind: "cron", name: "IdentityMaintenanceCron.completeDueMfaRecoveries" },
		);
		if (completed > 0) {
			this.logger.log({ event: "mfa_recovery.completed", completed });
		}
	}

	@Cron(CronExpression.EVERY_HOUR)
	public async purgeStalePasswordResetTokens(): Promise<void> {
		const retired = await this.dispatcher.dispatch(
			new PurgeStalePasswordResetTokensCommand(systemActor(PASSWORD_RESET_CLEANUP_OPERATION, "cron", null, RESET_TOKEN_REASON, null), { reason: RESET_TOKEN_REASON }),
			{ kind: "cron", name: "IdentityMaintenanceCron.purgeStalePasswordResetTokens" },
		);
		if (retired > 0) {
			this.logger.log({ event: "password_reset_token.retired", retired });
		}
	}

	@Cron(CronExpression.EVERY_HOUR)
	public async purgeStaleWebAuthnChallenges(): Promise<void> {
		const retired = await this.dispatcher.dispatch(
			new PurgeStaleWebAuthnChallengesCommand(systemActor(WEB_AUTHN_CHALLENGE_CLEANUP_OPERATION, "cron", null, WEB_AUTHN_CHALLENGE_REASON, null), {
				reason: WEB_AUTHN_CHALLENGE_REASON,
			}),
			{ kind: "cron", name: "IdentityMaintenanceCron.purgeStaleWebAuthnChallenges" },
		);
		if (retired > 0) {
			this.logger.log({ event: "web_authn_challenge.retired", retired });
		}
	}
}
