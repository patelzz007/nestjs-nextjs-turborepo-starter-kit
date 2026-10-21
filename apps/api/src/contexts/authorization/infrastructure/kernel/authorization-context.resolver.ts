import { Inject, Injectable } from "@nestjs/common";
import type { FastifyRequest } from "fastify";
import { z } from "zod";

import { rejectMachineTenantSelector } from "../../../../platform/infrastructure/tenancy/machine-tenant-selector";
import { TENANT_SOURCE, type TenantSource } from "../../../../platform/application/tenancy/tenant-source.port";
import { hasApiKeyAuthOnRequest } from "../../../../platform/presentation/http/security/api-keys/api-key-request";
import type { AuthenticatedUser } from "../../../../types/authenticated-user";
import { TenantMembershipService, type TargetTenant, type VerifiedTenantContext } from "./tenant-membership.service";

const ResourceIdSchema = z.string().min(1).max(64);

/** The location selector. The tenant comes from {@link TenantSource}, never from these fields. */
const ResourceSelectorSchema = z.looseObject({
	tenantSlug: ResourceIdSchema.optional(),
	locationId: ResourceIdSchema.optional(),
});

type ResourceSelector = z.output<typeof ResourceSelectorSchema>;

/** Resolves and verifies the tenant a request operates in (`AuthorizationGuard`, ADR 017). */
export interface RequestTenantResolverPort {
	resolve(request: FastifyRequest, user: AuthenticatedUser): Promise<RequestTenantContext>;
}

export interface RequestTenantContext {
	/** Proven against the caller's active membership — safe for RLS and scoped grants. */
	readonly verified: VerifiedTenantContext;
	/** Ids the request targets, verified or not — used as resource attributes. */
	readonly requested: VerifiedTenantContext;
	/**
	 * The tenant the request targets (by `:tenantSlug` or a location) with its lifecycle and the
	 * caller's access, or null when it targets none. The lifecycle rule applies to it on every path.
	 */
	readonly target: TargetTenant | null;
}

function readSelector(source: FastifyRequest["body"]): ResourceSelector {
	const parsed = ResourceSelectorSchema.safeParse(source);
	return parsed.success ? parsed.data : {};
}

function firstDefined(values: readonly (string | undefined)[]): string | undefined {
	return values.find((value) => value !== undefined);
}

/**
 * The tenant for a user is {@link TenantSource} (`:tenantSlug` in multi mode, the default tenant in single mode).
 * On a route without one, a requested location still belongs to a tenant: membership verification
 * reports that tenant as the request's target, so its lifecycle is enforced exactly as for a named tenant.
 * A machine credential names its own tenant; a slug or tenant id on that request is rejected.
 * `x-tenant-id` and `x-location-id` select nothing: the merchant console and POS clients send them on
 * every call as information only (what they think the request is about), and this resolver never
 * reads them. A SuperAdmin is verified like any other user.
 */
@Injectable()
export class AuthorizationContextResolver implements RequestTenantResolverPort {
	public constructor(
		private readonly tenantMembership: TenantMembershipService,
		@Inject(TENANT_SOURCE) private readonly tenantSource: TenantSource,
	) {}

	public async resolve(request: FastifyRequest, user: AuthenticatedUser): Promise<RequestTenantContext> {
		if (hasApiKeyAuthOnRequest(request)) {
			rejectMachineTenantSelector(request);
			return { verified: {}, requested: {}, target: null };
		}

		const params = readSelector(request.params);
		const query = readSelector(request.query);
		const body = readSelector(request.body);
		const resolution = await this.tenantSource.resolve(params.tenantSlug === undefined ? {} : { tenantSlug: params.tenantSlug });
		const requestedTenantId = resolution.kind === "tenant" ? resolution.tenantId : undefined;

		const requestedLocationId = firstDefined([params.locationId, query.locationId, body.locationId]);
		const requested: VerifiedTenantContext = {
			...(requestedTenantId === undefined ? {} : { tenantId: requestedTenantId }),
			...(requestedLocationId === undefined ? {} : { locationId: requestedLocationId }),
		};

		// Platform staff are verified like every user (D4): a membership, or an approved support grant
		// for this tenant (`TenantMembershipService.verify`). Being a SuperAdmin never binds a tenant.
		const verification = await this.tenantMembership.verify(user.id, requested);
		return { verified: verification.context, requested, target: verification.target };
	}
}
