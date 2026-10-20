import { Inject } from "@nestjs/common";
import { QueryHandler, type IQueryHandler } from "@nestjs/cqrs";
import type { PaginatedServiceResult, RewardNotificationResponse } from "@workspace/shared";

import { actingUserId } from "../../commands/acting-user";
import type { RewardNotificationReadPort } from "../../ports/claims-read.port";
import { REWARD_NOTIFICATION_READS } from "../../ports/claims.tokens";
import { ListMyRewardNotificationsQuery } from "./list-my-reward-notifications.query";

/** One page of the caller's reward inbox. */
@QueryHandler(ListMyRewardNotificationsQuery)
export class ListMyRewardNotificationsHandler implements IQueryHandler<ListMyRewardNotificationsQuery, PaginatedServiceResult<RewardNotificationResponse>> {
	public constructor(@Inject(REWARD_NOTIFICATION_READS) private readonly reads: RewardNotificationReadPort) {}

	public async execute(query: ListMyRewardNotificationsQuery): Promise<PaginatedServiceResult<RewardNotificationResponse>> {
		return this.reads.listForUser(query.actor, actingUserId(query.actor), query.input);
	}
}
