import { Controller, Get, HttpStatus, Post } from "@nestjs/common";
import { ApiBearerAuth, ApiOperation, ApiTags } from "@nestjs/swagger";
import type { z } from "zod";

import { apiContract, apiPath, RewardNotificationListResponseSchema, OkResponseSchema } from "@workspace/shared";
import { ZodBody, ZodListQuery } from "../../../common/decorators/zod-request.decorators";
import { ZodResponse } from "../../../common/decorators/zod-response.decorators";
import { GetUser } from "../../auth/decorators/get-user.decorator";
import type { AccessTokenPayload } from "../../auth/services/token.service";

import { RewardNotificationService } from "../services/reward-notification.service";

@ApiTags("Reward Notifications")
@ApiBearerAuth()
@Controller(apiPath("/reward-notifications"))
export class RewardNotificationsController {
	public constructor(private readonly notificationService: RewardNotificationService) {}

	@Get()
	@ApiOperation({ summary: "List in-app reward notifications" })
	@ZodResponse(RewardNotificationListResponseSchema, { description: "Notifications with unread count" })
	public listNotifications(
		@GetUser() user: AccessTokenPayload,
		@ZodListQuery(apiContract.rewardNotifications.list.input) query: z.output<typeof apiContract.rewardNotifications.list.input>,
	): ReturnType<RewardNotificationService["listForUser"]> {
		return this.notificationService.listForUser(user.sub, query);
	}

	@Post("read")
	@ApiOperation({ summary: "Mark reward notifications as read" })
	@ZodResponse(OkResponseSchema, { status: HttpStatus.CREATED, description: "Notifications marked read" })
	public markRead(
		@GetUser() user: AccessTokenPayload,
		@ZodBody(apiContract.rewardNotifications.read.input) body: { notificationIds?: string[]; markAll?: boolean },
	): ReturnType<RewardNotificationService["markRead"]> {
		return this.notificationService.markRead(user.sub, body.notificationIds, body.markAll);
	}
}
