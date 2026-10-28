import { Prisma } from "@prisma/client";
import { z } from "zod";

import { SystemOperationNameSchema } from "../platform/application/system-operation-names";

// ============================================
// prisma/system-operation.registry.ts — THE allowlist of RLS-bypassing work
// ============================================
// ADR 012. A system operation is the ONLY way code obtains `app.rls_bypass`.
// Each entry names exactly ONE purpose (never "provisioning" for anything
// that touches a tenant) and the PostgreSQL role it runs as:
//
//   - `withSystemOperation` (tenant-transaction.service.ts) and the pool
//     checkout (rls-pool.ts) both switch to `role` with `SET ROLE` — the
//     role is enforced by PostgreSQL, not just documented here;
//   - the operation name is written to `app.system_operation`, and
//     `app_rls_bypass()` (prisma/rls/00-app-helpers.sql) refuses a bypass
//     that does not name its operation;
//   - every use is recorded: a structured `rls.system_operation` log line and,
//     inside an HTTP request, the request's audit entry (`systemOperations`).
//     A `routine` operation — a background poller that runs every few seconds
//     whether or not there is work — writes that line at debug level instead of
//     info, so the info log stays readable; it is still recorded.
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
	/** Read-only role for cross-tenant schedulers: SELECT on `Tenant` (and what its policy reads) only. */
	"app_enumerator",
]);
export type DatabaseRole = z.output<typeof DatabaseRoleSchema>;

/** The role every non-system (user, anonymous) database session runs as. */
export const DEFAULT_DATABASE_ROLE: DatabaseRole = "app_runtime";

/** The closed set of allowlisted operation names. */
export const SystemOperationSchema = SystemOperationNameSchema;
export type SystemOperation = z.output<typeof SystemOperationSchema>;

/** A table a system operation's bypass may reach: a Prisma model name, so a typo does not compile. */
export type TableName = Prisma.ModelName;

/**
 * Which tables an operation's bypass reaches. PostgreSQL enforces it: every policy admits a system
 * operation through `app_rls_bypass_on('<its table>')`, generated from this registry into
 * prisma/rls/00-system-operation-scopes.sql (prisma/rls/system-operation-scopes.ts).
 */
export interface SystemOperationScope {
	readonly kind: "tables";
	readonly tables: readonly TableName[];
}

/**
 * How loudly each use is logged: `call` at info (the default), `routine` at debug — only for a
 * background poller that runs on a short timer whether or not there is work.
 */
export const SystemOperationAuditLevelSchema = z.enum(["call", "routine"]);
export type SystemOperationAuditLevel = z.output<typeof SystemOperationAuditLevelSchema>;

/** What an allowlisted operation is for, the role it runs as, the tables its bypass reaches, and how its use is logged. */
export interface SystemOperationDefinition {
	readonly description: string;
	readonly role: DatabaseRole;
	readonly scope: SystemOperationScope;
	readonly audit: SystemOperationAuditLevel;
}

const tables = (...names: readonly TableName[]): SystemOperationScope => ({ kind: "tables", tables: names });
/** An operation that runs no SQL under its own name: it exists so its job is audited as a system command. It bypasses nothing. */
const NO_TABLES: SystemOperationScope = { kind: "tables", tables: [] };

const runtime = (description: string, scope: SystemOperationScope): SystemOperationDefinition => ({ description, role: "app_runtime", scope, audit: "call" });
/** A background poller's operation: as {@link runtime}, its use logged at debug level. */
const routinePoller = (description: string, scope: SystemOperationScope): SystemOperationDefinition => ({ ...runtime(description, scope), audit: "routine" });

/**
 * The tables `seed.demo_dataset` writes: every Prisma model, because `db:check-seed-coverage` fails
 * unless each table holds seeded rows. A new model is seeded (and so listed) automatically.
 */
const SEEDED_TABLES: readonly TableName[] = Object.values(Prisma.ModelName);

