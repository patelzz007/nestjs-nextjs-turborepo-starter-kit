import { Inject, Logger } from "@nestjs/common";
import { CommandHandler, type ICommandHandler } from "@nestjs/cqrs";
import type { AdminUserBanResult, AdminUserBanState, EpochMs } from "@workspace/shared";

import { CLOCK, type Clock } from "../../../../../platform/application/clock.port";
import type { UnitOfWork } from "../../../../../platform/application/unit-of-work.port";
import type { UserAccount } from "../../../domain/aggregates/user-account.aggregate";
import { AccountNotFoundError } from "../../../domain/errors/identity.errors";
import { DeviceSessionsRevoked } from "../../../domain/events/identity.events";
import { revokedByUser } from "../../../domain/value-objects/session-revoker.value-object";
import type { IdentityScope } from "../../identity-scope";
import { ADMIN_USERS_BAN_OPERATION, IDENTITY_UNIT_OF_WORK } from "../../ports/identity.tokens";
import { BanUserCommand } from "./ban-user.command";

/**
 * Runs as `auth.admin_users.ban` on behalf of the admin, under the account's row lock: the ban
 * (deactivation + ban columns, compare-and-set on `tokenVersion`), the revocation of every device
 * session and the cross-instance invalidation events commit together, so a banned account keeps no
 * working session anywhere.
 */
@CommandHandler(BanUserCommand)
export class BanUserHandler implements ICommandHandler<BanUserCommand, AdminUserBanResult> {
	private readonly logger: Logger = new Logger(BanUserHandler.name);

	public constructor(
		@Inject(IDENTITY_UNIT_OF_WORK) private readonly uow: UnitOfWork<IdentityScope>,
		@Inject(CLOCK) private readonly clock: Clock,
	) {}

	public async execute(command: BanUserCommand): Promise<AdminUserBanResult> {
		const { input } = command;
		const ban: AdminUserBanState = await this.uow.runSystemOperation(ADMIN_USERS_BAN_OPERATION, command.actor, async (scope: IdentityScope): Promise<AdminUserBanState> => {
			const account: UserAccount | null = await scope.accounts.lockById(input.userId);
			if (account === null) {
				throw new AccountNotFoundError();
			}
			const now: EpochMs = this.clock.now();
			account.banBy(input.adminUserId, input.reason, now);
			await scope.accounts.save(account);
			await scope.sessions.revokeAllOf([account.id], revokedByUser(input.adminUserId), now, null);
			scope.events.collectFrom(account);
			scope.events.collect(new DeviceSessionsRevoked([account.id], "account_banned", now));
			const admin: UserAccount | null = await scope.accounts.findById(input.adminUserId);
			return { bannedAt: now, reason: input.reason.trim(), bannedBy: admin === null ? null : { id: admin.id, fullName: admin.fullName } };
		});
		this.logger.log({ event: "auth.account_banned", targetUserId: input.userId, adminUserId: input.adminUserId });
		return { userId: input.userId, ban };
	}
}
