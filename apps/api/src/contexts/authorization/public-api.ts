// The ONLY file other contexts (and the platform security kit) may import from authorization (§6.4).
// Ports and tokens are listed first: identity imports them while this context revokes identity's
// sessions, so they must be initialised before the module class is evaluated.

// ── Ports and their injection tokens ────────────────────────────────────────
export type { AuthorizationCheck, AuthorizationPort } from "../../platform/application/ports/authorization.port";
export type { AuthorizationAuditMetadata, AuthorizationKernelPort, SuperAdminBypassAuditPort } from "./application/ports/authorization-kernel.port";
export type { AuthorizationCacheInvalidationPort, UserInvalidationScope, UserInvalidationTrigger } from "./application/ports/authorization-cache-invalidation.port";
export { UserInvalidationTriggerSchema } from "./application/ports/authorization-cache-invalidation.port";
export type { SubjectAuthorizationReadPort } from "./application/ports/subject-authorization-read.port";
export type { PermissionHoldersReadPort } from "./application/ports/permission-holders-read.port";
export type {
	AccountDefaultRolePort,
	DefaultRoleAssignmentPort,
	PlatformRoleAssignmentOutcome,
	PlatformRoleAssignmentRequest,
} from "./application/ports/default-role-assignment.port";
export type { AccessControlPort } from "./application/ports/access-control.port";
export {
	ACCESS_CONTROL,
	ACCOUNT_DEFAULT_ROLE,
	AUTHORIZATION_CACHE_INVALIDATION,
	AUTHORIZATION_HEALTH_INDICATOR,
	AUTHORIZATION_KERNEL,
	AUTHORIZATION_PORT,
	REQUEST_TENANT_RESOLVER,
	PERMISSION_HOLDERS_READ,
	SUBJECT_AUTHORIZATION_READ,
	SUPER_ADMIN_BYPASS_AUDIT,
} from "./application/ports/authorization.tokens";
export type { RequestTenantContext, RequestTenantResolverPort } from "./infrastructure/kernel/authorization-context.resolver";

// ── Transactional port factory (other contexts' infrastructure only) ────────
export { createAuthorizationTransactionalPorts, type AuthorizationTransactionalPorts } from "./infrastructure/adapters/authorization-transactional-ports";

// ── Public domain events ────────────────────────────────────────────────────
export { UserAuthorizationChanged } from "./domain/events/user-authorization-changed.event";

// ── Error codes (for the HTTP status map) and the uniform denial ────────────
export { AuthorizationErrorCodeSchema, type AuthorizationErrorCode, AccessDeniedError } from "./domain/errors/authorization.errors";
export { AuthorizationException } from "./presentation/http/authorization.exception";

// ── Names other contexts and the security kit share ─────────────────────────
export { ADMIN_ROLE_NAME, DEFAULT_CONSUMER_ROLE_NAME, LOCATION_MANAGER_ROLE_NAME, LOCATION_STAFF_ROLE_NAME, SUPER_ADMIN_ROLE_NAME } from "./domain/rbac-catalog";

// ── The Nest module ─────────────────────────────────────────────────────────
export { AuthorizationModule } from "./authorization.module";

// ── Access decisions (ADR 067) ─────────────────────────────────────────────
export { StoreScope } from "./domain/access/store-scope";
export type { AccessDecision, AccessRequest, AccessTarget, AllowPathName } from "./domain/access/access-request";
export { TenantRoleCopies, TenantRoleMissingError, type TenantRoleCopiesDb } from "./infrastructure/access/tenant-role-copies";
/** The platform reference data (permission catalog, system and template roles) — the same loader as `db:sync-reference-data`; test fixtures that build tenants without the app use it first. */
export { createReferenceDataSyncService, systemOperationRunner } from "./infrastructure/reference-data/reference-data.composition";