/** Definition of every allowlisted operation — `Record` makes a missing entry a compile error. */
export const SYSTEM_OPERATIONS: Readonly<Record<SystemOperation, SystemOperationDefinition>> = {
	"audit.http_request.record": runtime("Append the global HTTP audit entry of a state-changing request (bypass-only audit_logs table)", tables("AuditLog")),
	"audit.http_request.read": runtime(
		"Read the bypass-only audit_logs table (and the actor / tenant names its rows reference) for the admin audit viewer — only after the AUDIT_LOG permission check",
		tables("AuditLog", "User", "Tenant"),
	),
	"audit.trail.read": runtime(
		"Read both bypass-only audit stores (audit_logs + data_change_logs) as one timeline for the admin audit log — only after the AUDIT_LOG permission check",
		tables("AuditLog", "DataChangeLog", "User", "Tenant"),
	),
	"audit.data_change.read": runtime(
		"Read the bypass-only data_change_logs table (and the actor / tenant names its rows reference) for the admin data-change viewer — only after the AUDIT_LOG permission check",
		tables("DataChangeLog", "AuditLog", "User", "Tenant"),
	),
	"http.idempotency": runtime("Acquire, replay, complete and release Idempotency-Key records (bypass-only idempotency table)", tables("PlatformResourceIdempotencyRecord")),
	"idempotency.retention": runtime("Purge Idempotency-Key records expired past their retention grace", tables("PlatformResourceIdempotencyRecord")),
	"outbox.publish": routinePoller("Outbox dispatcher: claim, publish and advance outbox rows (polled every few seconds)", tables("OutboxEvent")),
	"outbox.enqueue": runtime("Record a platform telemetry event that has no domain write of its own", tables("OutboxEvent")),
	"email.log.write": runtime(
		"Record outbound email attempts, their send outcome and verified delivery-webhook events (bypass-only email tables)",
		tables("EmailLog", "EmailDeliveryEvent", "OutboxEvent"),
	),
	"notifications.email_log.list": runtime("Read the admin email-log list after the EMAIL permission check", tables("EmailLog")),
	"notifications.health.email_log": runtime("Readiness: the email log is reachable", tables("EmailLog")),
	"outbox.retention": runtime("Purge outbox rows published (or dead-lettered) longer ago than their retention window", tables("OutboxEvent")),
	"tenant.enumerate": { description: "List active tenant ids for scheduler fan-out", role: "app_enumerator", scope: tables("Tenant"), audit: "call" },
	"tenancy.data_check": runtime(
		"CLI only (db:check-tenant-integrity): count child rows whose parent belongs to another tenant, read-only, before the composite foreign keys land",
		tables(
			"Location",
			"Membership",
			"MembershipLocationScope",
			"Reward",
			"RewardImage",
			"RewardLocationScope",
			"RewardRedemption",
			"RewardSale",
			"TenantApiKey",
			"TenantInvitationLocationScope",
			"TenantTerminal",
		),
	),
	"tenancy.default_tenant.verify": runtime("Boot check: the single-tenant DEFAULT_TENANT_ID names a live tenant", tables("Tenant")),
	"auth.membership.lookup": runtime(
		"Resolve a tenant from its slug, a previous slug, or its id, and verify the caller's membership and location",
		tables("Membership", "MembershipLocationScope", "Tenant", "TenantSlugHistory", "Location"),
	),
	"auth.api_key.lookup": runtime(
		"Authenticate a merchant API key, confirm its terminal and the tenant's operating state, and record last use",
		tables("TenantApiKey", "TenantTerminal", "Tenant", "TenantMerchantProfile"),
	),
	"seed.demo_dataset": runtime(
		"CLI only (pnpm db:seed): write the demo dataset. Seed coverage (db:check-seed-coverage) requires every table to hold seeded rows, so the dataset writes every application table; no HTTP request or job can run under it",
		tables(...SEEDED_TABLES),
	),
	"seed.test_fixture": runtime(
		"Idempotent two-tenant e2e fixture (tenants A, B, S, customer C, platform admin P)",
		tables(
			"Role",
			"RolePermission",
			"User",
			"Tenant",
			"Location",
			"Membership",
			"MembershipLocationScope",
			"Reward",
			"RewardLocationScope",
			"RewardClaim",
			"TenantApiKey",
			"TenantTerminal",
			"RewardSale",
			"RewardRedemption",
		),
	),
	"geo.reference_data.read": runtime(
		"Read geo reference data (regions, subregions, countries, states, cities) after the GEO permission check",
		tables("Region", "Subregion", "Country", "State", "City"),
	),
	"geo.reference_data.write": runtime(
		"SuperAdmin create/update/soft-delete/import of geo reference data (bypass-only writes)",
		tables("Region", "Subregion", "Country", "State", "City", "AuditLog"),
	),
	"catalog.product_catalog.read": runtime("Read the bypass-only product and sample-category tables after the catalog permission check", tables("Product", "SampleCategory")),
	"catalog.product_catalog.write": runtime(
		"Create, revise, soft-delete or restore bypass-only product and sample-category rows after the catalog permission check",
		tables("Product", "SampleCategory", "OutboxEvent"),
	),
	// ── Operations console (ADR 068): bypass-only platform tables, after the route's permission check ──
	"operations.agent.report": routinePoller(
		"A server agent's report, authenticated by its own token (not a session): find the server by the token's digest, record its host facts and last-seen time, and its finished minute",
		tables("OpsServer", "OpsServerSample"),
	),
	"operations.console.read": runtime(
		"Read the operations console — servers, metric history, alerts, settings, backups and load tests, with the names of who asked for them — after the SERVER_METRIC / DATABASE_BACKUP / LOAD_TEST permission check",
		tables(
			"OpsServer",
			"OpsServerSample",
			"OpsInstanceSample",
			"OpsDependencySample",
			"OpsAlert",
			"OpsSettings",
			"OpsBackup",
			"LoadTestRun",
			"LoadTestPoint",
			"LoadTestStepStat",
			"User",
			"Tenant",
		),
	),
	"operations.servers.write": runtime(
		"SuperAdmin: register a server, rotate its agent token or revoke it (reading the alert settings for the server's health in the answer)",
		tables("OpsServer", "OpsSettings"),
	),
	"operations.settings.write": runtime("SuperAdmin: change the alert thresholds and recipients, the backup schedule or the load-test caps", tables("OpsSettings")),
	"operations.monitor.collect": routinePoller(
		"Once a minute, on one instance: record the dependencies' minute, evaluate the alert rules against servers, instances, dependencies and endpoints, open / update / resolve alerts and request their emails to the SuperAdmins and the extra recipients",
		tables("OpsServer", "OpsServerSample", "OpsDependencySample", "OpsAlert", "OpsSettings", "User", "EmailLog", "OutboxEvent"),
	),
	"operations.instance.record": routinePoller("Once a minute, each instance: write its own finished minute of process and request metrics", tables("OpsInstanceSample")),
	"operations.history.maintain": routinePoller(
		"Hourly: roll the past hour's minute rows up into hourly rows, and remove history past its retention (minutes 7 days, hours 1 year)",
		tables("OpsServerSample", "OpsInstanceSample", "OpsDependencySample"),
	),
	"operations.backup.write": runtime(
		"SuperAdmin: queue a backup, pin or unpin one, delete one, or change the backup schedule, after the DATABASE_BACKUP permission check",
		tables("OpsBackup", "OpsSettings", "User"),
	),
	"operations.backup.run": runtime(
		"BullMQ worker: take a queued backup (or queue the scheduled one) and record how it went; prune backups past their retention",
		tables("OpsBackup", "OpsSettings"),
	),
	"load_test.write": runtime(
		"Start, abort or configure a load test after the LOAD_TEST permission check; provision the Load Test tenant, its store, roles, rewards and load-test users on first use",
		tables(
			"LoadTestRun",
			"OpsSettings",
			"User",
			"UserRole",
			"Role",
			"RolePermission",
			"Permission",
			"Tenant",
			"Location",
			"Membership",
			"MembershipLocationScope",
			"Reward",
			"RewardLocationScope",
			"RewardLegalAcceptance",
			"TenantMerchantProfile",
		),
	),
	"load_test.record": runtime(
		"Record a load test's progress and outcome as the load runner reports it, with the servers' CPU for its automatic abort",
		tables("LoadTestRun", "LoadTestPoint", "LoadTestStepStat", "OpsServer", "OpsServerSample"),
	),
	"load_test.purge": runtime(
		"SuperAdmin: HARD-delete what load tests created — the load-test users' sessions, claims and their redemptions, sales, challenges and notifications, and the rewards they created (the users, their store, roles and legal acceptances stay for the next run) — inside the Load Test tenant only (ADR 068, exception 2)",
		tables(
			"Tenant",
			"User",
			"RefreshToken",
			"TwoFactorLoginChallenge",
			"Reward",
			"RewardLocationScope",
			"RewardImage",
			"RewardAuditLog",
			"RewardClaim",
			"RewardOtpChallenge",
			"RewardNotification",
			"RewardRedemption",
			"RewardSale",
			"LoadTestRun",
		),
	),
	"kanban.board.read": runtime(
		"Read the bypass-only kanban boards (columns, items, comments, attachments, checklists, links, watchers, history) with their people's names and the attached files, after the KANBAN_TASK permission check",
		tables(
			"KanbanPlanningColumn",
			"KanbanExecutionColumn",
			"KanbanTask",
			"KanbanTaskComment",
			"KanbanTaskAttachment",
			"KanbanChecklistItem",
			"KanbanTaskWatcher",
			"KanbanTaskLink",
			"KanbanTaskActivity",
			"User",
			"StoredFile",
		),
	),
	"kanban.board.write": runtime(
		"Create, edit, move or soft-delete kanban items (keyed from the level counters), reorder or limit columns, comment, attach a READY file the caller uploaded (row-locked), edit checklists, links and watchers, and record each change's history, under the board lock, after the KANBAN_TASK permission check",
		tables(
			"KanbanPlanningColumn",
			"KanbanExecutionColumn",
			"KanbanLevelCounter",
			"KanbanTask",
			"KanbanTaskComment",
			"KanbanTaskAttachment",
			"KanbanChecklistItem",
			"KanbanTaskWatcher",
			"KanbanTaskLink",
			"KanbanTaskActivity",
			"User",
			"StoredFile",
		),
	),
	"authorization.capability_catalog.sync": runtime(
		"API boot: converge the PLATFORM capability definitions to the permission catalog — creates missing rows and corrects changed ones, writes nothing else",
		tables("CapabilityDefinition", "Permission"),
	),
	"authorization.capability_catalog.read": runtime("Read the capability catalog for an authenticated caller", tables("CapabilityDefinition")),
	"authorization.permission_registry.sync": runtime(
		"API boot: insert missing code-registry permissions and correct changed metadata (registry → database only, never deletes), under the catalog-sync advisory lock",
		tables("Permission"),
	),
	"reference_data.sync": runtime(
		"CLI/seed only (db:sync-reference-data): converge the platform reference data — permission catalog, system roles, their grants and the merchant capability catalog — one section per transaction, with an audit row per change",
		tables("Permission", "Role", "RolePermission", "CapabilityDefinition", "PermissionAuditLog"),
	),

	"queue.email.send": runtime("BullMQ worker: send one queued email", tables("EmailLog", "EmailDeliveryEvent", "OutboxEvent")),
	"queue.storage.cleanup": runtime(
		"BullMQ worker: expire abandoned uploads",
		tables("StoredFile", "FileVariant", "TenantAsset", "TenantKybFile", "UserAvatar", "ProductImage", "RewardImage", "Reward"),
	),
	"queue.storage.delete": runtime("BullMQ worker: delete a stored object from object storage and purge its CDN copies (no database access)", NO_TABLES),
	"queue.rewards.auto_publish": runtime(
		"BullMQ worker: publish scheduled rewards",
		tables("Reward", "RewardImage", "RewardLocationScope", "Location", "RewardAuditLog", "RewardNotification", "OutboxEvent"),
	),
	"queue.claims.expire_pending": runtime(
		"BullMQ worker: expire pending reward claims",
		tables("RewardClaim", "Reward", "RewardImage", "RewardLocationScope", "Location", "RewardAuditLog", "OutboxEvent"),
	),
	"queue.claims.expire_referrer": runtime(
		"BullMQ worker: expire referrer reward claims",
		tables("RewardClaim", "Reward", "RewardImage", "RewardLocationScope", "Location", "RewardAuditLog", "OutboxEvent"),
	),
	"claims.otp.request": runtime(
		"Read a claimable reward and the customer, store the claim code, and request the code email",
		tables("Reward", "RewardImage", "RewardLocationScope", "Location", "User", "RewardOtpChallenge", "EmailLog", "OutboxEvent"),
	),
	"claims.reward.claim": runtime(
		"Lock the customer, spend the claim code, check the merchant operates and has not banned the customer, reserve one unit, attach a referral, and store the claim with the verified phone",
		tables(
			"RewardLegalAcceptance",
			"User",
			"RewardOtpChallenge",
			"Reward",
			"RewardImage",
			"RewardLocationScope",
			"Location",
			"RewardReferral",
			"RewardClaim",
			"Tenant",
			"TenantCustomerBan",
		),
	),
	"rewards.referral_credit.deliver": runtime(
		"Read a credited referral's referrer email and mark it notified — whoever triggered the delivery (the POS checkout right after commit, or the retry job)",
		tables("RewardReferral", "RewardClaim", "Reward", "RewardLocationScope", "Location", "User", "EmailLog", "OutboxEvent"),
	),
	"marketplace.published_rewards.read": runtime(
		"Read published consumer rewards for the public marketplace, including their images, stores and the merchant named by a city filter",
		tables("Reward", "RewardImage", "StoredFile", "FileVariant", "RewardLocationScope", "Location", "Tenant", "TenantMerchantProfile"),
	),
	"rewards.admin_review": runtime(
		"Review a consumer reward across tenants: the moderation queue, the decision, its audit row, the owners' notice and the image download",
		tables("Reward", "RewardImage", "StoredFile", "FileVariant", "RewardLocationScope", "Location", "RewardAuditLog", "RewardNotification", "OutboxEvent"),
	),
	"reporting.platform_analytics.read": runtime(
		"Read platform-wide sales and reward analytics for an admin",
		tables("RewardSale", "RewardRedemption", "RewardClaim", "Reward", "RewardLocationScope", "Location", "Tenant", "TenantMerchantProfile", "RewardReferral"),
	),
	"maintenance.permission_expiry": runtime("Cron: revoke expired temporary permissions", tables("UserPermission", "User", "UserRole", "PermissionAuditLog", "RefreshToken")),
	"maintenance.audit_log_retention": runtime("Cron: purge permission audit rows past retention", tables("PermissionAuditLog")),
	"maintenance.password_reset_token_cleanup": runtime("Cron: delete expired password reset tokens", tables("PasswordResetToken")),
	"maintenance.mfa_recovery_unlock": runtime(
		"Cron: apply due MFA recovery unlocks",
		tables("MfaRecoveryRequest", "MfaRecoveryAuditLog", "User", "BackupCode", "TwoFactorPendingSetup", "EmailLog", "OutboxEvent"),
	),
	"maintenance.authorization_change_sweep": runtime(
		"Every instance, every few seconds: read the recent User.authorizationChangedAt stamps to drop cached authorization an after-commit invalidation missed",
		tables("User"),
	),
	"maintenance.signup_referral_codes": runtime(
		"Cron: issue the first signup referral code to every non-deleted user without one, and a successor after a code expires, each under that user's row lock, with a system audit row (ADR 035)",
		tables("User", "SignupReferralCode", "RewardAuditLog"),
	),

	"auth.profile.update": runtime(
		"A user edits their OWN profile (optimistic-lock conditional update scoped to their id), with the request's audit row in the bypass-only audit table, in one transaction",
		tables("User", "UserAvatar", "StoredFile", "FileVariant", "AuditLog"),
	),
	"auth.account.lookup": runtime("Read an account by email or id, including the check that an email is already registered", tables("User")),
	"auth.admin_users.read": runtime("Read the platform admin user list and one account's security fields after the USER permission check", tables("User")),
	"auth.admin_users.unlock": runtime("Clear a locked account's failed-attempt counter for a platform administrator", tables("User")),
	"auth.admin_users.ban": runtime(
		"A platform admin bans an account (deactivate + ban columns, compare-and-set on tokenVersion) and revokes every device session, after the DELETE USER check",
		tables("User", "RefreshToken", "OutboxEvent"),
	),
	"auth.admin_users.unban": runtime("A platform admin lifts an account's ban (compare-and-set on the ban), after the DELETE USER check", tables("User")),
	"auth.principal.lookup": runtime(
		"Read an account, its roles, grants, location roles, and recently revoked sessions, or whether an impersonation session is still live",
		tables(
			"User",
			"UserRole",
			"Role",
			"RolePermission",
			"Permission",
			"UserPermission",
			"Membership",
			"MembershipLocationScope",
			"Location",
			"Tenant",
			"RefreshToken",
			"ImpersonationSession",
		),
	),
	"auth.merchant_portal.lookup": runtime(
		"Read whether a signing-in account belongs to a merchant tenant or has a pending team invite",
		tables("Membership", "Tenant", "TenantMerchantProfile", "TenantInvitation"),
	),
	"auth.login.record_failure": runtime("Count a failed password sign-in and, on lockout, request the account-locked email", tables("User", "EmailLog", "OutboxEvent")),
	"auth.login.clear_lockout": runtime("Clear a successful password sign-in's failed-attempt counter", tables("User")),
	"auth.login.open_challenge": runtime("Open the two-factor challenge for a password that matched", tables("TwoFactorLoginChallenge")),
	"auth.login.request_device_code": runtime("Read the account and request the new-device login code email", tables("User", "EmailLog", "OutboxEvent")),
	"auth.login.complete_mfa": runtime(
		"Consume a passed second factor, record the TOTP step or used backup code, clear the lockout, and stamp MFA assurance",
		tables("User", "TwoFactorLoginChallenge", "TwoFactorPendingSetup", "BackupCode"),
	),
	"auth.login.record_mfa_failure": runtime(
		"Count a wrong authenticator code and, once the challenge is exhausted, count the failed sign-in and request the lockout email",
		tables("User", "TwoFactorLoginChallenge", "EmailLog", "OutboxEvent"),
	),
	"auth.session.issue": runtime("Lock the account, record MFA assurance when required, and store the new session while sweeping expired ones", tables("User", "RefreshToken")),
	"auth.password_reset.request": runtime(
		"Expire older reset links, store a new one, and request the reset email when the account can reset its password",
		tables("User", "PasswordResetToken", "EmailLog", "OutboxEvent"),
	),
	"auth.password_reset.lookup": runtime("Read an unused, unexpired password-reset link by its digest", tables("PasswordResetToken")),
	"auth.password_reset.complete": runtime(
		"Consume the reset link, replace the password, record it in the history, sign out every session, and request the password-changed email",
		tables("User", "PasswordResetToken", "PasswordHistory", "RefreshToken", "EmailLog", "OutboxEvent"),
	),
	"auth.signup.register": runtime(
		"Create the account, its first referral code and default role, request the verification email, and attach an accepted signup referral",
		tables("User", "SignupReferralCode", "SignupReferral", "Role", "UserRole", "UserPermission", "PermissionAuditLog", "EmailLog", "OutboxEvent"),
	),
	"auth.email_verification.send": runtime("Read an unverified account and request its verification email", tables("User", "EmailLog", "OutboxEvent")),
	"auth.email_verification.confirm": runtime("Mark an account's email verified", tables("User")),
	"auth.impersonation.start": runtime(
		"Lock the administrator, open one impersonation session with its start audit row, and record the impersonation event",
		tables("User", "ImpersonationSession", "ImpersonationAuditLog", "OutboxEvent"),
	),
	"auth.impersonation.stop": runtime(
		"Read the administrator and their live device session, end the impersonation with its stop audit row, and record the impersonation event",
		tables("User", "RefreshToken", "ImpersonationSession", "ImpersonationAuditLog", "OutboxEvent"),
	),
	"auth.signup_referrals.validate_code": runtime("Read a signup referral code and its owner's account state before signup accepts it", tables("User", "SignupReferralCode")),
	"auth.signup_referrals.list_referees": runtime(
		"Read referee display names for the authenticated referrer's signup-referral list (`users` RLS is self-only); only after the caller is bound to their own referrer id",
		tables("User", "SignupReferral"),
	),
	"auth.signup_referrals.admin_summary": runtime(
		"Read referral status and the referrer's name for a page of accounts on the admin user list",
		tables("User", "SignupReferral"),
	),
	"auth.signup_referrals.notify_success": runtime(
		"Claim a successful signup referral's owed notification and write it to the referrer's in-app inbox with the referee's current name — after the POS checkout that stamped it, or from the hourly retry pass (ADR 035)",
		tables("SignupReferral", "User", "RewardNotification"),
	),
	"auth.mfa_recovery.list": runtime("Read the platform admin MFA recovery queue, including each requester's name and email", tables("MfaRecoveryRequest", "User")),
	"auth.mfa_recovery.request": runtime(
		"A user opens an MFA recovery request, with its audit row in the bypass-only platform audit table",
		tables("User", "MfaRecoveryRequest", "MfaRecoveryAuditLog", "EmailLog", "OutboxEvent"),
	),
	"auth.mfa_recovery.review": runtime(
		"A SuperAdmin (never the requester) approves or denies a pending MFA recovery request, with its audit row in the bypass-only platform audit table",
		tables("MfaRecoveryRequest", "MfaRecoveryAuditLog", "User", "EmailLog", "OutboxEvent"),
	),
	"auth.superadmin.bootstrap": runtime(
		"CLI only (admin:bootstrap-superadmin): create the platform's FIRST SuperAdmin — the no-active-SuperAdmin check, the user, the SuperAdmin role assignment and both audit rows in one transaction under an advisory lock",
		tables("User", "Role", "UserRole", "UserPermission", "SignupReferralCode", "PermissionAuditLog"),
	),

	"tenant.provision.platform_invite": runtime(
		"Provision a tenant from a platform invitation",
		tables("Role", "RolePermission", "Tenant", "TenantMerchantProfile", "TenantPlacement", "TenantLifecycleEvent", "TenantInvitation", "AuthorizationAudit", "TenantAuditLog"),
	),
	"tenant.provision.admin_merchant_invite": runtime(
		"A platform admin invites a merchant (tenant + invitation)",
		tables(
			"Role",
			"RolePermission",
			"Tenant",
			"TenantSlugHistory",
			"TenantMerchantProfile",
			"TenantPlacement",
			"TenantLifecycleEvent",
			"TenantInvitation",
			"AuthorizationAudit",
			"TenantAuditLog",
			"EmailLog",
			"OutboxEvent",
		),
	),
	"tenant.access_request.create": runtime("Record a user's request to join a tenant", tables("Membership", "TenantAccessRequest", "TenantAuditLog")),
	"tenant.access_request.review": runtime(
		"Approve (create the membership) or reject a pending access request, after the reviewer's manage-team check",
		tables("TenantAccessRequest", "Location", "Membership", "MembershipLocationScope", "Role", "TenantAuditLog"),
	),
	"tenant.context.resolve_route_key": runtime(
		"Resolve a tenant slug/id from the URL before membership is known",
		tables("Tenant", "TenantSlugHistory", "Membership", "MembershipLocationScope"),
	),
	"tenant.context.location_access": runtime("Validate the caller's access to a tenant location", tables("Location")),
	"tenant.context.resolve_membership": runtime("Resolve the caller's tenant membership context", tables("Tenant", "TenantMerchantProfile")),
	"tenant.context.list_memberships": runtime("List the caller's tenant memberships", tables("Membership", "Tenant", "TenantMerchantProfile")),

	"tenant.membership.accept": runtime(
		"Accept a team member invitation and create the membership",
		tables("TenantInvitation", "TenantInvitationLocationScope", "Tenant", "Membership", "MembershipLocationScope", "Role", "TenantAuditLog"),
	),
	"tenant.membership.roster": runtime("Read member names and emails for the team roster (users RLS is self-only); only after the manage-team check", tables("User")),
	"tenant.invitation.create": runtime(
		"Create a team member invitation",
		tables("User", "Membership", "Location", "TenantInvitation", "TenantInvitationLocationScope", "TenantAuditLog", "EmailLog", "OutboxEvent"),
	),
	"tenant.invitation.revoke": runtime("Revoke a team member invitation", tables("TenantInvitation", "TenantInvitationLocationScope", "TenantAuditLog")),
	"tenant.membership.remove_from_location": runtime(
		"Remove a team member from one location: soft-delete its location scope row (and the location role it carries)",
		tables("Membership", "MembershipLocationScope", "TenantAuditLog"),
	),
	"tenant.invitation.resolve_token": runtime(
		"Resolve a team invitation from its token",
		tables("TenantInvitation", "Tenant", "TenantInvitationLocationScope", "Location", "User", "TenantMerchantProfile"),
	),
	"tenant.invitation.accept_merchant_onboarding": runtime(
		"Complete merchant onboarding in one transaction: the new owner account (with its referral code and default role) or the existing account's name, the claimed invitation, owner membership, merchant profile, locations, activation and audit rows",
		tables(
			"User",
			"SignupReferralCode",
			"Role",
			"UserRole",
			"UserPermission",
			"PermissionAuditLog",
			"TenantInvitation",
			"TenantInvitationLocationScope",
			"Tenant",
			"Membership",
			"MembershipLocationScope",
			"TenantAuditLog",
			"TenantMerchantProfile",
			"Location",
			"TenantLifecycleEvent",
		),
	),
	"tenant.invitation.submit_onboarding_documents": runtime(
		"Consume an accepted merchant onboarding invitation's single-use document window and attach the submitted KYB evidence",
		tables("TenantInvitation", "TenantInvitationLocationScope", "TenantMerchantProfile", "Tenant", "StoredFile", "TenantKybFile", "TenantAuditLog"),
	),
	"tenant.onboarding.document_file": runtime("Stage or read a KYB file for an accepted onboarding invite on the request connection", tables("StoredFile")),
	"tenant.invitation.register_and_accept": runtime(
		"Create the invitee's account and accept their team invitation in one transaction",
		tables(
			"User",
			"SignupReferralCode",
			"Role",
			"UserRole",
			"UserPermission",
			"PermissionAuditLog",
			"TenantInvitation",
			"TenantInvitationLocationScope",
			"Tenant",
			"Membership",
			"MembershipLocationScope",
			"TenantAuditLog",
		),
	),

	"tenant.location.admin_create": runtime("A platform admin creates a tenant store location", tables("Tenant", "TenantMerchantProfile", "Location", "TenantAuditLog")),
	"tenant.location.admin_review": runtime("A platform admin approves or rejects a store location request", tables("Location", "TenantAuditLog")),
	"tenant.location.admin_list": runtime("A platform admin lists pending store location requests", tables("Location", "Tenant")),
	"tenant.merchant.admin_read": runtime(
		"A platform admin reads merchant tenants (list, detail, KYB evidence with its stored-file metadata and download) across tenants, after the LIST MERCHANT_ORG check",
		tables("Tenant", "TenantMerchantProfile", "Membership", "User", "TenantKybFile", "StoredFile", "Location"),
	),
	"tenant.location.close": runtime(
		"A merchant closes one of its locations: soft-deletes it and its member scope rows, terminals and keys in one transaction",
		tables("Location", "MembershipLocationScope", "TenantTerminal", "TenantApiKey", "TenantAuditLog"),
	),
	"tenant.lifecycle.read": runtime(
		"Read a tenant's lifecycle state, current suspension and appeals (and resolve a lifecycle route's tenant for an active member), after the route's membership or MERCHANT_ORG check",
		tables("Tenant", "TenantSlugHistory", "Membership", "TenantLifecycleEvent", "TenantSuspensionAppeal", "User"),
	),
	"tenant.lifecycle.appeal": runtime(
		"A suspended tenant's owner appeals the suspension: the PENDING appeal plus its tenant audit row, after the manage_verification check",
		tables("Tenant", "TenantSuspensionAppeal", "TenantAuditLog"),
	),
	"tenant.lifecycle.reactivate": runtime(
		"The owner reactivates a tenant pending deletion within its grace period: compare-and-set on the lifecycle state, lifecycle event and tenant audit row",
		tables("Tenant", "TenantSlugHistory", "Membership", "TenantLifecycleEvent", "TenantAuditLog"),
	),
	"tenant.membership.leave": runtime(
		"A member leaves a tenant (any membership status): soft-delete the membership and its location scope rows, with the tenant audit row",
		tables("Tenant", "TenantSlugHistory", "Membership", "MembershipLocationScope", "TenantAuditLog"),
	),
	"tenant.lifecycle.admin_suspend": runtime(
		"A platform admin suspends a tenant: compare-and-set on the lifecycle state, lifecycle event and tenant audit row, after the SUSPEND MERCHANT_ORG check",
		tables("Tenant", "TenantLifecycleEvent", "TenantAuditLog"),
	),
	"tenant.lifecycle.admin_ban": runtime(
		"A super admin bans a tenant and closes its pending suspension appeal: compare-and-set on the lifecycle state, lifecycle event and tenant audit row, after the super-admin check",
		tables("Tenant", "TenantLifecycleEvent", "TenantSuspensionAppeal", "TenantAuditLog"),
	),
	"tenant.lifecycle.admin_unban": runtime(
		"A super admin lifts a tenant's ban: compare-and-set on the lifecycle state, lifecycle event and tenant audit row, after the super-admin check",
		tables("Tenant", "TenantLifecycleEvent", "TenantAuditLog"),
	),
	"tenant.customer_ban.create": runtime(
		"A merchant bans the customer behind one of its redemptions at the caller's stores: the active ban plus its tenant audit row, after the manage_rewards check",
		tables("RewardRedemption", "RewardClaim", "Reward", "TenantCustomerBan", "TenantAuditLog"),
	),
	"tenant.customer_ban.lift": runtime(
		"A merchant lifts one of its customer bans (compare-and-set on the ban still being active) with its tenant audit row, after the manage_rewards check",
		tables("TenantCustomerBan", "TenantAuditLog"),
	),
	"tenant.customer_ban.read": runtime(
		"Read a tenant's customer bans with the member who made each and the redemption it was made from, after the manage_rewards check",
		tables("TenantCustomerBan", "User", "RewardRedemption", "RewardClaim", "Reward"),
	),
	"tenant.lifecycle.admin_reinstate": runtime(
		"A platform admin reinstates a suspended tenant and accepts its pending appeal, with the lifecycle event and tenant audit row, after the REACTIVATE MERCHANT_ORG check",
		tables("Tenant", "TenantLifecycleEvent", "TenantSuspensionAppeal", "TenantAuditLog"),
	),
	"tenant.lifecycle.admin_reject_appeal": runtime(
		"A platform admin rejects a tenant's pending appeal (compare-and-set on PENDING) with the tenant audit row, after the REJECT MERCHANT_ORG check",
		tables("TenantSuspensionAppeal", "TenantAuditLog"),
	),
	"tenant.kyb.admin_decide": runtime(
		"A platform admin decides a merchant's KYB review: locked compare-and-set on the merchant profile plus the tenant audit row, after the APPROVE MERCHANT_ORG check",
		tables("TenantMerchantProfile", "Tenant", "TenantAuditLog"),
	),
	"tenant.display_data.read": runtime(
		"Read tenant names and logos (and owner user ids) for display by other contexts; the caller authorized the records that reference them",
		tables("Tenant", "TenantAsset", "StoredFile", "FileVariant", "Membership"),
	),

	"encryption.tenant_key.provision": runtime("Create or ensure a tenant's tenant encryption key", tables("TenantEncryptionKey", "TenantAuditLog")),
	"encryption.tenant_key.rewrap": runtime(
		"Maintenance: re-wrap tenant data keys to the current key-encryption key (compare-and-swap + audit row); SuperAdmin actor only",
		tables("TenantEncryptionKey", "TenantAuditLog", "User"),
	),

	"support_access.grant": runtime("Create a support access grant", tables("Tenant", "SupportAccessGrant", "TenantAuditLog")),
	"support_access.approve": runtime(
		"A tenant OWNER approves a pending support access grant (bypass-write table) — the tenant comes from the grant record and the owner membership is verified in the same transaction",
		tables("Membership", "User", "SupportAccessGrant", "TenantAuditLog"),
	),
	"support_access.revoke": runtime("Revoke a support access grant", tables("SupportAccessGrant", "TenantAuditLog")),
	"support_access.verify": runtime("Verify an active support access grant", tables("SupportAccessGrant")),
	"support_access.admin_read": runtime(
		"List support access grants with their tenants and people for a platform SuperAdmin, after the READ USER check",
		tables("SupportAccessGrant", "Tenant", "User"),
	),
	"support_access.tenant_read": runtime(
		"List one tenant's support access grants for its active owner (the owner check runs in the same read)",
		tables("SupportAccessGrant", "Tenant", "TenantSlugHistory", "Membership", "User"),
	),
	"referrals.reward_link.create": runtime(
		"Lock the signed-in referrer, check the reward can be shared, count their unused links and insert one PENDING reward referral",
		tables("User", "Reward", "RewardReferral"),
	),
	"referrals.attribution.record": runtime(
		"Read a PENDING reward referral by the link's token and store it as the signed-in referee's pending attribution",
		tables("RewardReferral", "User"),
	),
	"maintenance.support_access_expiry": runtime(
		"Maintenance: mark non-terminal support access grants past their expiry EXPIRED (compare-and-set on the loaded status)",
		tables("SupportAccessGrant"),
	),

	"authorization.rbac.mutate": runtime(
		"One RBAC change (roles, permissions, assignments) with its session revocation and permission audit row, in one transaction — only after the route permission + privilege-escalation checks; catalog tables are bypass-write",
		tables("Role", "RolePermission", "Permission", "UserRole", "UserPermission", "User", "Membership", "MembershipLocationScope", "PermissionAuditLog", "RefreshToken"),
	),
	"authorization.rbac.inspect": runtime(
		"Read a target user's role assignments and direct grants (own-row RLS) for an RBAC preview or conflict check — only after the route permission check",
		tables("UserRole", "Role", "RolePermission", "Permission", "UserPermission", "Membership", "MembershipLocationScope"),
	),
	"authorization.permission_holders.read": runtime(
		"Read who holds one platform permission (role grants down the role hierarchy, location roles, live direct overrides, SuperAdmins; active accounts only) for another context's picker or check — only after that context's route permission check",
		tables("User", "UserRole", "Role", "RolePermission", "Permission", "UserPermission", "Membership", "MembershipLocationScope"),
	),
	"authorization.rbac.catalog.read": runtime(
		"Read the role and permission catalog for the admin lists — only after the ROLE or PERMISSION permission check",
		tables("Role", "Permission"),
	),
	"authorization.health.system_roles": runtime("Readiness: every platform role the code depends on exists as a live system role", tables("Role")),
	"authorization.audit_log.read": runtime(
		"Read the bypass-only permission_audit_logs table for the admin audit viewer — only after the AUDIT_LOG:READ check",
		tables("PermissionAuditLog"),
	),
	"authorization.access.facts": runtime(
		"Read what one decision needs: the caller's role permissions, stores, grants and shares (or an approved support grant), and who owns the record in question (ADR 067)",
		tables(
			"Membership",
			"MembershipLocationScope",
			"Location",
			"Role",
			"RolePermission",
			"Permission",
			"UserRole",
			"UserPermission",
			"ResourceAcl",
			"SupportAccessGrant",
			"User",
			"RewardClaim",
		),
	),
	"authorization.tenant_access.write": runtime(
		"Administer a tenant's own access after the decision service allowed it: its roles, members' roles, grants and shares, with their audit rows (ADR 067)",
		tables(
			"User",
			"Tenant",
			"Role",
			"RolePermission",
			"Permission",
			"Membership",
			"MembershipLocationScope",
			"Location",
			"UserPermission",
			"ResourceAcl",
			"Reward",
			"RewardLocationScope",
			"TenantAuditLog",
		),
	),
	"authorization.superadmin_bypass.audit": runtime("Record that a superadmin skipped the route permission check", tables("PermissionAuditLog")),

	"pos.terminal.pair": runtime(
		"POST /integration/terminals/pair: the till has no credential yet — find the terminal by its one-time code, mint its POS key, bind it (the code is the only authorization)",
		tables("TenantTerminal", "Tenant", "TenantMerchantProfile", "TenantApiKey", "RewardAuditLog", "Location"),
	),
	"rewards.sales.merchant_summary": runtime(
		"Read merchant names/categories for sales breakdowns (customer spending, admin top merchants) — ids come from sales the caller may already see",
		tables("Tenant", "TenantMerchantProfile"),
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
		"Soft-delete a stored file and the binding rows that reference it, after the caller's permission check (product images and kanban task attachments are bypass-only); a released kanban attachment is recorded in its item's history under the deleting user",
		tables("StoredFile", "FileVariant", "ProductImage", "KanbanTaskAttachment", "KanbanTaskActivity", "User"),
	),
	"files.authorization": runtime("Resolve the caller's tenant membership role to authorize a file operation", tables("Membership", "Tenant", "StoredFile")),
	"files.scan_verdict.apply": runtime(
		"Apply a malware-scan verdict to an uploaded file (state transition, resource binding) together with every category listener's reaction (e.g. KYB review status) in one transaction",
		tables("StoredFile", "FileVariant", "TenantAsset", "UserAvatar", "Product", "ProductImage", "Tenant", "TenantMerchantProfile", "TenantKybFile"),
	),
	"files.local_object.read": runtime("Read a stored file for a signed local-storage download or upload ticket", tables("StoredFile")),
	"files.local_variant.read": runtime("Read a public file's rendition for local storage", tables("StoredFile", "FileVariant")),
	"kanban.board.convert": runtime(
		"CLI only (pnpm db:kanban-convert): the one-off board conversion — key every item, split the shared columns into planning and execution columns, triage planning items, turn task checklists into subtask items — under the board lock, each stage recorded",
		tables(
			"KanbanColumn",
			"KanbanPlanningColumn",
			"KanbanExecutionColumn",
			"KanbanLevelCounter",
			"KanbanConversionStage",
			"KanbanTask",
			"KanbanChecklistItem",
			"KanbanTaskWatcher",
			"KanbanTaskActivity",
		),
	),
	"seed.github_link.carry": runtime("Export or import the superadmin GitHub account link across a baseline reset, ciphertext unchanged", tables("GithubAccountLink", "User")),
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
