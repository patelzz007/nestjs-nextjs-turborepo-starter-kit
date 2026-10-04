import { CanActivate, ExecutionContext, Injectable, UnauthorizedException } from "@nestjs/common";
import { Reflector } from "@nestjs/core";
import type { FastifyRequest } from "fastify";
import type { AuthorizationAttributes, AuthorizationContext, AuthorizationRequest, AuthorizationResult, PermissionAction, PermissionResource } from "@workspace/shared";

import { readFirstHeader } from "../../../common/utils/http-headers";
import { RequestContextService } from "../../../common/context/request-context";
import { MAX_USER_AGENT_LENGTH } from "../../../common/middleware/request-context.middleware";
import { PrismaService } from "../../../prisma/prisma.service";
import type { AuthenticatedUser } from "../../../types/authenticated-user";
import { isAuthenticatedUser } from "../../../types/authenticated-user";
import { AuthorizationAuditService } from "../audit/authorization-audit.service";
import {
	REQUIRED_PERMISSION_KEY,
	REQUIRED_PERMISSIONS_KEY,
	REQUIRED_ROLES_KEY,
	type RequiredPermission,
	type RequiredPermissionsMetadata,
	type RequiredRolesMetadata,
} from "../constants/authorization.constants";
import { AUTHORIZE_KEY, readRouteParam, type AuthorizationRequirement } from "../decorators/authorize.decorator";
import { AuthorizationException } from "../exceptions/authorization.exception";
import { AuthorizationAuditKernelService, type AuthorizationAuditMetadata } from "../kernel/authorization-audit-kernel.service";
import { AuthorizationKernelService } from "../kernel/authorization-kernel.service";
import { AuthorizationContextResolver, type RequestTenantContext } from "../services/authorization-context.resolver";

interface RouteRequirements {
	readonly permission?: RequiredPermission | undefined;
	readonly permissions?: RequiredPermissionsMetadata | undefined;
	readonly roles?: RequiredRolesMetadata | undefined;
	readonly authorize?: AuthorizationRequirement | undefined;
}

function hasRequirements(requirements: RouteRequirements): boolean {
	return requirements.permission !== undefined || requirements.permissions !== undefined || requirements.roles !== undefined || requirements.authorize !== undefined;
}

