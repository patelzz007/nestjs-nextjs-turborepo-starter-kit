import { z } from "zod";

import { SystemOperationNameSchema } from "../platform/application/system-operation-names";

// ============================================
// prisma/system-operation.registry.ts — THE allowlist of RLS-bypassing work
// ============================================
// ADR 012. A system operation is the ONLY way code obtains `app.rls_bypass`.
// Each entry names exactly ONE purpose (never "provisioning" for anything
// that touches an organization) and the PostgreSQL role it runs as:
//
//   - `withSystemOperation` (tenant-transaction.service.ts) and the pool
//     checkout (rls-pool.ts) both switch to `role` with `SET ROLE` — the
//     role is enforced by PostgreSQL, not just documented here;
//   - the operation name is written to `app.system_operation`, and
//     `app_rls_bypass()` (prisma/rls/00-app-helpers.sql) refuses a bypass
//     that does not name its operation;
//   - every use is recorded: a structured `rls.system_operation` log line and,
//     inside an HTTP request, the request's audit entry (`systemOperations`).
//
// Each entry also declares the tables its bypass reaches (`scope`): every RLS
// policy admits a system operation only through `app_rls_bypass_on('<table>')`,
// generated from this registry (prisma/rls/system-operation-scopes.ts), so an
// operation can read and write exactly the tables listed here.
//
// Adding a name: add it to `SystemOperationNameSchema` (platform/application) AND to `SYSTEM_OPERATIONS`
// (the `Record` type makes a missing definition a compile error), give it the
// narrowest role and table set that work, run `pnpm db:generate-system-operation-scopes`,
// and document it in docs/technical/authorization/tenancy-and-rls.md §3.1.

/**
 * PostgreSQL roles a system operation may run as. Every role is created in
 * prisma/rls/00-app-helpers.sql (NOLOGIN, NOBYPASSRLS — policies always apply)
 * and granted in prisma/rls/99-app-runtime-grants.sql.
 */
export const DatabaseRoleSchema = z.enum([
	/** The application role: DML on every table, filtered by RLS policies. */
	"app_runtime",
	/** Read-only role for cross-tenant schedulers: SELECT on `Organization` (and what its policy reads) only. */
	"app_enumerator",
]);
export type DatabaseRole = z.output<typeof DatabaseRoleSchema>;

/** The role every non-system (user, anonymous) database session runs as. */
export const DEFAULT_DATABASE_ROLE: DatabaseRole = "app_runtime";

/** The closed set of allowlisted operation names. */
export const SystemOperationSchema = SystemOperationNameSchema;
export type SystemOperation = z.output<typeof SystemOperationSchema>;

/** Why an operation's bypass still reaches every table instead of a declared set. */
export const AllTablesReasonSchema = z.enum([
	/**
	 * A request-wide scope (guards, `@RlsBypass()` routes, the platform staff scopes): the route that runs
	 * under it decides what it touches, so no fixed table set describes it. Narrowed per route instead.
	 */
	"request_scope",
	/**
	 * A command whose writes span several contexts' tables and whose every branch has not been verified
	 * against a declared set yet. Narrowing one is a `tables(…)` change here, checked by the e2e suites.
	 */
	"not_yet_narrowed",
]);
export type AllTablesReason = z.output<typeof AllTablesReasonSchema>;

/**
 * Which tables an operation's bypass reaches. PostgreSQL enforces it: every policy admits a system
 * operation through `app_rls_bypass_on('<its table>')`, generated from this registry into
 * prisma/rls/00-system-operation-scopes.sql (prisma/rls/system-operation-scopes.ts).
 */
export type SystemOperationScope = { readonly kind: "tables"; readonly tables: readonly string[] } | { readonly kind: "allTables"; readonly reason: AllTablesReason };

/** What an allowlisted operation is for, the role it runs as, and the tables its bypass reaches. */
export interface SystemOperationDefinition {
	readonly description: string;
	readonly role: DatabaseRole;
	readonly scope: SystemOperationScope;
}

