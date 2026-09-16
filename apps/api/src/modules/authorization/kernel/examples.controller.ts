import { Controller, Get, Param, Query } from "@nestjs/common";
import { ApiBearerAuth, ApiOperation, ApiParam, ApiQuery, ApiTags } from "@nestjs/swagger";

import { CurrentUser } from "../decorators/current-user.decorator";
import type { AuthenticatedUser } from "../../../types/authenticated-user";

import { AuthorizationKernelService } from "./authorization-kernel.service";
import type { AuthorizationDecision, AuthorizationRequest, AuthorizationResult, PermissionAction, PermissionResource } from "@workspace/shared";

/**
 * Example controller demonstrating Authorization Kernel usage.
 *
 * This controller shows how to:
 * 1. Use `can()` for permission checks
 * 2. Use `filter()` for query filtering
 * 3. Use `explain()` for debugging authorization decisions
 *
 * Note: Auth is handled by global AuthGuard, so no @UseGuards needed here.
 */
@ApiTags("Authorization Kernel Examples")
@ApiBearerAuth()
@Controller("authorization-kernel/examples")
export class AuthorizationKernelExamplesController {
	public constructor(private readonly kernel: AuthorizationKernelService) {}

	/**
	 * Check if current user can perform an action on a resource.
	 *
	 * @example GET /authorization-kernel/examples/can?action=UPDATE&resource=ORDER&resourceId=order-123
	 */
	@Get("can")
	@ApiOperation({
		summary: "Check permission (can)",
		description: "Returns ALLOW or DENY decision for the authorization request",
	})
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
			action: action as PermissionAction,
			resource: resource as PermissionResource,
			resourceId,
		};

		const decision = await this.kernel.can(request);

		return { decision };
	}

	/**
	 * Get detailed explanation of authorization decision.
	 *
	 * @example GET /authorization-kernel/examples/explain/UPDATE/ORDER/order-123
	 */
	@Get("explain/:action/:resource/:resourceId")
	@ApiOperation({
		summary: "Explain authorization decision",
		description: "Returns step-by-step breakdown of the authorization decision process",
	})
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
			action: action as PermissionAction,
			resource: resource as PermissionResource,
			resourceId,
		};

		return this.kernel.explain(request);
	}

	/**
	 * Get filter conditions for querying resources.
	 *
	 * @example GET /authorization-kernel/examples/filter?action=READ&resource=ORDER
	 */
	@Get("filter")
	@ApiOperation({
		summary: "Get filter conditions",
		description: "Returns Prisma filter conditions for authorized resources",
	})
	@ApiQuery({ name: "action", enum: ["CREATE", "READ", "UPDATE", "DELETE", "LIST", "MANAGE"] })
	@ApiQuery({ name: "resource", enum: ["USER", "ORGANIZATION", "LOCATION", "ORDER", "PAYMENT", "INVENTORY"] })
	@ApiQuery({ name: "organizationId", required: false })
	@ApiQuery({ name: "locationId", required: false })
	public async getFilter(
		@CurrentUser() user: AuthenticatedUser,
		@Query("action") action: PermissionAction,
		@Query("resource") resource: PermissionResource,
		@Query("organizationId") organizationId?: string,
		@Query("locationId") locationId?: string,
	): Promise<{ filter: Record<string, unknown> }> {
		const request: AuthorizationRequest = {
			subject: {
				userId: user.id,
				organizationId,
				locationId,
				isSuperAdmin: user.isSuperAdmin,
			},
			action: action as PermissionAction,
			resource: resource as PermissionResource,
		};

		const filter = await this.kernel.filter(request);

		return { filter };
	}
}
