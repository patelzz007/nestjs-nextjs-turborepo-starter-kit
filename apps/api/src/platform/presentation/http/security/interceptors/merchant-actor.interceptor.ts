import { CallHandler, ExecutionContext, Inject, Injectable, UnauthorizedException, type NestInterceptor } from "@nestjs/common";
import type { FastifyRequest } from "fastify";
import { Observable, from, switchMap } from "rxjs";
import { TenantSlugParamSchema } from "@workspace/shared";
import { z } from "zod";

import { MERCHANT_TENANT_RESOLVER, type MerchantTenantResolverPort } from "../../../../application/ports/merchant-tenant-resolver.port";
import { isAuthenticatedUser } from "../../../../../types/authenticated-user";
import { getApiKeyAuthFromRequest, setMerchantActorOnRequest } from "../api-keys/api-key-request";
import type { MerchantActor } from "../api-keys/merchant-actor";

/** The `:tenantSlug` route segment, when the matched route declares one. */
const TenantSlugRouteParamsSchema = z.object({ tenantSlug: z.string() });

/**
 * Resolves a unified `MerchantActor` for merchant dashboard and API-key routes: a verified API key is
 * its own tenant (the route's slug is not consulted); a member reaches the tenant of the
 * `:tenantSlug` segment through their membership (tenants answers a non-member with 404).
 *
 * A member's malformed slug is NOT resolved here: interceptors run before the route's pipes, and the
 * route's own `@ZodParams(TenantSlugParamSchema)` answers it 400, as it did before this
 * interceptor existed (instead of a 404 from looking up a slug that cannot exist).
 */
@Injectable()
export class MerchantActorInterceptor implements NestInterceptor {
	public constructor(@Inject(MERCHANT_TENANT_RESOLVER) private readonly tenants: MerchantTenantResolverPort) {}

	public intercept<T>(context: ExecutionContext, next: CallHandler<T>): Observable<T> {
		const request: FastifyRequest = context.switchToHttp().getRequest<FastifyRequest>();
		const routeParams = TenantSlugRouteParamsSchema.safeParse(request.params);
		const tenantSlug: string | undefined = routeParams.success ? routeParams.data.tenantSlug : undefined;
		if (tenantSlug !== undefined && getApiKeyAuthFromRequest(request) === undefined && !TenantSlugParamSchema.safeParse({ tenantSlug }).success) {
			return next.handle();
		}

		return from(this.resolve(request, tenantSlug)).pipe(
			switchMap((actor) => {
				setMerchantActorOnRequest(request, actor);
				return next.handle();
			}),
		);
	}

	private async resolve(request: FastifyRequest, tenantSlug: string | undefined): Promise<MerchantActor> {
		const apiKeyAuth = getApiKeyAuthFromRequest(request);
		if (apiKeyAuth !== undefined) {
			return { kind: "api_key", tenantId: apiKeyAuth.tenantId, apiKeyId: apiKeyAuth.apiKeyId, keyScope: apiKeyAuth.scope, keyLocationId: apiKeyAuth.locationId };
		}
		const user = request.user;
		if (!isAuthenticatedUser(user)) {
			throw new UnauthorizedException({ message: "Tenant authentication required", error: "TENANT_AUTH_REQUIRED" });
		}
		if (tenantSlug === undefined || tenantSlug.length === 0) {
			throw new UnauthorizedException({ message: "Tenant slug required", error: "TENANT_SLUG_REQUIRED" });
		}
		return { kind: "user", userId: user.sub, tenantId: await this.tenants.tenantIdForMember(user.sub, tenantSlug), tenantSlug };
	}
}
