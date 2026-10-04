import { z } from "zod";

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
// Adding a name: add it to `SystemOperationSchema` AND to `SYSTEM_OPERATIONS`
// (the `Record` type makes a missing definition a compile error), give it the
// narrowest role that works, and document it in
// docs/technical/authorization/tenancy-and-rls.md §3.1.

/**
 * PostgreSQL roles a system operation may run as. Every role is created in
 * prisma/rls/00-app-helpers.sql (NOLOGIN, NOBYPASSRLS — policies always apply)
 * and granted in prisma/rls/99-app-runtime-grants.sql.
 */
export const DatabaseRoleSchema = z.enum([
	/** The application role: DML on every table, filtered by RLS policies. */
	"app_runtime",
	/** Read-only role for cross-tenant schedulers: SELECT on `organizations` (and what its policy reads) only. */
	"app_enumerator",
]);
export type DatabaseRole = z.output<typeof DatabaseRoleSchema>;

/** The role every non-system (user, anonymous) database session runs as. */
export const DEFAULT_DATABASE_ROLE: DatabaseRole = "app_runtime";

/** The closed set of allowlisted operation names. */
export const SystemOperationSchema = z.enum([
	// ── HTTP request phases ──────────────────────────────────────────────
	"request.pre_handler",
	"route.rls_bypass",
	"platform.superadmin",
	"platform.staff_single_tenant",
	// ── Platform infrastructure ──────────────────────────────────────────
	"audit.http_request.record",
	"http.idempotency",
	"idempotency.retention",
	"outbox.publish",
	"outbox.enqueue",
	"outbox.retention",
	"email.log.write",
	"tenant.enumerate",
	"tenancy.default_organization.verify",
	"geo.reference_data.write",
	"reference_data.sync",
	// ── Background jobs (one per queue / schedule) ───────────────────────
	"queue.email.send",
	"queue.storage.cleanup",
	"queue.storage.delete",
	"queue.storage.scan",
	"queue.rewards.auto_publish",
	"queue.claims.expire_pending",
	"queue.claims.expire_referrer",
	"queue.rewards.referral_credit_notify",
	"rewards.referral_credit.deliver",
	"maintenance.permission_expiry",
	"maintenance.audit_log_retention",
	"maintenance.password_reset_token_cleanup",
	"maintenance.mfa_recovery_unlock",
	// ── Account security ─────────────────────────────────────────────────
	"auth.profile.update",
	"auth.mfa_recovery.request",
	"auth.mfa_recovery.review",
	"auth.superadmin.bootstrap",
	// ── Organization lifecycle ───────────────────────────────────────────
	"organization.provision.platform_invite",
	"organization.provision.admin_merchant_invite",
	"organization.lifecycle.transition",
	"organization.erase",
	"organization.access_request.create",
	"organization.access_request.review",
	"organization.context.resolve_route_key",
	"organization.context.location_access",
	"organization.reward_hub.resolve_context",
	"organization.reward_hub.list_memberships",
	// ── Organization membership & invitations ────────────────────────────
	"organization.membership.accept",
	"organization.membership.roster",
	"organization.invitation.create",
	"organization.invitation.revoke",
	"organization.membership.remove_from_store",
	"organization.invitation.resolve_token",
	"organization.invitation.accept_merchant_onboarding",
	"organization.invitation.submit_onboarding_documents",
	"organization.invitation.check_existing_membership",
	"organization.invitation.preview_account",
	"organization.invitation.check_registration_account",
	"organization.invitation.validate_location_scope",
	"organization.invitation.resolve_location_labels",
	"organization.invitation.register_and_accept",
	// ── Organization locations ───────────────────────────────────────────
	"organization.location.admin_create",
	"organization.location.admin_review",
	"organization.location.admin_list",
	"organization.location.close",
	// ── Tenant encryption ────────────────────────────────────────────────
	"encryption.tenant_key.provision",
	"encryption.tenant_key.unwrap",
	"encryption.tenant_key.rewrap",
	// ── Support access ───────────────────────────────────────────────────
	"support_access.grant",
	"support_access.approve",
	"support_access.revoke",
	"support_access.verify",
	// ── Authorization administration (RBAC) ──────────────────────────────
	"authorization.rbac.mutate",
	"authorization.rbac.inspect",
	"authorization.audit_log.read",
	// ── Authorization policy control plane ───────────────────────────────
	"policy.draft.create",
	"policy.draft.simulate",
	"policy.simulation.record",
	"policy.publish",
	"policy.bundle.load",
	// ── Domain reads that RLS cannot express for the caller ──────────────
	"rewards.sales.merchant_summary",
	"pos.terminal.pair",
	"files.authorization",
	"files.scan_verdict.apply",
]);
export type SystemOperation = z.output<typeof SystemOperationSchema>;

/** What an allowlisted operation is for, and the role it runs as. */
export interface SystemOperationDefinition {
	readonly description: string;
	readonly role: DatabaseRole;
}

