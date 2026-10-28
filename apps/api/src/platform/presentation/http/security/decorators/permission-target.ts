// The record a `@RequirePermission(…, { resourceId, attributes })` check is about,
// read from the request: a route param, the caller themselves (`self()`), or
// policy attributes from the body.

import type { ExecutionContext } from "@nestjs/common";
import type { FastifyRequest } from "fastify";
import { z } from "zod";
import { AuthorizationAttributeValueSchema, type AuthorizationAttributes } from "@workspace/shared";

import { isAuthenticatedUser } from "../../../../../types/authenticated-user";

/** Extracts the target resource id from the request (`null` = none resolvable → deny). */
export type ResourceIdExtractor = (context: ExecutionContext) => string | null;

/** Extracts server-side resource attributes for policy evaluation. */
export type ResourceAttributesExtractor = (context: ExecutionContext) => AuthorizationAttributes;

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
	const value: string | undefined = parsed.data[paramName];
	return value === undefined || value.length === 0 ? null : value;
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
