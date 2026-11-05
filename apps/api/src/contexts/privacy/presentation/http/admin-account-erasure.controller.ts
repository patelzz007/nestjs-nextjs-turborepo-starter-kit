// ============================================
// privacy/presentation/http/admin-account-erasure.controller.ts — support erasing an account (ADR 077, Q13)
// ============================================
// For someone who asked another way (for example by email). The same permission as banning an account
// (`DELETE USER`, super admins), and a recorded reason; the request (with the reason) is in the audit log.
import { Controller, Get, HttpCode, HttpStatus, Inject, Post } from "@nestjs/common";
import { ApiBearerAuth, ApiOperation, ApiTags } from "@nestjs/swagger";

import { ACCOUNT_ERASURE_REQUEST_OPERATION } from "../../../../platform/application/personal-data/personal-data-erasure.registry";
import {
	AccountErasureResponseSchema,
	AccountErasureUserParamsSchema,
	apiPath,
	OwnAccountErasureResponseSchema,
	RequestAccountErasureBySupportSchema,
	type AccountErasureResponse,
	type OwnAccountErasureResponse,
	type RequestAccountErasureBySupport,
} from "@workspace/shared";
import type { z } from "zod";

import type { ActorContext } from "../../../../platform/application/actor-context";
import { CurrentActor } from "../../../../platform/presentation/http/security/current-actor.decorator";
import { EmailVerified } from "../../../../platform/presentation/http/security/decorators/email-verified.decorator";
import { PlatformOperation } from "../../../../platform/presentation/http/security/decorators/platform-operation.decorator";
import { RequirePermission } from "../../../../platform/presentation/http/security/decorators/require-permission.decorator";
import { SuperAdminOnly } from "../../../../platform/presentation/http/security/decorators/super-admin.decorator";
import { RATE_LIMIT_POLICY, RateLimit } from "../../../../platform/presentation/http/security/throttling/rate-limit.decorator";
import { ZodBody, ZodParams } from "../../../../platform/presentation/http/validation/decorators/zod-request.decorators";
import { ZodResponse } from "../../../../platform/presentation/http/validation/decorators/zod-response.decorators";
import { ACCOUNT_ERASURE_SERVICE } from "../../application/ports/account-erasure.store";
import type { AccountErasureService } from "../../application/services/account-erasure.service";

type UserParams = z.output<typeof AccountErasureUserParamsSchema>;

@ApiTags("Privacy")
@ApiBearerAuth()
@Controller(apiPath("/admin/users"))
export class AdminAccountErasureController {
	public constructor(@Inject(ACCOUNT_ERASURE_SERVICE) private readonly erasures: AccountErasureService) {}

	@SuperAdminOnly()
	@EmailVerified()
	@PlatformOperation(ACCOUNT_ERASURE_REQUEST_OPERATION)
	@RequirePermission("DELETE", "USER", { resourceId: "userId", description: "Support reads an account's erasure request" })
	@Get(":userId/erasure")
	@ApiOperation({ summary: "Support: an account's open (or latest) erasure request" })
	@ZodResponse(OwnAccountErasureResponseSchema, { description: "The request, or none" })
	public async status(@CurrentActor() actor: ActorContext, @ZodParams(AccountErasureUserParamsSchema) params: UserParams): Promise<OwnAccountErasureResponse> {
		return { erasure: await this.erasures.statusOf(actor, params.userId) };
	}

	@SuperAdminOnly()
	@EmailVerified()
	@PlatformOperation(ACCOUNT_ERASURE_REQUEST_OPERATION)
	@RequirePermission("DELETE", "USER", { resourceId: "userId", description: "Support erases an account for someone who asked another way" })
	@RateLimit(RATE_LIMIT_POLICY.adminSecurityMutation)
	@Post(":userId/erasure")
	@ApiOperation({ summary: "Support: erase an account for someone who asked another way, with a recorded reason (30-day grace; the person is signed out now)" })
	@ZodResponse(AccountErasureResponseSchema, { status: HttpStatus.CREATED, description: "The request" })
	public request(
		@CurrentActor() actor: ActorContext,
		@ZodParams(AccountErasureUserParamsSchema) params: UserParams,
		@ZodBody(RequestAccountErasureBySupportSchema) body: RequestAccountErasureBySupport,
	): Promise<AccountErasureResponse> {
		return this.erasures.requestBySupport(actor, params.userId, body.reason);
	}

	@SuperAdminOnly()
	@EmailVerified()
	@PlatformOperation(ACCOUNT_ERASURE_REQUEST_OPERATION)
	@RequirePermission("DELETE", "USER", { resourceId: "userId", description: "Support cancels an account's erasure" })
	@RateLimit(RATE_LIMIT_POLICY.adminSecurityMutation)
	@Post(":userId/erasure/cancel")
	@HttpCode(HttpStatus.OK)
	@ApiOperation({ summary: "Support: cancel an account's erasure during its grace period" })
	@ZodResponse(AccountErasureResponseSchema, { description: "The cancelled request" })
	public cancel(@CurrentActor() actor: ActorContext, @ZodParams(AccountErasureUserParamsSchema) params: UserParams): Promise<AccountErasureResponse> {
		return this.erasures.cancelBySupport(actor, params.userId);
	}
}
