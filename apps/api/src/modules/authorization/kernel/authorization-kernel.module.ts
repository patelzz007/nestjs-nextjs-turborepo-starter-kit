import { Module } from "@nestjs/common";

import { PrismaService } from "../../../prisma/prisma.service";

import { AuthorizationKernelService } from "./authorization-kernel.service";
import { PolicyEngineService } from "./policy-engine.service";
import { AclService } from "./acl.service";
import { AuthorizationAuditKernelService } from "./authorization-audit-kernel.service";
import { AuthorizationKernelExamplesController } from "./examples.controller";
import { KernelIntegrationHelper } from "./kernel-integration.helper";

/**
 * Authorization Kernel Module - provides the core authorization services.
 *
 * Services:
 * - AuthorizationKernelService: Main service with can(), authorize(), filter(), explain()
 * - PolicyEngineService: Evaluates Zod-validated policy DSL
 * - AclService: Manages resource ACLs (ALLOW/DENY)
 * - AuthorizationAuditKernelService: Audit trail for authorization decisions
 * - KernelIntegrationHelper: Convenience methods for controllers/services
 */
@Module({
	controllers: [AuthorizationKernelExamplesController],
	providers: [
		PrismaService,
		AuthorizationKernelService,
		PolicyEngineService,
		AclService,
		AuthorizationAuditKernelService,
		KernelIntegrationHelper,
	],
	exports: [
		AuthorizationKernelService,
		PolicyEngineService,
		AclService,
		AuthorizationAuditKernelService,
		KernelIntegrationHelper,
	],
})
export class AuthorizationKernelModule {}
