import { Injectable, type CallHandler, type ExecutionContext, type NestInterceptor } from "@nestjs/common";
import { Reflector } from "@nestjs/core";
import type { FastifyRequest } from "fastify";
import { Observable } from "rxjs";

import { TenancyConfigService } from "../../config/tenancy.config";
import { RequestContextService } from "../context/request-context";
import { DefaultOrganizationService } from "../tenancy/default-organization.service";
import { isAuthenticatedUser } from "../../types/authenticated-user";
import { RLS_BYPASS_KEY } from "../../modules/auth/decorators/rls-bypass.decorator";
import { anonymousRlsContext, apiKeyRlsContext, rlsStorage, systemRlsContext, userRlsContext, type RlsContext } from "../../prisma/rls-context";

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
		private readonly tenancy: TenancyConfigService,
		private readonly requestContext: RequestContextService,
		private readonly defaultOrganization: DefaultOrganizationService,
	) {}

	public intercept<T>(context: ExecutionContext, next: CallHandler<T>): Observable<T> {
		const rls: RlsContext = this.contextFromRequest(context);
		if (rls.systemOperation !== null) {
			// The request's audit entry names every RLS bypass the request ran under.
			this.requestContext.recordSystemOperation(rls.systemOperation);
		}
		return new Observable<T>((subscriber) => {
			return rlsStorage.run(rls, () => next.handle().subscribe(subscriber));
		});
	}

	private contextFromRequest(context: ExecutionContext): RlsContext {
		const request: FastifyRequest = context.switchToHttp().getRequest<FastifyRequest>();
		const organizationId: string | null = this.resolveOrganizationId();
		const user = request.user;

		if (this.reflector.getAllAndOverride<boolean | undefined>(RLS_BYPASS_KEY, [context.getHandler(), context.getClass()]) === true) {
			return systemRlsContext("route.rls_bypass", user?.sub ?? null, organizationId);
		}

		// A verified API key (bound by ApiKeyAuthGuard / MerchantApiKeyGuard) is a machine principal of its OWN
		// organization — the key lookup is the server-side verification, never a client-supplied id.
		const apiKey = this.requestContext.current()?.apiKey;
		if (apiKey !== undefined) {
			return apiKeyRlsContext(apiKey.apiKeyId, apiKey.organizationId, apiKey.locationId);
		}

		if (user === undefined) {
			return anonymousRlsContext(organizationId);
		}

		if (isAuthenticatedUser(user)) {
			if (user.isSuperAdmin) {
				return systemRlsContext("platform.superadmin", user.sub, organizationId);
			}
			if (this.tenancy.staffBypassesRls && user.hasAdminAccess) {
				return systemRlsContext("platform.staff_single_tenant", user.sub, organizationId);
			}
			return userRlsContext(user.sub, organizationId, true);
		}

		// Refresh-token routes (refresh / logout) stay scoped to the token subject.
		return userRlsContext(user.sub, organizationId, false);
	}

	/**
	 * Single-tenant mode: the configured organization, verified to exist at boot
	 * (`DefaultOrganizationService`). Multi-tenant mode:
	 * ONLY the guard-verified tenant — with none bound the scope has no
	 * organization (`null`) and tenant-scoped pool access fails closed; it
	 * never falls back to a default organization.
	 */
	private resolveOrganizationId(): string | null {
		if (!this.tenancy.enabled) {
			return this.defaultOrganization.singleTenantOrganizationId();
		}
		return this.requestContext.current()?.tenant.organizationId ?? null;
	}
}
