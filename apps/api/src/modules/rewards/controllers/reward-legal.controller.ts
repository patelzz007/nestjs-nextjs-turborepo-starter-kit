import { Body, Controller, Get, Post } from "@nestjs/common";
import { ApiBearerAuth, ApiBody, ApiOkResponse, ApiOperation, ApiTags } from "@nestjs/swagger";

import { apiContract, apiPath } from "@workspace/shared";
import { ZodValidationPipe } from "../../../common/pipes/zod-validation.pipe";
import { GetUser } from "../../auth/decorators/get-user.decorator";
import type { AccessTokenPayload } from "../../auth/services/token.service";

import { AcceptRewardLegalDto } from "../dtos/rewards.dto";
import { RewardLegalService } from "../services/reward-legal.service";

@ApiTags("Legal")
@ApiBearerAuth()
@Controller(apiPath("/legal"))
export class RewardLegalController {
	public constructor(private readonly legalService: RewardLegalService) {}

	@Get("status")
	@ApiOperation({ summary: "Get rewards legal acceptance and verified phone status" })
	@ApiOkResponse({ description: "Claim checkout status for the signed-in user" })
	public getStatus(@GetUser() user: AccessTokenPayload): ReturnType<RewardLegalService["getCheckoutStatus"]> {
		return this.legalService.getCheckoutStatus(user.sub);
	}

	@Post("accept")
	@ApiOperation({ summary: "Accept rewards terms and privacy policy" })
	@ApiBody({ type: AcceptRewardLegalDto })
	@ApiOkResponse({ description: "Legal acceptance recorded" })
	public acceptLegal(
		@GetUser() user: AccessTokenPayload,
		@Body(new ZodValidationPipe(apiContract.legal.accept.input)) body: { termsVersion: string; privacyVersion: string },
	): ReturnType<RewardLegalService["accept"]> {
		return this.legalService.accept(user.sub, body.termsVersion, body.privacyVersion);
	}
}
