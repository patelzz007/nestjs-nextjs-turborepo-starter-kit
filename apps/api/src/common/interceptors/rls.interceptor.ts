import { Injectable, type CallHandler, type ExecutionContext, type NestInterceptor } from "@nestjs/common";
import { Reflector } from "@nestjs/core";
import type { FastifyRequest } from "fastify";
import { Observable } from "rxjs";

import { TenancyConfigService } from "../../config/tenancy.config";
import { isAuthenticatedUser } from "../../types/authenticated-user";
import { RLS_BYPASS_KEY } from "../../modules/auth/decorators/rls-bypass.decorator";
import { rlsStorage, systemRlsContext, type RlsContext } from "../../prisma/rls-context";

/**
 * Narrows the RLS AsyncLocalStorage scope for the rest of the interceptor
 * chain + controller. Register this APP_INTERCEPTOR first so it is outermost.
 *
 * Scope per request:
 * - `@RlsBypass()` handler → explicit `route.rls_bypass` system operation
 * - platform SuperAdmin → `platform.superadmin` bypass
 * - single-tenant staff (`hasAdminAccess`) → `platform.staff_single_tenant` bypass
 * - authenticated user → scoped to the user and the **server-verified** organization
 * - refresh-token request → scoped to the token subject
 * - anonymous → no user, no bypass (only publicly visible rows)
 *
 * The organization id is never read from raw client input here: it comes from
 * `request.authorizationContext`, which `AuthorizationGuard` fills only after
 * verifying the caller's active membership.
 */
@Injectable()
export class RlsInterceptor implements NestInterceptor {
	public constructor(
		private readonly reflector: Reflector,
		private readonly tenancy: TenancyConfigService,
	) {}

	public intercept<T>(context: ExecutionContext, next: CallHandler<T>): Observable<T> {
		const rls: RlsContext = this.contextFromRequest(context);
		return new Observable<T>((subscriber) => {
			return rlsStorage.run(rls, () => next.handle().subscribe(subscriber));
		});
	}

	private contextFromRequest(context: ExecutionContext): RlsContext {
		const request: FastifyRequest = context.switchToHttp().getRequest<FastifyRequest>();
		const organizationId: string = this.resolveOrganizationId(request);
		const user = request.user;

		if (this.reflector.getAllAndOverride<boolean | undefined>(RLS_BYPASS_KEY, [context.getHandler(), context.getClass()]) === true) {
			return { ...systemRlsContext("route.rls_bypass", user?.sub ?? ""), organizationId };
		}

		if (isAuthenticatedUser(user)) {
			if (user.isSuperAdmin) {
				return { ...systemRlsContext("platform.superadmin", user.sub), organizationId };
			}
			if (this.tenancy.staffBypassesRls && user.hasAdminAccess) {
				return { ...systemRlsContext("platform.staff_single_tenant", user.sub), organizationId };
			}
			return { userId: user.sub, bypass: false, organizationId, requireExplicitContext: true, systemOperation: "" };
		}

		// Refresh-token routes (refresh / logout) stay scoped to the token subject.
		return { userId: user?.sub ?? "", bypass: false, organizationId, requireExplicitContext: false, systemOperation: "" };
	}

	private resolveOrganizationId(request: FastifyRequest): string {
		if (!this.tenancy.enabled) {
			return this.tenancy.defaultOrganizationId;
		}
		return request.authorizationContext?.organizationId ?? this.tenancy.defaultOrganizationId;
	}
}
