import { CanActivate, ExecutionContext, Inject, Injectable, UnauthorizedException } from "@nestjs/common";
import { Reflector } from "@nestjs/core";
import type { Prisma } from "@prisma/client";
import type { FastifyRequest } from "fastify";
import type { AuthorizationAttributes, AuthorizationContext, AuthorizationRequest, PermissionAction, PermissionResource } from "@workspace/shared";
import { isFunctionValue, isStringPrimitive } from "@workspace/shared";

import { NotFoundError } from "../../../../application/errors/app-error";
import { readFirstHeader } from "../../../../infrastructure/utils/http-headers";
import {
	decideTenantLifecycle,
	MembershipInactiveError,
	TENANT_LIFECYCLE_ROUTE_KEY,
	TenantBannedError,
	TenantRouteNotActiveError,
	TenantSuspendedError,
	type TenantLifecycleRouteKind,
} from "../../../../../contexts/tenancy/public-api";
import { RequestContextService } from "../../../../infrastructure/context/request-context";
import { MAX_USER_AGENT_LENGTH } from "../../../../infrastructure/http/user-agent-header";
import type { SystemDatabaseContext } from "../../../../../prisma/tenant-context";
import { TenantTransactionService } from "../../../../../prisma/tenant-transaction.service";
import type { AuthenticatedUser } from "../../../../../types/authenticated-user";
import { isAuthenticatedUser } from "../../../../../types/authenticated-user";
import {
	AUTHORIZATION_KERNEL,
	AuthorizationException,
	REQUEST_TENANT_RESOLVER,
	SUPER_ADMIN_BYPASS_AUDIT,
	type AuthorizationAuditMetadata,
	type AuthorizationKernelPort,
	type RequestTenantContext,
	type RequestTenantResolverPort,
	type SuperAdminBypassAuditPort,
} from "../../../../../contexts/authorization/public-api";
import { readRouteParam, type ResourceAttributesExtractor } from "../decorators/permission-target";
import { REQUIRED_PERMISSION_KEY, type RequiredPermission } from "../decorators/route-requirements.metadata";
import { PRINCIPAL_LOOKUP_OPERATION } from "../../../../application/shared-system-operations";

/** A requirement's `attributes` is either static values or an extractor called per request. */
function isAttributesExtractor(attributes: AuthorizationAttributes | ResourceAttributesExtractor): attributes is ResourceAttributesExtractor {
	return isFunctionValue(attributes);
}

/** Principal reads the guard makes before the handler's RLS scope exists. */
interface GuardPrincipalLookup {
	withSystemOperation<TResult>(context: SystemDatabaseContext, work: (tx: Prisma.TransactionClient) => Promise<TResult>): Promise<TResult>;
}

/**
 * **Kernel-first Authorization Guard** (global `APP_GUARD`).
 *
 * Every protected route goes through the Authorization Kernel — there is no
 * second authorization path. A route declares what it needs with one or more
 * `@RequirePermission(action, resource, { resourceId?, attributes? })`; every one must pass.
 *
 * Flow:
 * 1. Authenticated requests: validate token version, then resolve and verify the
 *    tenant context (`x-tenant-id` and `x-location-id` select nothing). The
 *    verified context is bound into the request context (ADR 017) for RLS.
 * 2. Routes without requirements only compute `hasAdminAccess`.
 * 3. SuperAdmin → explicit, audited platform bypass.
 * 4. Each requirement → `kernel.authorize()` (audited: DENY / writes / sensitive
 *    reads). Any denial → uniform 403 that reveals nothing about the rule.
 */
@Injectable()
export class AuthorizationGuard implements CanActivate {
	public constructor(
		private readonly reflector: Reflector,
		@Inject(AUTHORIZATION_KERNEL) private readonly kernel: AuthorizationKernelPort,
		@Inject(SUPER_ADMIN_BYPASS_AUDIT) private readonly bypassAudit: SuperAdminBypassAuditPort,
		@Inject(REQUEST_TENANT_RESOLVER) private readonly contextResolver: RequestTenantResolverPort,
		private readonly requestContext: RequestContextService,
		@Inject(TenantTransactionService) private readonly principalLookup: GuardPrincipalLookup,
	) {}

	public async canActivate(context: ExecutionContext): Promise<boolean> {
		const request = context.switchToHttp().getRequest<FastifyRequest>();
		const user = request.user;
		const requirements = this.readRequirements(context);
		const protectedRoute = requirements.length > 0;

		if (!isAuthenticatedUser(user)) {
			if (protectedRoute) {
				throw new UnauthorizedException({ message: "Authentication required", error: "UNAUTHENTICATED" });
			}
			return true;
		}

		if (protectedRoute) {
			await this.validateTokenVersion(user.id, user.tokenVersion);
		}

		const tenant = await this.contextResolver.resolve(request, user);
		this.requestContext.bindTenant(tenant.verified);
		this.assertTenantLifecycle(context, tenant);

		if (user.isSuperAdmin && tenant.verified.tenantId === undefined) {
			if (protectedRoute) {
				await this.auditSuperAdminBypass(user.id, context, request);
			}
			this.setAdminAccess(user, true);
			return true;
		}

		for (const requirement of requirements) {
			await this.enforce(context, request, user, tenant, requirement);
		}

		this.setAdminAccess(user, await this.hasAdminDashboardAccess(user, tenant));
		return true;
	}

