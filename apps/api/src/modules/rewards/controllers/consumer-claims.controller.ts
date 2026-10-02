import { Controller, Get, HttpStatus, Post } from "@nestjs/common";
import { ApiBearerAuth, ApiOperation, ApiTags } from "@nestjs/swagger";
import type { z } from "zod";

import {
	apiContract,
	apiPath,
	OkResponseSchema,
	RewardClaimCreatedResponseSchema,
	RewardClaimResponseSchema,
	UserRewardsAnalyticsResponseSchema,
	RewardClaimQrResponseSchema,
} from "@workspace/shared";
import { ZodBody, ZodListQuery, ZodQuery, ZodParams } from "../../../common/decorators/zod-request.decorators";
import { ZodPaginatedResponse, ZodResponse } from "../../../common/decorators/zod-response.decorators";
import { GetUser } from "../../auth/decorators/get-user.decorator";
import { RlsBypass } from "../../auth/decorators/rls-bypass.decorator";
import type { AccessTokenPayload } from "../../auth/services/token.service";

import { ClaimService } from "../services/claim.service";
import { RewardsAnalyticsService } from "../services/rewards-analytics.service";

@ApiTags("Claims")
@ApiBearerAuth()
@Controller(apiPath("/claims"))
export class ConsumerClaimsController {
	public constructor(
		private readonly claimService: ClaimService,
		private readonly rewardsAnalyticsService: RewardsAnalyticsService,
	) {}

	@Post("otp")
	@RlsBypass()
	@ApiOperation({ summary: "Request claim OTP (emailed to your account — no SMS in dev)" })
	@ZodResponse(OkResponseSchema, { status: HttpStatus.CREATED, description: "OTP sent" })
	public requestOtp(
		@GetUser() user: AccessTokenPayload,
		@ZodBody(apiContract.claims.otp.input) body: { rewardId: string; phone: string },
	): ReturnType<ClaimService["requestOtp"]> {
		return this.claimService.requestOtp(user.sub, body.rewardId, body.phone);
	}

	@Post()
	@RlsBypass()
	@ApiOperation({ summary: "Claim a reward after OTP verification" })
	@ZodResponse(RewardClaimCreatedResponseSchema, { status: HttpStatus.CREATED, description: "Claim created with backup code" })
	public createClaim(
		@GetUser() user: AccessTokenPayload,
		@ZodBody(apiContract.claims.create.input) body: z.output<typeof apiContract.claims.create.input>,
	): ReturnType<ClaimService["createClaim"]> {
		return this.claimService.createClaim(user.sub, body);
	}

	@Get()
	@ApiOperation({ summary: "List my reward claims" })
	@ZodPaginatedResponse(RewardClaimResponseSchema, { description: "Paginated claims" })
	public listClaims(
		@GetUser() user: AccessTokenPayload,
		@ZodListQuery(apiContract.claims.list.input) query: z.output<typeof apiContract.claims.list.input>,
	): ReturnType<ClaimService["listClaims"]> {
		return this.claimService.listClaims(user.sub, query);
	}

	@Get("analytics")
	@ApiOperation({ summary: "Reward activity analytics for the signed-in user" })
	@ZodResponse(UserRewardsAnalyticsResponseSchema, { description: "Claims, redemptions, and referral metrics" })
	public getAnalytics(
		@GetUser() user: AccessTokenPayload,
		@ZodQuery(apiContract.claims.analytics.input) query: z.output<typeof apiContract.claims.analytics.input>,
	): ReturnType<RewardsAnalyticsService["getUserAnalytics"]> {
		return this.rewardsAnalyticsService.getUserAnalytics(user.sub, query);
	}

	@Get(":claimId/qr")
	@ApiOperation({ summary: "Refresh QR payload for an active claim" })
	@ZodResponse(RewardClaimQrResponseSchema, { description: "QR payload and backup code" })
	public getClaimQr(@GetUser() user: AccessTokenPayload, @ZodParams(apiContract.claims.qr.input) params: { claimId: string }): ReturnType<ClaimService["getClaimQr"]> {
		return this.claimService.getClaimQr(user.sub, params.claimId);
	}
}
