import { Controller, HttpStatus, Post, UseGuards } from "@nestjs/common";
import { CommandBus } from "@nestjs/cqrs";
import { ApiBearerAuth, ApiHeader, ApiOperation, ApiTags } from "@nestjs/swagger";
import { SkipThrottle } from "@nestjs/throttler";
import {
	apiContract,
	apiPath,
	RedemptionCheckoutResponseSchema,
	RedemptionPreviewResponseSchema,
	type RedemptionCheckoutResponse,
	type RedemptionPreviewResponse,
} from "@workspace/shared";
import type { z } from "zod";

import type { ActorContext } from "../../../../platform/application/actor-context";
import { CurrentActor } from "../../../../platform/presentation/http/security/current-actor.decorator";
import { Public } from "../../../../platform/presentation/http/security/decorators/public.decorator";
import { SkipMutationIntent } from "../../../../platform/presentation/http/security/decorators/skip-mutation-intent.decorator";
import { TillPoint } from "../../../../platform/presentation/http/security/decorators/till-point.decorator";
import { MerchantApiKeyGuard } from "../../../../platform/presentation/http/security/guards/merchant-api-key.guard";
import { ZodBody } from "../../../../platform/presentation/http/validation/decorators/zod-request.decorators";
import { ZodResponse } from "../../../../platform/presentation/http/validation/decorators/zod-response.decorators";
import { CheckoutSaleCommand } from "../../application/commands/checkout-sale/checkout-sale.command";
import { ValidateRedemptionCodesCommand } from "../../application/commands/validate-redemption-codes/validate-redemption-codes.command";
import type { CheckoutPoint } from "../../domain/aggregates/reward-sale.aggregate";
import { PosRateLimitGuard } from "./guards/pos-rate-limit.guard";

/** OpenAPI note shared by every POS route. */
const TERMINAL_ID_HEADER_DESCRIPTION =
	"Terminal id. Optional for a key issued by pairing (POST /integration/terminals/pair); required for a manually created key (e.g. KL-REGISTER-01).";

/**
 * POS (machine-to-machine) endpoints. Every route authenticates with a merchant API key header only —
 * never a cookie — so the browser CSRF mutation-intent check does not apply (a POS sends no Origin).
 *
 * Rate limits: the per-IP `strict` auth limiter is skipped (stores share NAT addresses); the per-IP
 * `default` limiter still applies before the key is verified, and `PosRateLimitGuard` limits each API
 * key. Unknown backup codes additionally count toward the key's lockout.
 *
 * Database scope: no RLS bypass. After `MerchantApiKeyGuard` verifies the key, the request runs as the `api_key`
 * principal (prisma/rls/40-api-key-principal.sql): only the key's tenant — and, for a
 * store-scoped key, its store's redemptions and sales — are visible or writable.
 */
@ApiTags("Redemptions")
@SkipMutationIntent()
@Controller(apiPath("/integration/redemptions"))
export class RedemptionsController {
	public constructor(private readonly commandBus: CommandBus) {}

	@Public()
	@SkipThrottle({ strict: true })
	@UseGuards(MerchantApiKeyGuard, PosRateLimitGuard)
	@Post("validate")
	@ApiBearerAuth()
	@ApiHeader({ name: "X-Terminal-Id", required: false, description: TERMINAL_ID_HEADER_DESCRIPTION })
	@ApiOperation({ summary: "POS validate QR or backup code" })
	@ZodResponse(RedemptionPreviewResponseSchema, { status: HttpStatus.CREATED, description: "Redemption preview" })
	public validate(
		@CurrentActor() actor: ActorContext,
		@TillPoint() till: CheckoutPoint,
		@ZodBody(apiContract.integration.validateRedemption.input) body: z.output<typeof apiContract.integration.validateRedemption.input>,
	): Promise<RedemptionPreviewResponse> {
		return this.commandBus.execute(new ValidateRedemptionCodesCommand(actor, till, body));
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
		@CurrentActor() actor: ActorContext,
		@TillPoint() till: CheckoutPoint,
		@ZodBody(apiContract.integration.checkoutRedemption.input) body: z.output<typeof apiContract.integration.checkoutRedemption.input>,
	): Promise<RedemptionCheckoutResponse> {
		return this.commandBus.execute(new CheckoutSaleCommand(actor, till, body));
	}
}
