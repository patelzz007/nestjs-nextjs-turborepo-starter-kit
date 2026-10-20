import { Injectable } from "@nestjs/common";
import type { FastifyRequest } from "fastify";

import { AuthenticationError } from "../../../application/errors/app-error";
import type { ActorContext } from "../../../application/actor-context";
import { RequestContextService, type RequestActorResolution, type RequestContext } from "../../../infrastructure/context/request-context";
import { actorForPrincipal, buildRequestMetadata, resolveRequestPrincipal, type RequestPrincipalDecision } from "./request-principal";

export interface ActorContextFromHttpOptions {
	/** When true, callers without credentials become `kind: "anonymous"` instead of an error. */
	readonly allowAnonymous?: boolean;
}

/** One request's principal decision and the actor built from it. */
export interface ResolvedRequestActor {
	readonly decision: RequestPrincipalDecision;
	readonly actor: RequestActorResolution;
}

/**
 * The actor of a resolution. Throws {@link AuthenticationError} when there is
 * none, when the caller has no credentials and anonymous callers are not
 * allowed, or when the credentials cannot form an actor.
 */
export function actorFromResolution(resolution: RequestActorResolution | undefined, options: ActorContextFromHttpOptions = {}): ActorContext {
	if (resolution === undefined) {
		throw new AuthenticationError({ message: "Request context is not available." });
	}
	switch (resolution.status) {
		case "resolved":
			return resolution.actor;
		case "anonymous":
			if (options.allowAnonymous === true) {
				return resolution.actor;
			}
			throw new AuthenticationError({ message: "Authentication is required to resolve the current actor." });
		case "unresolvable":
			throw new AuthenticationError({ message: resolution.reason });
	}
}

/**
 * Resolves a request's actor through the ONE principal resolver (`request-principal.ts`).
 *
 * `RlsInterceptor` calls {@link resolve} once per request and binds the result
 * to the request context; `@CurrentActor()` and every later caller read that
 * bound actor, so the actor always matches the database scope. A method guard
 * runs before interceptors: {@link fromHttpRequest} then resolves the same way
 * from the verified facts (route metadata is not on the
 * request) — a guard asks who is calling, never which database scope applies.
 */
@Injectable()
export class ActorContextFactory {
	public constructor(private readonly requestContext: RequestContextService) {}

	/** The decision and actor for `request`. */
	public resolve(request: FastifyRequest): ResolvedRequestActor {
		const context: RequestContext | undefined = this.requestContext.current();
		if (context === undefined) {
			throw new AuthenticationError({ message: "Request context is not available." });
		}
		const decision: RequestPrincipalDecision = resolveRequestPrincipal({ user: request.user, apiKey: context.apiKey, requestTenantId: context.tenant.tenantId });
		return { decision, actor: actorForPrincipal(decision, buildRequestMetadata(request, context)) };
	}

	public fromHttpRequest(request: FastifyRequest, options: ActorContextFromHttpOptions = {}): ActorContext {
		const bound: RequestActorResolution | undefined = this.requestContext.current()?.actor;
		if (bound !== undefined) {
			return actorFromResolution(bound, options);
		}
		return actorFromResolution(this.resolve(request).actor, options);
	}
}
