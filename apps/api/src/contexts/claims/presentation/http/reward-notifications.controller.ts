import { Controller, Get, HttpStatus, Post } from "@nestjs/common";
import { CommandBus, QueryBus } from "@nestjs/cqrs";
import { ApiBearerAuth, ApiOperation, ApiTags } from "@nestjs/swagger";
import {
	apiContract,
	apiPath,
	OkResponseSchema,
	RewardNotificationResponseSchema,
	type OkResponse,
	type PaginatedServiceResult,
	type RewardNotificationResponse,
} from "@workspace/shared";
import type { z } from "zod";

import type { ActorContext } from "../../../../platform/application/actor-context";
import { CurrentActor } from "../../../../platform/presentation/http/security/current-actor.decorator";
import { RATE_LIMIT_POLICY, RateLimit } from "../../../../platform/presentation/http/security/throttling/rate-limit.decorator";
import { ZodBody, ZodListQuery } from "../../../../platform/presentation/http/validation/decorators/zod-request.decorators";
import { ZodPaginatedResponse, ZodResponse } from "../../../../platform/presentation/http/validation/decorators/zod-response.decorators";
import { MarkRewardNotificationsReadCommand } from "../../application/commands/mark-reward-notifications-read/mark-reward-notifications-read.command";
import { ListMyRewardNotificationsQuery } from "../../application/queries/list-my-reward-notifications/list-my-reward-notifications.query";

/** A customer's in-app reward inbox. */
@ApiTags("Reward Notifications")
@ApiBearerAuth()
@Controller(apiPath("/reward-notifications"))
export class RewardNotificationsController {
	public constructor(
		private readonly commandBus: CommandBus,
		private readonly queryBus: QueryBus,
	) {}

	@Get()
	@ApiOperation({ summary: "List in-app reward notifications" })
	@ZodPaginatedResponse(RewardNotificationResponseSchema, {
		description: "One page of notifications, newest first; pagination is in `meta` (`filter[readAt][isNull]=true` counts the unread)",
	})
	public listNotifications(
		@CurrentActor() actor: ActorContext,
		@ZodListQuery(apiContract.rewardNotifications.list.input) query: z.output<typeof apiContract.rewardNotifications.list.input>,
	): Promise<PaginatedServiceResult<RewardNotificationResponse>> {
		return this.queryBus.execute(new ListMyRewardNotificationsQuery(actor, query));
	}

	@RateLimit(RATE_LIMIT_POLICY.authenticatedMutation)
	@Post("read")
	@ApiOperation({ summary: "Mark reward notifications as read" })
	@ZodResponse(OkResponseSchema, { status: HttpStatus.CREATED, description: "Notifications marked read" })
	public markRead(
		@CurrentActor() actor: ActorContext,
		@ZodBody(apiContract.rewardNotifications.read.input) body: z.output<typeof apiContract.rewardNotifications.read.input>,
	): Promise<OkResponse> {
		return this.commandBus.execute(new MarkRewardNotificationsReadCommand(actor, body));
	}
}
