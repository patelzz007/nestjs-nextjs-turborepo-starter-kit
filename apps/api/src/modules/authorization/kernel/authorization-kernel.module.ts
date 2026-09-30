import { Module } from "@nestjs/common";

import { AuthorizationContextResolver } from "../services/authorization-context.resolver";
import { AclService } from "./acl.service";
import { AuthorizationAuditKernelService } from "./authorization-audit-kernel.service";
import { AuthorizationDecisionsController } from "./authorization-decisions.controller";
import { AuthorizationKernelService } from "./authorization-kernel.service";
import { PolicyEngineService } from "./policy-engine.service";
import { ResourceOwnershipResolver } from "./resource-ownership.resolver";
import { SubjectGrantsLoader } from "./subject-grants.loader";
import { TenantMembershipService } from "./tenant-membership.service";

/**
 * Authorization Kernel Module — the single backend decision point.
 *
 * - AuthorizationKernelService: can(), authorize(), explain(), filter(), resourceCapabilities(), hasRoles()
 * - SubjectGrantsLoader: roles (with hierarchy), role permissions, user overrides
 * - TenantMembershipService: organization / location membership verification (ReBAC)
 * - ResourceOwnershipResolver: DB-backed ownership for OWN-scoped grants
 * - AclService: resource-level ALLOW / DENY exceptions
 * - PolicyEngineService: Zod-validated conditional policies (ABAC)
 * - AuthorizationAuditKernelService: decision audit trail
 * - AuthorizationContextResolver: verifies client-requested tenant context per request
 *
 * `PrismaService` / `SystemPrismaService` come from the global PrismaModule.
 */
@Module({
	controllers: [AuthorizationDecisionsController],
	providers: [
		AuthorizationKernelService,
		SubjectGrantsLoader,
		TenantMembershipService,
		ResourceOwnershipResolver,
		PolicyEngineService,
		AclService,
		AuthorizationAuditKernelService,
		AuthorizationContextResolver,
	],
	exports: [AuthorizationKernelService, TenantMembershipService, PolicyEngineService, AclService, AuthorizationAuditKernelService, AuthorizationContextResolver],
})
export class AuthorizationKernelModule {}
