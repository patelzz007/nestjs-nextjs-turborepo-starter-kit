import { Body, Controller, Get, Param, Post, Query } from "@nestjs/common";
import { ApiBearerAuth, ApiBody, ApiOkResponse, ApiOperation, ApiTags } from "@nestjs/swagger";

import { apiContract, apiPath } from "@workspace/shared";
import { ZodValidationPipe } from "../../../common/pipes/zod-validation.pipe";
import { GetUser } from "../../auth/decorators/get-user.decorator";
import type { AccessTokenPayload } from "../../auth/services/token.service";

import { CreateRewardClaimDto, RequestClaimOtpDto } from "../dtos/rewards.dto";
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
	@ApiOperation({ summary: "Request claim OTP (emailed to your account — no SMS in dev)" })
	@ApiBody({ type: RequestClaimOtpDto })
	@ApiOkResponse({ description: "OTP sent" })
	public requestOtp(
		@GetUser() user: AccessTokenPayload,
		@Body(new ZodValidationPipe(apiContract.claims.otp.input)) body: { rewardId: string; phone: string },
	): ReturnType<ClaimService["requestOtp"]> {
		return this.claimService.requestOtp(user.sub, body.rewardId, body.phone);
	}

	@Post()
	@ApiOperation({ summary: "Claim a reward after OTP verification" })
	@ApiBody({ type: CreateRewardClaimDto })
	@ApiOkResponse({ description: "Claim created with backup code" })
	public createClaim(
		@GetUser() user: AccessTokenPayload,
		@Body(new ZodValidationPipe(apiContract.claims.create.input)) body: Parameters<ClaimService["createClaim"]>[1],
	): ReturnType<ClaimService["createClaim"]> {
		return this.claimService.createClaim(user.sub, body);
	}

	@Get()
	@ApiOperation({ summary: "List my reward claims" })
	@ApiOkResponse({ description: "Paginated claims" })
	public listClaims(
		@GetUser() user: AccessTokenPayload,
		@Query(new ZodValidationPipe(apiContract.claims.list.input)) query: Parameters<ClaimService["listClaims"]>[1],
	): ReturnType<ClaimService["listClaims"]> {
		return this.claimService.listClaims(user.sub, query);
	}

	@Get("analytics")
	@ApiOperation({ summary: "Reward activity analytics for the signed-in user" })
	@ApiOkResponse({ description: "Claims, redemptions, and referral metrics" })
	public getAnalytics(
		@GetUser() user: AccessTokenPayload,
		@Query(new ZodValidationPipe(apiContract.claims.analytics.input)) query: Parameters<RewardsAnalyticsService["getUserAnalytics"]>[1],
	): ReturnType<RewardsAnalyticsService["getUserAnalytics"]> {
		return this.rewardsAnalyticsService.getUserAnalytics(user.sub, query);
	}

	@Get(":claimId/qr")
	@ApiOperation({ summary: "Refresh QR payload for an active claim" })
	@ApiOkResponse({ description: "QR payload and backup code" })
	public getClaimQr(
		@GetUser() user: AccessTokenPayload,
		@Param(new ZodValidationPipe(apiContract.claims.qr.input)) params: { claimId: string },
	): ReturnType<ClaimService["getClaimQr"]> {
		return this.claimService.getClaimQr(user.sub, params.claimId);
	}
}
