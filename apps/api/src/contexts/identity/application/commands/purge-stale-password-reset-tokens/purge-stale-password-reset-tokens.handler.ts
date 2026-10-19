import { Inject, Logger } from "@nestjs/common";
import { CommandHandler, type ICommandHandler } from "@nestjs/cqrs";

import { CLOCK, type Clock } from "../../../../../platform/application/clock.port";
import type { UnitOfWork } from "../../../../../platform/application/unit-of-work.port";
import { EXPIRED_RESET_TOKEN_GRACE_MS, USED_RESET_TOKEN_RETENTION_MS } from "../../../domain/entities/password-reset-token.entity";
import type { IdentityScope } from "../../identity-scope";
import { IDENTITY_UNIT_OF_WORK, PASSWORD_RESET_CLEANUP_OPERATION } from "../../ports/identity.tokens";
import { PurgeStalePasswordResetTokensCommand } from "./purge-stale-password-reset-tokens.command";

/**
 * Cron: soft-deletes (never DELETEs) used tokens older than seven days and expired tokens one hour
 * past expiry — a set-based write; every reader already filters `is_deleted = false`.
 */
@CommandHandler(PurgeStalePasswordResetTokensCommand)
export class PurgeStalePasswordResetTokensHandler implements ICommandHandler<PurgeStalePasswordResetTokensCommand, number> {
	private readonly logger: Logger = new Logger(PurgeStalePasswordResetTokensHandler.name);

	public constructor(
		@Inject(IDENTITY_UNIT_OF_WORK) private readonly uow: UnitOfWork<IdentityScope>,
		@Inject(CLOCK) private readonly clock: Clock,
	) {}

	public async execute(command: PurgeStalePasswordResetTokensCommand): Promise<number> {
		const retired: number = await this.uow.runSystemOperation(PASSWORD_RESET_CLEANUP_OPERATION, command.actor, (scope) =>
			scope.resetTokens.retireStale(this.clock.now(), USED_RESET_TOKEN_RETENTION_MS, EXPIRED_RESET_TOKEN_GRACE_MS),
		);
		if (retired > 0) {
			this.logger.log({ event: "auth.password_reset_tokens.retired", retired });
		}
		return retired;
	}
}
