import { SetMetadata, type ExecutionContext } from "@nestjs/common";
import type { FastifyRequest } from "fastify";
import { z } from "zod";
import { AuthorizationAttributeValueSchema, type AuthorizationAttributes, type PermissionAction, type PermissionResource } from "@workspace/shared";

import { isAuthenticatedUser } from "../../../types/authenticated-user";

/** Metadata key read by `AuthorizationGuard` to enforce `@Authorize(...)`. */
export const AUTHORIZE_KEY = "authorization:authorize";

/** Extracts the target resource id from the request (`null` = none resolvable → deny). */
export type ResourceIdExtractor = (context: ExecutionContext) => string | null;

/** Extracts server-side resource attributes for policy evaluation. */
export type ResourceAttributesExtractor = (context: ExecutionContext) => AuthorizationAttributes;

/**
 * Route-level authorization requirement enforced by the global
 * `AuthorizationGuard` through the Authorization Kernel.
 *
 * @template TAction - permission action (compile-time checked)
 * @template TResource - permission resource (compile-time checked)
 */
export interface AuthorizationRequirement<TAction extends PermissionAction = PermissionAction, TResource extends PermissionResource = PermissionResource> {
	readonly action: TAction;
	readonly resource: TResource;
	/**
	 * Target resource:
	 * - a route **param name** (`"id"` → `req.params.id`), or
	 * - an extractor such as {@link self} / {@link fromParam}.
	 * When declared but unresolvable the guard denies (fail closed).
	 */
	readonly resourceId?: string | ResourceIdExtractor;
	/** Resource attributes for ABAC policies — static values or an extractor. */
	readonly attributes?: AuthorizationAttributes | ResourceAttributesExtractor;
	/** Human-readable purpose, surfaced in audits and docs. */
	readonly description?: string;
}

const RouteParamsSchema = z.record(z.string(), z.string());

const RequestBodySchema = z.looseObject({});

function getHttpRequest(context: ExecutionContext): FastifyRequest {
	return context.switchToHttp().getRequest<FastifyRequest>();
}

/** Read a string route param (`null` when absent or not a string). */
export function readRouteParam(context: ExecutionContext, paramName: string): string | null {
	const parsed = RouteParamsSchema.safeParse(getHttpRequest(context).params);
	if (!parsed.success) {
		return null;
	}
	if (!Object.hasOwn(parsed.data, paramName)) {
		return null;
	}
	const value = parsed.data[paramName];
	return value.length === 0 ? null : value;
}

/**
 * Enforce a kernel authorization check on a route handler.
 *
 * ```ts
 * @Authorize({ action: "UPDATE", resource: "USER", resourceId: self() })
 * @Authorize({ action: "DELETE", resource: "ORDER", resourceId: "id" })
 * ```
 */
export function Authorize<TAction extends PermissionAction, TResource extends PermissionResource>(requirement: AuthorizationRequirement<TAction, TResource>): MethodDecorator {
	return SetMetadata(AUTHORIZE_KEY, requirement);
}

/** Resource id from a named route param. */
export function fromParam(paramName: string): ResourceIdExtractor {
	return (context: ExecutionContext): string | null => readRouteParam(context, paramName);
}

/**
 * The authenticated caller's own user id — for self-service routes acting on
 * the caller's own account (`USER` / `PROFILE` with OWN scope).
 */
export function self(): ResourceIdExtractor {
	return (context: ExecutionContext): string | null => {
		const user = getHttpRequest(context).user;
		return isAuthenticatedUser(user) ? user.id : null;
	};
}

/** Resource attributes read from the request body — only policy-safe scalar/list values survive. */
export function attributesFromBody(fields: readonly string[]): ResourceAttributesExtractor {
	return (context: ExecutionContext): AuthorizationAttributes => {
		const body = RequestBodySchema.safeParse(getHttpRequest(context).body);
		const picked: AuthorizationAttributes = {};
		if (!body.success) {
			return picked;
		}
		for (const field of fields) {
			if (!(field in body.data)) {
				continue;
			}
			const value = AuthorizationAttributeValueSchema.safeParse(body.data[field]);
			if (value.success) {
				picked[field] = value.data;
			}
		}
		return picked;
	};
}
