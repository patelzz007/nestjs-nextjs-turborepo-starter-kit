// ============================================
// privacy/presentation/http/account-erasure.controller.ts — "Delete my account" (ADR 077)
// ============================================
import { Controller, Get, HttpCode, HttpStatus, Inject, Post } from "@nestjs/common";
import { ApiOperation, ApiTags } from "@nestjs/swagger";
import {
	AccountErasureResponseSchema,
	apiPath,
	OwnAccountErasureResponseSchema,
	RequestOwnAccountErasureSchema,
	type AccountErasureResponse,
	type OwnAccountErasureResponse,
	type RequestOwnAccountErasure,
} from "@workspace/shared";

import type { ActorContext } from "../../../../platform/application/actor-context";
import { CurrentActor } from "../../../../platform/presentation/http/security/current-actor.decorator";
import { RATE_LIMIT_POLICY, RateLimit } from "../../../../platform/presentation/http/security/throttling/rate-limit.decorator";
import { ZodBody } from "../../../../platform/presentation/http/validation/decorators/zod-request.decorators";
import { ZodResponse } from "../../../../platform/presentation/http/validation/decorators/zod-response.decorators";
import { ACCOUNT_ERASURE_SERVICE } from "../../application/ports/account-erasure.store";
import type { AccountErasureService } from "../../application/services/account-erasure.service";

@ApiTags("Privacy")
@Controller(apiPath("/me"))
export class AccountErasureController {
	public constructor(@Inject(ACCOUNT_ERASURE_SERVICE) private readonly erasures: AccountErasureService) {}

	@Get("erasure")
	@ApiOperation({ summary: "Your account's erasure request: open, cancelled, or none" })
	@ZodResponse(OwnAccountErasureResponseSchema, { description: "The open (or most recent) request" })
	public async status(@CurrentActor() actor: ActorContext): Promise<OwnAccountErasureResponse> {
		return { erasure: await this.erasures.ownStatus(actor) };
	}

	@Post("erasure")
	@RateLimit(RATE_LIMIT_POLICY.credential)
	@ApiOperation({ summary: "Delete my account: confirmed with your password; every session ends now, and the account is erased after 30 days unless you cancel" })
	@ZodResponse(AccountErasureResponseSchema, { status: HttpStatus.CREATED, description: "The request, with the date it will be carried out" })
	public requestOwn(@CurrentActor() actor: ActorContext, @ZodBody(RequestOwnAccountErasureSchema) body: RequestOwnAccountErasure): Promise<AccountErasureResponse> {
		return this.erasures.requestOwn(actor, body.password);
	}

	@Post("erasure/cancel")
	@HttpCode(HttpStatus.OK)
	@RateLimit(RATE_LIMIT_POLICY.authenticatedMutation)
	@ApiOperation({ summary: "Change your mind: cancel your account's erasure during the grace period" })
	@ZodResponse(AccountErasureResponseSchema, { description: "The cancelled request" })
	public cancelOwn(@CurrentActor() actor: ActorContext): Promise<AccountErasureResponse> {
		return this.erasures.cancelOwn(actor);
	}
}