	/**
	 * C1 for the tenant the request targets, however it was reached (`:tenantSlug` or a
	 * location), with the caller's real access status. A caller without access is left to the
	 * ordinary authorization answer (`no_membership`).
	 */
	private assertTenantLifecycle(context: ExecutionContext, tenant: RequestTenantContext): void {
		const { target } = tenant;
		if (target === null) {
			return;
		}
		const route = this.reflector.getAllAndOverride<TenantLifecycleRouteKind | undefined>(TENANT_LIFECYCLE_ROUTE_KEY, [context.getHandler(), context.getClass()]);
		const decision = decideTenantLifecycle({
			lifecycleState: target.lifecycleState,
			// A target is only ever a live tenant: membership verification skips soft-deleted rows.
			isDeleted: false,
			route: route ?? "ordinary",
			membershipStatus: target.membershipStatus,
		});
		if (decision.kind === "allow" || decision.kind === "no_membership") {
			return;
		}
		if (decision.kind === "not_found") {
			throw new NotFoundError({ message: "Tenant not found" });
		}
		if (decision.kind === "tenant_suspended") {
			throw new TenantSuspendedError();
		}
		if (decision.kind === "tenant_banned") {
			throw new TenantBannedError();
		}
		if (decision.kind === "membership_inactive") {
			throw new MembershipInactiveError();
		}
		throw new TenantRouteNotActiveError();
	}

	/** Every `@RequirePermission` on the route's method (none: an unprotected route). */
	private readRequirements(context: ExecutionContext): readonly RequiredPermission[] {
		return this.reflector.get<readonly RequiredPermission[] | undefined>(REQUIRED_PERMISSION_KEY, context.getHandler()) ?? [];
	}

	private async enforce(
		context: ExecutionContext,
		request: FastifyRequest,
		user: AuthenticatedUser,
		tenant: RequestTenantContext,
		requirement: RequiredPermission,
	): Promise<void> {
		let resourceId: string | undefined;
		if (requirement.resourceId !== undefined) {
			const resolved = isStringPrimitive(requirement.resourceId) ? readRouteParam(context, requirement.resourceId) : requirement.resourceId(context);
			// A declared but unresolvable target is never widened to a global check.
			if (resolved === null) {
				throw new AuthorizationException();
			}
			resourceId = resolved;
		}

		const declared = requirement.attributes === undefined ? {} : isAttributesExtractor(requirement.attributes) ? requirement.attributes(context) : requirement.attributes;
		// Tenant attributes come last so a body-supplied value can never override the routed tenant.
		const attributes: AuthorizationAttributes = { ...declared, ...this.tenantAttributes(tenant) };

		await this.kernel.authorize(
			this.buildRequest(this.buildSubject(user, tenant), requirement.action, requirement.resource, resourceId, attributes),
			this.auditMetadata(request),
		);
	}

	private buildSubject(user: AuthenticatedUser, tenant: RequestTenantContext): AuthorizationContext {
		return {
			userId: user.id,
			isSuperAdmin: false,
			...(tenant.verified.tenantId === undefined ? {} : { tenantId: tenant.verified.tenantId }),
			...(tenant.verified.locationId === undefined ? {} : { locationId: tenant.verified.locationId }),
		};
	}

	/** Requested tenant ids become resource attributes so scoped grants can compare them. */
	private tenantAttributes(tenant: RequestTenantContext): AuthorizationAttributes {
		const attributes: AuthorizationAttributes = {};
		if (tenant.requested.tenantId !== undefined) {
			attributes.tenantId = tenant.requested.tenantId;
		}
		if (tenant.requested.locationId !== undefined) {
			attributes.locationId = tenant.requested.locationId;
		}
		return attributes;
	}

	private buildRequest(
		subject: AuthorizationContext,
		action: PermissionAction,
		resource: PermissionResource,
		resourceId: string | undefined,
		resourceAttributes: AuthorizationAttributes,
	): AuthorizationRequest {
		return {
			subject,
			action,
			resource,
			...(resourceId === undefined ? {} : { resourceId }),
			...(Object.keys(resourceAttributes).length === 0 ? {} : { resourceAttributes }),
		};
	}

	private auditMetadata(request: FastifyRequest): AuthorizationAuditMetadata {
		const userAgent = readFirstHeader(request.headers["user-agent"]);
		// The request's validated correlation id (≤ 64 chars) — never the raw header.
		const requestId: string = this.requestContext.resolveCorrelationId(request.raw);
		return {
			ipAddress: request.ip,
			...(userAgent === undefined ? {} : { userAgent: userAgent.slice(0, MAX_USER_AGENT_LENGTH) }),
			requestId,
		};
	}

	/** Rejects tokens minted before the user's authorization state last changed. */
	private async validateTokenVersion(userId: string, tokenVersion: number): Promise<void> {
		const dbUser = await this.principalLookup.withSystemOperation(
			{ operation: PRINCIPAL_LOOKUP_OPERATION, reason: "Compare an access token's version with the account", actorUserId: userId },
			(tx) => tx.user.findUnique({ where: { id: userId }, select: { tokenVersion: true } }),
		);
		if (dbUser !== null && dbUser.tokenVersion !== tokenVersion) {
			throw new UnauthorizedException({ message: "Token revoked — authorization state changed", error: "TOKEN_VERSION_MISMATCH" });
		}
	}

	private async hasAdminDashboardAccess(user: AuthenticatedUser, tenant: RequestTenantContext): Promise<boolean> {
		const decision = await this.kernel.can(this.buildRequest(this.buildSubject(user, tenant), "READ", "ADMIN_DASHBOARD", undefined, {}));
		return decision === "ALLOW";
	}

	private setAdminAccess(user: AuthenticatedUser, hasAdminAccess: boolean): void {
		Object.assign<AuthenticatedUser, { hasAdminAccess: boolean }>(user, { hasAdminAccess });
	}

	private async auditSuperAdminBypass(userId: string, context: ExecutionContext, request: FastifyRequest): Promise<void> {
		await this.bypassAudit.recordBypass(userId, `Bypassed authorization for ${context.getHandler().name} at ${request.method} ${request.url}`);
	}
}
