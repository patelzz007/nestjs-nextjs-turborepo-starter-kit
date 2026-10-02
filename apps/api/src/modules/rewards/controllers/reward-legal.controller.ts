import { Controller, Get, HttpStatus, Post } from "@nestjs/common";
import { ApiBearerAuth, ApiOperation, ApiTags } from "@nestjs/swagger";

import { apiContract, apiPath, RewardClaimCheckoutStatusSchema, OkResponseSchema } from "@workspace/shared";
import { ZodBody } from "../../../common/decorators/zod-request.decorators";
import { ZodResponse } from "../../../common/decorators/zod-response.decorators";
import { GetUser } from "../../auth/decorators/get-user.decorator";
import type { AccessTokenPayload } from "../../auth/services/token.service";

import { RewardLegalService } from "../services/reward-legal.service";

@ApiTags("Legal")
@ApiBearerAuth()
@Controller(apiPath("/legal"))
export class RewardLegalController {
	public constructor(private readonly legalService: RewardLegalService) {}

	@Get("status")
	@ApiOperation({ summary: "Get rewards legal acceptance and verified phone status" })
	@ZodResponse(RewardClaimCheckoutStatusSchema, { description: "Claim checkout status for the signed-in user" })
	public getStatus(@GetUser() user: AccessTokenPayload): ReturnType<RewardLegalService["getCheckoutStatus"]> {
		return this.legalService.getCheckoutStatus(user.sub);
	}

	@Post("accept")
	@ApiOperation({ summary: "Accept rewards terms and privacy policy" })
	@ZodResponse(OkResponseSchema, { status: HttpStatus.CREATED, description: "Legal acceptance recorded" })
	public acceptLegal(
		@GetUser() user: AccessTokenPayload,
		@ZodBody(apiContract.legal.accept.input) body: { termsVersion: string; privacyVersion: string },
	): ReturnType<RewardLegalService["accept"]> {
		return this.legalService.accept(user.sub, body.termsVersion, body.privacyVersion);
	}
}
