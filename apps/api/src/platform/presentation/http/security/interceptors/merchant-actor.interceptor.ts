import { CallHandler, ExecutionContext, Inject, Injectable, UnauthorizedException, type NestInterceptor } from "@nestjs/common";
import type { FastifyRequest } from "fastify";
import { Observable, from, switchMap } from "rxjs";
import { OrganizationSlugParamSchema } from "@workspace/shared";
import { z } from "zod";

import { MERCHANT_ORGANIZATION_RESOLVER, type MerchantOrganizationResolverPort } from "../../../../application/ports/merchant-organization-resolver.port";
import { isAuthenticatedUser } from "../../../../../types/authenticated-user";
import { getApiKeyAuthFromRequest, setMerchantActorOnRequest } from "../api-keys/api-key-request";
import type { MerchantActor } from "../api-keys/merchant-actor";

/** The `:orgSlug` route segment, when the matched route declares one. */
const OrgSlugRouteParamsSchema = z.object({ orgSlug: z.string() });

/**
 * Resolves a unified `MerchantActor` for merchant dashboard and API-key routes: a verified API key is
 * its own organization (the route's slug is not consulted); a member reaches the organization of the
 * `:orgSlug` segment through their membership (organizations answers a non-member with 404).
 *
 * A member's malformed slug is NOT resolved here: interceptors run before the route's pipes, and the
 * route's own `@ZodParams(OrganizationSlugParamSchema)` answers it 400, as it did before this
 * interceptor existed (instead of a 404 from looking up a slug that cannot exist).
 */
@Injectable()
export class MerchantActorInterceptor implements NestInterceptor {
	public constructor(@Inject(MERCHANT_ORGANIZATION_RESOLVER) private readonly organizations: MerchantOrganizationResolverPort) {}

	public intercept<T>(context: ExecutionContext, next: CallHandler<T>): Observable<T> {
		const request: FastifyRequest = context.switchToHttp().getRequest<FastifyRequest>();
		const routeParams = OrgSlugRouteParamsSchema.safeParse(request.params);
		const orgSlug: string | undefined = routeParams.success ? routeParams.data.orgSlug : undefined;
		if (orgSlug !== undefined && getApiKeyAuthFromRequest(request) === undefined && !OrganizationSlugParamSchema.safeParse({ orgSlug }).success) {
			return next.handle();
		}

		return from(this.resolve(request, orgSlug)).pipe(
			switchMap((actor) => {
				setMerchantActorOnRequest(request, actor);
				return next.handle();
			}),
		);
	}

	private async resolve(request: FastifyRequest, orgSlug: string | undefined): Promise<MerchantActor> {
		const apiKeyAuth = getApiKeyAuthFromRequest(request);
		if (apiKeyAuth !== undefined) {
			return { kind: "api_key", organizationId: apiKeyAuth.organizationId, apiKeyId: apiKeyAuth.apiKeyId, keyScope: apiKeyAuth.scope, keyLocationId: apiKeyAuth.locationId };
		}
		const user = request.user;
		if (!isAuthenticatedUser(user)) {
			throw new UnauthorizedException({ message: "Organization authentication required", error: "ORGANIZATION_AUTH_REQUIRED" });
		}
		if (orgSlug === undefined || orgSlug.length === 0) {
			throw new UnauthorizedException({ message: "Organization slug required", error: "ORGANIZATION_SLUG_REQUIRED" });
		}
		return { kind: "user", userId: user.sub, organizationId: await this.organizations.organizationIdForMember(user.sub, orgSlug), orgSlug };
	}
}
