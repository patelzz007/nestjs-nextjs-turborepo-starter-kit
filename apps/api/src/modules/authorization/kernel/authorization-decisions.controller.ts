import { Body, Controller, Get, HttpCode, HttpStatus, Post, Query, Req } from "@nestjs/common";
import { ApiBearerAuth, ApiOkResponse, ApiOperation, ApiTags } from "@nestjs/swagger";
import type { FastifyRequest } from "fastify";
import {
	apiPath,
	AuthorizationDecisionsRequestSchema,
	AuthorizationDecisionsResponseSchema,
	AuthorizationExplainQuerySchema,
	AuthorizationResultSchema,
	type AuthorizationContext,
	type AuthorizationDecisionsRequest,
	type AuthorizationDecisionsResponse,
	type AuthorizationExplainQuery,
	type AuthorizationResult,
} from "@workspace/shared";

import { createWrappedDto } from "../../../common/dto/response-wrapper";
import { ZodValidationPipe } from "../../../common/pipes/zod-validation.pipe";
import type { AuthenticatedUser } from "../../../types/authenticated-user";
import { RequirePermission } from "../../auth/decorators/require-permission.decorator";
import { CurrentUser } from "../decorators/current-user.decorator";
import { AuthorizationKernelService } from "./authorization-kernel.service";

const WrappedDecisionsResponse = createWrappedDto(AuthorizationDecisionsResponseSchema, "WrappedAuthorizationDecisionsResponse");
const WrappedAuthorizationResultResponse = createWrappedDto(AuthorizationResultSchema, "WrappedAuthorizationResultResponse");

/**
 * Authorization decisions for UI capability rendering (spec §12 option C) and
 * admin debugging (spec §34).
 *
 * The subject is always the authenticated caller and the tenant context is the
 * one `AuthorizationGuard` verified — never ids from the query string.
 */
@ApiTags("Authorization")
@ApiBearerAuth()
@Controller(apiPath("/authorization/decisions"))
export class AuthorizationDecisionsController {
	public constructor(private readonly kernel: AuthorizationKernelService) {}

	@Post()
	@HttpCode(HttpStatus.OK)
	@ApiOperation({ summary: "Evaluate capability checks for the current user (UI hints — the API re-authorizes every operation)" })
	@ApiOkResponse({ type: WrappedDecisionsResponse })
	public async decide(
		@CurrentUser() user: AuthenticatedUser,
		@Req() request: FastifyRequest,
		@Body(new ZodValidationPipe(AuthorizationDecisionsRequestSchema)) body: AuthorizationDecisionsRequest,
	): Promise<AuthorizationDecisionsResponse> {
		const subject: AuthorizationContext = {
			userId: user.id,
			isSuperAdmin: user.isSuperAdmin,
			...(request.authorizationContext?.organizationId === undefined ? {} : { organizationId: request.authorizationContext.organizationId }),
			...(request.authorizationContext?.storeId === undefined ? {} : { storeId: request.authorizationContext.storeId }),
			...(request.authorizationContext?.locationId === undefined ? {} : { locationId: request.authorizationContext.locationId }),
		};

		const results = await Promise.all(
			body.checks.map(async (check) => {
				const decision = await this.kernel.can({
					subject,
					action: check.action,
					resource: check.resource,
					...(check.resourceId === undefined ? {} : { resourceId: check.resourceId }),
				});
				return { ...check, allowed: decision === "ALLOW" };
			}),
		);
		return { results };
	}

	@Get("explain")
	@RequirePermission("READ", "PERMISSION")
	@ApiOperation({ summary: "Admin: step-by-step explanation of an authorization decision" })
	@ApiOkResponse({ type: WrappedAuthorizationResultResponse })
	public async explain(
		@CurrentUser() user: AuthenticatedUser,
		@Query(new ZodValidationPipe(AuthorizationExplainQuerySchema)) query: AuthorizationExplainQuery,
	): Promise<AuthorizationResult> {
		const explainingSelf = query.userId === undefined || query.userId === user.id;
		// The kernel re-verifies organization / location membership for the explained subject.
		return this.kernel.explain({
			subject: {
				userId: query.userId ?? user.id,
				isSuperAdmin: explainingSelf ? user.isSuperAdmin : false,
				...(query.organizationId === undefined ? {} : { organizationId: query.organizationId }),
				...(query.storeId === undefined ? {} : { storeId: query.storeId }),
				...(query.locationId === undefined ? {} : { locationId: query.locationId }),
			},
			action: query.action,
			resource: query.resource,
			...(query.resourceId === undefined ? {} : { resourceId: query.resourceId }),
		});
	}
}
