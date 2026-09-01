import { Body, Controller, Post, UseGuards } from "@nestjs/common";
import { ApiBearerAuth, ApiBody, ApiHeader, ApiOkResponse, ApiOperation, ApiTags } from "@nestjs/swagger";

import { apiContract, apiPath } from "@workspace/shared";
import { ZodValidationPipe } from "../../../common/pipes/zod-validation.pipe";
import { Public } from "../../auth/decorators/public.decorator";
import { RlsBypass } from "../../auth/decorators/rls-bypass.decorator";

import { MerchantPos } from "../decorators/merchant-pos.decorator";
import { RedemptionConfirmDto, RedemptionValidateDto } from "../dtos/rewards.dto";
import { MerchantApiKeyGuard } from "../guards/merchant-api-key.guard";
import type { MerchantPosContext } from "../types/merchant-pos-context";
import { RedemptionService } from "../services/redemption.service";

@ApiTags("Redemptions")
@Controller(apiPath("/redemptions"))
export class RedemptionsController {
	public constructor(private readonly redemptionService: RedemptionService) {}

	@Public()
	@RlsBypass()
	@UseGuards(MerchantApiKeyGuard)
	@Post("validate")
	@ApiBearerAuth()
	@ApiHeader({ name: "X-Terminal-Id", required: true, description: "POS terminal id (e.g. KL-REGISTER-01)" })
	@ApiOperation({ summary: "POS validate QR or backup code" })
	@ApiBody({ type: RedemptionValidateDto })
	@ApiOkResponse({ description: "Redemption preview" })
	public validate(
		@MerchantPos() pos: MerchantPosContext,
		@Body(new ZodValidationPipe(apiContract.redemptions.validate.input)) body: Parameters<RedemptionService["validate"]>[2],
	): ReturnType<RedemptionService["validate"]> {
		return this.redemptionService.validate(pos.merchantOrgId, pos.terminalId, body);
	}

	@Public()
	@RlsBypass()
	@UseGuards(MerchantApiKeyGuard)
	@Post("confirm")
	@ApiBearerAuth()
	@ApiHeader({ name: "X-Terminal-Id", required: true, description: "POS terminal id (e.g. KL-REGISTER-01)" })
	@ApiOperation({ summary: "POS confirm redemption (idempotent)" })
	@ApiBody({ type: RedemptionConfirmDto })
	@ApiOkResponse({ description: "Redemption confirmed" })
	public confirm(
		@MerchantPos() pos: MerchantPosContext,
		@Body(new ZodValidationPipe(apiContract.redemptions.confirm.input)) body: Parameters<RedemptionService["confirm"]>[2],
	): ReturnType<RedemptionService["confirm"]> {
		return this.redemptionService.confirm(pos.merchantOrgId, pos.terminalId, body);
	}
}
