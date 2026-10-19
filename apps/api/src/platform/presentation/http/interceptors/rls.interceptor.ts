import { Injectable, type CallHandler, type ExecutionContext, type NestInterceptor } from "@nestjs/common";
import { Reflector } from "@nestjs/core";
import type { FastifyRequest } from "fastify";
import { Observable } from "rxjs";

import { RequestContextService } from "../../../infrastructure/context/request-context";
import { ActorContextFactory, type ResolvedRequestActor } from "../security/actor-context.factory";
import { RLS_BYPASS_KEY } from "../security/decorators/rls-bypass.decorator";
import { rlsContextForPrincipal } from "../security/request-principal";
import { rlsStorage, type RlsContext } from "../../../../prisma/rls-context";

/**
 * Narrows the RLS AsyncLocalStorage scope for the rest of the interceptor
 * chain + controller. Register this APP_INTERCEPTOR first so it is outermost.
 *
 * Scope per request:
 * - `@RlsBypass()` handler → explicit `route.rls_bypass` system operation
 * - platform SuperAdmin → `platform.superadmin` bypass
 * - single-tenant staff (`hasAdminAccess`) → `platform.staff_single_tenant` bypass
 * - verified merchant API key → `api_key` machine principal of the key's own organization (and store)
 * - authenticated user → scoped to the user and the **server-verified** organization
 * - refresh-token request → scoped to the token subject
 * - anonymous → no user, no bypass (only publicly visible rows)
 *
 * The organization id is never read from raw client input here: it comes from
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
		const routeRlsBypass: boolean = this.reflector.getAllAndOverride<boolean | undefined>(RLS_BYPASS_KEY, [context.getHandler(), context.getClass()]) === true;
		// One decision: the database scope and the handler's actor are both derived from it.
		const resolved: ResolvedRequestActor = this.actors.resolve(request, routeRlsBypass);
		this.requestContext.bindActor(resolved.actor);
		const rls: RlsContext = rlsContextForPrincipal(resolved.decision);
		if (rls.systemOperation !== null) {
			// The request's audit entry names every RLS bypass the request ran under.
			this.requestContext.recordSystemOperation(rls.systemOperation);
		}
		return new Observable<T>((subscriber) => {
			return rlsStorage.run(rls, () => next.handle().subscribe(subscriber));
		});
	}
}
