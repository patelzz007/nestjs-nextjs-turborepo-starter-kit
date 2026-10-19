import { Inject, Logger } from "@nestjs/common";
import { CommandHandler, type ICommandHandler } from "@nestjs/cqrs";
import type { MessageResponse } from "@workspace/shared";

import { CLOCK, type Clock } from "../../../../../platform/application/clock.port";
import type { UnitOfWork } from "../../../../../platform/application/unit-of-work.port";
import type { UserAccount } from "../../../domain/aggregates/user-account.aggregate";
import { AccountNotFoundError } from "../../../domain/errors/identity.errors";
import type { IdentityScope } from "../../identity-scope";
import { IDENTITY_UNIT_OF_WORK } from "../../ports/identity.tokens";
import { UnlockAccountCommand } from "./unlock-account.command";

const UNLOCKED_RESPONSE: MessageResponse = { message: "User account has been unlocked successfully." };

/**
 * D18: the unlock runs in the administrator's own RLS session, so the database change trail
 * (`DataChangeLog`) attributes it to them and joins it to the request's HTTP audit row; after
 * commit the account's cached state is dropped on every instance (`UserCredentialsChanged`).
 */
@CommandHandler(UnlockAccountCommand)
export class UnlockAccountHandler implements ICommandHandler<UnlockAccountCommand, MessageResponse> {
	private readonly logger: Logger = new Logger(UnlockAccountHandler.name);

	public constructor(
		@Inject(IDENTITY_UNIT_OF_WORK) private readonly uow: UnitOfWork<IdentityScope>,
		@Inject(CLOCK) private readonly clock: Clock,
	) {}

	public async execute(command: UnlockAccountCommand): Promise<MessageResponse> {
		await this.uow.run(command.actor, async (scope: IdentityScope): Promise<void> => {
			const account: UserAccount | null = await scope.accounts.findById(command.input.userId);
			if (account === null) {
				throw new AccountNotFoundError();
			}
			account.unlock(this.clock.now());
			await scope.accounts.save(account);
			scope.events.collectFrom(account);
		});
		this.logger.log({ event: "auth.account_unlocked", targetUserId: command.input.userId });
		return UNLOCKED_RESPONSE;
	}
}
