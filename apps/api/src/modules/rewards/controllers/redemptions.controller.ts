import { Controller, HttpStatus, Post, UseGuards } from "@nestjs/common";
import { ApiBearerAuth, ApiHeader, ApiOperation, ApiTags } from "@nestjs/swagger";
import { SkipThrottle } from "@nestjs/throttler";
import type { z } from "zod";

import { apiContract, apiPath, RedemptionCheckoutResponseSchema, RedemptionPreviewResponseSchema } from "@workspace/shared";
import { ZodBody } from "../../../common/decorators/zod-request.decorators";
import { ZodResponse } from "../../../common/decorators/zod-response.decorators";
import { Public } from "../../auth/decorators/public.decorator";
import { SkipMutationIntent } from "../../auth/decorators/skip-mutation-intent.decorator";

import { MerchantPos } from "../decorators/merchant-pos.decorator";

import { MerchantApiKeyGuard } from "../guards/merchant-api-key.guard";
import { PosRateLimitGuard } from "../guards/pos-rate-limit.guard";
import type { MerchantPosContext } from "../types/merchant-pos-context";
import { RedemptionService } from "../services/redemption.service";

/**
 * POS (machine-to-machine) endpoints. Every route authenticates with a
 * merchant API key header only — never a cookie — so the browser CSRF
 * mutation-intent check does not apply (a POS sends no Origin).
 *
 * Rate limits: the per-IP `strict` auth limiter is skipped (stores share NAT
 * addresses); the per-IP `default` limiter still applies before the key is
 * verified, and `PosRateLimitGuard` limits each API key. Unknown backup codes
 * additionally count toward the key's lockout (`PosCodeLockoutService`).
 *
 * Database scope: no RLS bypass. After `MerchantApiKeyGuard` verifies the key,
 * the request runs as the `api_key` principal (prisma/rls/40-api-key-principal.sql):
 * only the key's organization — and, for a store-scoped key, its store's
 * redemptions and sales — are visible or writable.
 */
/** OpenAPI note shared by every POS route. */
const TERMINAL_ID_HEADER_DESCRIPTION =
	"Terminal id. Optional for a key issued by pairing (POST /pos/terminals/pair); required for a manually created key (e.g. KL-REGISTER-01).";

@ApiTags("Redemptions")
@SkipMutationIntent()
@Controller(apiPath("/redemptions"))
export class RedemptionsController {
	public constructor(private readonly redemptionService: RedemptionService) {}

	@Public()
	@SkipThrottle({ strict: true })
	@UseGuards(MerchantApiKeyGuard, PosRateLimitGuard)
	@Post("validate")
	@ApiBearerAuth()
	@ApiHeader({ name: "X-Terminal-Id", required: false, description: TERMINAL_ID_HEADER_DESCRIPTION })
	@ApiOperation({ summary: "POS validate QR or backup code" })
	@ZodResponse(RedemptionPreviewResponseSchema, { status: HttpStatus.CREATED, description: "Redemption preview" })
	public validate(
		@MerchantPos() pos: MerchantPosContext,
		@ZodBody(apiContract.redemptions.validate.input) body: z.output<typeof apiContract.redemptions.validate.input>,
	): ReturnType<RedemptionService["validate"]> {
		return this.redemptionService.validate(pos, body);
	}

	@Public()
	@SkipThrottle({ strict: true })
	@UseGuards(MerchantApiKeyGuard, PosRateLimitGuard)
	@Post("checkout")
	@ApiBearerAuth()
	@ApiHeader({ name: "X-Terminal-Id", required: false, description: TERMINAL_ID_HEADER_DESCRIPTION })
	@ApiOperation({
		summary: "POS checkout: after payment, record the bill and redeem every presented reward (all-or-nothing, idempotent)",
		description:
			"Send the bill total in minor units (sen) and up to 10 QR tokens / backup codes of ONE customer. Retrying with the same idempotencyKey and body replays the original result; a different body with a used key is rejected (409 IDEMPOTENCY_KEY_REUSED).",
	})
	@ZodResponse(RedemptionCheckoutResponseSchema, { status: HttpStatus.CREATED, description: "Bill recorded and rewards redeemed" })
	public checkout(
		@MerchantPos() pos: MerchantPosContext,
		@ZodBody(apiContract.redemptions.checkout.input) body: z.output<typeof apiContract.redemptions.checkout.input>,
	): ReturnType<RedemptionService["checkout"]> {
		return this.redemptionService.checkout(pos, body);
	}
}
