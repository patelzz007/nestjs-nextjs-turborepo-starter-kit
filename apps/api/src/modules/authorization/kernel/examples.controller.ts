import { Controller, Get, Param, Query } from "@nestjs/common";
import { ApiBearerAuth, ApiOkResponse, ApiOperation, ApiParam, ApiQuery, ApiTags } from "@nestjs/swagger";
import { z } from "zod";

import {
	apiPath,
	AuthorizationDecisionSchema,
	AuthorizationResultSchema,
	type AuthorizationDecision,
	type AuthorizationRequest,
	type AuthorizationResult,
	type PermissionAction,
	type PermissionResource,
} from "@workspace/shared";

import { createWrappedDto } from "../../../common/dto/response-wrapper";
import { CurrentUser } from "../decorators/current-user.decorator";
import type { AuthenticatedUser } from "../../../types/authenticated-user";

import { AuthorizationKernelService } from "./authorization-kernel.service";

const AuthorizationDecisionResponseSchema = z.object({ decision: AuthorizationDecisionSchema }).strict();
const FilterConditionsResponseSchema = z.object({ filter: z.record(z.string(), z.unknown()) }).strict();

const WrappedAuthorizationDecisionResponse = createWrappedDto(AuthorizationDecisionResponseSchema, "WrappedAuthorizationDecisionResponse");
const WrappedAuthorizationResultResponse = createWrappedDto(AuthorizationResultSchema, "WrappedAuthorizationResultResponse");
const WrappedFilterConditionsResponse = createWrappedDto(FilterConditionsResponseSchema, "WrappedFilterConditionsResponse");

/**
 * Example controller demonstrating Authorization Kernel usage.
 */
@ApiTags("Authorization Kernel Examples")
@ApiBearerAuth()
@Controller(apiPath("/authorization-kernel/examples"))
export class AuthorizationKernelExamplesController {
	public constructor(private readonly kernel: AuthorizationKernelService) {}

	@Get("can")
	@ApiOperation({
		summary: "Check permission (can)",
		description: "Returns ALLOW or DENY decision for the authorization request",
	})
	@ApiOkResponse({ type: WrappedAuthorizationDecisionResponse, description: "Authorization decision" })
	@ApiQuery({ name: "action", enum: ["CREATE", "READ", "UPDATE", "DELETE", "LIST", "MANAGE"] })
	@ApiQuery({ name: "resource", enum: ["USER", "ORGANIZATION", "LOCATION", "ORDER", "PAYMENT", "INVENTORY"] })
	@ApiQuery({ name: "resourceId", required: false })
	@ApiQuery({ name: "organizationId", required: false })
	@ApiQuery({ name: "locationId", required: false })
	public async checkCan(
		@CurrentUser() user: AuthenticatedUser,
		@Query("action") action: PermissionAction,
		@Query("resource") resource: PermissionResource,
		@Query("resourceId") resourceId?: string,
		@Query("organizationId") organizationId?: string,
		@Query("locationId") locationId?: string,
	): Promise<{ decision: AuthorizationDecision }> {
		const request: AuthorizationRequest = {
			subject: {
				userId: user.id,
				organizationId,
				locationId,
				isSuperAdmin: user.isSuperAdmin,
			},
			action: action,
			resource: resource,
			resourceId,
		};

		const decision = await this.kernel.can(request);

		return { decision };
	}

	@Get("explain/:action/:resource/:resourceId")
	@ApiOperation({
		summary: "Explain authorization decision",
		description: "Returns step-by-step breakdown of the authorization decision process",
	})
	@ApiOkResponse({ type: WrappedAuthorizationResultResponse, description: "Authorization explanation" })
	@ApiParam({ name: "action", enum: ["CREATE", "READ", "UPDATE", "DELETE", "LIST", "MANAGE"] })
	@ApiParam({ name: "resource", enum: ["USER", "ORGANIZATION", "LOCATION", "ORDER", "PAYMENT", "INVENTORY"] })
	@ApiParam({ name: "resourceId" })
	public async explainDecision(
		@CurrentUser() user: AuthenticatedUser,
		@Param("action") action: PermissionAction,
		@Param("resource") resource: PermissionResource,
		@Param("resourceId") resourceId: string,
		@Query("organizationId") organizationId?: string,
		@Query("locationId") locationId?: string,
	): Promise<AuthorizationResult> {
		const request: AuthorizationRequest = {
			subject: {
				userId: user.id,
				organizationId,
				locationId,
				isSuperAdmin: user.isSuperAdmin,
			},
			action: action,
			resource: resource,
			resourceId,
		};

		return this.kernel.explain(request);
	}

	@Get("filter")
	@ApiOperation({
		summary: "Get filter conditions",
		description: "Returns Prisma filter conditions for authorized resources",
	})
	@ApiOkResponse({ type: WrappedFilterConditionsResponse, description: "Prisma filter for authorized rows" })
	@ApiQuery({ name: "action", enum: ["CREATE", "READ", "UPDATE", "DELETE", "LIST", "MANAGE"] })
	@ApiQuery({ name: "resource", enum: ["USER", "ORGANIZATION", "LOCATION", "ORDER", "PAYMENT", "INVENTORY"] })
	@ApiQuery({ name: "organizationId", required: false })
	@ApiQuery({ name: "locationId", required: false })
	public getFilter(
		@CurrentUser() user: AuthenticatedUser,
		@Query("action") action: PermissionAction,
		@Query("resource") resource: PermissionResource,
		@Query("organizationId") organizationId?: string,
		@Query("locationId") locationId?: string,
	): { filter: Record<string, unknown> } {
		const filter = this.kernel.filter(
			{
				userId: user.id,
				organizationId,
				locationId,
				isSuperAdmin: user.isSuperAdmin,
			},
			action,
			resource,
		);

		return { filter };
	}
}
