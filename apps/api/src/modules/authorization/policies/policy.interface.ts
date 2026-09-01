import type { PermissionAction, PermissionResource } from "@workspace/shared";

/**
 * Context passed to a policy when evaluating authorization.
 *
 * Contains the authenticated user and the resource being accessed.
 */
export interface PolicyContext<T = Record<string, unknown>> {
	/** The user ID of the authenticated user. */
	readonly userId: string;
	/** Whether the user is a super-admin. */
	readonly isSuperAdmin: boolean;
	/** The resource being accessed (if applicable). */
	readonly resource?: T;
}

/**
 * A policy defines resource-specific authorization rules beyond basic RBAC.
 *
 * Example:
 * ```ts
 * const PostPolicy: Policy = {
 *   resource: "POST",
 *   canUpdate: (ctx) => ctx.resource.authorId === ctx.userId,
 *   canDelete: (ctx) => ctx.resource.authorId === ctx.userId || ctx.isSuperAdmin,
 * };
 * ```
 */
export interface Policy {
	/** The resource this policy applies to. */
	readonly resource: PermissionResource;

	/** Check if the user can perform an action on a specific resource instance. */
	readonly can?: (action: PermissionAction, ctx: PolicyContext) => boolean;
}
