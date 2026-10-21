import { z } from "zod";

/**
 * The ONLY places `pnpm db:check-seed-coverage` (scripts/db.ts check-seed-coverage)
 * accepts an empty table or a nullable column that is NULL in every seeded row.
 *
 * The rule (docs/technical/database.md, "Seed coverage — every table, every column"): after `pnpm db:seed` every table holds rows and
 * every nullable column holds a real value in at least one row. An entry here is
 * a deliberate, reviewed exception — "we did not seed it" is never a reason;
 * seed it instead. Valid reasons are structural: the column can never hold a
 * value in a correct database (e.g. a legacy column the app only ever clears).
 *
 * `never-soft-deleted` covers the base model's soft-delete pair (`deletedAt`, `deletedBy`) of a table whose
 * rows no write path ever soft-deletes: every table carries the pair (the base model, prisma/schema.prisma), but an append-only
 * log or a row that ends through its own status column never fills it. Seeding a soft-deleted row there would
 * be data no correct database holds.
 *
 * The checker fails on a stale entry too (unknown table/column, or a gap that
 * the seed now fills), so this list can only shrink back to what is still true.
 */

/** A reason must be a real sentence a reviewer can judge, not a placeholder like "n/a". */
export const MIN_EXEMPTION_REASON_LENGTH = 40;

/** The base model's soft-delete columns a `never-soft-deleted` entry covers (`isDeleted` is NOT NULL, so never a gap). */
export const SOFT_DELETE_COLUMNS: readonly string[] = ["deletedAt", "deletedBy"];

const ExemptionReasonSchema = z.string().trim().min(MIN_EXEMPTION_REASON_LENGTH);
/** A Postgres table/column name as the catalog reports it (models and fields: PascalCase tables, camelCase columns). */
const IdentifierSchema = z.string().regex(/^[A-Za-z_][A-Za-z0-9_]*$/);

export const SeedCoverageExemptionSchema = z.discriminatedUnion("kind", [
	z.object({ kind: z.literal("empty-table"), table: IdentifierSchema, reason: ExemptionReasonSchema }),
	z.object({ kind: z.literal("null-column"), table: IdentifierSchema, column: IdentifierSchema, reason: ExemptionReasonSchema }),
	z.object({ kind: z.literal("never-soft-deleted"), table: IdentifierSchema, reason: ExemptionReasonSchema }),
]);

export type SeedCoverageExemption = z.infer<typeof SeedCoverageExemptionSchema>;

const APPEND_ONLY_RECORD =
	"An append-only record: every row is written once and never edited or retracted, and retention (where it exists) purges whole rows — no endpoint, job or admin action soft-deletes one, so no correct database holds a soft-deleted row.";

const DELIVERY_BOOKKEEPING =
	"Delivery bookkeeping whose lifecycle is its own status and receipt columns: the retention job purges expired rows outright and nothing soft-deletes one, so no correct database holds a soft-deleted row.";

function neverSoftDeleted(table: string, reason: string): SeedCoverageExemption {
	return { kind: "never-soft-deleted", table, reason };
}

