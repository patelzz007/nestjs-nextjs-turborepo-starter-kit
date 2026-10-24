import { Global, Module } from "@nestjs/common";
import type { Prisma } from "@prisma/client";

import type { UnitOfWork } from "../../platform/application/unit-of-work.port";
import { USER_GRANTS_READ } from "../../platform/application/ports/authorization.port";
import { IDENTITY_SESSIONS, type IdentitySessionsPortFactory } from "../../platform/application/ports/identity-sessions.port";
import { UserGrantsReadAdapter } from "./infrastructure/adapters/user-grants-read.adapter";
import { RequestContextService } from "../../platform/infrastructure/context/request-context";
import { SystemCommandModule } from "../../platform/infrastructure/system-command.module";
import type { AfterCommitPublisher } from "../../platform/infrastructure/unit-of-work/after-commit-publisher";
import { PrismaReadExecutor } from "../../platform/infrastructure/unit-of-work/prisma-read-executor";
import { PrismaUnitOfWork } from "../../platform/infrastructure/unit-of-work/prisma-unit-of-work";
import { TransactionalEventDispatcher } from "../../platform/infrastructure/unit-of-work/transactional-event-dispatcher";
import { AFTER_COMMIT_PUBLISHER, UnitOfWorkModule } from "../../platform/infrastructure/unit-of-work/unit-of-work.module";
import { PrismaModule } from "../../prisma/prisma.module";
import { TenantTransactionService } from "../../prisma/tenant-transaction.service";
import type { AuthorizationScope } from "./application/authorization-scope";
import { ApproveSupportAccessHandler } from "./application/commands/approve-support-access/approve-support-access.handler";
import { AssignDefaultRoleHandler } from "./application/commands/assign-default-role/assign-default-role.handler";
import { AssignRoleHandler } from "./application/commands/assign-role/assign-role.handler";
import { CreatePermissionHandler } from "./application/commands/create-permission/create-permission.handler";
import { CreatePolicyDraftHandler } from "./application/commands/create-policy-draft/create-policy-draft.handler";
import { CreateRoleHandler } from "./application/commands/create-role/create-role.handler";
import { ExpireTimeBoundPermissionOverridesHandler } from "./application/commands/expire-time-bound-permission-overrides/expire-time-bound-permission-overrides.handler";
import { GrantUserPermissionHandler } from "./application/commands/grant-user-permission/grant-user-permission.handler";
import { PublishPolicyHandler } from "./application/commands/publish-policy/publish-policy.handler";
import { PurgeOldPermissionAuditLogsHandler } from "./application/commands/purge-old-permission-audit-logs/purge-old-permission-audit-logs.handler";
import { RemovePermissionHandler } from "./application/commands/remove-permission/remove-permission.handler";
import { RemoveRoleHandler } from "./application/commands/remove-role/remove-role.handler";
import { ReparentRoleHandler } from "./application/commands/reparent-role/reparent-role.handler";
import { RequestSupportAccessHandler } from "./application/commands/request-support-access/request-support-access.handler";
import { RestorePermissionHandler } from "./application/commands/restore-permission/restore-permission.handler";
import { RestoreRoleHandler } from "./application/commands/restore-role/restore-role.handler";
import { RevisePermissionHandler } from "./application/commands/revise-permission/revise-permission.handler";
import { ReviseRoleHandler } from "./application/commands/revise-role/revise-role.handler";
import { RevokeSupportAccessHandler } from "./application/commands/revoke-support-access/revoke-support-access.handler";
import { RevokeUserPermissionHandler } from "./application/commands/revoke-user-permission/revoke-user-permission.handler";
import { SimulatePolicyDraftHandler } from "./application/commands/simulate-policy-draft/simulate-policy-draft.handler";
import { SyncCapabilityCatalogHandler } from "./application/commands/sync-capability-catalog/sync-capability-catalog.handler";
import { SyncPermissionRegistryHandler } from "./application/commands/sync-permission-registry/sync-permission-registry.handler";
import { SyncReferenceDataHandler } from "./application/commands/sync-reference-data/sync-reference-data.handler";
import { SyncRolePermissionsHandler } from "./application/commands/sync-role-permissions/sync-role-permissions.handler";
import { SyncUserPermissionsHandler } from "./application/commands/sync-user-permissions/sync-user-permissions.handler";
import { SyncUserRolesHandler } from "./application/commands/sync-user-roles/sync-user-roles.handler";
import { UnassignRoleHandler } from "./application/commands/unassign-role/unassign-role.handler";
import { InvalidateAuthorizationOnUserAuthorizationChanged } from "./application/event-handlers/after-commit/invalidate-authorization-on-user-authorization-changed.event-handler";
import { InvalidatePolicyBundlesOnPolicyPublished } from "./application/event-handlers/after-commit/invalidate-policy-bundles-on-policy-published.event-handler";
import {
	ACCOUNT_DEFAULT_ROLE,
	AUTHORIZATION_CACHE_INVALIDATION,
	AUTHORIZATION_DECISION_AUDIT,
	AUTHORIZATION_HEALTH_INDICATOR,
	AUTHORIZATION_KERNEL,
	AUTHORIZATION_PORT,
	AUTHORIZATION_UNIT_OF_WORK,
	CAPABILITY_CATALOG_READ,
	CEDAR_POLICY_EVALUATOR,
	PERMISSION_AUDIT_LOG_READ,
	PERMISSION_REACH,
	POLICY_SIMULATOR,
	POLICY_TEMPLATE_COMPILER,
	RBAC_CATALOG_READ,
	RBAC_INSPECTION_READ,
	PERMISSION_HOLDERS_READ,
	REFERENCE_DATA_SYNC,
	REQUEST_TENANT,
	REQUEST_TENANT_RESOLVER,
	SUBJECT_AUTHORIZATION_READ,
	SUPER_ADMIN_BYPASS_AUDIT,
	SUPPORT_ACCESS_READ,
} from "./application/ports/authorization.tokens";
import type { ReferenceDataSyncPort } from "./application/ports/catalog-sync.port";
import { POLICY_ENGINE } from "./application/ports/policy-engine.port";
import { CheckPermissionHandler } from "./application/queries/check-permission/check-permission.handler";
import { DecideAuthorizationHandler } from "./application/queries/decide-authorization/decide-authorization.handler";
import { ExplainAuthorizationHandler } from "./application/queries/explain-authorization/explain-authorization.handler";
import { GetCapabilityCatalogHandler } from "./application/queries/get-capability-catalog/get-capability-catalog.handler";
import { GetPermissionHandler } from "./application/queries/get-permission/get-permission.handler";
import { GetRoleHandler } from "./application/queries/get-role/get-role.handler";
import { ListPermissionAuditLogHandler } from "./application/queries/list-permission-audit-log/list-permission-audit-log.handler";
import { ListPermissionGroupsHandler } from "./application/queries/list-permission-groups/list-permission-groups.handler";
import { ListPermissionsHandler } from "./application/queries/list-permissions/list-permissions.handler";
import { ListRolesHandler } from "./application/queries/list-roles/list-roles.handler";
import { PreviewRoleAssignmentHandler } from "./application/queries/preview-role-assignment/preview-role-assignment.handler";
import { ValidateRoleAssignmentHandler } from "./application/queries/validate-role-assignment/validate-role-assignment.handler";
import { RbacMutationGuard } from "./application/services/rbac-mutation-guard";
import { RbacMutationScope } from "./application/services/rbac-mutation-scope";
import { SupportAccessGrantLocator } from "./application/services/support-access-grant-locator";
import { ListSupportAccessGrantsHandler } from "./application/queries/list-support-access-grants/list-support-access-grants.handler";
import { ListTenantSupportAccessGrantsHandler } from "./application/queries/list-tenant-support-access-grants/list-tenant-support-access-grants.handler";
import { PrismaSupportAccessReadRepository } from "./infrastructure/read/prisma-support-access.read-repository";
import { AccountDefaultRoleAdapter } from "./infrastructure/adapters/account-default-role.adapter";
import { AuthorizationPortAdapter } from "./infrastructure/adapters/authorization-port.adapter";
import { PermissionReachAdapter } from "./infrastructure/adapters/permission-reach.adapter";
import { SuperAdminBypassAuditAdapter } from "./infrastructure/adapters/super-admin-bypass-audit.adapter";
import { AuthorizationCacheService } from "./infrastructure/cache/authorization-cache.service";
import { AuthorizationInvalidationService } from "./infrastructure/cache/authorization-invalidation.service";
import { CedarPolicyEvaluatorService } from "./infrastructure/cedar/cedar-policy-evaluator.service";
import { CedarWasmPolicyEngine } from "./infrastructure/cedar/cedar-wasm-policy-engine";
import { PolicyBundleCacheRegistration } from "./infrastructure/cedar/policy-bundle-cache.registration";
import { PolicySimulator } from "./infrastructure/cedar/policy-simulator";
import { PolicyTemplateCompilerAdapter } from "./infrastructure/cedar/policy-template.compiler";
import { AuthorizationHealthIndicator } from "./infrastructure/health/authorization.health";
import { AclService } from "./infrastructure/kernel/acl.service";
import { AuthorizationAuditKernelService } from "./infrastructure/kernel/authorization-audit-kernel.service";
import { AuthorizationContextResolver } from "./infrastructure/kernel/authorization-context.resolver";
import { AuthorizationKernelService } from "./infrastructure/kernel/authorization-kernel.service";
import { PolicyEngineService } from "./infrastructure/kernel/policy-engine.service";
import { ResourceOwnershipResolver } from "./infrastructure/kernel/resource-ownership.resolver";
import { SubjectGrantsLoader } from "./infrastructure/kernel/subject-grants.loader";
import { TenantMembershipService } from "./infrastructure/kernel/tenant-membership.service";
import { AuthorizationScopeFactory } from "./infrastructure/persistence/authorization-scope.factory";
import { CapabilityCatalogReader } from "./infrastructure/read/capability-catalog.reader";
import { AuthorizationCheckerService } from "./infrastructure/read/authorization-checker.service";
import { PermissionAuditLogReader } from "./infrastructure/read/permission-audit-log.reader";
import { PrismaRbacCatalogReader } from "./infrastructure/read/prisma-rbac-catalog.reader";
import { PrismaPermissionHoldersReader } from "./infrastructure/read/prisma-permission-holders.reader";
import { PrismaRbacInspectionReadAdapter } from "./infrastructure/read/prisma-rbac-inspection.reader";
import { RequestTenantAdapter } from "./infrastructure/read/request-tenant.adapter";
import { createReferenceDataSyncService, systemOperationRunner } from "./infrastructure/reference-data/reference-data.composition";
import { AuditLogRetentionCron } from "./presentation/jobs/audit-log-retention.cron";
import { PermissionExpiryCron } from "./presentation/jobs/permission-expiry.cron";
import { SupportAccessExpiryCron } from "./presentation/jobs/support-access-expiry.cron";
import { ExpireSupportAccessGrantsHandler } from "./application/commands/expire-support-access-grants/expire-support-access-grants.handler";

