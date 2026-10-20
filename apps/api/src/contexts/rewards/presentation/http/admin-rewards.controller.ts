import { Controller, Get, HttpStatus, Post, Res } from "@nestjs/common";
import { CommandBus, QueryBus } from "@nestjs/cqrs";
import { ApiBearerAuth, ApiBody, ApiOperation, ApiTags } from "@nestjs/swagger";
import { z } from "zod";
import {
	AdminRewardImageDownloadResponseSchema,
	apiContract,
	apiPath,
	RewardResponseSchema,
	UuidParamSchema,
	type AdminRewardImageDownloadResponse,
	type PaginatedServiceResult,
	type RewardResponse,
} from "@workspace/shared";
import type { FastifyReply } from "fastify";

import type { ActorContext } from "../../../../platform/application/actor-context";
import { CurrentActor } from "../../../../platform/presentation/http/security/current-actor.decorator";
import { RequirePermission } from "../../../../platform/presentation/http/security/decorators/require-permission.decorator";
import { PlatformOperation } from "../../../../platform/presentation/http/security/decorators/platform-operation.decorator";
import { RATE_LIMIT_POLICY, RateLimit } from "../../../../platform/presentation/http/security/throttling/rate-limit.decorator";
import { ZodBody, ZodListQuery, ZodParams } from "../../../../platform/presentation/http/validation/decorators/zod-request.decorators";
import { ZodFileResponse, ZodPaginatedResponse, ZodResponse } from "../../../../platform/presentation/http/validation/decorators/zod-response.decorators";
import { REWARDS_ADMIN_REVIEW_OPERATION } from "../../application/ports/rewards.tokens";
import { ApproveRewardCommand } from "../../application/commands/approve-reward/approve-reward.command";
import { RejectRewardCommand } from "../../application/commands/reject-reward/reject-reward.command";
import type { RewardImagesArchive } from "../../application/ports/reward-read.port";
import { GetRewardForAdminQuery } from "../../application/queries/get-reward-for-admin/get-reward-for-admin.query";
import { GetRewardImageDownloadUrlQuery } from "../../application/queries/get-reward-image-download-url/get-reward-image-download-url.query";
import { GetRewardImagesArchiveQuery } from "../../application/queries/get-reward-images-archive/get-reward-images-archive.query";
import { ListRewardsPendingReviewQuery } from "../../application/queries/list-rewards-pending-review/list-rewards-pending-review.query";
import { sendRewardFileAttachment } from "./file-attachment.response";
import { RewardsEmptyBodyDto } from "./rewards-empty-body.dto";

@ApiTags("Rewards Admin")
@ApiBearerAuth()
@PlatformOperation(REWARDS_ADMIN_REVIEW_OPERATION)
@Controller(apiPath("/admin/rewards"))
export class RewardsAdminRewardsController {
	public constructor(
		private readonly commandBus: CommandBus,
		private readonly queryBus: QueryBus,
	) {}

	@RequirePermission("MANAGE", "REWARD")
	@Get("pending")
	@ApiOperation({ summary: "List rewards pending moderation (oldest first, paginated)" })
	@ZodPaginatedResponse(RewardResponseSchema, { description: "One page of pending rewards" })
	public listPendingRewards(
		@CurrentActor() actor: ActorContext,
		@ZodListQuery(apiContract.rewardsAdmin.pendingRewards.input) query: z.output<typeof apiContract.rewardsAdmin.pendingRewards.input>,
	): Promise<PaginatedServiceResult<RewardResponse>> {
		return this.queryBus.execute(new ListRewardsPendingReviewQuery(actor, query));
	}

	// Fastify matches the static `pending` segment before `:rewardId`, whatever the declaration order.
	@RequirePermission("MANAGE", "REWARD")
	@Get(":rewardId")
	@ApiOperation({ summary: "Get one reward in full, whatever its status (moderation detail)" })
	@ZodResponse(RewardResponseSchema, { description: "The reward" })
	public getReward(
		@CurrentActor() actor: ActorContext,
		@ZodParams(apiContract.rewardsAdmin.getReward.input) params: z.output<typeof apiContract.rewardsAdmin.getReward.input>,
	): Promise<RewardResponse> {
		return this.queryBus.execute(new GetRewardForAdminQuery(actor, params));
	}

	@RateLimit(RATE_LIMIT_POLICY.authenticatedMutation)
	@RequirePermission("MANAGE", "REWARD")
	@Post(":rewardId/approve")
	@ApiOperation({ summary: "Approve a pending reward (no body required)" })
	@ApiBody({ type: RewardsEmptyBodyDto, required: false })
	@ZodResponse(RewardResponseSchema, { status: HttpStatus.CREATED, description: "Approved reward" })
	public approveReward(@CurrentActor() actor: ActorContext, @ZodParams(apiContract.rewardsAdmin.approveReward.input) params: { rewardId: string }): Promise<RewardResponse> {
		return this.commandBus.execute(new ApproveRewardCommand(actor, { rewardId: params.rewardId }));
	}

	/** Reviewers check a reward's photos at full resolution; the URL downloads the original upload and expires. */
	@RequirePermission("MANAGE", "REWARD")
	@Get(":rewardId/images/:fileId/download")
	@ApiOperation({ summary: "Get a short-lived signed URL that downloads one of a reward's images (the original upload)" })
	@ZodResponse(AdminRewardImageDownloadResponseSchema, { description: "Signed download URL of the image" })
	public getRewardImageDownload(
		@CurrentActor() actor: ActorContext,
		@ZodParams(apiContract.rewardsAdmin.downloadRewardImage.input) params: z.output<typeof apiContract.rewardsAdmin.downloadRewardImage.input>,
	): Promise<AdminRewardImageDownloadResponse> {
		return this.queryBus.execute(new GetRewardImageDownloadUrlQuery(actor, params));
	}

	/** Reviewers save every photo of a reward at once: one ZIP of the original uploads, streamed. */
	@RequirePermission("MANAGE", "REWARD")
	@Get(":rewardId/images/archive")
	@ApiOperation({ summary: "Download every image of a reward as one ZIP of the original uploads, in display order" })
	@ZodFileResponse(apiContract.rewardsAdmin.downloadRewardImagesArchive.response, { description: "The ZIP archive (Content-Disposition: attachment)" })
	public async downloadRewardImagesArchive(
		@CurrentActor() actor: ActorContext,
		@ZodParams(apiContract.rewardsAdmin.downloadRewardImagesArchive.input) params: z.output<typeof apiContract.rewardsAdmin.downloadRewardImagesArchive.input>,
		@Res() reply: FastifyReply,
	): Promise<void> {
		const archive: RewardImagesArchive = await this.queryBus.execute(new GetRewardImagesArchiveQuery(actor, params));
		await sendRewardFileAttachment(reply, archive);
	}

	@RateLimit(RATE_LIMIT_POLICY.authenticatedMutation)
	@RequirePermission("MANAGE", "REWARD")
	@Post(":rewardId/reject")
	@ApiOperation({ summary: "Reject a pending reward" })
	@ZodResponse(RewardResponseSchema, { status: HttpStatus.CREATED, description: "Reward returned to draft" })
	public rejectReward(
		@CurrentActor() actor: ActorContext,
		@ZodParams(z.object({ rewardId: UuidParamSchema }).strict()) params: { rewardId: string },
		@ZodBody(apiContract.rewardsAdmin.rejectReward.input) body: z.output<typeof apiContract.rewardsAdmin.rejectReward.input>,
	): Promise<RewardResponse> {
		return this.commandBus.execute(new RejectRewardCommand(actor, { rewardId: params.rewardId, reason: body.reason }));
	}
}
