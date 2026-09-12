import { Body, Controller, Get, Headers, Param, Patch, Post, Query, UseInterceptors } from "@nestjs/common";
import { ApiBearerAuth, ApiBody, ApiHeader, ApiOkResponse, ApiOperation, ApiSecurity, ApiTags } from "@nestjs/swagger";
import { z } from "zod";
import type { MerchantKybDocumentDownloadResponse, MerchantKybProfileResponse, MerchantMembershipResponse } from "@workspace/shared";

import { FileDownloadDispositionSchema, MerchantKybSubmissionFieldsSchema, apiContract, apiPath, MerchantUpdateRewardSchema, UuidParamSchema } from "@workspace/shared";
import { ZodValidationPipe } from "../../../common/pipes/zod-validation.pipe";
import { readFirstHeader } from "../../../common/utils/http-headers";
import { AllowApiKeyAuth } from "../../api-keys/decorators/allow-api-key-auth.decorator";
import { GetMerchantActor } from "../../api-keys/decorators/get-merchant-actor.decorator";
import { MerchantActorInterceptor } from "../../api-keys/interceptors/merchant-actor.interceptor";
import type { MerchantActor } from "../../api-keys/types/merchant-actor.types";
import { SkipAuthThrottle } from "../../auth/decorators/skip-auth-throttle.decorator";
import { GetUser } from "../../auth/decorators/get-user.decorator";
import type { AccessTokenPayload } from "../../auth/services/token.service";

import { MerchantCreateApiKeyDto, MerchantCreateRewardDto, MerchantUpdateRewardDto, RewardsEmptyBodyDto } from "../dtos/rewards.dto";
import { MerchantApiKeyService } from "../services/merchant-api-key.service";
import { MerchantContextService } from "../services/merchant-context.service";
import { MerchantKybDocumentService } from "../services/merchant-kyb-document.service";
import { MerchantKybService } from "../services/merchant-kyb.service";
import { MerchantRewardService } from "../services/merchant-reward.service";
import { RewardsAnalyticsService } from "../services/rewards-analytics.service";

const MERCHANT_ORG_HEADER = {
	name: "X-Merchant-Org-Id",
	required: false,
	description: "Merchant org uuid — defaults to your first membership",
} as const;

@ApiTags("Merchant")
@ApiBearerAuth()
@Controller(apiPath("/merchant/me"))
export class MerchantProfileController {
	public constructor(private readonly merchantContext: MerchantContextService) {}

	@SkipAuthThrottle()
	@Get()
	@ApiOperation({ summary: "List merchant org memberships for the current user" })
	@ApiOkResponse({ description: "Merchant memberships" })
	public listMemberships(@GetUser() user: AccessTokenPayload): Promise<MerchantMembershipResponse[]> {
		return this.merchantContext.listMembershipsForUser(user.sub, { isImpersonating: user.isImpersonating === true });
	}
}

@ApiTags("Merchant KYB")
@ApiBearerAuth()
@Controller(apiPath("/merchant/kyb"))
export class MerchantKybController {
	public constructor(
		private readonly merchantKyb: MerchantKybService,
		private readonly merchantContext: MerchantContextService,
		private readonly kybDocuments: MerchantKybDocumentService,
	) {}

	@SkipAuthThrottle()
	@Get()
	@ApiHeader(MERCHANT_ORG_HEADER)
	@ApiOperation({ summary: "Get the active merchant org KYB profile" })
	@ApiOkResponse({ description: "Merchant KYB profile" })
	public getProfile(@GetUser() user: AccessTokenPayload, @Headers() headers: Record<string, string | string[] | undefined>): Promise<MerchantKybProfileResponse> {
		const orgId = readFirstHeader(headers["x-merchant-org-id"]);
		return this.merchantKyb.getProfile(user.sub, orgId);
	}

	@Patch()
	@ApiHeader(MERCHANT_ORG_HEADER)
	@ApiOperation({ summary: "Submit or resubmit business verification details (owner only)" })
	@ApiOkResponse({ description: "Updated merchant KYB profile" })
	public submitKyb(
		@GetUser() user: AccessTokenPayload,
		@Headers() headers: Record<string, string | string[] | undefined>,
		@Body(new ZodValidationPipe(MerchantKybSubmissionFieldsSchema)) body: z.output<typeof MerchantKybSubmissionFieldsSchema>,
	): Promise<MerchantKybProfileResponse> {
		const orgId = readFirstHeader(headers["x-merchant-org-id"]);
		return this.merchantKyb.submitKyb(user.sub, orgId, body);
	}

