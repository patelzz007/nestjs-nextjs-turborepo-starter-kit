import { Injectable, Logger } from "@nestjs/common";
import type { PermissionAction, PermissionResource } from "@workspace/shared";

import type { Policy, PolicyContext } from "./policy.interface";

/**
 * Registry of resource-specific policies.
 *
 * Policies extend basic RBAC with resource-instance-level rules. For example,
 * a user might have `POST.UPDATE` permission but can only update posts they
 * authored — that logic lives in a policy.
 *
 * ## Usage
 *
 * ```ts
 * // Register a policy
 * policyRegistry.register({
 *   resource: "POST",
 *   can: (action, ctx) => ctx.resource.authorId === ctx.userId,
 * });
 *
 * // Check in a controller
 * const allowed = policyRegistry.can("UPDATE", "POST", {
 *   userId: user.id,
 *   isSuperAdmin: user.isSuperAdmin,
 *   resource: post,
 * });
 * ```
 */
@Injectable()
export class PolicyRegistry {
	private readonly logger: Logger = new Logger(PolicyRegistry.name);

	private readonly policies: Map<PermissionResource, Policy> = new Map<PermissionResource, Policy>();

	/**
	 * Register a policy for a resource.
	 *
	 * If a policy already exists for the resource, it is replaced.
	 */
	public register(policy: Policy): void {
		this.policies.set(policy.resource, policy);
		this.logger.debug(`Registered policy for resource: ${policy.resource}`);
	}

	/**
	 * Unregister a policy for a resource.
	 */
	public unregister(resource: PermissionResource): void {
		this.policies.delete(resource);
	}

	/**
	 * Check if a resource-specific policy allows the action.
	 *
	 * @returns `true` if the policy allows, `false` if it denies,
	 *          or `null` if no policy exists (caller should fall back to RBAC).
	 */
	public can(action: PermissionAction, resource: PermissionResource, ctx: PolicyContext): boolean | null {
		const policy: Policy | undefined = this.policies.get(resource);
		if (policy?.can === undefined) {
			return null;
		}
		return policy.can(action, ctx);
	}

	/**
	 * List all registered policies.
	 */
	public list(): readonly Policy[] {
		return Array.from(this.policies.values());
	}
}