export const SEED_COVERAGE_EXEMPTIONS: readonly SeedCoverageExemption[] = [
	...[
		"AnalyticsEvent",
		"AuditLog",
		"AuthorizationAudit",
		"AuthorizationPolicySimulation",
		"DataChangeLog",
		"EmailDeliveryEvent",
		"EmailLog",
		"ImpersonationAuditLog",
		"MfaRecoveryAuditLog",
		"TenantAuditLog",
		"TenantLifecycleEvent",
		"PasswordHistory",
		"RewardAuditLog",
	].map((table: string): SeedCoverageExemption => neverSoftDeleted(table, APPEND_ONLY_RECORD)),
	...["GithubWebhookDelivery", "InboxDeadLetter", "InboxProcessedEvent", "OutboxEvent", "PlatformResourceIdempotencyRecord"].map((table: string): SeedCoverageExemption =>
		neverSoftDeleted(table, DELIVERY_BOOKKEEPING),
	),
	neverSoftDeleted(
		"AuthorizationPolicyDraft",
		"A tenant policy draft ends through its status (PENDING_APPROVAL → APPROVED → PUBLISHED, SUPERSEDED or ROLLED_BACK) and is kept as the approval record; nothing soft-deletes a draft.",
	),
	neverSoftDeleted(
		"AuthorizationPolicyVersion",
		"A published policy version is immutable history: a newer publication stamps supersededAt on the old one, which stays so a rollback can restore it; nothing soft-deletes a version.",
	),
	neverSoftDeleted(
		"CapabilityDefinition",
		"Derived from the code's permission registry by the reference-data sync, which creates and updates capability rows but never retires one (a capability lives as long as its permission); nothing soft-deletes one.",
	),
	neverSoftDeleted(
		"ImpersonationSession",
		"An impersonation session ends through endedAt/endedBy or its expiresAt and is kept as evidence for the impersonation audit; nothing soft-deletes one.",
	),
	neverSoftDeleted(
		"MfaRecoveryRequest",
		"An MFA recovery request ends through its status (reviewedAt, completedAt) and is kept for the recovery audit; nothing soft-deletes one.",
	),
	neverSoftDeleted("TenantAccessRequest", "An access request ends through its status and reviewedAt, and is kept as the decision record; nothing soft-deletes one."),
	neverSoftDeleted("TenantSuspensionAppeal", "An appeal ends through its status and reviewedAt, and is kept as the decision record; nothing soft-deletes one."),
	neverSoftDeleted("TenantCustomerBan", "A ban ends through liftedAt and is kept as the merchant's history; nothing soft-deletes one."),
	neverSoftDeleted(
		"TenantInvitation",
		"An invitation ends through its status (accepted, revoked or expired via expiresAt) and is kept as the onboarding record; nothing soft-deletes one.",
	),
	neverSoftDeleted(
		"TenantInvitationLocationScope",
		"The store scope of an invitation is written with the invitation and ends with it (through the invitation's status); the repository never removes or soft-deletes a scope row.",
	),
	neverSoftDeleted(
		"TenantMerchantProfile",
		"The merchant profile is created with its tenant and updated in place for the tenant's whole life (the tenant itself carries the soft delete); nothing soft-deletes a profile.",
	),
	neverSoftDeleted(
		"TenantSlugHistory",
		"A retired slug is history: the row keeps the old slug reserved until reservedUntil so links keep resolving; nothing edits or soft-deletes it.",
	),
	neverSoftDeleted(
		"RewardLocationScope",
		"A reward's store scope is written once with the reward (the repository only inserts scope rows); nothing removes or soft-deletes one.",
	),
	neverSoftDeleted("SupportAccessGrant", "A support access grant ends through its status, revokedAt or expiresAt and is kept as the access record; nothing soft-deletes one."),
	neverSoftDeleted(
		"TenantEncryptionKey",
		"A tenant data key is rotated (status, rotatedAt), never removed: an old key must stay to decrypt the data it wrapped, so nothing soft-deletes one.",
	),
	neverSoftDeleted("TenantPlacement", "A tenant's placement is created with its tenant and updated in place for the tenant's whole life; nothing soft-deletes one."),
	neverSoftDeleted("TwoFactorLoginChallenge", "A login challenge ends through consumedAt or expiresAt and is kept for the sign-in audit; nothing soft-deletes one."),
	neverSoftDeleted(
		"TwoFactorPendingSetup",
		"A pending two-factor setup holds an unconfirmed secret: confirming or restarting the setup removes it outright so the secret does not linger, and nothing soft-deletes one.",
	),
	neverSoftDeleted(
		"TenantKybFile",
		'Submitted KYB evidence is retained for the review history: a resubmission retires a link ("isActive" = false) and DELETE /files/:id refuses submitted evidence (KYB_EVIDENCE_RETAINED), so no correct database holds a soft-deleted link.',
	),
	neverSoftDeleted(
		"SignupReferralCode",
		"ADR 035: a signup referral code is never edited or retired early — history is the append of a successor row, and no endpoint, job or admin action soft-deletes a code — so no correct database holds a soft-deleted code row.",
	),
	neverSoftDeleted(
		"SignupReferral",
		"ADR 035: a signup referral is never withdrawn, swapped or cleared — there is no user, referrer or admin delete in this slice and the row is the permanent record of the account's origin — so no correct database holds a soft-deleted signup referral.",
	),
];