	@Get("documents/:documentId/download")
	@ApiHeader(MERCHANT_ORG_HEADER)
	@ApiOperation({ summary: "Get a short-lived signed download URL for a CLEAN KYB document" })
	@ApiOkResponse({ description: "Signed download URL or scan status" })
	public async downloadDocument(
		@GetUser() user: AccessTokenPayload,
		@Headers() headers: Record<string, string | string[] | undefined>,
		@Param(new ZodValidationPipe(z.object({ documentId: UuidParamSchema }).strict())) params: { documentId: string },
		@Query(new ZodValidationPipe(z.object({ disposition: FileDownloadDispositionSchema.optional() }).strict()))
		query: {
			disposition?: "inline" | "attachment";
		},
	): Promise<MerchantKybDocumentDownloadResponse> {
		const orgId = await this.merchantContext.resolveOrgIdForUser(user.sub, readFirstHeader(headers["x-merchant-org-id"]));
		return this.kybDocuments.getDownloadUrl(params.documentId, orgId, query.disposition ?? "inline");
	}
}

@ApiTags("Merchant Rewards")
@ApiBearerAuth()
@ApiSecurity("merchantApiKey")
@AllowApiKeyAuth()
@UseInterceptors(MerchantActorInterceptor)
@Controller(apiPath("/merchant/rewards"))
export class MerchantRewardsController {
	public constructor(private readonly merchantRewardService: MerchantRewardService) {}

	@Get()
	@ApiHeader(MERCHANT_ORG_HEADER)
	@ApiOperation({ summary: "List merchant rewards" })
	@ApiOkResponse({ description: "Rewards for the merchant org" })
	public listRewards(@GetMerchantActor() actor: MerchantActor): ReturnType<MerchantRewardService["listRewards"]> {
		return this.merchantRewardService.listRewards(actor);
	}

	@Post()
	@ApiHeader(MERCHANT_ORG_HEADER)
	@ApiOperation({ summary: "Create a draft reward" })
	@ApiBody({ type: MerchantCreateRewardDto })
	@ApiOkResponse({ description: "Created reward" })
	public createReward(
		@GetMerchantActor() actor: MerchantActor,
		@Body(new ZodValidationPipe(apiContract.merchant.rewards.create.input)) body: Parameters<MerchantRewardService["createReward"]>[1],
	): ReturnType<MerchantRewardService["createReward"]> {
		return this.merchantRewardService.createReward(actor, body);
	}

	@Patch(":rewardId")
	@ApiHeader(MERCHANT_ORG_HEADER)
	@ApiOperation({ summary: "Update a draft or pending reward" })
	@ApiBody({ type: MerchantUpdateRewardDto })
	@ApiOkResponse({ description: "Updated reward" })
	public updateReward(
		@GetMerchantActor() actor: MerchantActor,
		@Param(new ZodValidationPipe(z.object({ rewardId: UuidParamSchema }).strict())) params: { rewardId: string },
		@Body(new ZodValidationPipe(MerchantUpdateRewardSchema)) body: Parameters<MerchantRewardService["updateReward"]>[2],
	): ReturnType<MerchantRewardService["updateReward"]> {
		return this.merchantRewardService.updateReward(actor, params.rewardId, body);
	}

	@Post(":rewardId/publish")
	@ApiHeader(MERCHANT_ORG_HEADER)
	@ApiOperation({ summary: "Submit reward for moderation review (no body required)" })
	@ApiBody({ type: RewardsEmptyBodyDto, required: false })
	@ApiOkResponse({ description: "Reward pending review" })
	public publishReward(
		@GetMerchantActor() actor: MerchantActor,
		@Param(new ZodValidationPipe(apiContract.merchant.rewards.publish.input)) params: { rewardId: string },
	): ReturnType<MerchantRewardService["publishReward"]> {
		return this.merchantRewardService.publishReward(actor, params.rewardId);
	}
}

@ApiTags("Merchant API Keys")
@ApiBearerAuth()
@Controller(apiPath("/merchant/api-keys"))
export class MerchantApiKeysController {
	public constructor(private readonly merchantApiKeyService: MerchantApiKeyService) {}

