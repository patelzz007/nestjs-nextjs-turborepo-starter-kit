import { Injectable } from "@nestjs/common";
import type { FastifyRequest } from "fastify";
import { z } from "zod";

import { readFirstHeader } from "../../../../platform/infrastructure/utils/http-headers";
import type { AuthenticatedUser } from "../../../../types/authenticated-user";
import { AccessDeniedError } from "../../domain/errors/authorization.errors";
import { TenantMembershipService, type VerifiedTenantContext } from "./tenant-membership.service";

const TenantIdSchema = z.string().min(1).max(64);

/** Tenant selectors a route may carry in params, query, or body. Other keys are ignored. */
const TenantSelectorSchema = z.looseObject({
	organizationId: TenantIdSchema.optional(),
	/** `/orgs/:orgSlug/...` routes: the organization's slug (or id), resolved to its id before verification. */
	orgSlug: TenantIdSchema.optional(),
	orgId: TenantIdSchema.optional(),
	storeId: TenantIdSchema.optional(),
	locationId: TenantIdSchema.optional(),
});

type TenantSelector = z.output<typeof TenantSelectorSchema>;

/** Resolves and verifies the tenant a request operates in (`AuthorizationGuard`, ADR 017). */
export interface RequestTenantResolverPort {
	resolve(request: FastifyRequest, user: AuthenticatedUser): Promise<RequestTenantContext>;
}

export interface RequestTenantContext {
	/** Proven against the caller's active membership — safe for RLS and scoped grants. */
	readonly verified: VerifiedTenantContext;
	/** Ids the request targets (route/body/query), verified or not — used as resource attributes. */
	readonly requested: VerifiedTenantContext;
}

/** Params, query, and body are all untyped request input — validated here before use. */
function readSelector(source: FastifyRequest["body"]): TenantSelector {
	const parsed = TenantSelectorSchema.safeParse(source);
	return parsed.success ? parsed.data : {};
}

function firstDefined(values: readonly (string | undefined)[]): string | undefined {
	return values.find((value) => value !== undefined);
}

/**
 * Resolves the tenant a request operates in (spec §55, §92, §93).
 *
 * The client may *request* a tenant through the `x-organization-id` /
 * `x-store-id` / `x-location-id` headers or route/body/query ids; the server decides whether
 * that request is legitimate:
 *
 * - An explicit tenant **header** the caller is not an active member of is a
 *   forged tenant claim → 403.
 * - Route/body/query ids are verified the same way but, when unproven, are only
 *   carried as resource attributes (a GLOBAL-scoped permission may still act on
 *   another organization's resource; an ORGANIZATION-scoped one may not).
 * - Platform SuperAdmins may select any tenant.
 */
@Injectable()
export class AuthorizationContextResolver implements RequestTenantResolverPort {
	public constructor(private readonly tenantMembership: TenantMembershipService) {}

	public async resolve(request: FastifyRequest, user: AuthenticatedUser): Promise<RequestTenantContext> {
		const params = readSelector(request.params);
		const query = readSelector(request.query);
		const body = readSelector(request.body);

		const headerOrganizationId = this.readHeader(request, "x-organization-id");
		const headerStoreId = this.readHeader(request, "x-store-id");
		const headerLocationId = this.readHeader(request, "x-location-id");

		const explicitOrganizationId = firstDefined([headerOrganizationId, params.organizationId, params.orgId, query.organizationId, body.organizationId]);
		// An `/orgs/:orgSlug` route names its organization by route key; it is verified like any route id below,
		// so in multi-tenant mode the request's RLS scope carries the organization the URL names.
		const requestedOrganizationId =
			explicitOrganizationId ?? (params.orgSlug === undefined ? undefined : ((await this.tenantMembership.organizationIdForRouteKey(params.orgSlug)) ?? undefined));
		const requestedStoreId = firstDefined([headerStoreId, params.storeId, query.storeId, body.storeId]);
		const requestedLocationId = firstDefined([headerLocationId, params.locationId, query.locationId, body.locationId]);
		const requested: VerifiedTenantContext = {
			...(requestedOrganizationId === undefined ? {} : { organizationId: requestedOrganizationId }),
			...(requestedStoreId === undefined ? {} : { storeId: requestedStoreId }),
			...(requestedLocationId === undefined ? {} : { locationId: requestedLocationId }),
		};

		if (user.isSuperAdmin) {
			return { verified: requested, requested };
		}

		const verification = await this.tenantMembership.verify(user.id, requested);
		const forgedHeader =
			(headerOrganizationId !== undefined && verification.organizationRejected) ||
			(headerStoreId !== undefined && verification.storeRejected) ||
			(headerLocationId !== undefined && verification.locationRejected);
		if (forgedHeader) {
			throw new AccessDeniedError();
		}

		return { verified: verification.context, requested };
	}

	private readHeader(request: FastifyRequest, name: "x-organization-id" | "x-store-id" | "x-location-id"): string | undefined {
		const value = readFirstHeader(request.headers[name]);
		if (value === undefined) {
			return undefined;
		}
		const parsed = TenantIdSchema.safeParse(value);
		// A malformed tenant header can never match a membership — reject it as forged.
		if (!parsed.success) {
			throw new AccessDeniedError();
		}
		return parsed.data;
	}
}
