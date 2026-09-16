import { SetMetadata, ExecutionContext } from "@nestjs/common";
import type { PermissionAction, PermissionResource } from "@workspace/shared";

/**
 * Authorization metadata key for the new unified @Authorize decorator.
 */
export const AUTHORIZE_KEY = "authorization:authorize";

/**
 * Resource ID extractor function type.
 * Extracts resourceId from the execution context (e.g., from path params).
 */
export type ResourceIdExtractor<TContext extends ExecutionContext = ExecutionContext> = (context: TContext) => string | null;

/**
 * Context extractor function type.
 * Extracts additional context from the execution context (e.g., organization ID, location ID).
 */
export type ContextExtractor<TContext extends ExecutionContext = ExecutionContext, TResult extends Record<string, unknown> = Record<string, unknown>> = (
	context: TContext,
) => TResult;

/**
 * Generic authorization requirement configuration.
 *
 * @template TAction - The permission action type (type-safe)
 * @template TResource - The permission resource type (type-safe)
 * @template TContext - Additional context type (generic, no any/unknown/never)
 */
export interface AuthorizationRequirement<
	TAction extends PermissionAction = PermissionAction,
	TResource extends PermissionResource = PermissionResource,
	TContext extends Record<string, unknown> = Record<string, unknown>,
> {
	/**
	 * The permission action required (READ, CREATE, UPDATE, DELETE, etc.)
	 */
	readonly action: TAction;

	/**
	 * The permission resource type (USER, ORDER, LOCATION, etc.)
	 */
	readonly resource: TResource;

	/**
	 * Resource ID - can be:
	 * - A static string
	 * - A function to extract from context
	 * - A param name (e.g., "id" → extracts from req.params.id)
	 * - null for non-resource-specific checks
	 */
	readonly resourceId?: string | ResourceIdExtractor | null;

	/**
	 * Additional context for authorization decision.
	 * Can be static values or a function to extract from request.
	 */
	readonly context?: TContext | ContextExtractor<ExecutionContext, TContext>;

	/**
	 * Optional scope restriction (GLOBAL, ORGANIZATION, LOCATION, RESOURCE, OWN)
	 */
	readonly scope?: string;

	/**
	 * Optional description for debugging/audit
	 */
	readonly description?: string;
}

/**
 * Unified @Authorize decorator for kernel-first authorization.
 *
 * Replaces the old @RequirePermission decorator with a more flexible,
 * type-safe, and kernel-native approach.
 *
 * @example
 * // Simple permission check
 * @Authorize({ action: "CREATE", resource: "ORDER" })
 * async createOrder() { ... }
 *
 * @example
 * // With resource ID from path param
 * @Authorize({
 *   action: "UPDATE",
 *   resource: "ORDER",
 *   resourceId: "id" // Extracts from req.params.id
 * })
 * async updateOrder(@Param("id") id: string) { ... }
 *
 * @example
 * // With custom resource ID extractor
 * @Authorize({
 *   action: "DELETE",
 *   resource: "ORDER",
 *   resourceId: (ctx) => ctx.switchToHttp().getRequest().params.orderId
 * })
 * async deleteOrder() { ... }
 *
 * @example
 * // With static context
 * @Authorize({
 *   action: "CREATE",
 *   resource: "LOCATION",
 *   context: { organizationId: "org-123" }
 * })
 * async createLocation() { ... }
 *
 * @example
 * // With dynamic context extractor
 * @Authorize({
 *   action: "UPDATE",
 *   resource: "LOCATION",
 *   resourceId: "id",
 *   context: (ctx) => ({
 *     organizationId: ctx.switchToHttp().getRequest().body.organizationId,
 *     locationId: ctx.switchToHttp().getRequest().params.id
 *   })
 * })
 * async updateLocation() { ... }
 *
 * @example
 * // With generic typed context
 * interface OrderContext {
 *   organizationId: string;
 *   orderTotal: number;
 * }
 *
 * @Authorize<"CREATE", "ORDER", OrderContext>({
 *   action: "CREATE",
 *   resource: "ORDER",
 *   context: (ctx) => ({
 *     organizationId: ctx.switchToHttp().getRequest().user.organizationId,
 *     orderTotal: ctx.switchToHttp().getRequest().body.total
 *   })
 * })
 * async createOrder() { ... }
 */
export function Authorize<
	TAction extends PermissionAction = PermissionAction,
	TResource extends PermissionResource = PermissionResource,
	TContext extends Record<string, unknown> = Record<string, unknown>,
>(requirement: AuthorizationRequirement<TAction, TResource, TContext>): MethodDecorator {
	return SetMetadata(AUTHORIZE_KEY, requirement);
}

/**
 * Helper to create a resource ID extractor from a param name.
 *
 * @param paramName - The name of the path parameter (e.g., "id", "orderId")
 * @returns A resource ID extractor function
 *
 * @example
 * @Authorize({
 *   action: "UPDATE",
 *   resource: "ORDER",
 *   resourceId: fromParam("orderId")
 * })
 * async updateOrder(@Param("orderId") orderId: string) { ... }
 */
export function fromParam(paramName: string): ResourceIdExtractor {
	return (context: ExecutionContext): string | null => {
		const request = context.switchToHttp().getRequest();
		const value = request.params?.[paramName];
		return typeof value === "string" ? value : null;
	};
}

