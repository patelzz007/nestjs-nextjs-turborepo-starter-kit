import { Injectable, type CallHandler, type ExecutionContext, type NestInterceptor } from "@nestjs/common";
import { Reflector } from "@nestjs/core";
import type { FastifyRequest } from "fastify";
import { Observable } from "rxjs";

import { RequestContextService } from "../../../infrastructure/context/request-context";
import { ActorContextFactory, type ResolvedRequestActor } from "../security/actor-context.factory";
import { PLATFORM_OPERATION_KEY } from "../security/decorators/platform-operation.decorator";
import { PUBLIC_OPERATION_KEY } from "../security/decorators/public-operation.decorator";
import { principalUserId, rlsContextForPrincipal, scopeTenantId } from "../security/request-principal";
import { rlsStorage, systemRlsContext, type RlsContext } from "../../../../prisma/rls-context";
import type { SystemOperation } from "../../../../prisma/system-operation.registry";

/**
 * Narrows the RLS AsyncLocalStorage scope for the rest of the interceptor
 * chain + controller. Register this APP_INTERCEPTOR first so it is outermost.
 *
 * Scope per request:
 * - every user, including a platform superadmin → the user's own tenant scope (no bypass)
 * - a route naming `@PlatformOperation` or `@PublicOperation` → that one operation (its declared tables only)
 * - verified merchant API key → `api_key` machine principal of the key's own tenant (and store)
 * - authenticated user → scoped to the user and the **server-verified** tenant
 * - refresh-token request → scoped to the token subject
 * - anonymous → no user, no bypass (only publicly visible rows)
 *
 * The tenant id is never read from raw client input here: it comes from
 * the request context's tenant (ADR 017), which `AuthorizationGuard` binds only
 * after verifying the caller's active membership. This interceptor is where the
 * request-scoped context feeds the separate, transaction-scoped RLS store.
 */
@Injectable()
export class RlsInterceptor implements NestInterceptor {
	public constructor(
		private readonly reflector: Reflector,
		private readonly requestContext: RequestContextService,
		private readonly actors: ActorContextFactory,
	) {}

	public intercept<T>(context: ExecutionContext, next: CallHandler<T>): Observable<T> {
		const request: FastifyRequest = context.switchToHttp().getRequest<FastifyRequest>();
		const routeOperation: SystemOperation | undefined = this.routeOperation(context);
		// One decision: the database scope and the handler's actor are both derived from it.
		const resolved: ResolvedRequestActor = this.actors.resolve(request);
		this.requestContext.bindActor(resolved.actor);
		const rls: RlsContext =
			routeOperation === undefined
				? rlsContextForPrincipal(resolved.decision)
				: systemRlsContext(routeOperation, principalUserId(resolved.decision), scopeTenantId(resolved.decision));
		if (rls.systemOperation !== null) {
			// The request's audit entry names every RLS bypass the request ran under.
			this.requestContext.recordSystemOperation(rls.systemOperation);
		}
		return new Observable<T>((subscriber) => {
			return rlsStorage.run(rls, () => next.handle().subscribe(subscriber));
		});
	}

	/** The one operation the route names: `@PlatformOperation` (admin console) or `@PublicOperation` (public flow), never both. */
	private routeOperation(context: ExecutionContext): SystemOperation | undefined {
		const targets = [context.getHandler(), context.getClass()];
		const platform: SystemOperation | undefined = this.reflector.getAllAndOverride<SystemOperation | undefined>(PLATFORM_OPERATION_KEY, targets);
		const publicFlow: SystemOperation | undefined = this.reflector.getAllAndOverride<SystemOperation | undefined>(PUBLIC_OPERATION_KEY, targets);
		if (platform !== undefined && publicFlow !== undefined) {
			throw new ConflictingRouteOperationError(platform, publicFlow);
		}
		return platform ?? publicFlow;
	}
}

/** A route declared both `@PlatformOperation` and `@PublicOperation`: a wiring bug, refused before any query runs. */
export class ConflictingRouteOperationError extends Error {
	public constructor(platform: SystemOperation, publicFlow: SystemOperation) {
		super(`A route declares both @PlatformOperation("${platform}") and @PublicOperation("${publicFlow}"); declare exactly one.`);
		this.name = "ConflictingRouteOperationError";
	}
}
