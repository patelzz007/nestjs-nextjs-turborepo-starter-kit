import { Module } from "@nestjs/common";

import { PrismaService } from "../../../prisma/prisma.service";

import { AuthorizationKernelService } from "./authorization-kernel.service";
import { PolicyEngineService } from "./policy-engine.service";
import { AclService } from "./acl.service";
import { AuthorizationAuditKernelService } from "./authorization-audit-kernel.service";
import { AuthorizationKernelExamplesController } from "./examples.controller";

/**
 * Authorization Kernel Module - provides the core authorization services.
 *
 * Services:
 * - AuthorizationKernelService: Main service with can(), authorize(), filter(), explain()
 * - PolicyEngineService: Evaluates Zod-validated policy DSL
 * - AclService: Manages resource ACLs (ALLOW/DENY)
 * - AuthorizationAuditKernelService: Audit trail for authorization decisions
 *
 * Note: AuthGuard is applied globally via APP_GUARD in AuthModule,
 * so controllers here don't need explicit @UseGuards(AuthGuard).
 */
@Module({
	controllers: [AuthorizationKernelExamplesController],
	providers: [
		PrismaService,
		AuthorizationKernelService,
		PolicyEngineService,
		AclService,
		AuthorizationAuditKernelService,
	],
	exports: [
		AuthorizationKernelService,
		PolicyEngineService,
		AclService,
		AuthorizationAuditKernelService,
	],
})
export class AuthorizationKernelModule {}
