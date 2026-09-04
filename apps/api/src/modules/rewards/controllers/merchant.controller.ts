import { Body, Controller, Get, Headers, Param, Patch, Post, Query } from "@nestjs/common";
import { ApiBearerAuth, ApiBody, ApiHeader, ApiOkResponse, ApiOperation, ApiTags } from "@nestjs/swagger";
import { z } from "zod";
import type { MerchantMembershipResponse } from "@workspace/shared";

import { apiContract, apiPath, MerchantUpdateRewardSchema, UuidParamSchema } from "@workspace/shared";
import { ZodValidationPipe } from "../../../common/pipes/zod-validation.pipe";
import { readFirstHeader } from "../../../common/utils/http-headers";
import { GetUser } from "../../auth/decorators/get-user.decorator";
import { RlsBypass } from "../../auth/decorators/rls-bypass.decorator";
import type { AccessTokenPayload } from "../../auth/services/token.service";

import { MerchantCreateApiKeyDto, MerchantCreateRewardDto, MerchantUpdateRewardDto, RewardsEmptyBodyDto } from "../dtos/rewards.dto";
import { MerchantApiKeyService } from "../services/merchant-api-key.service";
import { MerchantContextService } from "../services/merchant-context.service";
import { MerchantRewardService } from "../services/merchant-reward.service";
import { RewardsAnalyticsService } from "../services/rewards-analytics.service";

const MERCHANT_ORG_HEADER = {
	name: "X-Merchant-Org-Id",
	required: false,
	description: "Merchant org uuid — defaults to your first membership",
} as const;

@ApiTags("Merchant")
@ApiBearerAuth()
@RlsBypass()
@Controller(apiPath("/merchant/me"))
export class MerchantProfileController {
	public constructor(private readonly merchantContext: MerchantContextService) {}

	@Get()
	@ApiOperation({ summary: "List merchant org memberships for the current user" })
	@ApiOkResponse({ description: "Merchant memberships" })
	public listMemberships(@GetUser() user: AccessTokenPayload): Promise<MerchantMembershipResponse[]> {
		return this.merchantContext.listMembershipsForUser(user.sub, { isImpersonating: user.isImpersonating === true });
	}
}

@ApiTags("Merchant Rewards")
@ApiBearerAuth()
@RlsBypass()
@Controller(apiPath("/merchant/rewards"))
export class MerchantRewardsController {
	public constructor(private readonly merchantRewardService: MerchantRewardService) {}

	@Get()
	@ApiHeader(MERCHANT_ORG_HEADER)
	@ApiOperation({ summary: "List merchant rewards" })
	@ApiOkResponse({ description: "Rewards for the merchant org" })
	public listRewards(
		@GetUser() user: AccessTokenPayload,
		@Headers() headers: Record<string, string | string[] | undefined>,
	): ReturnType<MerchantRewardService["listRewards"]> {
		const orgId = readFirstHeader(headers["x-merchant-org-id"]);
		return this.merchantRewardService.listRewards(user.sub, orgId);
	}

	@Post()
	@ApiHeader(MERCHANT_ORG_HEADER)
	@ApiOperation({ summary: "Create a draft reward" })
	@ApiBody({ type: MerchantCreateRewardDto })
	@ApiOkResponse({ description: "Created reward" })
	public createReward(
		@GetUser() user: AccessTokenPayload,
		@Headers() headers: Record<string, string | string[] | undefined>,
		@Body(new ZodValidationPipe(apiContract.merchant.rewards.create.input)) body: Parameters<MerchantRewardService["createReward"]>[2],
	): ReturnType<MerchantRewardService["createReward"]> {
		const orgId = readFirstHeader(headers["x-merchant-org-id"]);
		return this.merchantRewardService.createReward(user.sub, orgId, body);
	}

	@Patch(":rewardId")
	@ApiHeader(MERCHANT_ORG_HEADER)
	@ApiOperation({ summary: "Update a draft or pending reward" })
	@ApiBody({ type: MerchantUpdateRewardDto })
	@ApiOkResponse({ description: "Updated reward" })
	public updateReward(
		@GetUser() user: AccessTokenPayload,
		@Headers() headers: Record<string, string | string[] | undefined>,
		@Param(new ZodValidationPipe(z.object({ rewardId: UuidParamSchema }).strict())) params: { rewardId: string },
		@Body(new ZodValidationPipe(MerchantUpdateRewardSchema)) body: Parameters<MerchantRewardService["updateReward"]>[3],
	): ReturnType<MerchantRewardService["updateReward"]> {
		const orgId = readFirstHeader(headers["x-merchant-org-id"]);
		return this.merchantRewardService.updateReward(user.sub, orgId, params.rewardId, body);
	}

	@Post(":rewardId/publish")
	@ApiHeader(MERCHANT_ORG_HEADER)
	@ApiOperation({ summary: "Submit reward for moderation review (no body required)" })
	@ApiBody({ type: RewardsEmptyBodyDto, required: false })
	@ApiOkResponse({ description: "Reward pending review" })
	public publishReward(
		@GetUser() user: AccessTokenPayload,
		@Headers() headers: Record<string, string | string[] | undefined>,
		@Param(new ZodValidationPipe(apiContract.merchant.rewards.publish.input)) params: { rewardId: string },
	): ReturnType<MerchantRewardService["publishReward"]> {
		const orgId = readFirstHeader(headers["x-merchant-org-id"]);
		return this.merchantRewardService.publishReward(user.sub, orgId, params.rewardId);
	}
}

@ApiTags("Merchant API Keys")
@ApiBearerAuth()
@RlsBypass()
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
@RlsBypass()
@Controller(apiPath("/merchant/redemptions"))
export class MerchantRedemptionsController {
	public constructor(private readonly merchantRewardService: MerchantRewardService) {}

	@Get()
	@ApiHeader(MERCHANT_ORG_HEADER)
	@ApiOperation({ summary: "List merchant redemptions" })
	@ApiOkResponse({ description: "Paginated redemption history" })
	public listRedemptions(
		@GetUser() user: AccessTokenPayload,
		@Headers() headers: Record<string, string | string[] | undefined>,
		@Query(new ZodValidationPipe(apiContract.merchant.redemptions.input)) query: Parameters<MerchantRewardService["listRedemptions"]>[2],
	): ReturnType<MerchantRewardService["listRedemptions"]> {
		const orgId = readFirstHeader(headers["x-merchant-org-id"]);
		return this.merchantRewardService.listRedemptions(user.sub, orgId, query);
	}
}

@ApiTags("Merchant Analytics")
@ApiBearerAuth()
@RlsBypass()
@Controller(apiPath("/merchant/analytics"))
export class MerchantAnalyticsController {
	public constructor(private readonly rewardsAnalyticsService: RewardsAnalyticsService) {}

	@Get()
	@ApiHeader(MERCHANT_ORG_HEADER)
	@ApiOperation({ summary: "Merchant reward performance analytics" })
	@ApiOkResponse({ description: "Summary metrics, trends, and top rewards" })
	public getAnalytics(
		@GetUser() user: AccessTokenPayload,
		@Headers() headers: Record<string, string | string[] | undefined>,
		@Query(new ZodValidationPipe(apiContract.merchant.analytics.input)) query: Parameters<RewardsAnalyticsService["getMerchantAnalytics"]>[2],
	): ReturnType<RewardsAnalyticsService["getMerchantAnalytics"]> {
		const orgId = readFirstHeader(headers["x-merchant-org-id"]);
		return this.rewardsAnalyticsService.getMerchantAnalytics(user.sub, orgId, query);
	}
}
