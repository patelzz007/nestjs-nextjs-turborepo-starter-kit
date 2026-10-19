// The ONLY file other contexts (and the platform security kit) may import from authorization (§6.4).
// Ports and tokens are listed first: identity imports them while this context revokes identity's
// sessions, so they must be initialised before the module class is evaluated.

// ── Ports and their injection tokens ────────────────────────────────────────
export type { AuthorizationCheck, AuthorizationPort } from "../../platform/application/ports/authorization.port";
export type {
	AuthorizationAuditMetadata,
	AuthorizationDecisionAuditPort,
	AuthorizationKernelPort,
	SuperAdminBypassAuditPort,
} from "./application/ports/authorization-kernel.port";
export type {
	AuthorizationCacheInvalidationPort,
	PolicyBundleInvalidationScope,
	UserInvalidationScope,
	UserInvalidationTrigger,
} from "./application/ports/authorization-cache-invalidation.port";
export { UserInvalidationTriggerSchema } from "./application/ports/authorization-cache-invalidation.port";
export type { SubjectAuthorizationReadPort } from "./application/ports/subject-authorization-read.port";
export type { CedarEvaluationInput, CedarPolicyEvaluatorPort } from "./application/ports/cedar-policy-evaluator.port";
export type { PolicyPrincipal } from "./application/ports/policy-engine.port";
export type {
	AccountDefaultRolePort,
	DefaultRoleAssignmentPort,
	PlatformRoleAssignmentOutcome,
	PlatformRoleAssignmentRequest,
} from "./application/ports/default-role-assignment.port";
export {
	ACCOUNT_DEFAULT_ROLE,
	AUTHORIZATION_CACHE_INVALIDATION,
	AUTHORIZATION_DECISION_AUDIT,
	AUTHORIZATION_HEALTH_INDICATOR,
	AUTHORIZATION_KERNEL,
	AUTHORIZATION_PORT,
	CEDAR_POLICY_EVALUATOR,
	REQUEST_TENANT_RESOLVER,
	SUBJECT_AUTHORIZATION_READ,
	SUPER_ADMIN_BYPASS_AUDIT,
} from "./application/ports/authorization.tokens";
export type { RequestTenantContext, RequestTenantResolverPort } from "./infrastructure/kernel/authorization-context.resolver";

// ── Transactional port factory (other contexts' infrastructure only) ────────
export { createAuthorizationTransactionalPorts, type AuthorizationTransactionalPorts } from "./infrastructure/adapters/authorization-transactional-ports";
/** For command-line composition roots that run without a Nest container (the tenant-key rewrap CLI). */
export { createCedarPolicyEvaluator } from "./infrastructure/cedar/cedar-policy-evaluator.factory";

// ── The default tenant Cedar policy, published when an organization is provisioned ──
// Organizations calls it in its provisioning transaction; the seed and the policy specs use it too.
export {
	DEFAULT_TENANT_POLICY_AUDIT_ACTION,
	findActivePolicyVersionInTx,
	newDefaultTenantPolicyRecordIds,
	DEFAULT_TENANT_CEDAR,
	seedDefaultTenantPolicies,
	type DefaultTenantPolicyRecordIds,
} from "./infrastructure/persistence/default-tenant-policy-seed";

// ── Public domain events ────────────────────────────────────────────────────
export { UserAuthorizationChanged } from "./domain/events/user-authorization-changed.event";
export { PolicyPublished } from "./domain/events/policy-published.event";

// ── Error codes (for the HTTP status map) and the uniform denial ────────────
export { AuthorizationErrorCodeSchema, type AuthorizationErrorCode, AccessDeniedError } from "./domain/errors/authorization.errors";
export { AuthorizationException } from "./presentation/http/authorization.exception";

// ── Names other contexts and the security kit share ─────────────────────────
export { ADMIN_ROLE_NAME, DEFAULT_CONSUMER_ROLE_NAME, SUPER_ADMIN_ROLE_NAME } from "./domain/rbac-catalog";
export { RequireAllPermissions } from "./presentation/http/decorators/require-all-permissions.decorator";
export { RequireAnyPermission } from "./presentation/http/decorators/require-any-permission.decorator";
export { RequireAllRoles } from "./presentation/http/decorators/require-all-roles.decorator";
export { RequireAnyRole } from "./presentation/http/decorators/require-any-role.decorator";

// ── The Nest module ─────────────────────────────────────────────────────────
export { AuthorizationModule } from "./authorization.module";
