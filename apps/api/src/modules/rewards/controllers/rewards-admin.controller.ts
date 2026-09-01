import { Body, Controller, Get, Param, Patch, Post, Query } from "@nestjs/common";
import { ApiBearerAuth, ApiBody, ApiOkResponse, ApiOperation, ApiTags } from "@nestjs/swagger";
import { z } from "zod";

import { AdminKybUpdateSchema, AdminRejectRewardSchema, apiContract, apiPath, UuidParamSchema } from "@workspace/shared";
import { ZodValidationPipe } from "../../../common/pipes/zod-validation.pipe";
import { RlsBypass } from "../../auth/decorators/rls-bypass.decorator";
import { RequirePermission } from "../../auth/decorators/require-permission.decorator";
import { GetUser } from "../../auth/decorators/get-user.decorator";
import type { AccessTokenPayload } from "../../auth/services/token.service";

import { AdminCreateMerchantInviteDto, AdminKybUpdateDto, AdminRejectRewardDto, RewardsEmptyBodyDto } from "../dtos/rewards.dto";
import { RewardsAdminService } from "../services/rewards-admin.service";

@ApiTags("Rewards Admin")
@ApiBearerAuth()
@RlsBypass()
@Controller(apiPath("/admin/invites"))
export class RewardsAdminInvitesController {
	public constructor(private readonly rewardsAdminService: RewardsAdminService) {}

	@RequirePermission("MANAGE", "MERCHANT_ORG")
	@Post()
	@ApiOperation({ summary: "Create merchant invite" })
	@ApiBody({ type: AdminCreateMerchantInviteDto })
	@ApiOkResponse({ description: "Invite created with token" })
	public createInvite(
		@GetUser() user: AccessTokenPayload,
		@Body(new ZodValidationPipe(apiContract.rewardsAdmin.createInvite.input)) body: Parameters<RewardsAdminService["createMerchantInvite"]>[1],
	): ReturnType<RewardsAdminService["createMerchantInvite"]> {
		return this.rewardsAdminService.createMerchantInvite(user.sub, body);
	}

	@RequirePermission("MANAGE", "MERCHANT_ORG")
	@Post("preview-email")
	@ApiOperation({ summary: "Preview merchant invite email with form data (does not send)" })
	@ApiBody({ type: AdminCreateMerchantInviteDto })
	@ApiOkResponse({ description: "Rendered invite email preview" })
	public previewInviteEmail(
		@Body(new ZodValidationPipe(apiContract.rewardsAdmin.previewInviteEmail.input)) body: Parameters<RewardsAdminService["previewMerchantInviteEmail"]>[0],
	): ReturnType<RewardsAdminService["previewMerchantInviteEmail"]> {
		return this.rewardsAdminService.previewMerchantInviteEmail(body);
	}
}

@ApiTags("Rewards Admin")
@ApiBearerAuth()
@RlsBypass()
@Controller(apiPath("/admin/rewards"))
export class RewardsAdminRewardsController {
	public constructor(private readonly rewardsAdminService: RewardsAdminService) {}

	@RequirePermission("MANAGE", "REWARD")
	@Get("pending")
	@ApiOperation({ summary: "List rewards pending moderation" })
	@ApiOkResponse({ description: "Pending rewards" })
	public listPendingRewards(): ReturnType<RewardsAdminService["listPendingRewards"]> {
		return this.rewardsAdminService.listPendingRewards();
	}

	@RequirePermission("MANAGE", "REWARD")
	@Post(":rewardId/approve")
	@ApiOperation({ summary: "Approve a pending reward (no body required)" })
	@ApiBody({ type: RewardsEmptyBodyDto, required: false })
	@ApiOkResponse({ description: "Approved reward" })
	public approveReward(
		@GetUser() user: AccessTokenPayload,
		@Param(new ZodValidationPipe(apiContract.rewardsAdmin.approveReward.input)) params: { rewardId: string },
	): ReturnType<RewardsAdminService["approveReward"]> {
		return this.rewardsAdminService.approveReward(user.sub, params.rewardId);
	}

	@RequirePermission("MANAGE", "REWARD")
	@Post(":rewardId/reject")
	@ApiOperation({ summary: "Reject a pending reward" })
	@ApiBody({ type: AdminRejectRewardDto })
	@ApiOkResponse({ description: "Reward returned to draft" })
	public rejectReward(
		@GetUser() user: AccessTokenPayload,
		@Param(new ZodValidationPipe(z.object({ rewardId: UuidParamSchema }).strict())) params: { rewardId: string },
		@Body(new ZodValidationPipe(AdminRejectRewardSchema)) body: Parameters<RewardsAdminService["rejectReward"]>[2],
	): ReturnType<RewardsAdminService["rejectReward"]> {
		return this.rewardsAdminService.rejectReward(user.sub, params.rewardId, body);
	}
}

@ApiTags("Rewards Admin")
@ApiBearerAuth()
@RlsBypass()
@Controller(apiPath("/admin/merchants"))
export class RewardsAdminMerchantsController {
	public constructor(private readonly rewardsAdminService: RewardsAdminService) {}

	@RequirePermission("LIST", "MERCHANT_ORG")
	@Get()
	@ApiOperation({ summary: "List merchant organizations" })
	@ApiOkResponse({ description: "Paginated merchant org list" })
	public listMerchants(
		@Query(new ZodValidationPipe(apiContract.rewardsAdmin.listMerchants.input)) query: Parameters<RewardsAdminService["listMerchants"]>[0],
	): ReturnType<RewardsAdminService["listMerchants"]> {
		return this.rewardsAdminService.listMerchants(query);
	}

	@RequirePermission("MANAGE", "MERCHANT_ORG")
	@Patch(":merchantOrgId/kyb")
	@ApiOperation({ summary: "Update merchant KYB status" })
	@ApiBody({ type: AdminKybUpdateDto })
	@ApiOkResponse({ description: "KYB updated" })
	public async updateKyb(
		@Param(new ZodValidationPipe(z.object({ merchantOrgId: UuidParamSchema }).strict())) params: { merchantOrgId: string },
		@Body(new ZodValidationPipe(AdminKybUpdateSchema)) body: Parameters<RewardsAdminService["updateMerchantKyb"]>[1],
	): Promise<{ ok: true }> {
		await this.rewardsAdminService.updateMerchantKyb(params.merchantOrgId, body);
		return { ok: true };
	}
}
