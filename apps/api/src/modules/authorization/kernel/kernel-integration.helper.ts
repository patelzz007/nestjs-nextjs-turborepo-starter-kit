import { ForbiddenException, Injectable } from "@nestjs/common";
import type {
	AuthorizationContext,
	AuthorizationDecision,
	AuthorizationRequest,
	PermissionAction,
	PermissionResource,
} from "@workspace/shared";

import { AuthorizationKernelService } from "./authorization-kernel.service";

/**
 * Helper service for integrating Authorization Kernel into controllers and services.
 *
 * Provides convenient methods for common authorization patterns:
 * - Resource creation checks
 * - Resource update/delete checks
 * - Query filtering
 * - Batch authorization
 */
@Injectable()
export class KernelIntegrationHelper {
	public constructor(private readonly kernel: AuthorizationKernelService) {}

	/**
	 * Check if user can perform action on a resource type (no specific resource).
	 * Throws ForbiddenException if denied.
	 *
	 * @example
	 * await helper.requireAction(userId, "CREATE", "ORDER", { organizationId });
	 */
	public async requireAction(
		userId: string,
		action: PermissionAction,
		resource: PermissionResource,
		context?: {
			organizationId?: string;
			locationId?: string;
			isSuperAdmin?: boolean;
		},
	): Promise<void> {
		const request: AuthorizationRequest = {
			subject: {
				userId,
				organizationId: context?.organizationId,
				locationId: context?.locationId,
				isSuperAdmin: context?.isSuperAdmin ?? false,
			},
			action: action as never,
			resource: resource as never,
		};

		const decision = await this.kernel.can(request);

		if (decision === "DENY") {
			throw new ForbiddenException({
				message: `Insufficient permissions to ${action} ${resource}`,
				error: "AUTHORIZATION_DENIED",
				action,
				resource,
			});
		}
	}

	/**
	 * Check if user can perform action on a specific resource.
	 * Throws ForbiddenException if denied.
	 *
	 * @example
	 * await helper.requireResourceAccess(userId, "UPDATE", "ORDER", orderId, { organizationId });
	 */
	public async requireResourceAccess(
		userId: string,
		action: PermissionAction,
		resource: PermissionResource,
		resourceId: string,
		context?: {
			organizationId?: string;
			locationId?: string;
			isSuperAdmin?: boolean;
			resourceAttributes?: Record<string, unknown>;
		},
	): Promise<void> {
		const request: AuthorizationRequest = {
			subject: {
				userId,
				organizationId: context?.organizationId,
				locationId: context?.locationId,
				isSuperAdmin: context?.isSuperAdmin ?? false,
			},
			action: action as never,
			resource: resource as never,
			resourceId,
			resourceAttributes: context?.resourceAttributes,
		};

		const decision = await this.kernel.can(request);

		if (decision === "DENY") {
			throw new ForbiddenException({
				message: `Insufficient permissions to ${action} ${resource}`,
				error: "AUTHORIZATION_DENIED",
				action,
				resource,
				resourceId,
			});
		}
	}

	/**
	 * Get filter conditions for querying resources.
	 * Use this to filter list/query operations at the database level.
	 *
	 * @example
	 * const filter = await helper.getQueryFilter(userId, "READ", "ORDER", { organizationId });
	 * const orders = await prisma.order.findMany({ where: { ...filter, ...otherConditions } });
	 */
	public async getQueryFilter(
		userId: string,
		action: PermissionAction,
		resource: PermissionResource,
		context?: {
			organizationId?: string;
			locationId?: string;
			isSuperAdmin?: boolean;
		},
	): Promise<Record<string, unknown>> {
		const authContext: AuthorizationContext = {
			userId,
			organizationId: context?.organizationId,
			locationId: context?.locationId,
			isSuperAdmin: context?.isSuperAdmin ?? false,
		};

		return this.kernel.filter(authContext, action as never, resource as never);
	}

	/**
	 * Check if user can perform action (returns boolean, doesn't throw).
	 *
	 * @example
	 * const canDelete = await helper.canAccessResource(userId, "DELETE", "ORDER", orderId);
	 */
	public async canAccessResource(
		userId: string,
		action: PermissionAction,
		resource: PermissionResource,
		resourceId?: string,
		context?: {
			organizationId?: string;
			locationId?: string;
			isSuperAdmin?: boolean;
		},
	): Promise<boolean> {
		const request: AuthorizationRequest = {
			subject: {
				userId,
				organizationId: context?.organizationId,
				locationId: context?.locationId,
				isSuperAdmin: context?.isSuperAdmin ?? false,
			},
			action: action as never,
			resource: resource as never,
			resourceId,
		};

		const decision = await this.kernel.can(request);
		return decision === "ALLOW";
	}

	/**
	 * Batch check multiple resources at once.
	 * Returns a map of resourceId -> boolean (allowed).
	 *
	 * @example
	 * const permissions = await helper.batchCheckResources(
	 *   userId,
	 *   "UPDATE",
	 *   "ORDER",
	 *   ["order-1", "order-2", "order-3"],
	 * );
	 * // { "order-1": true, "order-2": false, "order-3": true }
	 */
	public async batchCheckResources(
		userId: string,
		action: PermissionAction,
		resource: PermissionResource,
		resourceIds: readonly string[],
		context?: {
			organizationId?: string;
			locationId?: string;
			isSuperAdmin?: boolean;
		},
	): Promise<Record<string, boolean>> {
		const results = await Promise.all(
			resourceIds.map(async (resourceId) => {
				const allowed = await this.canAccessResource(userId, action, resource, resourceId, context);
				return [resourceId, allowed] as const;
			}),
		);

		return Object.fromEntries(results);
	}

	/**
	 * Filter a list of resources to only those the user can access.
	 *
	 * @example
	 * const accessibleOrders = await helper.filterAccessibleResources(
	 *   userId,
	 *   "UPDATE",
	 *   "ORDER",
	 *   orders,
	 *   (order) => order.id,
	 * );
	 */
	public async filterAccessibleResources<T>(
		userId: string,
		action: PermissionAction,
		resource: PermissionResource,
		items: readonly T[],
		getResourceId: (item: T) => string,
		context?: {
			organizationId?: string;
			locationId?: string;
			isSuperAdmin?: boolean;
		},
	): Promise<T[]> {
		const resourceIds = items.map(getResourceId);
		const permissions = await this.batchCheckResources(userId, action, resource, resourceIds, context);

		return items.filter((item) => permissions[getResourceId(item)] === true);
	}
}
