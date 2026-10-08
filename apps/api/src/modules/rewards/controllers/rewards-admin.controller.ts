import { Controller, Get, HttpStatus, Patch, Post, Req, Res, UseGuards } from "@nestjs/common";
import { ApiBearerAuth, ApiBody, ApiOperation, ApiTags } from "@nestjs/swagger";
import { z } from "zod";

import {
	AdminAnalyticsDashboardSchema,
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
	RewardResponseSchema,
	AdminLocationRequestResponseSchema,
	MerchantOrgResponseSchema,
	AdminMerchantDetailResponseSchema,
	MerchantKybDocumentDownloadResponseSchema,
	OkResponseSchema,
	OrganizationLocationResponseSchema,
} from "@workspace/shared";
import { ZodBody, ZodListQuery, ZodQuery, ZodParams } from "../../../common/decorators/zod-request.decorators";
import { ZodFileResponse, ZodPaginatedResponse, ZodResponse } from "../../../common/decorators/zod-response.decorators";
import { RlsBypass } from "../../auth/decorators/rls-bypass.decorator";
import { RequirePermission } from "../../auth/decorators/require-permission.decorator";
import { GetUser } from "../../auth/decorators/get-user.decorator";
import type { AccessTokenPayload } from "../../auth/services/token.service";

import { RewardsEmptyBodyDto } from "../dtos/rewards.dto";
import type { AdminAnalyticsDashboard, MerchantKybDocumentDownloadResponse } from "@workspace/shared";
import type { FastifyReply, FastifyRequest } from "fastify";

import { OrganizationLocationService } from "../../organization/services/organization-location.service";
import { MerchantKybDocumentService } from "../services/merchant-kyb-document.service";
import { RewardsAdminService } from "../services/rewards-admin.service";
import { RewardsAnalyticsService } from "../services/rewards-analytics.service";
import { AnalyticsDashboardService } from "../analytics/analytics-dashboard.service";
import { ANALYTICS_DASHBOARD_OPERATION_DESCRIPTION, ANALYTICS_EXPORT_OPERATION_DESCRIPTION } from "../analytics/analytics-api-docs";
import { AnalyticsExportRateLimitGuard } from "../analytics/analytics-export-rate-limit.guard";
import { AnalyticsExportService } from "../analytics/analytics-export.service";
import { sendAnalyticsExport } from "../analytics/analytics-export.reply";

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

	// A pure render (no state change), so a GET: the admin page re-renders it live as the form is typed.
	@RequirePermission("MANAGE", "MERCHANT_ORG")
	@Get("preview-email")
	@ApiOperation({
		summary: "Preview merchant invite email (does not send)",
		description:
			"Renders the invite email for a business name and pilot city, for a live preview while the invite is composed. The template's sample business name stands in when none is given. The recipient is not an input: the email body never shows it.",
	})
	@ZodResponse(EmailPreviewSchema, { description: "Rendered invite email preview" })
	public previewInviteEmail(
		@ZodQuery(apiContract.rewardsAdmin.previewInviteEmail.input) query: z.output<typeof apiContract.rewardsAdmin.previewInviteEmail.input>,
	): ReturnType<RewardsAdminService["previewMerchantInviteEmail"]> {
		return this.rewardsAdminService.previewMerchantInviteEmail(query);
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
	@ApiOperation({ summary: "List rewards pending moderation (oldest first, paginated)" })
	@ZodPaginatedResponse(RewardResponseSchema, { description: "One page of pending rewards" })
	public listPendingRewards(
		@ZodListQuery(apiContract.rewardsAdmin.pendingRewards.input) query: z.output<typeof apiContract.rewardsAdmin.pendingRewards.input>,
	): ReturnType<RewardsAdminService["listPendingRewards"]> {
		return this.rewardsAdminService.listPendingRewards(query);
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
	@ApiOperation({ summary: "Update merchant KYB status (REJECTED / ACTION_REQUIRED require kybFields.rejectionReason)" })
	@ZodResponse(OkResponseSchema, { description: "KYB updated" })
	public async updateKyb(
		@ZodParams(apiContract.rewardsAdmin.getOrganization.input) params: { organizationId: string },
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
	public constructor(
		private readonly analytics: RewardsAnalyticsService,
		private readonly dashboards: AnalyticsDashboardService,
		private readonly exports: AnalyticsExportService,
	) {}

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

	/** Authorization: `READ ANALYTICS` (platform admins); platform-wide, buckets in UTC. */
	@RequirePermission("READ", "ANALYTICS")
	@Get("dashboard")
	@ApiOperation({
		summary: "Platform analytics dashboard: custom range + interval, compared totals, series, top merchants, categories, cities, new vs returning customers",
		description: ANALYTICS_DASHBOARD_OPERATION_DESCRIPTION,
	})
	@ZodResponse(AdminAnalyticsDashboardSchema, { description: "Platform analytics dashboard" })
	public getDashboard(
		@ZodQuery(apiContract.rewardsAdmin.analyticsDashboard.input) query: z.output<typeof apiContract.rewardsAdmin.analyticsDashboard.input>,
	): Promise<AdminAnalyticsDashboard> {
		return this.dashboards.getAdminDashboard(query);
	}

	/** Authorization: `READ ANALYTICS`. Rate-limited per admin (`ANALYTICS_EXPORT_RATE_LIMIT`); every export writes an audit row. */
	@RequirePermission("READ", "ANALYTICS")
	@UseGuards(AnalyticsExportRateLimitGuard)
	@Get("export")
	@ApiOperation({
		summary: "Download the platform analytics report (csv | xlsx | pdf) for a date range",
		description: ANALYTICS_EXPORT_OPERATION_DESCRIPTION,
	})
	@ZodFileResponse(apiContract.rewardsAdmin.analyticsExport.response, { description: "The report file (Content-Disposition: attachment)" })
	public async exportReport(
		@ZodQuery(apiContract.rewardsAdmin.analyticsExport.input) query: z.output<typeof apiContract.rewardsAdmin.analyticsExport.input>,
		@Req() request: FastifyRequest,
		@Res() reply: FastifyReply,
	): Promise<void> {
		await sendAnalyticsExport(reply, await this.exports.exportPlatformReport(query, request));
	}
}
