import { SetMetadata } from "@nestjs/common";
import type { PermissionAction, PermissionResource } from "@workspace/shared";

import { REQUIRED_PERMISSION_KEY, type RequiredPermission, type RequiredPermissionTarget } from "./route-requirements.metadata";

/** Every requirement declared so far, per controller prototype and route method. */
const declared = new WeakMap<object, Map<string | symbol, readonly RequiredPermission[]>>();

/**
 * The one way to protect a route (a controller method): the caller must hold the permission (that exact verb on
 * that resource), checked by the authorization kernel in the global `AuthorizationGuard`. Super-admins
 * bypass, audited. With a target, the check is about one record:
 *
 * ```ts
 * @RequirePermission("LIST", "USER")                                  // the collection
 * @RequirePermission("UPDATE", "PROFILE", { resourceId: self() })     // the caller's own record
 * ```
 *
 * A route may stack several: **every one must pass**. An admin acting on someone else's record
 * declares both the permission and the record, so a self-only grant can never satisfy it:
 *
 * ```ts
 * @RequirePermission("DELETE", "USER")
 * @RequirePermission("DELETE", "USER", { resourceId: "userId", description: "A platform admin bans an account" })
 * ```
 */
export function RequirePermission(action: PermissionAction, resource: PermissionResource, target: RequiredPermissionTarget = {}): MethodDecorator {
	const requirement: RequiredPermission = { action, resource, ...target };
	return <TValue>(controller: object, method: string | symbol, descriptor: TypedPropertyDescriptor<TValue>): void => {
		const routes = declared.get(controller) ?? new Map<string | symbol, readonly RequiredPermission[]>();
		// Decorators apply bottom-up: putting each one first keeps the order they are written in.
		const requirements: readonly RequiredPermission[] = [requirement, ...(routes.get(method) ?? [])];
		routes.set(method, requirements);
		declared.set(controller, routes);
		SetMetadata(REQUIRED_PERMISSION_KEY, requirements)(controller, method, descriptor);
	};
}
