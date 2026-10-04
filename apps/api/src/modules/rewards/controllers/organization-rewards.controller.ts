import { Controller, Get, HttpStatus, Patch, Post, UseInterceptors } from "@nestjs/common";
import { ApiBearerAuth, ApiBody, ApiOperation, ApiSecurity, ApiTags } from "@nestjs/swagger";
import { z } from "zod";
import type { MerchantKybDocumentDownloadResponse, MerchantKybProfileResponse, OrganizationRewardMembershipResponse } from "@workspace/shared";

import {
	FileDownloadDispositionSchema,
	MerchantApiKeyListQuerySchema,
	MerchantCreateApiKeySchema,
	MerchantCreateRewardSchema,
	MerchantKybSubmissionFieldsSchema,
	MerchantRedemptionListQuerySchema,
	MerchantRewardListQuerySchema,
	MerchantUpdateRewardSchema,
	RewardsAnalyticsQuerySchema,
	OrganizationSlugParamSchema,
	UuidParamSchema,
	apiContract,
	apiPath,
	OrganizationRewardMembershipListResponseSchema,
	MerchantKybProfileResponseSchema,
	MerchantKybDocumentDownloadResponseSchema,
	RewardResponseListSchema,
	RewardResponseSchema,
	MerchantApiKeySummarySchema,
	MerchantApiKeyCreatedSchema,
	OkResponseSchema,
	MerchantRedemptionListItemSchema,
	MerchantAnalyticsResponseSchema,
	MERCHANT_CAPABILITY,
} from "@workspace/shared";
import { ZodBody, ZodListQuery, ZodQuery, ZodParams } from "../../../common/decorators/zod-request.decorators";
import { ZodPaginatedResponse, ZodResponse } from "../../../common/decorators/zod-response.decorators";
import { AllowApiKeyAuth } from "../../api-keys/decorators/allow-api-key-auth.decorator";
import { GetMerchantActor } from "../../api-keys/decorators/get-merchant-actor.decorator";
import { MerchantActorInterceptor } from "../../api-keys/interceptors/merchant-actor.interceptor";
import type { MerchantActor } from "../../api-keys/types/merchant-actor.types";
import { SkipAuthThrottle } from "../../auth/decorators/skip-auth-throttle.decorator";
import { GetUser } from "../../auth/decorators/get-user.decorator";
import type { AccessTokenPayload } from "../../auth/services/token.service";
import { OrganizationRewardAuthService } from "../../organization/services/organization-reward-auth.service";

import { RewardsEmptyBodyDto } from "../dtos/rewards.dto";
import { MerchantApiKeyService } from "../services/merchant-api-key.service";
import { MerchantKybDocumentService } from "../services/merchant-kyb-document.service";
import { MerchantKybService } from "../services/merchant-kyb.service";
import { MerchantRewardService } from "../services/merchant-reward.service";
import { RewardsAnalyticsService } from "../services/rewards-analytics.service";

@ApiTags("Organization RewardHub")
@ApiBearerAuth()
@Controller(apiPath("/orgs/memberships"))
export class OrganizationMembershipsBootstrapController {
	public constructor(private readonly organizationRewardAuth: OrganizationRewardAuthService) {}

	@SkipAuthThrottle()
	@Get()
	@ApiOperation({ summary: "List RewardHub organization memberships for the current user" })
	@ZodResponse(OrganizationRewardMembershipListResponseSchema, { description: "Organization reward hub memberships" })
	public listMemberships(@GetUser() user: AccessTokenPayload): Promise<OrganizationRewardMembershipResponse[]> {
		return this.organizationRewardAuth.listMembershipsForUser(user.sub);
	}
}

@ApiTags("Organization RewardHub")
@ApiBearerAuth()
@Controller(apiPath("/orgs/:orgSlug"))
export class OrganizationRewardMembershipsController {
	public constructor(private readonly organizationRewardAuth: OrganizationRewardAuthService) {}

