import { Controller, Get, Post } from "@nestjs/common";
import { QueryBus } from "@nestjs/cqrs";
import { ApiBearerAuth, ApiOperation, ApiTags } from "@nestjs/swagger";
import {
	apiPath,
	AuthorizationDecisionsRequestSchema,
	AuthorizationDecisionsResponseSchema,
	AuthorizationExplainQuerySchema,
	AuthorizationResultSchema,
	type AuthorizationDecisionsRequest,
	type AuthorizationDecisionsResponse,
	type AuthorizationExplainQuery,
	type AuthorizationResult,
} from "@workspace/shared";

import type { ActorContext } from "../../../../platform/application/actor-context";
import { CurrentActor } from "../../../../platform/presentation/http/security/current-actor.decorator";
import { PlatformOperation } from "../../../../platform/presentation/http/security/decorators/platform-operation.decorator";
import { RequirePermission } from "../../../../platform/presentation/http/security/decorators/require-permission.decorator";
import { RATE_LIMIT_POLICY, RateLimit } from "../../../../platform/presentation/http/security/throttling/rate-limit.decorator";
import { ZodBody, ZodQuery } from "../../../../platform/presentation/http/validation/decorators/zod-request.decorators";
import { ZodResponse } from "../../../../platform/presentation/http/validation/decorators/zod-response.decorators";
import { DecideAuthorizationQuery } from "../../application/queries/decide-authorization/decide-authorization.query";
import { ExplainAuthorizationQuery } from "../../application/queries/explain-authorization/explain-authorization.query";
import { PRINCIPAL_LOOKUP_OPERATION } from "../../../../platform/application/shared-system-operations";

/**
 * Authorization decisions for UI capability rendering (spec §12 option C) and admin debugging (spec §34).
 * The subject is always the authenticated caller and the tenant context is the one `AuthorizationGuard`
 * verified, never ids from the query string.
 */
@ApiTags("Authorization")
@ApiBearerAuth()
@Controller(apiPath("/authorization/decisions"))
export class AuthorizationDecisionsController {
	public constructor(private readonly queryBus: QueryBus) {}

	@Post()
	@RateLimit(RATE_LIMIT_POLICY.authenticatedMutation)
	@ApiOperation({ summary: "Evaluate capability checks for the current user (UI hints — the API re-authorizes every operation)" })
	@ZodResponse(AuthorizationDecisionsResponseSchema, { description: "One decision per requested check, in request order" })
	public async decide(
		@CurrentActor() actor: ActorContext,
		@ZodBody(AuthorizationDecisionsRequestSchema) body: AuthorizationDecisionsRequest,
	): Promise<AuthorizationDecisionsResponse> {
		return this.queryBus.execute(new DecideAuthorizationQuery(actor, body.checks));
	}

	@Get("explain")
	@RequirePermission("READ", "PERMISSION")
	@PlatformOperation(PRINCIPAL_LOOKUP_OPERATION)
	@ApiOperation({ summary: "Admin: step-by-step explanation of an authorization decision" })
	@ZodResponse(AuthorizationResultSchema, { description: "The decision with every evaluation step" })
	public async explain(@CurrentActor() actor: ActorContext, @ZodQuery(AuthorizationExplainQuerySchema) query: AuthorizationExplainQuery): Promise<AuthorizationResult> {
		return this.queryBus.execute(new ExplainAuthorizationQuery(actor, query));
	}
}