const runtime = (description: string): SystemOperationDefinition => ({ description, role: "app_runtime" });

/** Definition of every allowlisted operation — `Record` makes a missing entry a compile error. */
export const SYSTEM_OPERATIONS: Readonly<Record<SystemOperation, SystemOperationDefinition>> = {
	"request.pre_handler": runtime("Authentication + authorization lookups in guards, before the RLS interceptor narrows the request"),
	"route.rls_bypass": runtime("Handler explicitly decorated with @RlsBypass() (public cross-tenant flows)"),
	"platform.superadmin": runtime("Platform super-admin request scope"),
	"platform.staff_single_tenant": runtime("Admin staff request scope in single-tenant mode"),

	"audit.http_request.record": runtime("Append the global HTTP audit entry of a state-changing request (bypass-only audit_logs table)"),
	"http.idempotency": runtime("Acquire, replay, complete and release Idempotency-Key records (bypass-only idempotency table)"),
	"idempotency.retention": runtime("Purge Idempotency-Key records expired past their retention grace"),
	"outbox.publish": runtime("Outbox dispatcher: claim, publish and advance outbox rows"),
	"outbox.enqueue": runtime("Record a platform telemetry event that has no domain write of its own"),
	"email.log.write": runtime("Record outbound email attempts, their send outcome and verified delivery-webhook events (bypass-only email tables)"),
	"outbox.retention": runtime("Purge outbox rows published (or dead-lettered) longer ago than their retention window"),
	"tenant.enumerate": { description: "List active organization ids for scheduler fan-out", role: "app_enumerator" },
	"tenancy.default_organization.verify": runtime("Boot check: the single-tenant DEFAULT_ORGANIZATION_ID names a live organization"),
	"geo.reference_data.write": runtime("SuperAdmin create/update/soft-delete/import of geo reference data (bypass-only writes)"),
	"reference_data.sync": runtime(
		"CLI/seed only (db:sync-reference-data): converge the platform reference data — permission catalog, system roles, their grants and the merchant capability catalog — one section per transaction, with an audit row per change",
	),

	"queue.email.send": runtime("BullMQ worker: send one queued email"),
	"queue.storage.cleanup": runtime("BullMQ worker: expire abandoned uploads"),
	"queue.storage.delete": runtime("BullMQ worker: delete a stored object and its variants"),
	"queue.storage.scan": runtime("BullMQ worker: malware-scan an uploaded file and apply the verdict (READY + binding, QUARANTINED or FAILED)"),
	"queue.rewards.auto_publish": runtime("BullMQ worker: publish scheduled rewards"),
	"queue.claims.expire_pending": runtime("BullMQ worker: expire pending reward claims"),
	"queue.claims.expire_referrer": runtime("BullMQ worker: expire referrer reward claims"),
	"queue.rewards.referral_credit_notify": runtime("BullMQ worker: deliver pending referrer-reward-credited emails"),
	"rewards.referral_credit.deliver": runtime("Read a credited referral's referrer email and mark it notified — whoever triggered the delivery (the POS checkout right after commit, or the retry job)"),
	"maintenance.permission_expiry": runtime("Cron: revoke expired temporary permissions"),
	"maintenance.audit_log_retention": runtime("Cron: purge permission audit rows past retention"),
	"maintenance.password_reset_token_cleanup": runtime("Cron: delete expired password reset tokens"),
	"maintenance.mfa_recovery_unlock": runtime("Cron: apply due MFA recovery unlocks"),

	"auth.profile.update": runtime(
		"A user edits their OWN profile (optimistic-lock conditional update scoped to their id), with the request's audit row in the bypass-only audit table, in one transaction",
	),
	"auth.mfa_recovery.request": runtime("A user opens an MFA recovery request, with its audit row in the bypass-only platform audit table"),
	"auth.mfa_recovery.review": runtime(
		"A SuperAdmin (never the requester) approves or denies a pending MFA recovery request, with its audit row in the bypass-only platform audit table",
	),
	"auth.superadmin.bootstrap": runtime(
		"CLI only (admin:bootstrap-superadmin): create the platform's FIRST SuperAdmin — the no-active-SuperAdmin check, the user, the SuperAdmin role assignment and both audit rows in one transaction under an advisory lock",
	),

	"organization.provision.platform_invite": runtime("Provision an organization from a platform invitation"),
	"organization.provision.admin_merchant_invite": runtime("RewardHub admin invites a merchant (organization + invitation)"),
	"organization.lifecycle.transition": runtime("Move an organization between lifecycle states"),
	"organization.erase": runtime("Verified tenant erasure (tombstone the organization)"),
	"organization.access_request.create": runtime("Record a user's request to join an organization"),
	"organization.access_request.review": runtime("Approve (create the membership) or reject a pending access request, after the reviewer's manage-team check"),
	"organization.context.resolve_route_key": runtime("Resolve an organization slug/id from the URL before membership is known"),
	"organization.context.location_access": runtime("Validate the caller's access to an organization location"),
	"organization.reward_hub.resolve_context": runtime("Resolve the caller's RewardHub organization context"),
	"organization.reward_hub.list_memberships": runtime("List the caller's RewardHub organization memberships"),

	"organization.membership.accept": runtime("Accept a team member invitation and create the membership"),
	"organization.membership.roster": runtime("Read member names and emails for the team roster (users RLS is self-only); only after the manage-team check"),
	"organization.invitation.create": runtime("Create a team member invitation"),
	"organization.invitation.revoke": runtime("Revoke a team member invitation"),
	"organization.membership.remove_from_store": runtime("Remove a team member from one store: store membership soft delete + location scope row removal"),
	"organization.invitation.resolve_token": runtime("Resolve a team invitation from its token"),
	"organization.invitation.accept_merchant_onboarding": runtime(
		"Complete merchant onboarding in one transaction: claim the pending invitation, owner membership, merchant profile, locations, activation and audit row",
	),
	"organization.invitation.submit_onboarding_documents": runtime(
		"Consume an accepted merchant onboarding invitation's single-use document window and attach the submitted KYB evidence",
	),
	"organization.invitation.check_existing_membership": runtime("Check whether an invitee is already a member before inviting"),
	"organization.invitation.preview_account": runtime("Check whether an invitee already has an account (invite preview)"),
	"organization.invitation.check_registration_account": runtime("Check the invitee account before invite registration"),
	"organization.invitation.validate_location_scope": runtime("Validate the location scope of a team invitation"),
	"organization.invitation.resolve_location_labels": runtime("Resolve location labels shown on a team invitation"),
	"organization.invitation.register_and_accept": runtime("Create the invitee's account and accept their team invitation in one transaction"),

	"organization.location.admin_create": runtime("RewardHub admin creates an organization store location"),
	"organization.location.admin_review": runtime("RewardHub admin approves or rejects a store location request"),
	"organization.location.admin_list": runtime("RewardHub admin lists pending store location requests"),
	"organization.location.close": runtime("A merchant closes one of its stores: soft-deletes the store and revokes its memberships, terminals and keys in one transaction"),

	"encryption.tenant_key.provision": runtime("Create or ensure an organization's tenant encryption key"),
	"encryption.tenant_key.unwrap": runtime("Read the wrapped tenant data-encryption key (and append the decrypt audit row) to unwrap it"),
	"encryption.tenant_key.rewrap": runtime("Maintenance: re-wrap tenant data keys to the current key-encryption key (compare-and-swap + audit row); SuperAdmin actor only"),

	"support_access.grant": runtime("Create a support access grant"),
	"support_access.approve": runtime(
		"An organization OWNER approves a pending support access grant (bypass-write table) — the organization comes from the grant record and the owner membership is verified in the same transaction",
	),
	"support_access.revoke": runtime("Revoke a support access grant"),
	"support_access.verify": runtime("Verify an active support access grant"),

	"authorization.rbac.mutate": runtime(
		"One RBAC change (roles, permissions, assignments) with its session revocation and permission audit row, in one transaction — only after the route permission + privilege-escalation checks; catalog tables are bypass-write",
	),
	"authorization.rbac.inspect": runtime(
		"Read a target user's role assignments and direct grants (own-row RLS) for an RBAC preview or conflict check — only after the route permission check",
	),
	"authorization.audit_log.read": runtime("Read the bypass-only permission_audit_logs table for the admin audit viewer — only after the AUDIT_LOG:READ check"),

	"policy.draft.create": runtime("Create an authorization policy draft"),
	"policy.draft.simulate": runtime("Read a policy draft, the published policy versions and the in-scope active memberships for a bounded simulation"),
	"policy.simulation.record": runtime("Persist a policy simulation result"),
	"policy.publish": runtime("Publish a simulated policy draft as the next policy version (atomic)"),
	"policy.bundle.load": runtime("Load the active policy bundle for evaluation"),

	"pos.terminal.pair": runtime(
		"POST /pos/terminals/pair: the till has no credential yet — find the terminal by its one-time code, mint its POS key, bind it (the code is the only authorization)",
	),
	"rewards.sales.merchant_summary": runtime(
		"Read merchant names/categories for sales breakdowns (customer spending, admin top merchants) — ids come from sales the caller may already see",
	),
	"files.authorization": runtime("Resolve the caller's organization membership role to authorize a file operation"),
	"files.scan_verdict.apply": runtime(
		"Apply a malware-scan verdict to an uploaded file (state transition, resource binding) together with every category listener's reaction (e.g. KYB review status) in one transaction",
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

/** The definition (role, description) of an allowlisted operation. */
export function systemOperationDefinition(operation: SystemOperation): SystemOperationDefinition {
	return SYSTEM_OPERATIONS[operation];
}
