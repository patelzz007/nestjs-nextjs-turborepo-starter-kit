import { Query } from "@nestjs/cqrs";
import type { PaginatedServiceResult, RewardNotificationListQuery, RewardNotificationResponse } from "@workspace/shared";

import type { ActorContext } from "../../../../../platform/application/actor-context";

/** `GET /reward-notifications`. */
export class ListMyRewardNotificationsQuery extends Query<PaginatedServiceResult<RewardNotificationResponse>> {
	public constructor(
		public readonly actor: ActorContext,
		public readonly input: RewardNotificationListQuery,
	) {
		super();
	}
}
