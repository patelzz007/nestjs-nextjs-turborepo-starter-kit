import { Body, Controller, Get, Param, Patch, Post, Query } from "@nestjs/common";
import { ApiBearerAuth, ApiBody, ApiOkResponse, ApiOperation, ApiTags } from "@nestjs/swagger";
import { z } from "zod";

import { AdminKybUpdateSchema, apiContract, apiPath, FileDownloadDispositionSchema, UuidParamSchema } from "@workspace/shared";
import { ZodValidationPipe } from "../../../common/pipes/zod-validation.pipe";
import { RlsBypass } from "../../auth/decorators/rls-bypass.decorator";
import { RequirePermission } from "../../auth/decorators/require-permission.decorator";
import { GetUser } from "../../auth/decorators/get-user.decorator";
import type { AccessTokenPayload } from "../../auth/services/token.service";

import { AdminCreateMerchantInviteDto, AdminKybUpdateDto, AdminRejectRewardDto, RewardsEmptyBodyDto } from "../dtos/rewards.dto";
import type { MerchantKybDocumentDownloadResponse } from "@workspace/shared";

import { MerchantKybDocumentService } from "../services/merchant-kyb-document.service";
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
		@Body(new ZodValidationPipe(apiContract.rewardsAdmin.rejectReward.input)) body: Parameters<RewardsAdminService["rejectReward"]>[2],
	): ReturnType<RewardsAdminService["rejectReward"]> {
		return this.rewardsAdminService.rejectReward(user.sub, params.rewardId, body);
	}
}

@ApiTags("Rewards Admin")
@ApiBearerAuth()
@RlsBypass()
@Controller(apiPath("/admin/merchants"))
export class RewardsAdminMerchantsController {
	public constructor(
		private readonly rewardsAdminService: RewardsAdminService,
		private readonly kybDocuments: MerchantKybDocumentService,
	) {}

	@RequirePermission("LIST", "MERCHANT_ORG")
	@Get()
	@ApiOperation({ summary: "List merchant organizations" })
	@ApiOkResponse({ description: "Paginated merchant org list" })
	public listMerchants(
		@Query(new ZodValidationPipe(apiContract.rewardsAdmin.listOrganizations.input)) query: Parameters<RewardsAdminService["listMerchants"]>[0],
	): ReturnType<RewardsAdminService["listMerchants"]> {
		return this.rewardsAdminService.listMerchants(query);
	}

	@RequirePermission("LIST", "MERCHANT_ORG")
	@Get(":organizationId")
	@ApiOperation({ summary: "Get merchant organization detail for KYB review" })
	@ApiOkResponse({ description: "Merchant org detail with KYB payload" })
	public getMerchant(
		@Param(new ZodValidationPipe(apiContract.rewardsAdmin.getOrganization.input)) params: { organizationId: string },
	): ReturnType<RewardsAdminService["getMerchantDetail"]> {
		return this.rewardsAdminService.getMerchantDetail(params.organizationId);
	}

	@RequirePermission("LIST", "MERCHANT_ORG")
	@Get(":organizationId/documents/:documentId/download")
	@ApiOperation({ summary: "Get a short-lived signed download URL for a merchant KYB document" })
	@ApiOkResponse({ description: "Signed download URL or scan status" })
	public downloadDocument(
		@Param(new ZodValidationPipe(z.object({ organizationId: UuidParamSchema, documentId: UuidParamSchema }).strict()))
		params: {
			organizationId: string;
			documentId: string;
		},
		@Query(new ZodValidationPipe(z.object({ disposition: FileDownloadDispositionSchema.optional() }).strict()))
		query: {
			disposition?: "inline" | "attachment";
		},
	): Promise<MerchantKybDocumentDownloadResponse> {
		return this.kybDocuments.getDownloadUrl(params.documentId, params.organizationId, query.disposition ?? "inline");
	}

	@RequirePermission("MANAGE", "MERCHANT_ORG")
	@Patch(":organizationId/kyb")
	@ApiOperation({ summary: "Update merchant KYB status" })
	@ApiBody({ type: AdminKybUpdateDto })
	@ApiOkResponse({ description: "KYB updated" })
	public async updateKyb(
		@Param(new ZodValidationPipe(apiContract.rewardsAdmin.updateKyb.input)) params: { organizationId: string },
		@Body(new ZodValidationPipe(AdminKybUpdateSchema)) body: Parameters<RewardsAdminService["updateMerchantKyb"]>[1],
	): Promise<{ ok: true }> {
		await this.rewardsAdminService.updateMerchantKyb(params.organizationId, body);
		return { ok: true };
	}
}