const tables = (...names: readonly string[]): SystemOperationScope => ({ kind: "tables", tables: names });
const REQUEST_SCOPE: SystemOperationScope = { kind: "allTables", reason: "request_scope" };
const NOT_YET_NARROWED: SystemOperationScope = { kind: "allTables", reason: "not_yet_narrowed" };

const runtime = (description: string, scope: SystemOperationScope): SystemOperationDefinition => ({ description, role: "app_runtime", scope });

/** Definition of every allowlisted operation — `Record` makes a missing entry a compile error. */
export const SYSTEM_OPERATIONS: Readonly<Record<SystemOperation, SystemOperationDefinition>> = {
	"request.pre_handler": runtime("Authentication + authorization lookups in guards, before the RLS interceptor narrows the request", REQUEST_SCOPE),
	"route.rls_bypass": runtime("Handler explicitly decorated with @RlsBypass() (public cross-tenant flows)", REQUEST_SCOPE),
	"platform.superadmin": runtime("Platform super-admin request scope", REQUEST_SCOPE),
	"platform.staff_single_tenant": runtime("Admin staff request scope in single-tenant mode", REQUEST_SCOPE),

	"audit.http_request.record": runtime("Append the global HTTP audit entry of a state-changing request (bypass-only audit_logs table)", tables("AuditLog")),
	"audit.http_request.read": runtime(
		"Read the bypass-only audit_logs table (and the actor / organization names its rows reference) for the admin audit viewer — only after the AUDIT_LOG permission check",
		tables("AuditLog", "User", "Organization"),
	),
	"audit.trail.read": runtime(
		"Read both bypass-only audit stores (audit_logs + data_change_logs) as one timeline for the admin audit log — only after the AUDIT_LOG permission check",
		tables("AuditLog", "DataChangeLog", "User", "Organization"),
	),
	"audit.data_change.read": runtime(
		"Read the bypass-only data_change_logs table (and the actor / organization names its rows reference) for the admin data-change viewer — only after the AUDIT_LOG permission check",
		tables("DataChangeLog", "AuditLog", "User", "Organization"),
	),
	"http.idempotency": runtime("Acquire, replay, complete and release Idempotency-Key records (bypass-only idempotency table)", tables("PlatformResourceIdempotencyRecord")),
	"idempotency.retention": runtime("Purge Idempotency-Key records expired past their retention grace", tables("PlatformResourceIdempotencyRecord")),
	"outbox.publish": runtime("Outbox dispatcher: claim, publish and advance outbox rows", tables("OutboxEvent")),
	"outbox.enqueue": runtime("Record a platform telemetry event that has no domain write of its own", tables("OutboxEvent")),
	"email.log.write": runtime(
		"Record outbound email attempts, their send outcome and verified delivery-webhook events (bypass-only email tables)",
		tables("EmailLog", "EmailDeliveryEvent", "OutboxEvent"),
	),
	"outbox.retention": runtime("Purge outbox rows published (or dead-lettered) longer ago than their retention window", tables("OutboxEvent")),
	"tenant.enumerate": { description: "List active organization ids for scheduler fan-out", role: "app_enumerator", scope: tables("Organization") },
	"tenancy.default_organization.verify": runtime("Boot check: the single-tenant DEFAULT_ORGANIZATION_ID names a live organization", tables("Organization")),
	"geo.reference_data.write": runtime(
		"SuperAdmin create/update/soft-delete/import of geo reference data (bypass-only writes)",
		tables("Region", "Subregion", "Country", "State", "City", "AuditLog"),
	),
	"catalog.product_catalog.read": runtime("Read the bypass-only product and sample-category tables after the catalog permission check", tables("Product", "SampleCategory")),
	"catalog.product_catalog.write": runtime(
		"Create, revise, soft-delete or restore bypass-only product and sample-category rows after the catalog permission check",
		tables("Product", "SampleCategory", "OutboxEvent"),
	),
	"authorization.capability_catalog.sync": runtime(
		"API boot: converge the PLATFORM capability definitions to the permission catalog — creates missing rows and corrects changed ones, writes nothing else",
		NOT_YET_NARROWED,
	),
	"authorization.permission_registry.sync": runtime(
		"API boot: insert missing code-registry permissions and correct changed metadata (registry → database only, never deletes), under the catalog-sync advisory lock",
		NOT_YET_NARROWED,
	),
	"reference_data.sync": runtime(
		"CLI/seed only (db:sync-reference-data): converge the platform reference data — permission catalog, system roles, their grants and the merchant capability catalog — one section per transaction, with an audit row per change",
		NOT_YET_NARROWED,
	),

	"queue.email.send": runtime("BullMQ worker: send one queued email", tables("EmailLog", "EmailDeliveryEvent", "OutboxEvent")),
	"queue.storage.cleanup": runtime("BullMQ worker: expire abandoned uploads", NOT_YET_NARROWED),
	"queue.storage.delete": runtime("BullMQ worker: delete a stored object and its variants", NOT_YET_NARROWED),
	"queue.storage.scan": runtime("BullMQ worker: malware-scan an uploaded file and apply the verdict (READY + binding, QUARANTINED or FAILED)", NOT_YET_NARROWED),
	"queue.rewards.auto_publish": runtime("BullMQ worker: publish scheduled rewards", NOT_YET_NARROWED),
	"queue.claims.expire_pending": runtime("BullMQ worker: expire pending reward claims", NOT_YET_NARROWED),
	"queue.claims.expire_referrer": runtime("BullMQ worker: expire referrer reward claims", NOT_YET_NARROWED),
	"queue.rewards.referral_credit_notify": runtime("BullMQ worker: deliver pending referrer-reward-credited emails", NOT_YET_NARROWED),
	"rewards.referral_credit.deliver": runtime(
		"Read a credited referral's referrer email and mark it notified — whoever triggered the delivery (the POS checkout right after commit, or the retry job)",
		NOT_YET_NARROWED,
	),
	"maintenance.permission_expiry": runtime("Cron: revoke expired temporary permissions", NOT_YET_NARROWED),
	"maintenance.audit_log_retention": runtime("Cron: purge permission audit rows past retention", NOT_YET_NARROWED),
	"maintenance.password_reset_token_cleanup": runtime("Cron: delete expired password reset tokens", NOT_YET_NARROWED),
	"maintenance.mfa_recovery_unlock": runtime("Cron: apply due MFA recovery unlocks", NOT_YET_NARROWED),
	"maintenance.authorization_change_sweep": runtime(
		"Every instance, every few seconds: read the recent User.authorizationChangedAt stamps to drop cached authorization an after-commit invalidation missed",
		tables("User"),
	),
	"maintenance.signup_referral_codes": runtime(
		"Cron: issue the first signup referral code to every non-deleted user without one, and a successor after a code expires, each under that user's row lock, with a system audit row (ADR 035)",
		NOT_YET_NARROWED,
	),

	"auth.profile.update": runtime(
		"A user edits their OWN profile (optimistic-lock conditional update scoped to their id), with the request's audit row in the bypass-only audit table, in one transaction",
		NOT_YET_NARROWED,
	),
	"auth.signup_referrals.list_referees": runtime(
		"Read referee display names for the authenticated referrer's signup-referral list (`users` RLS is self-only); only after the caller is bound to their own referrer id",
		NOT_YET_NARROWED,
	),
	"auth.signup_referrals.notify_success": runtime(
		"Claim a successful signup referral's owed notification and write it to the referrer's in-app inbox with the referee's current name — after the POS checkout that stamped it, or from the hourly retry pass (ADR 035)",
		NOT_YET_NARROWED,
	),
	"auth.mfa_recovery.request": runtime("A user opens an MFA recovery request, with its audit row in the bypass-only platform audit table", NOT_YET_NARROWED),
	"auth.mfa_recovery.review": runtime(
		"A SuperAdmin (never the requester) approves or denies a pending MFA recovery request, with its audit row in the bypass-only platform audit table",
		NOT_YET_NARROWED,
	),
	"auth.superadmin.bootstrap": runtime(
		"CLI only (admin:bootstrap-superadmin): create the platform's FIRST SuperAdmin — the no-active-SuperAdmin check, the user, the SuperAdmin role assignment and both audit rows in one transaction under an advisory lock",
		NOT_YET_NARROWED,
	),

	"organization.provision.platform_invite": runtime("Provision an organization from a platform invitation", NOT_YET_NARROWED),
	"organization.provision.admin_merchant_invite": runtime("A platform admin invites a merchant (organization + invitation)", NOT_YET_NARROWED),
	"organization.access_request.create": runtime("Record a user's request to join an organization", NOT_YET_NARROWED),
	"organization.access_request.review": runtime(
		"Approve (create the membership) or reject a pending access request, after the reviewer's manage-team check",
		NOT_YET_NARROWED,
	),
	"organization.context.resolve_route_key": runtime("Resolve an organization slug/id from the URL before membership is known", NOT_YET_NARROWED),
	"organization.context.location_access": runtime("Validate the caller's access to an organization location", NOT_YET_NARROWED),
	"organization.context.resolve_membership": runtime("Resolve the caller's organization membership context", NOT_YET_NARROWED),
	"organization.context.list_memberships": runtime("List the caller's organization memberships", NOT_YET_NARROWED),

	"organization.membership.accept": runtime("Accept a team member invitation and create the membership", NOT_YET_NARROWED),
	"organization.membership.roster": runtime("Read member names and emails for the team roster (users RLS is self-only); only after the manage-team check", NOT_YET_NARROWED),
	"organization.invitation.create": runtime("Create a team member invitation", NOT_YET_NARROWED),
	"organization.invitation.revoke": runtime("Revoke a team member invitation", NOT_YET_NARROWED),
	"organization.membership.remove_from_store": runtime("Remove a team member from one store: store membership soft delete + location scope row removal", NOT_YET_NARROWED),
	"organization.invitation.resolve_token": runtime("Resolve a team invitation from its token", NOT_YET_NARROWED),
	"organization.invitation.accept_merchant_onboarding": runtime(
		"Complete merchant onboarding in one transaction: claim the pending invitation, owner membership, merchant profile, locations, activation and audit row",
		NOT_YET_NARROWED,
	),
	"organization.invitation.submit_onboarding_documents": runtime(
		"Consume an accepted merchant onboarding invitation's single-use document window and attach the submitted KYB evidence",
		NOT_YET_NARROWED,
	),
	"organization.invitation.register_and_accept": runtime("Create the invitee's account and accept their team invitation in one transaction", NOT_YET_NARROWED),

	"organization.location.admin_create": runtime("A platform admin creates an organization store location", NOT_YET_NARROWED),
	"organization.location.admin_review": runtime("A platform admin approves or rejects a store location request", NOT_YET_NARROWED),
	"organization.location.admin_list": runtime("A platform admin lists pending store location requests", NOT_YET_NARROWED),
	"organization.location.close": runtime(
		"A merchant closes one of its stores: soft-deletes the store and revokes its memberships, terminals and keys in one transaction",
		NOT_YET_NARROWED,
	),
	"organization.kyb.admin_decide": runtime(
		"A platform admin decides a merchant's KYB review: locked compare-and-set on the merchant profile plus the organization audit row, after the MANAGE MERCHANT_ORG check",
		NOT_YET_NARROWED,
	),
	"organization.merchant.admin_read": runtime(
		"A platform admin reads merchant organizations (list, detail, KYB evidence) across tenants, after the LIST MERCHANT_ORG check",
		NOT_YET_NARROWED,
	),
	"organization.display_data.read": runtime(
		"Read organization names and logos (and owner user ids) for display by other contexts; the caller authorized the records that reference them",
		NOT_YET_NARROWED,
	),

	"encryption.tenant_key.provision": runtime("Create or ensure an organization's tenant encryption key", tables("TenantEncryptionKey", "OrganizationAuditLog")),
	"encryption.tenant_key.unwrap": runtime(
		"Read the wrapped tenant data-encryption key (and append the decrypt audit row) to unwrap it",
		tables("TenantEncryptionKey", "OrganizationAuditLog"),
	),
	"encryption.tenant_key.rewrap": runtime(
		"Maintenance: re-wrap tenant data keys to the current key-encryption key (compare-and-swap + audit row); SuperAdmin actor only",
		tables("TenantEncryptionKey", "OrganizationAuditLog", "User"),
	),

	"support_access.grant": runtime("Create a support access grant", NOT_YET_NARROWED),
	"support_access.approve": runtime(
		"An organization OWNER approves a pending support access grant (bypass-write table) — the organization comes from the grant record and the owner membership is verified in the same transaction",
		NOT_YET_NARROWED,
	),
	"support_access.revoke": runtime("Revoke a support access grant", NOT_YET_NARROWED),
	"support_access.verify": runtime("Verify an active support access grant", tables("SupportAccessGrant")),

	"authorization.rbac.mutate": runtime(
		"One RBAC change (roles, permissions, assignments) with its session revocation and permission audit row, in one transaction — only after the route permission + privilege-escalation checks; catalog tables are bypass-write",
		NOT_YET_NARROWED,
	),
	"authorization.rbac.inspect": runtime(
		"Read a target user's role assignments and direct grants (own-row RLS) for an RBAC preview or conflict check — only after the route permission check",
		NOT_YET_NARROWED,
	),
	"authorization.audit_log.read": runtime(
		"Read the bypass-only permission_audit_logs table for the admin audit viewer — only after the AUDIT_LOG:READ check",
		NOT_YET_NARROWED,
	),

	"policy.draft.create": runtime("Create an authorization policy draft", NOT_YET_NARROWED),
	"policy.draft.simulate": runtime("Read a policy draft, the published policy versions and the in-scope active memberships for a bounded simulation", NOT_YET_NARROWED),
	"policy.publish": runtime("Publish a simulated policy draft as the next policy version (atomic)", NOT_YET_NARROWED),
	"policy.bundle.load": runtime("Load the active policy bundle for evaluation", tables("AuthorizationPolicyVersion")),

	"pos.terminal.pair": runtime(
		"POST /pos/terminals/pair: the till has no credential yet — find the terminal by its one-time code, mint its POS key, bind it (the code is the only authorization)",
		NOT_YET_NARROWED,
	),
	"rewards.sales.merchant_summary": runtime(
		"Read merchant names/categories for sales breakdowns (customer spending, admin top merchants) — ids come from sales the caller may already see",
		NOT_YET_NARROWED,
	),
	"github.webhook.subscriptions": runtime(
		"Read and change which repositories have live updates (bypass-only github_webhook_subscriptions) — only after the caller's GITHUB_PULL_REQUEST check",
		tables("GithubWebhookSubscription"),
	),
	"github.webhook.deliveries": runtime(
		"Record a GitHub webhook delivery and announce its change (bypass-only github_webhook_deliveries) — only after the delivery's signature is verified; also prunes old deliveries",
		tables("GithubWebhookDelivery"),
	),
	"files.delete": runtime(
		"Soft-delete a stored file and the binding rows that reference it, after the caller's permission check (product images are bypass-only)",
		NOT_YET_NARROWED,
	),
	"files.authorization": runtime("Resolve the caller's organization membership role to authorize a file operation", NOT_YET_NARROWED),
	"files.scan_verdict.apply": runtime(
		"Apply a malware-scan verdict to an uploaded file (state transition, resource binding) together with every category listener's reaction (e.g. KYB review status) in one transaction",
		NOT_YET_NARROWED,
	),
};

/** True when `name` is an allowlisted operation. */
export function isAllowlistedSystemOperation(name: string): boolean {
	return SystemOperationSchema.safeParse(name).success;
}

/** Thrown when code asks for a bypass under a name that is not allowlisted. */
export class SystemOperationNotAllowlistedError extends Error {
	public constructor(public readonly operation: string) {
		super(`System operation not allowlisted: ${operation}`);
		this.name = "SystemOperationNotAllowlistedError";
	}
}

/** Parse an operation name from configuration or another untyped source; throws when it is not allowlisted. */
export function parseSystemOperation(name: string): SystemOperation {
	const parsed = SystemOperationSchema.safeParse(name);
	if (!parsed.success) {
		throw new SystemOperationNotAllowlistedError(name);
	}
	return parsed.data;
}

/** The definition (role, description, table scope) of an allowlisted operation. */
export function systemOperationDefinition(operation: SystemOperation): SystemOperationDefinition {
	return SYSTEM_OPERATIONS[operation];
}
