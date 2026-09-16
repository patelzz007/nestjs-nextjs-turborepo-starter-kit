import { Body, Controller, Get, Param, Patch, Post, Query, UseInterceptors } from "@nestjs/common";
import { ApiBearerAuth, ApiBody, ApiOkResponse, ApiOperation, ApiSecurity, ApiTags } from "@nestjs/swagger";
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
} from "@workspace/shared";
import { ZodValidationPipe } from "../../../common/pipes/zod-validation.pipe";
import { AllowApiKeyAuth } from "../../api-keys/decorators/allow-api-key-auth.decorator";
import { GetMerchantActor } from "../../api-keys/decorators/get-merchant-actor.decorator";
import { MerchantActorInterceptor } from "../../api-keys/interceptors/merchant-actor.interceptor";
import type { MerchantActor } from "../../api-keys/types/merchant-actor.types";
import { SkipAuthThrottle } from "../../auth/decorators/skip-auth-throttle.decorator";
import { GetUser } from "../../auth/decorators/get-user.decorator";
import type { AccessTokenPayload } from "../../auth/services/token.service";
import { KernelIntegrationHelper } from "../../authorization/kernel/kernel-integration.helper";
import { OrganizationRewardAuthService } from "../../organization/services/organization-reward-auth.service";

import { MerchantCreateApiKeyDto, MerchantCreateRewardDto, MerchantUpdateRewardDto, RewardsEmptyBodyDto } from "../dtos/rewards.dto";
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
	@ApiOkResponse({ description: "Organization reward hub memberships" })
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
	@ApiOkResponse({ description: "Organization reward hub memberships" })
	public listMemberships(@GetUser() user: AccessTokenPayload): Promise<OrganizationRewardMembershipResponse[]> {
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
		private readonly kernelHelper: KernelIntegrationHelper,
	) {}

	@SkipAuthThrottle()
	@Get()
	@ApiOperation({ summary: "Get the organization KYB profile" })
	@ApiOkResponse({ description: "Organization KYB profile" })
	public async getProfile(
		@GetUser() user: AccessTokenPayload,
		@Param(new ZodValidationPipe(OrganizationSlugParamSchema)) params: z.output<typeof OrganizationSlugParamSchema>,
	): Promise<MerchantKybProfileResponse> {
		await this.organizationRewardAuth.resolveOrganizationFromSlug(user.sub, params.orgSlug);
		return this.merchantKyb.getProfile(user.sub, params.orgSlug);
	}

	@Patch()
	@ApiOperation({ summary: "Submit or resubmit business verification details (owner only)" })
	@ApiOkResponse({ description: "Updated organization KYB profile" })
	public async submitKyb(
		@GetUser() user: AccessTokenPayload,
		@Param(new ZodValidationPipe(OrganizationSlugParamSchema)) params: z.output<typeof OrganizationSlugParamSchema>,
		@Body(new ZodValidationPipe(MerchantKybSubmissionFieldsSchema)) body: z.output<typeof MerchantKybSubmissionFieldsSchema>,
	): Promise<MerchantKybProfileResponse> {
		const resolved = await this.organizationRewardAuth.resolveOrganizationFromSlug(user.sub, params.orgSlug);
		
		await this.kernelHelper.requireAction(user.sub, "UPDATE", "ORGANIZATION", {
			organizationId: resolved.organizationId,
		});
		
		return this.merchantKyb.submitKyb(user.sub, params.orgSlug, body);
	}

	@Get("documents/:documentId/download")
	@ApiOperation({ summary: "Get a short-lived signed download URL for a CLEAN KYB document" })
	@ApiOkResponse({ description: "Signed download URL or scan status" })
	public async downloadDocument(
		@GetUser() user: AccessTokenPayload,
		@Param(
			new ZodValidationPipe(
				OrganizationSlugParamSchema.extend({
					documentId: UuidParamSchema,
				}).strict(),
			),
		)
		params: { orgSlug: string; documentId: string },
		@Query(new ZodValidationPipe(z.object({ disposition: FileDownloadDispositionSchema.optional() }).strict()))
		query: {
			disposition?: "inline" | "attachment";
		},
	): Promise<MerchantKybDocumentDownloadResponse> {
		const resolved = await this.organizationRewardAuth.resolveOrganizationFromSlug(user.sub, params.orgSlug);
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
	public constructor(
		private readonly merchantRewardService: MerchantRewardService,
		private readonly kernelHelper: KernelIntegrationHelper,
	) {}

	@SkipAuthThrottle()
	@Get()
	@ApiOperation({ summary: "List organization rewards" })
	@ApiOkResponse({ description: "Rewards for the organization" })
	public listRewards(
		@GetMerchantActor() actor: MerchantActor,
		@Query(new ZodValidationPipe(MerchantRewardListQuerySchema)) query: z.output<typeof MerchantRewardListQuerySchema>,
	): ReturnType<MerchantRewardService["listRewards"]> {
		return this.merchantRewardService.listRewards(actor, query);
	}

	@Post()
	@ApiOperation({ summary: "Create a draft reward" })
	@ApiBody({ type: MerchantCreateRewardDto })
	@ApiOkResponse({ description: "Created reward" })
	public async createReward(
		@GetMerchantActor() actor: MerchantActor,
		@Param(new ZodValidationPipe(OrganizationSlugParamSchema)) _params: z.output<typeof OrganizationSlugParamSchema>,
		@Body(new ZodValidationPipe(MerchantCreateRewardSchema)) body: Parameters<MerchantRewardService["createReward"]>[1],
	): ReturnType<MerchantRewardService["createReward"]> {
		await this.kernelHelper.requireAction(actor.userId, "CREATE", "ORDER", {
			organizationId: actor.organizationId,
		});
		
		return this.merchantRewardService.createReward(actor, body);
	}

	@Patch(":rewardId")
	@ApiOperation({ summary: "Update a draft or pending reward" })
	@ApiBody({ type: MerchantUpdateRewardDto })
	@ApiOkResponse({ description: "Updated reward" })
	public async updateReward(
		@GetMerchantActor() actor: MerchantActor,
		@Param(new ZodValidationPipe(z.object({ orgSlug: OrganizationSlugParamSchema.shape.orgSlug, rewardId: UuidParamSchema }).strict()))
		params: { orgSlug: string; rewardId: string },
		@Body(new ZodValidationPipe(MerchantUpdateRewardSchema)) body: Parameters<MerchantRewardService["updateReward"]>[2],
	): ReturnType<MerchantRewardService["updateReward"]> {
		await this.kernelHelper.requireResourceAccess(actor.userId, "UPDATE", "ORDER", params.rewardId, {
			organizationId: actor.organizationId,
		});
		
		return this.merchantRewardService.updateReward(actor, params.rewardId, body);
	}

	@Post(":rewardId/publish")
	@ApiOperation({ summary: "Submit reward for moderation review (no body required)" })
	@ApiBody({ type: RewardsEmptyBodyDto, required: false })
	@ApiOkResponse({ description: "Reward pending review" })
	public publishReward(
		@GetMerchantActor() actor: MerchantActor,
		@Param(new ZodValidationPipe(apiContract.organizations.rewards.publish.input)) params: { orgSlug: string; rewardId: string },
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
		private readonly kernelHelper: KernelIntegrationHelper,
	) {}

	@SkipAuthThrottle()
	@Get()
	@ApiOperation({ summary: "List organization API keys" })
	@ApiOkResponse({ description: "API key summaries" })
	public async listKeys(
		@GetUser() user: AccessTokenPayload,
		@Param(new ZodValidationPipe(OrganizationSlugParamSchema)) params: z.output<typeof OrganizationSlugParamSchema>,
		@Query(new ZodValidationPipe(MerchantApiKeyListQuerySchema)) query: Parameters<MerchantApiKeyService["listKeys"]>[2],
	): ReturnType<MerchantApiKeyService["listKeys"]> {
		await this.organizationRewardAuth.resolveOrganizationFromSlug(user.sub, params.orgSlug);
		return this.merchantApiKeyService.listKeys(user.sub, params.orgSlug, query);
	}

	@Post()
	@ApiOperation({ summary: "Create a POS API key" })
	@ApiBody({ type: MerchantCreateApiKeyDto })
	@ApiOkResponse({ description: "API key created (shown once)" })
	public async createKey(
		@GetUser() user: AccessTokenPayload,
		@Param(new ZodValidationPipe(OrganizationSlugParamSchema)) params: z.output<typeof OrganizationSlugParamSchema>,
		@Body(new ZodValidationPipe(MerchantCreateApiKeySchema)) body: Parameters<MerchantApiKeyService["createKey"]>[2],
	): ReturnType<MerchantApiKeyService["createKey"]> {
		const resolved = await this.organizationRewardAuth.resolveOrganizationFromSlug(user.sub, params.orgSlug);
		
		await this.kernelHelper.requireAction(user.sub, "CREATE", "ORGANIZATION", {
			organizationId: resolved.organizationId,
		});
		
		return this.merchantApiKeyService.createKey(user.sub, params.orgSlug, body);
	}

	@Post(":keyId/revoke")
	@ApiOperation({ summary: "Revoke a POS API key (no body required)" })
	@ApiBody({ type: RewardsEmptyBodyDto, required: false })
	@ApiOkResponse({ description: "API key revoked" })
	public async revokeKey(
		@GetUser() user: AccessTokenPayload,
		@Param(new ZodValidationPipe(apiContract.organizations.apiKeys.revoke.input)) params: { orgSlug: string; keyId: string },
	): ReturnType<MerchantApiKeyService["revokeKey"]> {
		const resolved = await this.organizationRewardAuth.resolveOrganizationFromSlug(user.sub, params.orgSlug);
		
		await this.kernelHelper.requireResourceAccess(user.sub, "DELETE", "ORGANIZATION", params.keyId, {
			organizationId: resolved.organizationId,
		});
		
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
	@ApiOkResponse({ description: "Paginated redemption history" })
	public listRedemptions(
		@GetMerchantActor() actor: MerchantActor,
		@Query(new ZodValidationPipe(MerchantRedemptionListQuerySchema)) query: z.output<typeof MerchantRedemptionListQuerySchema>,
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
	@ApiOkResponse({ description: "Summary metrics, trends, and top rewards" })
	public getAnalytics(
		@GetMerchantActor() actor: MerchantActor,
		@Query(new ZodValidationPipe(RewardsAnalyticsQuerySchema)) query: z.output<typeof RewardsAnalyticsQuerySchema>,
	): ReturnType<RewardsAnalyticsService["getMerchantAnalytics"]> {
		return this.rewardsAnalyticsService.getMerchantAnalytics(actor, query);
	}
}
