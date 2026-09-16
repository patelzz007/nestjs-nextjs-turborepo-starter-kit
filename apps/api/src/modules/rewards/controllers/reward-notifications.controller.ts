import { Body, Controller, Get, Post, Query } from "@nestjs/common";
import { ApiBearerAuth, ApiBody, ApiOkResponse, ApiOperation, ApiTags } from "@nestjs/swagger";

import { apiContract, apiPath } from "@workspace/shared";
import { ZodValidationPipe } from "../../../common/pipes/zod-validation.pipe";
import { GetUser } from "../../auth/decorators/get-user.decorator";
import type { AccessTokenPayload } from "../../auth/services/token.service";

import { MarkRewardNotificationsReadDto } from "../dtos/rewards.dto";
import { RewardNotificationService } from "../services/reward-notification.service";

@ApiTags("Reward Notifications")
@ApiBearerAuth()
@Controller(apiPath("/reward-notifications"))
export class RewardNotificationsController {
	public constructor(private readonly notificationService: RewardNotificationService) {}

	@Get()
	@ApiOperation({ summary: "List in-app reward notifications" })
	@ApiOkResponse({ description: "Notifications with unread count" })
	public listNotifications(
		@GetUser() user: AccessTokenPayload,
		@Query(new ZodValidationPipe(apiContract.rewardNotifications.list.input)) query: Parameters<RewardNotificationService["listForUser"]>[1],
	): ReturnType<RewardNotificationService["listForUser"]> {
		return this.notificationService.listForUser(user.sub, query);
	}

	@Post("read")
	@ApiOperation({ summary: "Mark reward notifications as read" })
	@ApiBody({ type: MarkRewardNotificationsReadDto })
	@ApiOkResponse({ description: "Notifications marked read" })
	public markRead(
		@GetUser() user: AccessTokenPayload,
		@Body(new ZodValidationPipe(apiContract.rewardNotifications.read.input)) body: { notificationIds?: string[]; markAll?: boolean },
	): ReturnType<RewardNotificationService["markRead"]> {
		return this.notificationService.markRead(user.sub, body.notificationIds, body.markAll);
	}
}
