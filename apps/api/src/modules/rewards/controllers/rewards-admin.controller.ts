import { Controller, Get, HttpStatus, Patch, Post } from "@nestjs/common";
import { ApiBearerAuth, ApiBody, ApiOperation, ApiTags } from "@nestjs/swagger";
import { z } from "zod";

import {
	AdminKybUpdateSchema,
	AdminSalesAnalyticsResponseSchema,
	AdminOrganizationLocationCreateSchema,
	AdminOrganizationLocationReviewPathInputSchema,
	AdminOrganizationLocationReviewSchema,
	apiContract,
	apiPath,
	FileDownloadDispositionSchema,
	UuidParamSchema,
	AdminMerchantInviteCreatedResponseSchema,
	EmailPreviewSchema,
	RewardResponseListSchema,
	RewardResponseSchema,
	AdminLocationRequestResponseSchema,
	MerchantOrgResponseSchema,
	AdminMerchantDetailResponseSchema,
	MerchantKybDocumentDownloadResponseSchema,
	OkResponseSchema,
	OrganizationLocationResponseSchema,
} from "@workspace/shared";
import { ZodBody, ZodListQuery, ZodQuery, ZodParams } from "../../../common/decorators/zod-request.decorators";
import { ZodPaginatedResponse, ZodResponse } from "../../../common/decorators/zod-response.decorators";
import { RlsBypass } from "../../auth/decorators/rls-bypass.decorator";
import { RequirePermission } from "../../auth/decorators/require-permission.decorator";
import { GetUser } from "../../auth/decorators/get-user.decorator";
import type { AccessTokenPayload } from "../../auth/services/token.service";

import { RewardsEmptyBodyDto } from "../dtos/rewards.dto";
import type { MerchantKybDocumentDownloadResponse } from "@workspace/shared";

import { OrganizationLocationService } from "../../organization/services/organization-location.service";
import { MerchantKybDocumentService } from "../services/merchant-kyb-document.service";
import { RewardsAdminService } from "../services/rewards-admin.service";
import { RewardsAnalyticsService } from "../services/rewards-analytics.service";

@ApiTags("Rewards Admin")
@ApiBearerAuth()
@RlsBypass()
@Controller(apiPath("/admin/invites"))
export class RewardsAdminInvitesController {
	public constructor(private readonly rewardsAdminService: RewardsAdminService) {}

	@RequirePermission("MANAGE", "MERCHANT_ORG")
	@Post()
	@ApiOperation({ summary: "Create merchant invite" })
	@ZodResponse(AdminMerchantInviteCreatedResponseSchema, { status: HttpStatus.CREATED, description: "Invite created with token" })
	public createInvite(
		@GetUser() user: AccessTokenPayload,
		@ZodBody(apiContract.rewardsAdmin.createInvite.input) body: z.output<typeof apiContract.rewardsAdmin.createInvite.input>,
	): ReturnType<RewardsAdminService["createMerchantInvite"]> {
		return this.rewardsAdminService.createMerchantInvite(user.sub, body);
	}

