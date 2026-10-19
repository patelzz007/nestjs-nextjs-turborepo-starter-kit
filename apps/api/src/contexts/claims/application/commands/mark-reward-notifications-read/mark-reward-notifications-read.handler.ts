import { Inject } from "@nestjs/common";
import { CommandHandler, type ICommandHandler } from "@nestjs/cqrs";
import type { OkResponse } from "@workspace/shared";

import { CLOCK, type Clock } from "../../../../../platform/application/clock.port";
import type { UnitOfWork } from "../../../../../platform/application/unit-of-work.port";
import type { ClaimsScope } from "../../claims-scope";
import { CLAIMS_UNIT_OF_WORK } from "../../ports/claims.tokens";
import { actingUserId } from "../acting-user";
import { MarkRewardNotificationsReadCommand } from "./mark-reward-notifications-read.command";

/**
 * Marks the caller's notices read: all of them, or the listed ones. Set-based and idempotent
 * (only unread notices are stamped), so no aggregate is loaded per row.
 */
@CommandHandler(MarkRewardNotificationsReadCommand)
export class MarkRewardNotificationsReadHandler implements ICommandHandler<MarkRewardNotificationsReadCommand, OkResponse> {
	public constructor(
		@Inject(CLAIMS_UNIT_OF_WORK) private readonly uow: UnitOfWork<ClaimsScope>,
		@Inject(CLOCK) private readonly clock: Clock,
	) {}

	public async execute(command: MarkRewardNotificationsReadCommand): Promise<OkResponse> {
		const { actor, input } = command;
		const userId = actingUserId(actor);
		const selection = input.markAll === true ? "all" : { notificationIds: input.notificationIds ?? [] };

		return this.uow.run(actor, async (scope: ClaimsScope): Promise<OkResponse> => {
			await scope.notifications.markRead(userId, selection, this.clock.now());
			return { ok: true };
		});
	}
}
