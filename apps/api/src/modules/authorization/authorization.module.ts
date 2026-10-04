import { Global, Module } from "@nestjs/common";

import { PrismaModule } from "../../prisma/prisma.module";

import { SessionsPersistenceModule } from "../sessions/sessions-persistence.module";

import { AccessTokenModule } from "../auth/access-token.module";

import { AuthorizationAuditService } from "./audit/authorization-audit.service";
import { AuthorizationCacheService } from "./cache/authorization-cache.service";
import { AuthorizationInvalidationService } from "./cache/authorization-invalidation.service";
import { AuthorizationHealthIndicator } from "./health/authorization.health";
import { AuthorizationGuard } from "./guards/authorization.guard";
import { AuthorizationCheckerService } from "./services/authorization-checker.service";
import { AuthorizationService } from "./services/authorization.service";
import { AuthRateLimitService } from "./services/auth-rate-limit.service";
import { ConflictDetectionService } from "./services/conflict-detection.service";
import { PermissionService } from "./services/permission.service";
import { RoleService } from "./services/role.service";
import { UserSessionRevocationService } from "./services/user-session-revocation.service";
import { PermissionExpiryCleanup } from "./cleanup/permission-expiry.cleanup";
import { PermissionMigrationService } from "./migration/permission-migration.service";
import { PermissionRegistrySyncBootstrap } from "./migration/permission-registry-sync.bootstrap";
import { PolicyRegistry } from "./policies/policy-registry";
import { AuditLogCleanup } from "./cleanup/audit-log.cleanup";
import { AuthorizationEventEmitter } from "./events/authorization.events";
import { CapabilityDefinitionService } from "./services/capability-definition.service";
import { PrivilegeEscalationService } from "./services/privilege-escalation.service";
import { RbacMutationRunner } from "./services/rbac-mutation.runner";
import { PermissionRepository } from "./repositories/permission.repository";
import { RoleAssignmentRepository } from "./repositories/role-assignment.repository";
import { RoleRepository } from "./repositories/role.repository";
import { AuthorizationKernelModule } from "./kernel/authorization-kernel.module";

/**
 * First-class authorization module for NestJS + Fastify + Prisma.
 *
 * Provides:
 * - **AuthorizationService** — Spatie-like fluent facade
 * - **AuthorizationCheckerService** — permission/role evaluation
 * - **RoleService** — CRUD + assignment + hierarchy
 * - **PermissionService** — CRUD + direct user grants
 * - **AuthorizationCacheService** — per-process cache
 * - **AuthorizationInvalidationService** — post-commit invalidation, broadcast over Redis pub/sub
 * - **RbacMutationRunner** — the one transactional path for RBAC writes
 * - **AuthorizationGuard** — global guard
 * - **ConflictDetectionService** — role conflict rules
 * - **PolicyRegistry** — resource-specific policies
 * - **PermissionMigrationService** — code-to-DB sync
 * - **PermissionExpiryCleanup** — background cleanup of expired grants
 * - **AuthRateLimitService** — rate limiting on auth checks
 * - **AuthorizationEventEmitter** — NestJS events for auth changes
 * - **AuthorizationAuditService** — audit logging
 */
@Global()
@Module({
	imports: [PrismaModule, SessionsPersistenceModule, AccessTokenModule, AuthorizationKernelModule],
	providers: [
		{
			provide: "IN_MEMORY_AUTH_CACHE",
			useClass: AuthorizationCacheService,
		},
		// One per-process cache instance; cross-instance invalidation is AuthorizationInvalidationService's job.
		{
			provide: AuthorizationCacheService,
			useExisting: "IN_MEMORY_AUTH_CACHE",
		},
		AuthorizationInvalidationService,
		RbacMutationRunner,
		AuthorizationCheckerService,
		RoleRepository,
		PermissionRepository,
		RoleAssignmentRepository,
		RoleService,
		PermissionService,
		UserSessionRevocationService,
		AuthorizationService,
		AuthorizationGuard,
		AuthorizationAuditService,
		AuthorizationHealthIndicator,
		ConflictDetectionService,
		PolicyRegistry,
		PermissionMigrationService,
		PermissionRegistrySyncBootstrap,
		PermissionExpiryCleanup,
		AuditLogCleanup,
		AuthRateLimitService,
		AuthorizationEventEmitter,
		CapabilityDefinitionService,
		PrivilegeEscalationService,
	],
	exports: [
		AuthorizationCacheService,
		AuthorizationInvalidationService,
		AuthorizationCheckerService,
		RoleService,
		PermissionService,
		UserSessionRevocationService,
		AuthorizationService,
		AuthorizationGuard,
		AuthorizationAuditService,
		AuthorizationHealthIndicator,
		ConflictDetectionService,
		PolicyRegistry,
		PermissionMigrationService,
		PermissionExpiryCleanup,
		AuthRateLimitService,
		AuthorizationEventEmitter,
		CapabilityDefinitionService,
		PrivilegeEscalationService,
		AuthorizationKernelModule,
	],
})
export class AuthorizationModule {}