	@RequirePermission("MANAGE", "MERCHANT_ORG")
	@Post("preview-email")
	@ApiOperation({ summary: "Preview merchant invite email with form data (does not send)" })
	@ZodResponse(EmailPreviewSchema, { status: HttpStatus.CREATED, description: "Rendered invite email preview" })
	public previewInviteEmail(
		@ZodBody(apiContract.rewardsAdmin.previewInviteEmail.input) body: z.output<typeof apiContract.rewardsAdmin.previewInviteEmail.input>,
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
	@ZodResponse(RewardResponseListSchema, { description: "Pending rewards" })
	public listPendingRewards(): ReturnType<RewardsAdminService["listPendingRewards"]> {
		return this.rewardsAdminService.listPendingRewards();
	}

	@RequirePermission("MANAGE", "REWARD")
	@Post(":rewardId/approve")
	@ApiOperation({ summary: "Approve a pending reward (no body required)" })
	@ApiBody({ type: RewardsEmptyBodyDto, required: false })
	@ZodResponse(RewardResponseSchema, { status: HttpStatus.CREATED, description: "Approved reward" })
	public approveReward(
		@GetUser() user: AccessTokenPayload,
		@ZodParams(apiContract.rewardsAdmin.approveReward.input) params: { rewardId: string },
	): ReturnType<RewardsAdminService["approveReward"]> {
		return this.rewardsAdminService.approveReward(user.sub, params.rewardId);
	}

	@RequirePermission("MANAGE", "REWARD")
	@Post(":rewardId/reject")
	@ApiOperation({ summary: "Reject a pending reward" })
	@ZodResponse(RewardResponseSchema, { status: HttpStatus.CREATED, description: "Reward returned to draft" })
	public rejectReward(
		@GetUser() user: AccessTokenPayload,
		@ZodParams(z.object({ rewardId: UuidParamSchema }).strict()) params: { rewardId: string },
		@ZodBody(apiContract.rewardsAdmin.rejectReward.input) body: z.output<typeof apiContract.rewardsAdmin.rejectReward.input>,
	): ReturnType<RewardsAdminService["rejectReward"]> {
		return this.rewardsAdminService.rejectReward(user.sub, params.rewardId, body);
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
	@ZodPaginatedResponse(AdminLocationRequestResponseSchema, { description: "Paginated location requests" })
	public listLocationRequests(
		@ZodListQuery(apiContract.rewardsAdmin.listLocationRequests.input) query: z.output<typeof apiContract.rewardsAdmin.listLocationRequests.input>,
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
	@ZodPaginatedResponse(MerchantOrgResponseSchema, { description: "Paginated merchant org list" })
	public listMerchants(
		@ZodListQuery(apiContract.rewardsAdmin.listOrganizations.input) query: z.output<typeof apiContract.rewardsAdmin.listOrganizations.input>,
	): ReturnType<RewardsAdminService["listMerchants"]> {
		return this.rewardsAdminService.listMerchants(query);
	}

	@RequirePermission("LIST", "MERCHANT_ORG")
	@Get(":organizationId")
	@ApiOperation({ summary: "Get merchant organization detail for KYB review" })
	@ZodResponse(AdminMerchantDetailResponseSchema, { description: "Merchant org detail with KYB payload" })
	public getMerchant(@ZodParams(apiContract.rewardsAdmin.getOrganization.input) params: { organizationId: string }): ReturnType<RewardsAdminService["getMerchantDetail"]> {
		return this.rewardsAdminService.getMerchantDetail(params.organizationId);
	}

	@RequirePermission("LIST", "MERCHANT_ORG")
	@Get(":organizationId/documents/:documentId/download")
	@ApiOperation({ summary: "Get a short-lived signed download URL for a merchant KYB document" })
	@ZodResponse(MerchantKybDocumentDownloadResponseSchema, { description: "Signed download URL or scan status" })
	public downloadDocument(
		@ZodParams(z.object({ organizationId: UuidParamSchema, documentId: UuidParamSchema }).strict())
		params: {
			organizationId: string;
			documentId: string;
		},
		@ZodQuery(z.object({ disposition: FileDownloadDispositionSchema.optional() }).strict())
		query: {
			disposition?: "inline" | "attachment";
		},
	): Promise<MerchantKybDocumentDownloadResponse> {
		return this.kybDocuments.getDownloadUrl(params.documentId, params.organizationId, query.disposition ?? "inline");
	}

	@RequirePermission("MANAGE", "MERCHANT_ORG")
	@Patch(":organizationId/kyb")
	@ApiOperation({ summary: "Update merchant KYB status" })
	@ZodResponse(OkResponseSchema, { description: "KYB updated" })
	public async updateKyb(
		@ZodParams(apiContract.rewardsAdmin.updateKyb.input) params: { organizationId: string },
		@ZodBody(AdminKybUpdateSchema) body: z.output<typeof AdminKybUpdateSchema>,
	): Promise<{ ok: true }> {
		await this.rewardsAdminService.updateMerchantKyb(params.organizationId, body);
		return { ok: true };
	}

	@RequirePermission("MANAGE", "MERCHANT_ORG")
	@Post(":organizationId/locations")
	@ApiOperation({ summary: "Create an organization store location" })
	@ZodResponse(OrganizationLocationResponseSchema, { status: HttpStatus.CREATED, description: "Organization location created" })
	public createLocation(
		@GetUser() user: AccessTokenPayload,
		@ZodParams(apiContract.rewardsAdmin.getOrganization.input) params: { organizationId: string },
		@ZodBody(AdminOrganizationLocationCreateSchema) body: z.output<typeof AdminOrganizationLocationCreateSchema>,
	): ReturnType<OrganizationLocationService["createAdminLocation"]> {
		return this.organizationLocations.createAdminLocation(user.sub, params.organizationId, body);
	}

	@RequirePermission("MANAGE", "MERCHANT_ORG")
	@Patch(":organizationId/locations/:locationId/review")
	@ApiOperation({ summary: "Approve or reject an organization store location request" })
	@ZodResponse(OrganizationLocationResponseSchema, { description: "Organization location reviewed" })
	public reviewLocation(
		@GetUser() user: AccessTokenPayload,
		@ZodParams(AdminOrganizationLocationReviewPathInputSchema) params: { organizationId: string; locationId: string },
		@ZodBody(AdminOrganizationLocationReviewSchema) body: z.output<typeof AdminOrganizationLocationReviewSchema>,
	): ReturnType<OrganizationLocationService["reviewAdminLocation"]> {
		return this.organizationLocations.reviewAdminLocation(user.sub, params.organizationId, params.locationId, body);
	}
}

@ApiTags("Rewards Admin")
@ApiBearerAuth()
@RlsBypass()
@Controller(apiPath("/admin/analytics"))
export class RewardsAdminAnalyticsController {
	public constructor(private readonly analytics: RewardsAnalyticsService) {}

	@RequirePermission("READ", "ANALYTICS")
	@Get("sales")
	@ApiOperation({ summary: "Platform-wide sales: paid POS bills, compared with the previous period, plus top merchants" })
	@ZodResponse(AdminSalesAnalyticsResponseSchema, { description: "Platform sales analytics" })
	public getSales(
		@GetUser() user: AccessTokenPayload,
		@ZodQuery(apiContract.rewardsAdmin.salesAnalytics.input) query: z.output<typeof apiContract.rewardsAdmin.salesAnalytics.input>,
	): ReturnType<RewardsAnalyticsService["getAdminSalesAnalytics"]> {
		return this.analytics.getAdminSalesAnalytics(user.sub, query);
	}
}