/**
 * The authorization context's composition root: what you may do (roles, permissions, overrides, the
 * decision kernel, the Cedar policy plane, capabilities, support access).
 *
 * Global, so every context and the platform security kit reach the public ports by token without an
 * import cycle. Identity is global too: authorization takes `IDENTITY_SESSIONS` (revocation inside
 * the RBAC transaction) and `ACCESS_TOKEN_STATE` (the local token-state cache) from it by token. The HTTP
 * controllers live in `presentation/http/authorization-http.module.ts`, imported by `AppModule` only.
 */
@Global()
@Module({
	imports: [PrismaModule, UnitOfWorkModule, SystemCommandModule],
	providers: [
		// ── Unit of work ────────────────────────────────────────────────
		{
			provide: AUTHORIZATION_UNIT_OF_WORK,
			inject: [TenantTransactionService, IDENTITY_SESSIONS, RequestContextService, TransactionalEventDispatcher, AFTER_COMMIT_PUBLISHER],
			useFactory: (
				transactions: TenantTransactionService,
				identitySessions: IdentitySessionsPortFactory<Prisma.TransactionClient>,
				requestContext: RequestContextService,
				dispatcher: TransactionalEventDispatcher<Prisma.TransactionClient>,
				publisher: AfterCommitPublisher,
			): UnitOfWork<AuthorizationScope> => new PrismaUnitOfWork(transactions, new AuthorizationScopeFactory(identitySessions, requestContext), dispatcher, publisher),
		},
		{
			provide: PrismaReadExecutor,
			inject: [TenantTransactionService],
			useFactory: (transactions: TenantTransactionService): PrismaReadExecutor<Prisma.TransactionClient> => new PrismaReadExecutor(transactions),
		},
		// ── Application ─────────────────────────────────────────────────
		RbacMutationScope,
		RbacMutationGuard,
		SupportAccessGrantLocator,
		ListSupportAccessGrantsHandler,
		ListTenantSupportAccessGrantsHandler,
		PrismaSupportAccessReadRepository,
		{ provide: SUPPORT_ACCESS_READ, useExisting: PrismaSupportAccessReadRepository },
		CreatePermissionHandler,
		RevisePermissionHandler,
		RemovePermissionHandler,
		RestorePermissionHandler,
		GrantUserPermissionHandler,
		RevokeUserPermissionHandler,
		SyncUserPermissionsHandler,
		CreateRoleHandler,
		ReviseRoleHandler,
		RemoveRoleHandler,
		RestoreRoleHandler,
		ReparentRoleHandler,
		SyncRolePermissionsHandler,
		AssignRoleHandler,
		UnassignRoleHandler,
		SyncUserRolesHandler,
		AssignDefaultRoleHandler,
		ExpireTimeBoundPermissionOverridesHandler,
		PurgeOldPermissionAuditLogsHandler,
		SyncPermissionRegistryHandler,
		SyncCapabilityCatalogHandler,
		SyncReferenceDataHandler,
		CreatePolicyDraftHandler,
		SimulatePolicyDraftHandler,
		PublishPolicyHandler,
		RequestSupportAccessHandler,
		ApproveSupportAccessHandler,
		RevokeSupportAccessHandler,
		ListPermissionsHandler,
		GetPermissionHandler,
		ListPermissionGroupsHandler,
		CheckPermissionHandler,
		ListRolesHandler,
		GetRoleHandler,
		ValidateRoleAssignmentHandler,
		PreviewRoleAssignmentHandler,
		ListPermissionAuditLogHandler,
		GetCapabilityCatalogHandler,
		DecideAuthorizationHandler,
		ExplainAuthorizationHandler,
		InvalidateAuthorizationOnUserAuthorizationChanged,
		InvalidatePolicyBundlesOnPolicyPublished,
		// ── Kernel (the single decision point, ADR 026) ─────────────────
		AuthorizationKernelService,
		SubjectGrantsLoader,
		TenantMembershipService,
		ResourceOwnershipResolver,
		PolicyEngineService,
		AclService,
		AuthorizationAuditKernelService,
		AuthorizationContextResolver,
		{ provide: AUTHORIZATION_KERNEL, useExisting: AuthorizationKernelService },
		{ provide: AUTHORIZATION_DECISION_AUDIT, useExisting: AuthorizationAuditKernelService },
		{ provide: REQUEST_TENANT_RESOLVER, useExisting: AuthorizationContextResolver },
		AuthorizationPortAdapter,
		{ provide: AUTHORIZATION_PORT, useExisting: AuthorizationPortAdapter },
		PermissionReachAdapter,
		{ provide: PERMISSION_REACH, useExisting: PermissionReachAdapter },
		SuperAdminBypassAuditAdapter,
		{ provide: SUPER_ADMIN_BYPASS_AUDIT, useExisting: SuperAdminBypassAuditAdapter },
		// ── Caches and cross-instance invalidation ──────────────────────
		AuthorizationCacheService,
		AuthorizationInvalidationService,
		{ provide: AUTHORIZATION_CACHE_INVALIDATION, useExisting: AuthorizationInvalidationService },
		// ── Reads ───────────────────────────────────────────────────────
		AuthorizationCheckerService,
		{ provide: SUBJECT_AUTHORIZATION_READ, useExisting: AuthorizationCheckerService },
		UserGrantsReadAdapter,
		{ provide: USER_GRANTS_READ, useExisting: UserGrantsReadAdapter },
		PrismaRbacCatalogReader,
		{ provide: RBAC_CATALOG_READ, useExisting: PrismaRbacCatalogReader },
		PrismaRbacInspectionReadAdapter,
		{ provide: RBAC_INSPECTION_READ, useExisting: PrismaRbacInspectionReadAdapter },
		PrismaPermissionHoldersReader,
		{ provide: PERMISSION_HOLDERS_READ, useExisting: PrismaPermissionHoldersReader },
		PermissionAuditLogReader,
		{ provide: PERMISSION_AUDIT_LOG_READ, useExisting: PermissionAuditLogReader },
		CapabilityCatalogReader,
		{ provide: CAPABILITY_CATALOG_READ, useExisting: CapabilityCatalogReader },
		RequestTenantAdapter,
		{ provide: REQUEST_TENANT, useExisting: RequestTenantAdapter },
		// ── Cedar policy plane ──────────────────────────────────────────
		{ provide: POLICY_ENGINE, useClass: CedarWasmPolicyEngine },
		CedarPolicyEvaluatorService,
		{ provide: CEDAR_POLICY_EVALUATOR, useExisting: CedarPolicyEvaluatorService },
		PolicyBundleCacheRegistration,
		PolicySimulator,
		{ provide: POLICY_SIMULATOR, useExisting: PolicySimulator },
		{ provide: POLICY_TEMPLATE_COMPILER, useFactory: (): PolicyTemplateCompilerAdapter => new PolicyTemplateCompilerAdapter() },
		// ── Reference data, provisioning, health ────────────────────────
		{
			provide: REFERENCE_DATA_SYNC,
			inject: [TenantTransactionService],
			useFactory: (transactions: TenantTransactionService): ReferenceDataSyncPort => createReferenceDataSyncService(systemOperationRunner(transactions)),
		},
		AccountDefaultRoleAdapter,
		{ provide: ACCOUNT_DEFAULT_ROLE, useExisting: AccountDefaultRoleAdapter },
		AuthorizationHealthIndicator,
		{ provide: AUTHORIZATION_HEALTH_INDICATOR, useExisting: AuthorizationHealthIndicator },
		// ── Scheduled entry points ──────────────────────────────────────
		PermissionExpiryCron,
		SupportAccessExpiryCron,
		ExpireSupportAccessGrantsHandler,
		AuditLogRetentionCron,
	],
	exports: [
		AUTHORIZATION_PORT,
		AUTHORIZATION_KERNEL,
		AUTHORIZATION_DECISION_AUDIT,
		SUPER_ADMIN_BYPASS_AUDIT,
		REQUEST_TENANT_RESOLVER,
		AUTHORIZATION_CACHE_INVALIDATION,
		SUBJECT_AUTHORIZATION_READ,
		PERMISSION_HOLDERS_READ,
		CEDAR_POLICY_EVALUATOR,
		ACCOUNT_DEFAULT_ROLE,
		USER_GRANTS_READ,
		AUTHORIZATION_HEALTH_INDICATOR,
		POLICY_ENGINE,
		// The catalog-sync bootstrap in the HTTP module dispatches system commands.
		SystemCommandModule,
	],
})
export class AuthorizationModule {}