/**
 * Helper to create a context extractor from request body fields.
 *
 * @param fields - Object mapping context keys to body field paths
 * @returns A context extractor function
 *
 * @example
 * @Authorize({
 *   action: "CREATE",
 *   resource: "ORDER",
 *   context: fromBody({
 *     organizationId: "organizationId",
 *     locationId: "deliveryLocation.id"
 *   })
 * })
 * async createOrder(@Body() data: CreateOrderDto) { ... }
 */
export function fromBody<TContext extends Record<string, unknown>>(fields: Record<keyof TContext, string>): ContextExtractor<ExecutionContext, TContext> {
	return (context: ExecutionContext): TContext => {
		const request = context.switchToHttp().getRequest();
		const result = {} as TContext;

		for (const [key, path] of Object.entries(fields)) {
			// Simple dot-notation path resolver
			const value = path
				.split(".")
				.reduce((obj: Record<string, unknown> | undefined, prop: string) => obj?.[prop] as Record<string, unknown> | undefined, request.body as Record<string, unknown>);

			result[key as keyof TContext] = value as TContext[keyof TContext];
		}

		return result;
	};
}

/**
 * Helper to create a context extractor from user properties.
 *
 * @param fields - Object mapping context keys to user property paths
 * @returns A context extractor function
 *
 * @example
 * @Authorize({
 *   action: "CREATE",
 *   resource: "LOCATION",
 *   context: fromUser({
 *     organizationId: "organizationId",
 *     isSuperAdmin: "isSuperAdmin"
 *   })
 * })
 * async createLocation() { ... }
 */
export function fromUser<TContext extends Record<string, unknown>>(fields: Record<keyof TContext, string>): ContextExtractor<ExecutionContext, TContext> {
	return (context: ExecutionContext): TContext => {
		const request = context.switchToHttp().getRequest();
		const result = {} as TContext;

		for (const [key, path] of Object.entries(fields)) {
			const value = path
				.split(".")
				.reduce((obj: Record<string, unknown> | undefined, prop: string) => obj?.[prop] as Record<string, unknown> | undefined, request.user as Record<string, unknown>);

			result[key as keyof TContext] = value as TContext[keyof TContext];
		}

		return result;
	};
}

/**
 * Type-safe authorization requirement builder for complex scenarios.
 *
 * @example
 * const orderAuth = AuthorizeBuilder<"UPDATE", "ORDER">()
 *   .action("UPDATE")
 *   .resource("ORDER")
 *   .resourceId(fromParam("id"))
 *   .context((ctx) => ({
 *     organizationId: ctx.switchToHttp().getRequest().user.organizationId
 *   }))
 *   .build();
 *
 * @Authorize(orderAuth)
 * async updateOrder() { ... }
 */
export class AuthorizeBuilder<
	TAction extends PermissionAction = PermissionAction,
	TResource extends PermissionResource = PermissionResource,
	TContext extends Record<string, unknown> = Record<string, unknown>,
> {
	private requirement: Partial<AuthorizationRequirement<TAction, TResource, TContext>> = {};

	public action(action: TAction): this {
		this.requirement.action = action;
		return this;
	}

	public resource(resource: TResource): this {
		this.requirement.resource = resource;
		return this;
	}

	public resourceId(resourceId: string | ResourceIdExtractor | null): this {
		this.requirement.resourceId = resourceId;
		return this;
	}

	public context(context: TContext | ContextExtractor<ExecutionContext, TContext>): this {
		this.requirement.context = context;
		return this;
	}

	public scope(scope: string): this {
		this.requirement.scope = scope;
		return this;
	}

	public description(description: string): this {
		this.requirement.description = description;
		return this;
	}

	public build(): AuthorizationRequirement<TAction, TResource, TContext> {
		if (!this.requirement.action || !this.requirement.resource) {
			throw new Error("AuthorizeBuilder: action and resource are required");
		}

		return this.requirement as AuthorizationRequirement<TAction, TResource, TContext>;
	}
}

/**
 * Helper to create multiple authorization requirements (for AND semantics).
 *
 * @example
 * @Authorize(requireAll(
 *   { action: "READ", resource: "USER" },
 *   { action: "UPDATE", resource: "USER" }
 * ))
 * async updateUserProfile() { ... }
 */
export function requireAll<
	TAction extends PermissionAction = PermissionAction,
	TResource extends PermissionResource = PermissionResource,
	TContext extends Record<string, unknown> = Record<string, unknown>,
>(...requirements: readonly AuthorizationRequirement<TAction, TResource, TContext>[]): readonly AuthorizationRequirement<TAction, TResource, TContext>[] {
	return requirements;
}

/**
 * Helper to create multiple authorization requirements (for OR semantics).
 *
 * @example
 * @Authorize(requireAny(
 *   { action: "UPDATE", resource: "ORDER" },
 *   { action: "MANAGE", resource: "ORDER" }
 * ))
 * async modifyOrder() { ... }
 */
export function requireAny<
	TAction extends PermissionAction = PermissionAction,
	TResource extends PermissionResource = PermissionResource,
	TContext extends Record<string, unknown> = Record<string, unknown>,
>(...requirements: readonly AuthorizationRequirement<TAction, TResource, TContext>[]): readonly AuthorizationRequirement<TAction, TResource, TContext>[] {
	return requirements;
}