	@SkipAuthThrottle()
	@Get("memberships")
	@ApiOperation({ summary: "List organization memberships for the current user" })
	@ZodResponse(OrganizationRewardMembershipListResponseSchema, { description: "Organization reward hub memberships" })
	public listMemberships(
		@GetUser() user: AccessTokenPayload,
		@ZodParams(OrganizationSlugParamSchema) _params: z.output<typeof OrganizationSlugParamSchema>,
	): Promise<OrganizationRewardMembershipResponse[]> {
		return this.organizationRewardAuth.listMembershipsForUser(user.sub);
	}
}

@ApiTags("Organization KYB")
@ApiBearerAuth()
@Controller(apiPath("/orgs/:orgSlug/kyb"))
export class OrganizationKybController {
	public constructor(
		private readonly merchantKyb: MerchantKybService,
		private readonly organizationRewardAuth: OrganizationRewardAuthService,
		private readonly kybDocuments: MerchantKybDocumentService,
	) {}

	@SkipAuthThrottle()
	@Get()
	@ApiOperation({ summary: "Get the organization KYB profile (owner only)" })
	@ZodResponse(MerchantKybProfileResponseSchema, { description: "Organization KYB profile" })
	public async getProfile(
		@GetUser() user: AccessTokenPayload,
		@ZodParams(OrganizationSlugParamSchema) params: z.output<typeof OrganizationSlugParamSchema>,
	): Promise<MerchantKybProfileResponse> {
		await this.organizationRewardAuth.resolveOrganizationFromSlug(user.sub, params.orgSlug);
		return this.merchantKyb.getProfile(user.sub, params.orgSlug);
	}

	@Patch()
	@ApiOperation({ summary: "Submit or resubmit business verification details (owner only)" })
	@ZodResponse(MerchantKybProfileResponseSchema, { description: "Updated organization KYB profile" })
	public async submitKyb(
		@GetUser() user: AccessTokenPayload,
		@ZodParams(OrganizationSlugParamSchema) params: z.output<typeof OrganizationSlugParamSchema>,
		@ZodBody(MerchantKybSubmissionFieldsSchema) body: z.output<typeof MerchantKybSubmissionFieldsSchema>,
	): Promise<MerchantKybProfileResponse> {
		await this.organizationRewardAuth.resolveOrganizationFromSlug(user.sub, params.orgSlug);

		return this.merchantKyb.submitKyb(user.sub, params.orgSlug, body);
	}

	@Get("documents/:documentId/download")
	@ApiOperation({ summary: "Get a short-lived signed download URL for a CLEAN KYB document (owner only)" })
	@ZodResponse(MerchantKybDocumentDownloadResponseSchema, { description: "Signed download URL or scan status" })
	public async downloadDocument(
		@GetUser() user: AccessTokenPayload,
		@ZodParams(
			OrganizationSlugParamSchema.extend({
				documentId: UuidParamSchema,
			}).strict(),
		)
		params: { orgSlug: string; documentId: string },
		@ZodQuery(z.object({ disposition: FileDownloadDispositionSchema.optional() }).strict())
		query: {
			disposition?: "inline" | "attachment";
		},
	): Promise<MerchantKybDocumentDownloadResponse> {
		// KYB documents need `merchant:manage_verification` (owner-only), like the profile they belong to.
		const resolved = await this.organizationRewardAuth.requireCapabilityForSlug(user.sub, params.orgSlug, MERCHANT_CAPABILITY.manageVerification);
		return this.kybDocuments.getDownloadUrl(params.documentId, resolved.organizationId, query.disposition ?? "inline");
	}
}

@ApiTags("Organization Rewards")
@ApiBearerAuth()
@ApiSecurity("merchantApiKey")
@AllowApiKeyAuth()
@UseInterceptors(MerchantActorInterceptor)
@Controller(apiPath("/orgs/:orgSlug/rewards"))
export class OrganizationRewardsController {
	public constructor(private readonly merchantRewardService: MerchantRewardService) {}

