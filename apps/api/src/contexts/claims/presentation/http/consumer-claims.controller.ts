import { Controller, Get, HttpStatus, Post } from "@nestjs/common";
import { CommandBus, QueryBus } from "@nestjs/cqrs";
import { ApiBearerAuth, ApiOperation, ApiTags } from "@nestjs/swagger";
import {
	apiContract,
	apiPath,
	OkResponseSchema,
	RewardClaimCreatedResponseSchema,
	RewardClaimQrResponseSchema,
	RewardClaimResponseSchema,
	type OkResponse,
	type PaginatedServiceResult,
	type RewardClaimCreatedResponse,
	type RewardClaimQrResponse,
	type RewardClaimResponse,
} from "@workspace/shared";
import type { z } from "zod";

import type { ActorContext } from "../../../../platform/application/actor-context";
import { CurrentActor } from "../../../../platform/presentation/http/security/current-actor.decorator";
import { RlsBypass } from "../../../../platform/presentation/http/security/decorators/rls-bypass.decorator";
import { RATE_LIMIT_POLICY, RateLimit } from "../../../../platform/presentation/http/security/throttling/rate-limit.decorator";
import { ZodBody, ZodListQuery, ZodParams } from "../../../../platform/presentation/http/validation/decorators/zod-request.decorators";
import { ZodPaginatedResponse, ZodResponse } from "../../../../platform/presentation/http/validation/decorators/zod-response.decorators";
import { ClaimRewardCommand } from "../../application/commands/claim-reward/claim-reward.command";
import { IssueClaimQrCodesCommand } from "../../application/commands/issue-claim-qr-codes/issue-claim-qr-codes.command";
import { RequestClaimOtpCommand } from "../../application/commands/request-claim-otp/request-claim-otp.command";
import { GetMyClaimQuery } from "../../application/queries/get-my-claim/get-my-claim.query";
import { ListMyClaimsQuery } from "../../application/queries/list-my-claims/list-my-claims.query";

/** A customer's own reward claims: OTP, claim, wallet list and detail, and the QR codes. */
@ApiTags("Claims")
@ApiBearerAuth()
@Controller(apiPath("/claims"))
export class ConsumerClaimsController {
	public constructor(
		private readonly commandBus: CommandBus,
		private readonly queryBus: QueryBus,
	) {}

	@RateLimit(RATE_LIMIT_POLICY.authenticatedMutation)
	@Post("otp")
	@RlsBypass()
	@ApiOperation({ summary: "Request claim OTP (emailed to your account — no SMS in dev)" })
	@ZodResponse(OkResponseSchema, { status: HttpStatus.CREATED, description: "OTP sent" })
	public requestOtp(@CurrentActor() actor: ActorContext, @ZodBody(apiContract.claims.otp.input) body: z.output<typeof apiContract.claims.otp.input>): Promise<OkResponse> {
		return this.commandBus.execute(new RequestClaimOtpCommand(actor, body));
	}

	@RateLimit(RATE_LIMIT_POLICY.authenticatedMutation)
	@Post()
	@RlsBypass()
	@ApiOperation({ summary: "Claim a reward after OTP verification" })
	@ZodResponse(RewardClaimCreatedResponseSchema, { status: HttpStatus.CREATED, description: "Claim created with backup code" })
	public createClaim(
		@CurrentActor() actor: ActorContext,
		@ZodBody(apiContract.claims.create.input) body: z.output<typeof apiContract.claims.create.input>,
	): Promise<RewardClaimCreatedResponse> {
		return this.commandBus.execute(new ClaimRewardCommand(actor, body));
	}

	@Get()
	@ApiOperation({ summary: "List my reward claims" })
	@ZodPaginatedResponse(RewardClaimResponseSchema, { description: "Paginated claims" })
	public listClaims(
		@CurrentActor() actor: ActorContext,
		@ZodListQuery(apiContract.claims.list.input) query: z.output<typeof apiContract.claims.list.input>,
	): Promise<PaginatedServiceResult<RewardClaimResponse>> {
		return this.queryBus.execute(new ListMyClaimsQuery(actor, query));
	}

	@Get(":claimId")
	@ApiOperation({ summary: "One of my claims (never carries the codes)" })
	@ZodResponse(RewardClaimResponseSchema, { description: "The claim" })
	public getClaim(
		@CurrentActor() actor: ActorContext,
		@ZodParams(apiContract.claims.get.input) params: z.output<typeof apiContract.claims.get.input>,
	): Promise<RewardClaimResponse> {
		return this.queryBus.execute(new GetMyClaimQuery(actor, params));
	}

	@RateLimit(RATE_LIMIT_POLICY.authenticatedMutation)
	@Post(":claimId/qr")
	@ApiOperation({ summary: "Issue fresh QR and backup codes for an active claim (the previous codes stop working)" })
	@ZodResponse(RewardClaimQrResponseSchema, { status: HttpStatus.CREATED, description: "QR payload and backup code" })
	public issueQrCodes(
		@CurrentActor() actor: ActorContext,
		@ZodParams(apiContract.claims.qr.input) params: z.output<typeof apiContract.claims.qr.input>,
	): Promise<RewardClaimQrResponse> {
		return this.commandBus.execute(new IssueClaimQrCodesCommand(actor, params));
	}
}
