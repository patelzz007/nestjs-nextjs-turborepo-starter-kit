import { Controller, Get, Post } from "@nestjs/common";
import { ApiBearerAuth, ApiOperation, ApiTags } from "@nestjs/swagger";
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

import { RequestContextService, type RequestTenant } from "../../../common/context/request-context";
import { ZodBody, ZodQuery } from "../../../common/decorators/zod-request.decorators";
import { ZodResponse } from "../../../common/decorators/zod-response.decorators";
import type { AuthenticatedUser } from "../../../types/authenticated-user";
import { RequirePermission } from "../../auth/decorators/require-permission.decorator";
import { CurrentUser } from "../decorators/current-user.decorator";
import { AuthorizationKernelService } from "./authorization-kernel.service";

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
	public constructor(
		private readonly kernel: AuthorizationKernelService,
		private readonly requestContext: RequestContextService,
	) {}

	@Post()
	@ApiOperation({ summary: "Evaluate capability checks for the current user (UI hints — the API re-authorizes every operation)" })
	@ZodResponse(AuthorizationDecisionsResponseSchema, { description: "One decision per requested check, in request order" })
	public async decide(
		@CurrentUser() user: AuthenticatedUser,
		@ZodBody(AuthorizationDecisionsRequestSchema) body: AuthorizationDecisionsRequest,
	): Promise<AuthorizationDecisionsResponse> {
		// Server-verified tenant, bound by AuthorizationGuard into the request context (ADR 017).
		const tenant: RequestTenant | undefined = this.requestContext.current()?.tenant;
		const subject: AuthorizationContext = {
			userId: user.id,
			isSuperAdmin: user.isSuperAdmin,
			...(tenant?.organizationId === undefined ? {} : { organizationId: tenant.organizationId }),
			...(tenant?.storeId === undefined ? {} : { storeId: tenant.storeId }),
			...(tenant?.locationId === undefined ? {} : { locationId: tenant.locationId }),
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
	@ZodResponse(AuthorizationResultSchema, { description: "The decision with every evaluation step" })
	public async explain(@CurrentUser() user: AuthenticatedUser, @ZodQuery(AuthorizationExplainQuerySchema) query: AuthorizationExplainQuery): Promise<AuthorizationResult> {
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