	@SkipAuthThrottle()
	@Get()
	@ApiOperation({ summary: "List organization rewards" })
	@ZodResponse(RewardResponseListSchema, { description: "Rewards for the organization" })
	public listRewards(
		@GetMerchantActor() actor: MerchantActor,
		@ZodParams(OrganizationSlugParamSchema) _params: z.output<typeof OrganizationSlugParamSchema>,
		@ZodQuery(MerchantRewardListQuerySchema) query: z.output<typeof MerchantRewardListQuerySchema>,
	): ReturnType<MerchantRewardService["listRewards"]> {
		return this.merchantRewardService.listRewards(actor, query);
	}

	@SkipAuthThrottle()
	@Get(":rewardId")
	@ApiOperation({ summary: "Read one organization reward (404 when not offered at any of the caller's stores)" })
	@ZodResponse(RewardResponseSchema, { description: "Reward" })
	public getReward(
		@GetMerchantActor() actor: MerchantActor,
		@ZodParams(apiContract.organizations.rewards.get.input) params: z.output<typeof apiContract.organizations.rewards.get.input>,
	): ReturnType<MerchantRewardService["getReward"]> {
		return this.merchantRewardService.getReward(actor, params.rewardId);
	}

	@Post()
	@ApiOperation({ summary: "Create a draft reward" })
	@ZodResponse(RewardResponseSchema, { status: HttpStatus.CREATED, description: "Created reward" })
	public async createReward(
		@GetMerchantActor() actor: MerchantActor,
		@ZodParams(OrganizationSlugParamSchema) _params: z.output<typeof OrganizationSlugParamSchema>,
		@ZodBody(MerchantCreateRewardSchema) body: z.output<typeof MerchantCreateRewardSchema>,
	): ReturnType<MerchantRewardService["createReward"]> {
		return this.merchantRewardService.createReward(actor, body);
	}

	@Patch(":rewardId")
	@ApiOperation({ summary: "Update a draft or pending reward" })
	@ZodResponse(RewardResponseSchema, { description: "Updated reward" })
	public async updateReward(
		@GetMerchantActor() actor: MerchantActor,
		@ZodParams(z.object({ orgSlug: OrganizationSlugParamSchema.shape.orgSlug, rewardId: UuidParamSchema }).strict())
		params: { orgSlug: string; rewardId: string },
		@ZodBody(MerchantUpdateRewardSchema) body: z.output<typeof MerchantUpdateRewardSchema>,
	): ReturnType<MerchantRewardService["updateReward"]> {
		return this.merchantRewardService.updateReward(actor, params.rewardId, body);
	}

	@Post(":rewardId/publish")
	@ApiOperation({ summary: "Submit reward for moderation review (no body required)" })
	@ApiBody({ type: RewardsEmptyBodyDto, required: false })
	@ZodResponse(RewardResponseSchema, { status: HttpStatus.CREATED, description: "Reward pending review" })
	public publishReward(
		@GetMerchantActor() actor: MerchantActor,
		@ZodParams(apiContract.organizations.rewards.publish.input) params: { orgSlug: string; rewardId: string },
	): ReturnType<MerchantRewardService["publishReward"]> {
		return this.merchantRewardService.publishReward(actor, params.rewardId);
	}
}

@ApiTags("Organization API Keys")
@ApiBearerAuth()
@Controller(apiPath("/orgs/:orgSlug/api-keys"))
export class OrganizationApiKeysController {
	public constructor(
		private readonly merchantApiKeyService: MerchantApiKeyService,
		private readonly organizationRewardAuth: OrganizationRewardAuthService,
	) {}

	@SkipAuthThrottle()
	@Get()
	@ApiOperation({ summary: "List organization API keys" })
	@ZodPaginatedResponse(MerchantApiKeySummarySchema, { description: "Paginated API key summaries; pagination is in `meta`" })
	public async listKeys(
		@GetUser() user: AccessTokenPayload,
		@ZodParams(OrganizationSlugParamSchema) params: z.output<typeof OrganizationSlugParamSchema>,
		@ZodListQuery(MerchantApiKeyListQuerySchema) query: z.output<typeof MerchantApiKeyListQuerySchema>,
	): ReturnType<MerchantApiKeyService["listKeys"]> {
		await this.organizationRewardAuth.resolveOrganizationFromSlug(user.sub, params.orgSlug);
		return this.merchantApiKeyService.listKeys(user.sub, params.orgSlug, query);
	}