/**
 * **Kernel-first Authorization Guard** (global `APP_GUARD`).
 *
 * Every protected route goes through the Authorization Kernel — there is no
 * second authorization path. Supported declarations (all enforced, AND-ed):
 *
 * - `@RequirePermission(action, resource)`
 * - `@RequireAllPermissions(...)` / `@RequireAnyPermission(...)`
 * - `@RequireAllRoles(...)` / `@RequireAnyRole(...)`
 * - `@Authorize({ action, resource, resourceId, attributes })`
 *
 * Flow:
 * 1. Authenticated requests: validate token version, then resolve and verify the
 *    tenant context (a forged `x-organization-id` / `x-location-id` → 403). The
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
		private readonly kernel: AuthorizationKernelService,
		private readonly decisionAudit: AuthorizationAuditKernelService,
		private readonly audit: AuthorizationAuditService,
		private readonly contextResolver: AuthorizationContextResolver,
		private readonly prisma: PrismaService,
		private readonly requestContext: RequestContextService,
	) {}

	public async canActivate(context: ExecutionContext): Promise<boolean> {
		const request = context.switchToHttp().getRequest<FastifyRequest>();
		const user = request.user;
		const requirements = this.readRequirements(context);
		const protectedRoute = hasRequirements(requirements);

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

		if (user.isSuperAdmin) {
			if (protectedRoute) {
				await this.auditSuperAdminBypass(user.id, context, request);
			}
			this.setAdminAccess(user, true);
			return true;
		}

		if (protectedRoute) {
			await this.enforce(context, request, user, tenant, requirements);
		}

		this.setAdminAccess(user, await this.hasAdminDashboardAccess(user, tenant));
		return true;
	}

	private readRequirements(context: ExecutionContext): RouteRequirements {
		const targets = [context.getHandler(), context.getClass()];
		return {
			permission: this.reflector.getAllAndOverride<RequiredPermission | undefined>(REQUIRED_PERMISSION_KEY, targets),
			permissions: this.reflector.getAllAndOverride<RequiredPermissionsMetadata | undefined>(REQUIRED_PERMISSIONS_KEY, targets),
			roles: this.reflector.getAllAndOverride<RequiredRolesMetadata | undefined>(REQUIRED_ROLES_KEY, targets),
			authorize: this.reflector.getAllAndOverride<AuthorizationRequirement | undefined>(AUTHORIZE_KEY, targets),
		};
	}

	private async enforce(
		context: ExecutionContext,
		request: FastifyRequest,
		user: AuthenticatedUser,
		tenant: RequestTenantContext,
		requirements: RouteRequirements,
	): Promise<void> {
		const subject = this.buildSubject(user, tenant);
		const tenantAttributes = this.tenantAttributes(tenant);
		const metadata = this.auditMetadata(request);

		if (requirements.permission !== undefined) {
			await this.kernel.authorize(this.buildRequest(subject, requirements.permission.action, requirements.permission.resource, undefined, tenantAttributes), metadata);
		}

		if (requirements.permissions !== undefined) {
			await this.enforcePermissions(subject, requirements.permissions, tenantAttributes, metadata);
		}

		if (requirements.roles !== undefined) {
			const granted = await this.kernel.hasRoles(user.id, requirements.roles.roles, requirements.roles.mode);
			if (!granted) {
				throw new AuthorizationException();
			}
		}

		if (requirements.authorize !== undefined) {
			await this.enforceAuthorize(context, subject, requirements.authorize, tenantAttributes, metadata);
		}
	}

	private async enforcePermissions(
		subject: AuthorizationContext,
		meta: RequiredPermissionsMetadata,
		attributes: AuthorizationAttributes,
		metadata: AuthorizationAuditMetadata,
	): Promise<void> {
		if (meta.permissions.length === 0) {
			throw new AuthorizationException();
		}

		if (meta.mode === "all") {
			for (const [action, resource] of meta.permissions) {
				await this.kernel.authorize(this.buildRequest(subject, action, resource, undefined, attributes), metadata);
			}
			return;
		}

		const results: AuthorizationResult[] = await Promise.all(
			meta.permissions.map(([action, resource]) => this.kernel.explain(this.buildRequest(subject, action, resource, undefined, attributes))),
		);
		const allowed = results.find((result) => result.decision === "ALLOW");
		if (allowed !== undefined) {
			await this.decisionAudit.auditResult(allowed, metadata);
			return;
		}
		for (const denied of results) {
			await this.decisionAudit.auditResult(denied, metadata);
		}
		throw new AuthorizationException();
	}

	private async enforceAuthorize(
		context: ExecutionContext,
		subject: AuthorizationContext,
		requirement: AuthorizationRequirement,
		tenantAttributes: AuthorizationAttributes,
		metadata: AuthorizationAuditMetadata,
	): Promise<void> {
		let resourceId: string | undefined;
		if (requirement.resourceId !== undefined) {
			const resolved = typeof requirement.resourceId === "string" ? readRouteParam(context, requirement.resourceId) : requirement.resourceId(context);
			// A declared but unresolvable target is never widened to a global check.
			if (resolved === null) {
				throw new AuthorizationException();
			}
			resourceId = resolved;
		}

		const declared = requirement.attributes === undefined ? {} : typeof requirement.attributes === "function" ? requirement.attributes(context) : requirement.attributes;
		// Tenant attributes come last so a body-supplied value can never override the routed tenant.
		const attributes: AuthorizationAttributes = { ...declared, ...tenantAttributes };

		await this.kernel.authorize(this.buildRequest(subject, requirement.action, requirement.resource, resourceId, attributes), metadata);
	}

	private buildSubject(user: AuthenticatedUser, tenant: RequestTenantContext): AuthorizationContext {
		return {
			userId: user.id,
			isSuperAdmin: false,
			...(tenant.verified.organizationId === undefined ? {} : { organizationId: tenant.verified.organizationId }),
			...(tenant.verified.storeId === undefined ? {} : { storeId: tenant.verified.storeId }),
			...(tenant.verified.locationId === undefined ? {} : { locationId: tenant.verified.locationId }),
		};
	}

	/** Requested tenant ids become resource attributes so scoped grants can compare them. */
	private tenantAttributes(tenant: RequestTenantContext): AuthorizationAttributes {
		const attributes: AuthorizationAttributes = {};
		if (tenant.requested.organizationId !== undefined) {
			attributes.organizationId = tenant.requested.organizationId;
		}
		if (tenant.requested.storeId !== undefined) {
			attributes.storeId = tenant.requested.storeId;
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
		const dbUser = await this.prisma.user.findUnique({ where: { id: userId }, select: { tokenVersion: true } });
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
		// Guards run inside the `request.pre_handler` bypass scope, so the pool connection may append to the bypass-only audit table.
		await this.audit.record(
			{
				action: "SUPER_ADMIN_BYPASS",
				actor: { kind: "USER", userId },
				detail: `Bypassed authorization for ${context.getHandler().name} at ${request.method} ${request.url}`,
			},
			this.prisma,
		);
	}
}
