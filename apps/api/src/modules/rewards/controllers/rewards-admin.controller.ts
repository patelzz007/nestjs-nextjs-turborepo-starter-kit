import { Body, Controller, Get, Param, Patch, Post, Query } from "@nestjs/common";
import { ApiBearerAuth, ApiBody, ApiOkResponse, ApiOperation, ApiTags } from "@nestjs/swagger";
import { z } from "zod";

import {
	AdminKybUpdateSchema,
	AdminOrganizationLocationCreateSchema,
	AdminOrganizationLocationReviewPathInputSchema,
	AdminOrganizationLocationReviewSchema,
	apiContract,
	apiPath,
	FileDownloadDispositionSchema,
	UuidParamSchema,
} from "@workspace/shared";
import { ZodValidationPipe } from "../../../common/pipes/zod-validation.pipe";
import { RlsBypass } from "../../auth/decorators/rls-bypass.decorator";
import { RequirePermission } from "../../auth/decorators/require-permission.decorator";
import { GetUser } from "../../auth/decorators/get-user.decorator";
import type { AccessTokenPayload } from "../../auth/services/token.service";

import { AdminCreateMerchantInviteDto, AdminKybUpdateDto, AdminRejectRewardDto, RewardsEmptyBodyDto } from "../dtos/rewards.dto";
import type { MerchantKybDocumentDownloadResponse } from "@workspace/shared";

import { OrganizationLocationService } from "../../organization/services/organization-location.service";
import { MerchantKybDocumentService } from "../services/merchant-kyb-document.service";
import { RewardsAdminService } from "../services/rewards-admin.service";

@ApiTags("Rewards Admin")
@ApiBearerAuth()
@RlsBypass()
@Controller(apiPath("/admin/invites"))
export class RewardsAdminInvitesController {
	public constructor(
		private readonly rewardsAdminService: RewardsAdminService,
	) {}

	@RequirePermission("MANAGE", "MERCHANT_ORG")
	@Post()
	@ApiOperation({ summary: "Create merchant invite" })
	@ApiBody({ type: AdminCreateMerchantInviteDto })
	@ApiOkResponse({ description: "Invite created with token" })
	public async createInvite(
		@GetUser() user: AccessTokenPayload,
		@Body(new ZodValidationPipe(apiContract.rewardsAdmin.createInvite.input)) body: Parameters<RewardsAdminService["createMerchantInvite"]>[1],
	): Promise<ReturnType<RewardsAdminService["createMerchantInvite"]>> {
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
	public constructor(
		private readonly rewardsAdminService: RewardsAdminService,
	) {}

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
	public async approveReward(
		@GetUser() user: AccessTokenPayload,
		@Param(new ZodValidationPipe(apiContract.rewardsAdmin.approveReward.input)) params: { rewardId: string },
	): Promise<ReturnType<RewardsAdminService["approveReward"]>> {
	}

	@RequirePermission("MANAGE", "REWARD")
	@Post(":rewardId/reject")
	@ApiOperation({ summary: "Reject a pending reward" })
	@ApiBody({ type: AdminRejectRewardDto })
	@ApiOkResponse({ description: "Reward returned to draft" })
	public async rejectReward(
		@GetUser() user: AccessTokenPayload,
		@Param(new ZodValidationPipe(z.object({ rewardId: UuidParamSchema }).strict())) params: { rewardId: string },
		@Body(new ZodValidationPipe(apiContract.rewardsAdmin.rejectReward.input)) body: Parameters<RewardsAdminService["rejectReward"]>[2],
	): Promise<ReturnType<RewardsAdminService["rejectReward"]>> {
	}
}

@ApiTags("Rewards Admin")
@ApiBearerAuth()
@RlsBypass()
@Controller(apiPath("/admin/location-requests"))
export class RewardsAdminLocationRequestsController {
	public constructor(private readonly organizationLocations: OrganizationLocationService) {}

	@RequirePermission("LIST", "MERCHANT_ORG")
	@Get()
	@ApiOperation({ summary: "List pending organization store location requests" })
	@ApiOkResponse({ description: "Paginated location requests" })
	public listLocationRequests(
		@Query(new ZodValidationPipe(apiContract.rewardsAdmin.listLocationRequests.input)) query: Parameters<OrganizationLocationService["listAdminLocationRequests"]>[0],
	): ReturnType<OrganizationLocationService["listAdminLocationRequests"]> {
		return this.organizationLocations.listAdminLocationRequests(query);
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
		private readonly organizationLocations: OrganizationLocationService,
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

	@RequirePermission("MANAGE", "MERCHANT_ORG")
	@Post(":organizationId/locations")
	@ApiOperation({ summary: "Create an organization store location" })
	@ApiOkResponse({ description: "Organization location created" })
	public createLocation(
		@GetUser() user: AccessTokenPayload,
		@Param(new ZodValidationPipe(apiContract.rewardsAdmin.getOrganization.input)) params: { organizationId: string },
		@Body(new ZodValidationPipe(AdminOrganizationLocationCreateSchema)) body: Parameters<OrganizationLocationService["createAdminLocation"]>[2],
	): ReturnType<OrganizationLocationService["createAdminLocation"]> {
		return this.organizationLocations.createAdminLocation(user.sub, params.organizationId, body);
	}

	@RequirePermission("MANAGE", "MERCHANT_ORG")
	@Patch(":organizationId/locations/:locationId/review")
	@ApiOperation({ summary: "Approve or reject an organization store location request" })
	@ApiOkResponse({ description: "Organization location reviewed" })
	public reviewLocation(
		@GetUser() user: AccessTokenPayload,
		@Param(new ZodValidationPipe(AdminOrganizationLocationReviewPathInputSchema)) params: { organizationId: string; locationId: string },
		@Body(new ZodValidationPipe(AdminOrganizationLocationReviewSchema)) body: Parameters<OrganizationLocationService["reviewAdminLocation"]>[3],
	): ReturnType<OrganizationLocationService["reviewAdminLocation"]> {
		return this.organizationLocations.reviewAdminLocation(user.sub, params.organizationId, params.locationId, body);
	}
}