	@Post()
	@ApiOperation({ summary: "Create a POS API key" })
	@ZodResponse(MerchantApiKeyCreatedSchema, { status: HttpStatus.CREATED, description: "API key created (shown once)" })
	public async createKey(
		@GetUser() user: AccessTokenPayload,
		@ZodParams(OrganizationSlugParamSchema) params: z.output<typeof OrganizationSlugParamSchema>,
		@ZodBody(MerchantCreateApiKeySchema) body: z.output<typeof MerchantCreateApiKeySchema>,
	): ReturnType<MerchantApiKeyService["createKey"]> {
		await this.organizationRewardAuth.resolveOrganizationFromSlug(user.sub, params.orgSlug);

		return this.merchantApiKeyService.createKey(user.sub, params.orgSlug, body);
	}

	@Post(":keyId/revoke")
	@ApiOperation({ summary: "Revoke a POS API key (no body required)" })
	@ApiBody({ type: RewardsEmptyBodyDto, required: false })
	@ZodResponse(OkResponseSchema, { status: HttpStatus.CREATED, description: "API key revoked" })
	public async revokeKey(
		@GetUser() user: AccessTokenPayload,
		@ZodParams(apiContract.organizations.apiKeys.revoke.input) params: { orgSlug: string; keyId: string },
	): ReturnType<MerchantApiKeyService["revokeKey"]> {
		await this.organizationRewardAuth.resolveOrganizationFromSlug(user.sub, params.orgSlug);

		return this.merchantApiKeyService.revokeKey(user.sub, params.orgSlug, params.keyId);
	}
}

@ApiTags("Organization Redemptions")
@ApiBearerAuth()
@ApiSecurity("merchantApiKey")
@AllowApiKeyAuth()
@UseInterceptors(MerchantActorInterceptor)
@Controller(apiPath("/orgs/:orgSlug/redemptions"))
export class OrganizationRedemptionsController {
	public constructor(private readonly merchantRewardService: MerchantRewardService) {}

	@SkipAuthThrottle()
	@Get()
	@ApiOperation({ summary: "List organization redemptions" })
	@ZodPaginatedResponse(MerchantRedemptionListItemSchema, { description: "Paginated redemption history" })
	public listRedemptions(
		@GetMerchantActor() actor: MerchantActor,
		@ZodParams(OrganizationSlugParamSchema) _params: z.output<typeof OrganizationSlugParamSchema>,
		@ZodListQuery(MerchantRedemptionListQuerySchema) query: z.output<typeof MerchantRedemptionListQuerySchema>,
	): ReturnType<MerchantRewardService["listRedemptions"]> {
		return this.merchantRewardService.listRedemptions(actor, query);
	}
}

@ApiTags("Organization Analytics")
@ApiBearerAuth()
@ApiSecurity("merchantApiKey")
@AllowApiKeyAuth()
@UseInterceptors(MerchantActorInterceptor)
@Controller(apiPath("/orgs/:orgSlug/analytics"))
export class OrganizationAnalyticsController {
	public constructor(private readonly rewardsAnalyticsService: RewardsAnalyticsService) {}

	@SkipAuthThrottle()
	@Get()
	@ApiOperation({ summary: "Organization reward performance analytics" })
	@ZodResponse(MerchantAnalyticsResponseSchema, { description: "Summary metrics, trends, and top rewards" })
	public getAnalytics(
		@GetMerchantActor() actor: MerchantActor,
		@ZodParams(OrganizationSlugParamSchema) _params: z.output<typeof OrganizationSlugParamSchema>,
		@ZodQuery(RewardsAnalyticsQuerySchema) query: z.output<typeof RewardsAnalyticsQuerySchema>,
	): ReturnType<RewardsAnalyticsService["getMerchantAnalytics"]> {
		return this.rewardsAnalyticsService.getMerchantAnalytics(actor, query);
	}
}
