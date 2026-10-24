import type { SystemOperationName } from "../../../../platform/application/system-operation-names";

/** Every RBAC change made by an authenticated user runs under this allowlisted operation (the RBAC tables are bypass-write). */
export const RBAC_MUTATE_OPERATION: SystemOperationName = "authorization.rbac.mutate";

/** Dry-run reads of another user's assignments (validate-assignment, preview). */
export const RBAC_INSPECT_OPERATION: SystemOperationName = "authorization.rbac.inspect";
/** Role and permission catalog lists. */
export const RBAC_CATALOG_READ_OPERATION: SystemOperationName = "authorization.rbac.catalog.read";
/** Who holds a permission, asked by another context (kanban assignees). */
export const PERMISSION_HOLDERS_READ_OPERATION: SystemOperationName = "authorization.permission_holders.read";
/** The admin capability catalog. */
export const CAPABILITY_CATALOG_READ_OPERATION: SystemOperationName = "authorization.capability_catalog.read";

/** `GET /admin/audit`. */
export const AUDIT_LOG_READ_OPERATION: SystemOperationName = "authorization.audit_log.read";

/** Hourly expiry of time-bound direct overrides; also the audited actor of every expiry. */
export const PERMISSION_EXPIRY_OPERATION: SystemOperationName = "maintenance.permission_expiry";

/** Hourly soft-delete of permission audit rows past retention. */
export const AUDIT_LOG_RETENTION_OPERATION: SystemOperationName = "maintenance.audit_log_retention";

/** Boot: registry → `Permission`. */
export const PERMISSION_REGISTRY_SYNC_OPERATION: SystemOperationName = "authorization.permission_registry.sync";

/** Boot: PLATFORM capability definitions → permission catalog. */
export const CAPABILITY_CATALOG_SYNC_OPERATION: SystemOperationName = "authorization.capability_catalog.sync";

/** CLI/seed: the whole platform reference data. */
export const REFERENCE_DATA_SYNC_OPERATION: SystemOperationName = "reference_data.sync";

export const POLICY_DRAFT_CREATE_OPERATION: SystemOperationName = "policy.draft.create";
/** D37: the whole simulation (draft load, every principal page, the result row and its audit row) runs under this ONE operation. */
export const POLICY_DRAFT_SIMULATE_OPERATION: SystemOperationName = "policy.draft.simulate";
export const POLICY_PUBLISH_OPERATION: SystemOperationName = "policy.publish";

export const SUPPORT_ACCESS_GRANT_OPERATION: SystemOperationName = "support_access.grant";
export const SUPPORT_ACCESS_APPROVE_OPERATION: SystemOperationName = "support_access.approve";
export const SUPPORT_ACCESS_REVOKE_OPERATION: SystemOperationName = "support_access.revoke";
export const SUPPORT_ACCESS_EXPIRY_OPERATION: SystemOperationName = "maintenance.support_access_expiry";
export const SUPPORT_ACCESS_ADMIN_READ_OPERATION: SystemOperationName = "support_access.admin_read";
export const SUPPORT_ACCESS_TENANT_READ_OPERATION: SystemOperationName = "support_access.tenant_read";
export const SUPPORT_ACCESS_READ = Symbol("SUPPORT_ACCESS_READ");

// ── Injection tokens ────────────────────────────────────────────────────────

export const AUTHORIZATION_UNIT_OF_WORK = Symbol("AUTHORIZATION_UNIT_OF_WORK");
export const PERMISSION_REACH = Symbol("PERMISSION_REACH");
export const RBAC_CATALOG_READ = Symbol("RBAC_CATALOG_READ");
export const RBAC_INSPECTION_READ = Symbol("RBAC_INSPECTION_READ");
export const PERMISSION_AUDIT_LOG_READ = Symbol("PERMISSION_AUDIT_LOG_READ");
export const CAPABILITY_CATALOG_READ = Symbol("CAPABILITY_CATALOG_READ");
export const REQUEST_TENANT = Symbol("REQUEST_TENANT");
export const POLICY_TEMPLATE_COMPILER = Symbol("POLICY_TEMPLATE_COMPILER");

// Public ports (re-exported by public-api.ts).
export const AUTHORIZATION_PORT = Symbol("AUTHORIZATION_PORT");
export const AUTHORIZATION_KERNEL = Symbol("AUTHORIZATION_KERNEL");
export const AUTHORIZATION_DECISION_AUDIT = Symbol("AUTHORIZATION_DECISION_AUDIT");
export const SUPER_ADMIN_BYPASS_AUDIT = Symbol("SUPER_ADMIN_BYPASS_AUDIT");
export const REQUEST_TENANT_RESOLVER = Symbol("REQUEST_TENANT_RESOLVER");
export const AUTHORIZATION_CACHE_INVALIDATION = Symbol("AUTHORIZATION_CACHE_INVALIDATION");
export const SUBJECT_AUTHORIZATION_READ = Symbol("SUBJECT_AUTHORIZATION_READ");
export const PERMISSION_HOLDERS_READ = Symbol("PERMISSION_HOLDERS_READ");
export const CEDAR_POLICY_EVALUATOR = Symbol("CEDAR_POLICY_EVALUATOR");
export const ACCOUNT_DEFAULT_ROLE = Symbol("ACCOUNT_DEFAULT_ROLE");
export const AUTHORIZATION_HEALTH_INDICATOR = Symbol("AUTHORIZATION_HEALTH_INDICATOR");
export const REFERENCE_DATA_SYNC = Symbol("REFERENCE_DATA_SYNC");
export const POLICY_SIMULATOR = Symbol("POLICY_SIMULATOR");
