import { SetMetadata, ExecutionContext } from "@nestjs/common";
import type { FastifyRequest } from "fastify";
import type { PermissionAction, PermissionResource } from "@workspace/shared";

import { isAuthenticatedUser } from "../../../types/authenticated-user";

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

/** Mutable draft used only by {@link AuthorizeBuilder} (public requirement stays readonly). */
interface AuthorizationRequirementDraft<
	TAction extends PermissionAction = PermissionAction,
	TResource extends PermissionResource = PermissionResource,
	TContext extends Record<string, unknown> = Record<string, unknown>,
> {
	action?: TAction;
	resource?: TResource;
	resourceId?: string | ResourceIdExtractor | null;
	context?: TContext | ContextExtractor<ExecutionContext, TContext>;
	scope?: string;
	description?: string;
}

function getHttpRequest(context: ExecutionContext): FastifyRequest {
	return context.switchToHttp().getRequest<FastifyRequest>();
}

function isRecord(value: unknown): value is Record<string, unknown> {
	return value !== null && typeof value === "object";
}

function readStringParam(params: unknown, key: string): string | undefined {
	if (!isRecord(params)) {
		return undefined;
	}
	const value = params[key];
	return typeof value === "string" ? value : undefined;
}

function resolveDotPath(root: unknown, path: string): unknown {
	let current: unknown = root;
	for (const prop of path.split(".")) {
		if (!isRecord(current)) {
			return undefined;
		}
		current = current[prop];
	}
	return current;
}

function buildContextFromPaths(fields: Record<string, string>, root: unknown): Record<string, unknown> {
	const result: Record<string, unknown> = {};
	for (const [key, path] of Object.entries(fields)) {
		result[key] = resolveDotPath(root, path);
	}
	return result;
}

/**
 * Unified @Authorize decorator for kernel-first authorization.
 */
export function Authorize<
	TAction extends PermissionAction = PermissionAction,
	TResource extends PermissionResource = PermissionResource,
	TContext extends Record<string, unknown> = Record<string, unknown>,
>(requirement: AuthorizationRequirement<TAction, TResource, TContext>): MethodDecorator {
	return SetMetadata(AUTHORIZE_KEY, requirement);
}

export function fromParam(paramName: string): ResourceIdExtractor {
	return (context: ExecutionContext): string | null => {
		const request = getHttpRequest(context);
		const value = readStringParam(request.params, paramName);
		return value ?? null;
	};
}

export function fromBody(fields: Record<string, string>): ContextExtractor {
	return (context: ExecutionContext): Record<string, unknown> => {
		const request = getHttpRequest(context);
		return buildContextFromPaths(fields, request.body);
	};
}

export function fromUser(fields: Record<string, string>): ContextExtractor {
	return (context: ExecutionContext): Record<string, unknown> => {
		const request = getHttpRequest(context);
		const user = request.user;
		const root: unknown = isAuthenticatedUser(user) ? user : undefined;
		return buildContextFromPaths(fields, root);
	};
}

export class AuthorizeBuilder<
	TAction extends PermissionAction = PermissionAction,
	TResource extends PermissionResource = PermissionResource,
	TContext extends Record<string, unknown> = Record<string, unknown>,
> {
	private readonly requirement: AuthorizationRequirementDraft<TAction, TResource, TContext> = {};

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
		const action = this.requirement.action;
		const resource = this.requirement.resource;
		if (action === undefined || resource === undefined) {
			throw new Error("AuthorizeBuilder: action and resource are required");
		}

		return {
			action,
			resource,
			resourceId: this.requirement.resourceId,
			context: this.requirement.context,
			scope: this.requirement.scope,
			description: this.requirement.description,
		};
	}
}

export function requireAll<
	TAction extends PermissionAction = PermissionAction,
	TResource extends PermissionResource = PermissionResource,
	TContext extends Record<string, unknown> = Record<string, unknown>,
>(...requirements: readonly AuthorizationRequirement<TAction, TResource, TContext>[]): readonly AuthorizationRequirement<TAction, TResource, TContext>[] {
	return requirements;
}

export function requireAny<
	TAction extends PermissionAction = PermissionAction,
	TResource extends PermissionResource = PermissionResource,
	TContext extends Record<string, unknown> = Record<string, unknown>,
>(...requirements: readonly AuthorizationRequirement<TAction, TResource, TContext>[]): readonly AuthorizationRequirement<TAction, TResource, TContext>[] {
	return requirements;
}
