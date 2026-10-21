import { Inject, Logger } from "@nestjs/common";
import { CommandHandler, type ICommandHandler } from "@nestjs/cqrs";
import type { AdminUserBanResult } from "@workspace/shared";

import { CLOCK, type Clock } from "../../../../../platform/application/clock.port";
import type { UnitOfWork } from "../../../../../platform/application/unit-of-work.port";
import type { UserAccount } from "../../../domain/aggregates/user-account.aggregate";
import { AccountNotFoundError } from "../../../domain/errors/identity.errors";
import type { IdentityScope } from "../../identity-scope";
import { ADMIN_USERS_UNBAN_OPERATION, IDENTITY_UNIT_OF_WORK } from "../../ports/identity.tokens";
import { UnbanUserCommand } from "./unban-user.command";

/** Runs as `auth.admin_users.unban` under the account's row lock; the write is a compare-and-set on the loaded ban. */
@CommandHandler(UnbanUserCommand)
export class UnbanUserHandler implements ICommandHandler<UnbanUserCommand, AdminUserBanResult> {
	private readonly logger: Logger = new Logger(UnbanUserHandler.name);

	public constructor(
		@Inject(IDENTITY_UNIT_OF_WORK) private readonly uow: UnitOfWork<IdentityScope>,
		@Inject(CLOCK) private readonly clock: Clock,
	) {}

	public async execute(command: UnbanUserCommand): Promise<AdminUserBanResult> {
		const { input } = command;
		await this.uow.runSystemOperation(ADMIN_USERS_UNBAN_OPERATION, command.actor, async (scope: IdentityScope): Promise<void> => {
			const account: UserAccount | null = await scope.accounts.lockById(input.userId);
			if (account === null) {
				throw new AccountNotFoundError();
			}
			account.unban(this.clock.now());
			await scope.accounts.save(account);
			scope.events.collectFrom(account);
		});
		this.logger.log({ event: "auth.account_unbanned", targetUserId: input.userId });
		return { userId: input.userId, ban: null };
	}
}