	@Get()
	@ApiHeader(MERCHANT_ORG_HEADER)
	@ApiOperation({ summary: "List merchant API keys" })
	@ApiOkResponse({ description: "API key summaries" })
	public listKeys(@GetUser() user: AccessTokenPayload, @Headers() headers: Record<string, string | string[] | undefined>): ReturnType<MerchantApiKeyService["listKeys"]> {
		const orgId = readFirstHeader(headers["x-merchant-org-id"]);
		return this.merchantApiKeyService.listKeys(user.sub, orgId);
	}

	@Post()
	@ApiHeader(MERCHANT_ORG_HEADER)
	@ApiOperation({ summary: "Create a POS API key" })
	@ApiBody({ type: MerchantCreateApiKeyDto })
	@ApiOkResponse({ description: "API key created (shown once)" })
	public createKey(
		@GetUser() user: AccessTokenPayload,
		@Headers() headers: Record<string, string | string[] | undefined>,
		@Body(new ZodValidationPipe(apiContract.merchant.apiKeys.create.input)) body: Parameters<MerchantApiKeyService["createKey"]>[2],
	): ReturnType<MerchantApiKeyService["createKey"]> {
		const orgId = readFirstHeader(headers["x-merchant-org-id"]);
		return this.merchantApiKeyService.createKey(user.sub, orgId, body);
	}

	@Post(":keyId/revoke")
	@ApiHeader(MERCHANT_ORG_HEADER)
	@ApiOperation({ summary: "Revoke a POS API key (no body required)" })
	@ApiBody({ type: RewardsEmptyBodyDto, required: false })
	@ApiOkResponse({ description: "API key revoked" })
	public revokeKey(
		@GetUser() user: AccessTokenPayload,
		@Headers() headers: Record<string, string | string[] | undefined>,
		@Param(new ZodValidationPipe(apiContract.merchant.apiKeys.revoke.input)) params: { keyId: string },
	): ReturnType<MerchantApiKeyService["revokeKey"]> {
		const orgId = readFirstHeader(headers["x-merchant-org-id"]);
		return this.merchantApiKeyService.revokeKey(user.sub, orgId, params.keyId);
	}
}

@ApiTags("Merchant Redemptions")
@ApiBearerAuth()
@ApiSecurity("merchantApiKey")
@AllowApiKeyAuth()
@UseInterceptors(MerchantActorInterceptor)
@Controller(apiPath("/merchant/redemptions"))
export class MerchantRedemptionsController {
	public constructor(private readonly merchantRewardService: MerchantRewardService) {}

	@Get()
	@ApiHeader(MERCHANT_ORG_HEADER)
	@ApiOperation({ summary: "List merchant redemptions" })
	@ApiOkResponse({ description: "Paginated redemption history" })
	public listRedemptions(
		@GetMerchantActor() actor: MerchantActor,
		@Query(new ZodValidationPipe(apiContract.merchant.redemptions.input)) query: Parameters<MerchantRewardService["listRedemptions"]>[1],
	): ReturnType<MerchantRewardService["listRedemptions"]> {
		return this.merchantRewardService.listRedemptions(actor, query);
	}
}

@ApiTags("Merchant Analytics")
@ApiBearerAuth()
@ApiSecurity("merchantApiKey")
@AllowApiKeyAuth()
@UseInterceptors(MerchantActorInterceptor)
@Controller(apiPath("/merchant/analytics"))
export class MerchantAnalyticsController {
	public constructor(private readonly rewardsAnalyticsService: RewardsAnalyticsService) {}

	@Get()
	@ApiHeader(MERCHANT_ORG_HEADER)
	@ApiOperation({ summary: "Merchant reward performance analytics" })
	@ApiOkResponse({ description: "Summary metrics, trends, and top rewards" })
	public getAnalytics(
		@GetMerchantActor() actor: MerchantActor,
		@Query(new ZodValidationPipe(apiContract.merchant.analytics.input)) query: Parameters<RewardsAnalyticsService["getMerchantAnalytics"]>[1],
	): ReturnType<RewardsAnalyticsService["getMerchantAnalytics"]> {
		return this.rewardsAnalyticsService.getMerchantAnalytics(actor, query);
	}
}
