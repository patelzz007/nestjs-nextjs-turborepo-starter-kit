import type { DatabaseRoleName } from "./roles";
import type { ColumnOf, PermissionAction, PermissionResource, SystemOperationName, TableName } from "./table-types";

/**
 * Every table's row-level security policies — the source of `prisma/rls/04-policies.sql`.
 *
 * Type-checked against the real schema: `TABLE_POLICIES` must name every Prisma model (a new model without
 * an entry does not compile), a `column` must be one of that table's columns, a permission one of the
 * catalogue's resources and actions, an operation one of the registry's, a one-off rule only on its own
 * table — and each rule accepts exactly the inputs it needs, so the editor autocompletes all of it.
 *
 * Every listed table has RLS enabled AND forced. A table's policies are permissive: a row is reachable when
 * ANY of them admits it. What each rule checks is written once, in generator/policy-rules.ts (and the one-off
 * rules in generator/table-specific-rules.ts); in plain words: docs/technical/database/adding-a-table.md.
 */

// ── The rules, grouped by the inputs they need ─────────────────────────────

/** Rules that need nothing but the table. */
export type SimpleRule =
	// System operations only (ADR 012): the named operation's registry scope must list the table.
	| "system"
	| "systemRead"
	| "systemInsert"
	| "systemUpdate"
	| "systemDelete"
	// Public and append-only.
	| "readableByAll"
	| "anyoneInsert"
	| "triggerInsert"
	| "triggerUpdate"
	| "triggerOrSystemRead";

/** Rules that check one column of the row: its owner, its tenant, or the reward / user it refers to. */
export type ColumnRule =
	// Ownership: the column is the signed-in user.
	| "ownerOrSystem"
	| "systemOrOwner"
	| "ownerOrSystemRead"
	| "ownerOrSystemInsert"
	| "ownerOrSystemUpdate"
	| "ownerRead"
	// Tenant membership: the column is the row's tenant.
	| "tenantMemberOrSystem"
	| "tenantMemberReadOrSystem"
	| "systemOrTenantMember"
	| "systemOrActiveTenantMember"
	| "systemOrActiveTenantMemberRead"
	// Merchant API keys (the till / tenant API session).
	| "apiKeyRead"
	| "apiKeyInsert"
	| "apiKeyUpdate"
	| "apiKeyNullableTenantRead"
	| "apiKeyNullableTenantInsert"
	| "apiKeyRewardRead"
	| "apiKeyRewardInsert"
	| "apiKeyRewardUpdate"
	| "apiKeySignupRefereeRead"
	| "apiKeySignupRefereeUpdate"
	| "apiKeyCustomerRead";

/** Rules that check the row's tenant (`column`) and store (`storeColumn`). */
export type StoreRule = "systemOrStoreAccess" | "systemOrOptionalStoreAccess" | "apiKeyStoreRead" | "apiKeyStoreInsert" | "apiKeyStoreUpdate";

/** Tenant permissions (ADR 067: the member's role or a live grant, at the row's store when it has one). */
export type PermissionRule = "permission" | "permissionRead" | "permissionInsert" | "permissionUpdate" | "permissionDelete";

/** Only the named system operations may write. */
export type OperationsRule = "systemOperationWrite";

/** A dedicated database role (retention, erasure, analytics consumer): the policy names that role alone. */
export type RoleRule = "roleRead" | "roleInsert" | "roleUpdate" | "roleDelete" | "roleAll";

/** Every reusable rule (generator/policy-rules.ts). */
export type PolicyRule = SimpleRule | ColumnRule | StoreRule | PermissionRule | OperationsRule | RoleRule;

/** Each one-off rule and the one table it belongs to (generator/table-specific-rules.ts). */
export type TableSpecificRulePair =
	| { readonly rule: "roleCatalogueReadable"; readonly table: "Role" }
	| { readonly rule: "rolePermissionFollowsRole"; readonly table: "RolePermission" }
	| { readonly rule: "shareReadable"; readonly table: "ResourceAcl" }
	| { readonly rule: "storedFileReadable"; readonly table: "StoredFile" }
	| { readonly rule: "storedFileWritable"; readonly table: "StoredFile" }
	| { readonly rule: "publicRewardImageFile"; readonly table: "StoredFile" }
	| { readonly rule: "publicRewardImageVariant"; readonly table: "FileVariant" }
	| { readonly rule: "fileVariantReadable"; readonly table: "FileVariant" }
	| { readonly rule: "fileVariantWritable"; readonly table: "FileVariant" }
	| { readonly rule: "rewardReadable"; readonly table: "Reward" }
	| { readonly rule: "rewardEditable"; readonly table: "Reward" }
	| { readonly rule: "rewardScopeReadable"; readonly table: "RewardLocationScope" }
	| { readonly rule: "rewardImageReadable"; readonly table: "RewardImage" }
	| { readonly rule: "claimMerchantReadable"; readonly table: "RewardClaim" }
	| { readonly rule: "redemptionReadable"; readonly table: "RewardRedemption" }
	| { readonly rule: "referralParties"; readonly table: "RewardReferral" }
	| { readonly rule: "outboxAppend"; readonly table: "OutboxEvent" }
	| { readonly rule: "webhookEventAppend"; readonly table: "WebhookEvent" }
	| { readonly rule: "tenantVisibleToMembers"; readonly table: "Tenant" }
	| { readonly rule: "locationMember"; readonly table: "Location" }
	| { readonly rule: "accessRequestReadable"; readonly table: "TenantAccessRequest" }
	| { readonly rule: "accessRequestFile"; readonly table: "TenantAccessRequest" }
	| { readonly rule: "apiKeySelfRead"; readonly table: "TenantApiKey" }
	| { readonly rule: "apiKeySelfUpdate"; readonly table: "TenantApiKey" }
	| { readonly rule: "apiKeyReferrerNotice"; readonly table: "RewardNotification" }
	| { readonly rule: "tenantAuditAppend"; readonly table: "TenantAuditLog" }
	| { readonly rule: "ownTenantAuditRead"; readonly table: "TenantAuditLog" }
	| { readonly rule: "ownMembershipRead"; readonly table: "Membership" }
	| { readonly rule: "ownMembershipScopes"; readonly table: "MembershipLocationScope" };

/** Every one-off rule. */
export type TableSpecificRule = TableSpecificRulePair["rule"];

/** The one-off rules `Table` may use. */
export type TableSpecificRuleOf<Table extends TableName> = Extract<TableSpecificRulePair, { readonly table: Table }>["rule"];

/** The table a one-off rule belongs to. */
export type TableOfSpecificRule<Rule extends TableSpecificRule> = Extract<TableSpecificRulePair, { readonly rule: Rule }>["table"];

// ── A policy, as written in TABLE_POLICIES ─────────────────────────────────

interface PolicyBase {
	/** The policy's name (unique per table). */
	readonly name: string;
	/** Limits the policy to one role; left out, it applies to every role. */
	readonly to?: DatabaseRoleName;
}

export interface SimplePolicy extends PolicyBase {
	readonly rule: SimpleRule;
}

export interface ColumnPolicy<Table extends TableName> extends PolicyBase {
	readonly rule: ColumnRule;
	/** The owner, tenant or reference column the rule checks. */
	readonly column: ColumnOf<Table>;
}

export interface StorePolicy<Table extends TableName> extends PolicyBase {
	readonly rule: StoreRule;
	readonly column: ColumnOf<Table>;
	readonly storeColumn: ColumnOf<Table>;
}

export interface PermissionPolicy<Table extends TableName> extends PolicyBase {
	readonly rule: PermissionRule;
	/** The catalogue permission (ADR 067's `noun.verb`). */
	readonly resource: PermissionResource;
	readonly action: PermissionAction;
	/** The row's tenant column. */
	readonly column: ColumnOf<Table>;
	/** The row's store column: the member's stores (and a grant's store) must cover it. */
	readonly storeColumn?: ColumnOf<Table>;
}

export interface OperationsPolicy extends PolicyBase {
	readonly rule: OperationsRule;
	readonly operations: readonly SystemOperationName[];
}

export interface RolePolicy extends PolicyBase {
	readonly rule: RoleRule;
	readonly to: DatabaseRoleName;
}

/** A dedicated role's policy limited to the rows where `column` equals a value. */
export interface FilteredRolePolicy<Table extends TableName> extends RolePolicy {
	readonly where: { readonly column: ColumnOf<Table>; readonly equals: string | boolean };
}

export interface TableSpecificPolicy<Table extends TableName> extends PolicyBase {
	readonly rule: TableSpecificRuleOf<Table>;
}

/** One policy of `Table`: the rule decides which other fields it takes. */
export type TablePolicy<Table extends TableName> =
	| SimplePolicy
	| ColumnPolicy<Table>
	| StorePolicy<Table>
	| PermissionPolicy<Table>
	| OperationsPolicy
	| RolePolicy
	| FilteredRolePolicy<Table>
	| TableSpecificPolicy<Table>;

/** Every table, with its policies (an empty list: nobody but the table owner may touch it). */
export type TablePolicies = { readonly [Table in TableName]: readonly TablePolicy<Table>[] };

/**
 * The generator's view of a policy: the same fields, as plain strings. Every `TablePolicy` is one; the
 * generator re-checks each value before it reaches SQL.
 */
export interface PolicyDeclaration {
	readonly name: string;
	readonly rule: PolicyRule | TableSpecificRule;
	readonly column?: string;
	readonly storeColumn?: string;
	readonly resource?: string;
	readonly action?: string;
	readonly operations?: readonly string[];
	readonly where?: { readonly column: string; readonly equals: string | boolean };
	readonly to?: DatabaseRoleName;
}

// ── Guard rails ────────────────────────────────────────────────────────────

/**
 * Rules that let ANY member of the row's tenant (or store) write, whatever their role. Tenant data checks a
 * permission instead (ADR 090), so table-policies.spec.ts refuses these on a table with a `tenantId` column unless
 * the table is listed in {@link MEMBERSHIP_WRITE_EXCEPTIONS} with the reason.
 */
export const MEMBERSHIP_WRITE_RULES: ReadonlySet<PolicyRule | TableSpecificRule> = new Set<PolicyRule | TableSpecificRule>([
	"tenantMemberOrSystem",
	"systemOrTenantMember",
	"systemOrActiveTenantMember",
	"systemOrStoreAccess",
	"systemOrOptionalStoreAccess",
]);

/** Tenant tables deliberately writable by every member, each with why (none today). */
export const MEMBERSHIP_WRITE_EXCEPTIONS: Readonly<Partial<Record<TableName, string>>> = {};

// ── Shared pieces ──────────────────────────────────────────────────────────

/** The two named operations allowed to write geo reference data. */
const GEO_WRITERS: readonly SystemOperationName[] = ["geo.reference_data.write", "seed.demo_dataset"];

/** Account erasure (ADR 077): `app_erasure` reads and masks a kept record. Policy names: `<table lowercased>_erasure_*`. */
function erasurePolicies(table: TableName): RolePolicy[] {
	const prefix = table.toLowerCase();
	return [
		{ name: `${prefix}_erasure_read`, rule: "roleRead", to: "app_erasure" },
		{ name: `${prefix}_erasure_mask`, rule: "roleUpdate", to: "app_erasure" },
	];
}

/** Audit-record retention (ADR 078): `app_retention` reads and deletes old audit rows. */
function retentionPolicies(prefix: string): RolePolicy[] {
	return [
		{ name: `${prefix}_retention_read`, rule: "roleRead", to: "app_retention" },
		{ name: `${prefix}_retention_delete`, rule: "roleDelete", to: "app_retention" },
	];
}

/*
 * Tenant data checks a permission, not only membership (ADR 090). Where a route checks a different verb than the
 * catalogue's natural one (for example the terminal routes check `api_key.create`), the table lists both, so the
 * database never refuses what the API allows.
 */
export const TABLE_POLICIES: TablePolicies = {
	AccountErasure: [
		{ name: "account_erasure_system_write", rule: "system" },
		{ name: "account_erasure_owner_read", rule: "ownerOrSystemRead", column: "userId" },
		{ name: "account_erasure_erasure_read", rule: "roleRead", to: "app_erasure" },
	],
	AnalyticsEvent: [
		{ name: "analytics_events_bypass", rule: "system", to: "app_runtime" },
		{ name: "analytics_events_analytics_consumer_insert", rule: "roleInsert", to: "analytics_consumer" },
		// INSERT … ON CONFLICT (id) checks the new row against SELECT policies too; the column grant limits what it reads to `id`.
		{ name: "analytics_events_analytics_consumer_select", rule: "roleRead", to: "analytics_consumer" },
	],
	AuditLegalHold: [
		{ name: "audit_legal_hold_bypass", rule: "system" },
		{ name: "audit_legal_hold_retention_read", rule: "roleRead", to: "app_retention" },
	],
	AuditLog: [
		{ name: "audit_logs_insert", rule: "systemInsert" },
		{ name: "audit_logs_select", rule: "systemRead" },
		...retentionPolicies("audit_log"),
		...erasurePolicies("AuditLog"),
	],
	AuthorizationAudit: [{ name: "authorization_audits_bypass", rule: "system" }, ...erasurePolicies("AuthorizationAudit")],
	BackupCode: [{ name: "backup_codes_own", rule: "ownerOrSystem", column: "userId" }],
	// Every read and write of a tenant's broadcasts runs as a `broadcasts.*` system operation after the route's check.
	Broadcast: [{ name: "broadcast_write", rule: "system" }],
	BroadcastReport: [
		{ name: "broadcast_report_review", rule: "systemUpdate" },
		{ name: "broadcast_report_own", rule: "ownerOrSystemRead", column: "reporterUserId" },
		{ name: "broadcast_report_file", rule: "ownerOrSystemInsert", column: "reporterUserId" },
	],
	CapabilityDefinition: [
		{ name: "capability_definitions_read", rule: "readableByAll" },
		{ name: "capability_definitions_write", rule: "system" },
	],
	City: [
		{ name: "cities_read", rule: "readableByAll" },
		{ name: "cities_write", rule: "systemOperationWrite", operations: GEO_WRITERS },
	],
	Country: [
		{ name: "countries_read", rule: "readableByAll" },
		{ name: "countries_write", rule: "systemOperationWrite", operations: GEO_WRITERS },
	],
	// Customer tiers (ADR 085): the tiers context writes through its system operations; the customer reads their own
	// standing and history, and the till reads the standing of its tenant's customers.
	CustomerTierChange: [
		{ name: "customer_tier_changes_system", rule: "system" },
		{ name: "customer_tier_changes_own_read", rule: "ownerRead", column: "userId" },
	],
	CustomerTierSettings: [{ name: "customer_tier_settings_system", rule: "system" }],
	CustomerTierStanding: [
		{ name: "customer_tier_standings_system", rule: "system" },
		{ name: "customer_tier_standings_own_read", rule: "ownerRead", column: "userId" },
		{ name: "customer_tier_standings_api_key_read", rule: "apiKeyCustomerRead", column: "userId", to: "app_runtime" },
	],
	// The change trail's per-group index: kept ONLY by the `data_change_group_track` trigger on DataChangeLog.
	DataChangeGroup: [
		{ name: "data_change_groups_insert", rule: "triggerInsert" },
		{ name: "data_change_groups_update", rule: "triggerUpdate" },
		{ name: "data_change_groups_select", rule: "triggerOrSystemRead" },
		...retentionPolicies("data_change_group"),
	],
	// Row-level data-change trail (ADR 051): rows are INSERTed only by the generated capture triggers.
	DataChangeLog: [
		{ name: "data_change_logs_select", rule: "systemRead" },
		{ name: "data_change_logs_insert", rule: "triggerInsert" },
		...retentionPolicies("data_change_log"),
		...erasurePolicies("DataChangeLog"),
	],
	EmailDeliveryEvent: [{ name: "email_delivery_events_bypass", rule: "system" }],
	EmailLog: [
		{ name: "email_logs_delete", rule: "systemDelete" },
		{ name: "email_logs_select", rule: "systemRead" },
		{ name: "email_logs_update", rule: "systemUpdate" },
		{ name: "email_logs_insert", rule: "anyoneInsert" },
		...erasurePolicies("EmailLog"),
	],
	Experiment: [
		{ name: "experiment_bypass", rule: "system", to: "app_runtime" },
		{ name: "experiments_analytics_consumer_select", rule: "roleRead", to: "analytics_consumer", where: { column: "isDeleted", equals: false } },
	],
	ExperimentMetricEvent: [
		{ name: "experiment_metric_event_bypass", rule: "system", to: "app_runtime" },
		{ name: "experiment_metric_events_analytics_consumer", rule: "roleAll", to: "analytics_consumer" },
	],
	ExperimentResult: [
		{ name: "experiment_result_bypass", rule: "system", to: "app_runtime" },
		{ name: "experiment_results_analytics_consumer", rule: "roleAll", to: "analytics_consumer" },
	],
	FeatureFlagCatalogVersion: [{ name: "feature_flag_catalog_version_bypass", rule: "system" }],
	FeatureFlagExposure: [
		{ name: "feature_flag_exposure_bypass", rule: "system", to: "app_runtime" },
		{ name: "feature_flag_exposures_analytics_consumer", rule: "roleAll", to: "analytics_consumer" },
	],
	FeatureFlagExposureDaily: [
		{ name: "feature_flag_exposure_daily_bypass", rule: "system", to: "app_runtime" },
		{ name: "feature_flag_exposure_dailies_analytics_consumer", rule: "roleAll", to: "analytics_consumer" },
	],
	FeatureFlagKillSwitch: [{ name: "feature_flag_kill_switch_bypass", rule: "system" }],
	FeatureFlagOverride: [{ name: "feature_flag_override_bypass", rule: "system" }],
	FileVariant: [
		{ name: "file_variants_reward_image_read", rule: "publicRewardImageVariant" },
		{ name: "file_variants_read", rule: "fileVariantReadable" },
		{ name: "file_variants_write", rule: "fileVariantWritable" },
	],
	FlagGroup: [{ name: "flag_group_bypass", rule: "system" }],
	FlagGroupMember: [{ name: "flag_group_member_bypass", rule: "system" }],
	FlagRevision: [{ name: "flag_revision_bypass", rule: "system" }],
	GithubAccountLink: [{ name: "github_account_links_own", rule: "ownerOrSystem", column: "userId" }],
	GithubWebhookDelivery: [{ name: "github_webhook_deliveries_bypass", rule: "system" }],
	GithubWebhookSubscription: [{ name: "github_webhook_subscriptions_bypass", rule: "system" }],
	ImpersonationAuditLog: [
		{ name: "impersonation_audit_logs_insert", rule: "systemInsert", to: "app_runtime" },
		{ name: "impersonation_audit_logs_select", rule: "systemRead", to: "app_runtime" },
		...erasurePolicies("ImpersonationAuditLog"),
	],
	ImpersonationSession: [{ name: "impersonation_sessions_bypass", rule: "system" }, ...erasurePolicies("ImpersonationSession")],
	InAppNotification: [{ name: "in_app_notification_own", rule: "ownerOrSystem", column: "userId" }],
	InboxDeadLetter: [
		{ name: "inbox_dead_letters_bypass", rule: "system", to: "app_runtime" },
		{ name: "inbox_dead_letters_analytics_consumer", rule: "roleAll", to: "analytics_consumer", where: { column: "consumer", equals: "analytics-warehouse" } },
	],
	InboxProcessedEvent: [
		{ name: "inbox_processed_events_bypass", rule: "system", to: "app_runtime" },
		// The analytics consumer's inbox id (ANALYTICS_CONSUMER_ID in packages/messaging/src/inbox/message-handler.ts).
		{ name: "inbox_processed_events_analytics_consumer", rule: "roleAll", to: "analytics_consumer", where: { column: "consumer", equals: "analytics-warehouse" } },
	],
	KanbanChecklistItem: [
		{ name: "kanban_checklist_item_insert", rule: "systemInsert" },
		{ name: "kanban_checklist_item_select", rule: "systemRead" },
		{ name: "kanban_checklist_item_update", rule: "systemUpdate" },
	],
	KanbanColumn: [
		{ name: "kanban_column_insert", rule: "systemInsert" },
		{ name: "kanban_column_select", rule: "systemRead" },
		{ name: "kanban_column_update", rule: "systemUpdate" },
	],
	KanbanConversionStage: [
		{ name: "kanban_conversion_stage_insert", rule: "systemInsert" },
		{ name: "kanban_conversion_stage_select", rule: "systemRead" },
		{ name: "kanban_conversion_stage_update", rule: "systemUpdate" },
	],
	KanbanExecutionColumn: [
		{ name: "kanban_execution_column_insert", rule: "systemInsert" },
		{ name: "kanban_execution_column_select", rule: "systemRead" },
		{ name: "kanban_execution_column_update", rule: "systemUpdate" },
	],
	KanbanLevelCounter: [
		{ name: "kanban_level_counter_insert", rule: "systemInsert" },
		{ name: "kanban_level_counter_select", rule: "systemRead" },
		{ name: "kanban_level_counter_update", rule: "systemUpdate" },
	],
	KanbanPlanningColumn: [
		{ name: "kanban_planning_column_insert", rule: "systemInsert" },
		{ name: "kanban_planning_column_select", rule: "systemRead" },
		{ name: "kanban_planning_column_update", rule: "systemUpdate" },
	],
	KanbanTask: [
		{ name: "kanban_task_insert", rule: "systemInsert" },
		{ name: "kanban_task_select", rule: "systemRead" },
		{ name: "kanban_task_update", rule: "systemUpdate" },
	],
	KanbanTaskActivity: [
		{ name: "kanban_task_activity_insert", rule: "systemInsert" },
		{ name: "kanban_task_activity_select", rule: "systemRead" },
		{ name: "kanban_task_activity_update", rule: "systemUpdate" },
	],
	KanbanTaskAttachment: [
		{ name: "kanban_task_attachment_insert", rule: "systemInsert" },
		{ name: "kanban_task_attachment_select", rule: "systemRead" },
		{ name: "kanban_task_attachment_update", rule: "systemUpdate" },
	],
	KanbanTaskComment: [
		{ name: "kanban_task_comment_insert", rule: "systemInsert" },
		{ name: "kanban_task_comment_select", rule: "systemRead" },
		{ name: "kanban_task_comment_update", rule: "systemUpdate" },
	],
	KanbanTaskLink: [
		{ name: "kanban_task_link_insert", rule: "systemInsert" },
		{ name: "kanban_task_link_select", rule: "systemRead" },
		{ name: "kanban_task_link_update", rule: "systemUpdate" },
	],
	KanbanTaskWatcher: [
		{ name: "kanban_task_watcher_insert", rule: "systemInsert" },
		{ name: "kanban_task_watcher_select", rule: "systemRead" },
		{ name: "kanban_task_watcher_update", rule: "systemUpdate" },
	],
	LoadTestPoint: [{ name: "load_test_point_bypass", rule: "system" }],
	LoadTestRun: [{ name: "load_test_run_bypass", rule: "system" }],
	LoadTestStepStat: [{ name: "load_test_step_stat_bypass", rule: "system" }],
	Location: [
		{ name: "locations_api_key_read", rule: "apiKeyRead", column: "tenantId", to: "app_runtime" },
		{ name: "locations_member", rule: "locationMember" },
		{ name: "locations_system", rule: "system" },
		{ name: "locations_insert", rule: "permissionInsert", resource: "LOCATION", action: "UPDATE", column: "tenantId" },
		{ name: "locations_update", rule: "permissionUpdate", resource: "LOCATION", action: "UPDATE", column: "tenantId" },
		// Registering a till locks its store (SELECT … FOR SHARE needs an UPDATE policy) under terminal.create.
		{ name: "locations_terminal_lock", rule: "permissionUpdate", resource: "TERMINAL", action: "CREATE", column: "tenantId" },
	],
	MarketingConsent: [
		{ name: "marketing_consent_read", rule: "ownerOrSystemRead", column: "userId" },
		{ name: "marketing_consent_insert", rule: "ownerOrSystemInsert", column: "userId" },
		...erasurePolicies("MarketingConsent"),
	],
	// The team: member.read reads it, and so does member.update (the team writes read the rows they change); a member
	// reads their own membership. Every write is a system operation — renaming oneself (`PATCH /members/me`) too, so
	// no member holds UPDATE on this table (ADR 090).
	Membership: [
		{ name: "tenant_memberships_system", rule: "system" },
		{ name: "tenant_memberships_read", rule: "permissionRead", resource: "MEMBER", action: "READ", column: "tenantId" },
		{ name: "tenant_memberships_team_read", rule: "permissionRead", resource: "MEMBER", action: "UPDATE", column: "tenantId" },
		{ name: "tenant_memberships_own_read", rule: "ownMembershipRead" },
	],
	MembershipLocationScope: [
		{ name: "membership_location_scopes_system", rule: "system" },
		{ name: "membership_location_scopes_read", rule: "permissionRead", resource: "MEMBER", action: "READ", column: "tenantId" },
		{ name: "membership_location_scopes_team_read", rule: "permissionRead", resource: "MEMBER", action: "UPDATE", column: "tenantId" },
		{ name: "membership_location_scopes_own_read", rule: "ownMembershipScopes" },
	],
	MfaRecoveryAuditLog: [
		{ name: "mfa_recovery_audit_logs_insert", rule: "systemInsert", to: "app_runtime" },
		{ name: "mfa_recovery_audit_logs_select", rule: "systemRead", to: "app_runtime" },
		...erasurePolicies("MfaRecoveryAuditLog"),
	],
	MfaRecoveryRequest: [{ name: "mfa_recovery_requests_own", rule: "ownerOrSystem", column: "userId" }],
	Notification: [
		{ name: "notification_delete", rule: "systemDelete" },
		{ name: "notification_select", rule: "systemRead" },
		{ name: "notification_update", rule: "systemUpdate" },
		// Any transaction may REQUEST a notification (the producer's own unit of work, like EmailLog).
		{ name: "notification_insert", rule: "anyoneInsert" },
		...erasurePolicies("Notification"),
	],
	NotificationDelivery: [{ name: "notification_delivery_bypass", rule: "system" }],
	NotificationPreference: [{ name: "notification_preference_own", rule: "ownerOrSystem", column: "userId" }],
	NotificationSchedule: [{ name: "notification_schedule_own", rule: "ownerOrSystem", column: "userId" }],
	NotificationSuppression: [{ name: "notification_suppression_bypass", rule: "system" }],
	OpsAlert: [{ name: "ops_alert_bypass", rule: "system" }],
	OpsBackup: [{ name: "ops_backup_bypass", rule: "system" }],
	OpsDependencySample: [{ name: "ops_dependency_sample_bypass", rule: "system" }],
	OpsInstanceSample: [{ name: "ops_instance_sample_bypass", rule: "system" }],
	OpsRestoreDrill: [{ name: "ops_restore_drill_bypass", rule: "system" }],
	OpsServer: [{ name: "ops_server_bypass", rule: "system" }],
	OpsServerSample: [{ name: "ops_server_sample_bypass", rule: "system" }],
	OpsSettings: [{ name: "ops_settings_bypass", rule: "system" }],
	OutboxEvent: [
		{ name: "outbox_events_bypass", rule: "system" },
		{ name: "outbox_events_append", rule: "outboxAppend" },
	],
	PasswordHistory: [{ name: "password_history_own", rule: "ownerOrSystem", column: "userId" }],
	PasswordResetToken: [{ name: "password_reset_tokens_own", rule: "ownerOrSystem", column: "userId" }],
	// A payment's history is read and written only by the `payments.*` system operations.
	PaymentEvent: [{ name: "payment_events_system_write", rule: "system" }],
	// payment.read reads them; asking for and refunding a payment run as `payments.*` system operations.
	PaymentIntent: [
		{ name: "payment_intents_read", rule: "permissionRead", resource: "PAYMENT", action: "READ", column: "tenantId" },
		{ name: "payment_intents_system_write", rule: "system" },
	],
	Permission: [
		{ name: "permissions_read", rule: "readableByAll" },
		{ name: "permissions_write", rule: "system" },
	],
	PermissionAuditLog: [{ name: "permission_audit_logs_bypass", rule: "system" }],
	PlatformResourceIdempotencyRecord: [{ name: "platform_resource_idempotency_bypass", rule: "system" }],
	Product: [
		{ name: "product_delete", rule: "systemDelete" },
		{ name: "product_insert", rule: "systemInsert" },
		{ name: "product_select", rule: "systemRead" },
		{ name: "product_update", rule: "systemUpdate" },
	],
	ProductImage: [{ name: "product_images_catalog", rule: "system" }],
	PushDevice: [{ name: "push_device_own", rule: "ownerOrSystem", column: "userId" }],
	ReceivedWebhook: [{ name: "received_webhook_bypass", rule: "system" }],
	DocsSyncRun: [{ name: "docs_sync_run_bypass", rule: "system" }],
	RefreshToken: [{ name: "refresh_tokens_own", rule: "ownerOrSystem", column: "userId" }],
	Region: [
		{ name: "regions_read", rule: "readableByAll" },
		{ name: "regions_write", rule: "systemOperationWrite", operations: GEO_WRITERS },
	],
	ResourceAcl: [
		// Shares are granted, changed and revoked only by system operations (ADR 067).
		{ name: "resource_acls_system", rule: "system" },
		{ name: "resource_acls_member", rule: "shareReadable" },
	],
	RetentionRun: [{ name: "retention_run_bypass", rule: "system" }],
	Reward: [
		// System operations (review, the seed, load-test cleanup) read, change and delete any reward.
		{ name: "rewards_system", rule: "system" },
		{ name: "rewards_api_key_insert", rule: "apiKeyInsert", column: "tenantId", to: "app_runtime" },
		{ name: "rewards_api_key_read", rule: "apiKeyRead", column: "tenantId", to: "app_runtime" },
		{ name: "rewards_api_key_update", rule: "apiKeyUpdate", column: "tenantId", to: "app_runtime" },
		{ name: "rewards_read", rule: "rewardReadable" },
		{ name: "rewards_write", rule: "permissionInsert", resource: "REWARD", action: "CREATE", column: "tenantId" },
		{ name: "rewards_update", rule: "rewardEditable" },
	],
	RewardAudienceMember: [
		// System operations (account erasure deletes a person's rows) do everything.
		{ name: "reward_audience_members_system", rule: "system" },
		{ name: "reward_audience_members_api_key_insert", rule: "apiKeyInsert", column: "tenantId", to: "app_runtime" },
		{ name: "reward_audience_members_api_key_read", rule: "apiKeyRead", column: "tenantId", to: "app_runtime" },
		{ name: "reward_audience_members_api_key_update", rule: "apiKeyUpdate", column: "tenantId", to: "app_runtime" },
		{ name: "reward_audience_members_read", rule: "permissionRead", resource: "REWARD", action: "READ", column: "tenantId" },
		// Reward writers read back the audience they set (creating a reward, editing it, the audience page).
		{ name: "reward_audience_members_creators_read", rule: "permissionRead", resource: "REWARD", action: "CREATE", column: "tenantId" },
		{ name: "reward_audience_members_editors_read", rule: "permissionRead", resource: "REWARD", action: "UPDATE", column: "tenantId" },
		{ name: "reward_audience_members_create", rule: "permissionInsert", resource: "REWARD", action: "CREATE", column: "tenantId" },
		{ name: "reward_audience_members_insert", rule: "permissionInsert", resource: "REWARD", action: "UPDATE", column: "tenantId" },
		{ name: "reward_audience_members_update", rule: "permissionUpdate", resource: "REWARD", action: "UPDATE", column: "tenantId" },
	],
	// Appended by the API-key, till and POS-settings commands, each under the permission its route checks; read only by
	// system operations.
	RewardAuditLog: [
		{ name: "reward_audit_insert", rule: "permissionInsert", resource: "API_KEY", action: "CREATE", column: "tenantId" },
		{ name: "reward_audit_key_revoke_insert", rule: "permissionInsert", resource: "API_KEY", action: "DELETE", column: "tenantId" },
		{ name: "reward_audit_terminal_insert", rule: "permissionInsert", resource: "TERMINAL", action: "CREATE", column: "tenantId" },
		{ name: "reward_audit_terminal_remove_insert", rule: "permissionInsert", resource: "TERMINAL", action: "DELETE", column: "tenantId" },
		{ name: "reward_audit_select", rule: "systemRead" },
		{ name: "reward_audit_logs_api_key_insert", rule: "apiKeyNullableTenantInsert", column: "tenantId", to: "app_runtime" },
	],
	RewardClaim: [
		{ name: "reward_claims_own", rule: "ownerOrSystem", column: "userId" },
		{ name: "reward_claims_merchant_read", rule: "claimMerchantReadable" },
		{ name: "reward_claims_api_key_read", rule: "apiKeyRewardRead", column: "rewardId", to: "app_runtime" },
		{ name: "reward_claims_api_key_insert", rule: "apiKeyRewardInsert", column: "rewardId", to: "app_runtime" },
		{ name: "reward_claims_api_key_update", rule: "apiKeyRewardUpdate", column: "rewardId", to: "app_runtime" },
	],
	RewardClaimHold: [{ name: "reward_claim_hold_own", rule: "ownerOrSystem", column: "userId" }],
	RewardImage: [
		{ name: "reward_images_system", rule: "system" },
		{ name: "reward_images_api_key_insert", rule: "apiKeyInsert", column: "tenantId", to: "app_runtime" },
		{ name: "reward_images_api_key_read", rule: "apiKeyRead", column: "tenantId", to: "app_runtime" },
		{ name: "reward_images_api_key_update", rule: "apiKeyUpdate", column: "tenantId", to: "app_runtime" },
		// Replacing a reward's images inserts the new rows and soft-deletes the old (no hard DELETE).
		{ name: "reward_images_insert", rule: "permissionInsert", resource: "REWARD", action: "UPDATE", column: "tenantId" },
		{ name: "reward_images_update", rule: "permissionUpdate", resource: "REWARD", action: "UPDATE", column: "tenantId" },
		{ name: "reward_images_create", rule: "permissionInsert", resource: "REWARD", action: "CREATE", column: "tenantId" },
		{ name: "reward_images_read", rule: "rewardImageReadable" },
	],
	RewardLegalAcceptance: [{ name: "reward_legal_own", rule: "ownerOrSystem", column: "userId" }],
	RewardLocationScope: [
		{ name: "reward_location_scopes_system", rule: "system" },
		{ name: "reward_location_scopes_api_key_insert", rule: "apiKeyInsert", column: "tenantId", to: "app_runtime" },
		{ name: "reward_location_scopes_api_key_read", rule: "apiKeyRead", column: "tenantId", to: "app_runtime" },
		{ name: "reward_location_scopes_insert", rule: "permissionInsert", resource: "REWARD", action: "UPDATE", column: "tenantId" },
		{ name: "reward_location_scopes_create", rule: "permissionInsert", resource: "REWARD", action: "CREATE", column: "tenantId" },
		{ name: "reward_location_scopes_read", rule: "rewardScopeReadable" },
	],
	RewardNotification: [
		{ name: "reward_notifications_own", rule: "ownerOrSystem", column: "userId" },
		{ name: "reward_notifications_api_key_insert", rule: "apiKeyReferrerNotice", to: "app_runtime" },
	],
	RewardOtpChallenge: [{ name: "reward_otp_own", rule: "ownerOrSystem", column: "userId" }],
	RewardRedemption: [
		{ name: "reward_redemptions_system_write", rule: "system" },
		{ name: "reward_redemptions_select", rule: "redemptionReadable" },
		{ name: "reward_redemptions_api_key_read", rule: "apiKeyStoreRead", column: "tenantId", storeColumn: "locationId", to: "app_runtime" },
		{ name: "reward_redemptions_api_key_insert", rule: "apiKeyStoreInsert", column: "tenantId", storeColumn: "locationId", to: "app_runtime" },
	],
	RewardReferral: [
		// Referrals are recorded and settled only by system operations.
		{ name: "reward_referrals_system", rule: "system" },
		{ name: "reward_referrals_parties", rule: "referralParties" },
		{ name: "reward_referrals_api_key_read", rule: "apiKeyRewardRead", column: "rewardId", to: "app_runtime" },
		{ name: "reward_referrals_api_key_update", rule: "apiKeyRewardUpdate", column: "rewardId", to: "app_runtime" },
	],
	RewardSale: [
		{ name: "reward_sales_system_write", rule: "system" },
		// The customer reads their own bills; the merchant's analytics (analytics.read, at the sale's store) reads them all.
		{ name: "reward_sales_own_read", rule: "ownerRead", column: "userId" },
		{ name: "reward_sales_analytics_read", rule: "permissionRead", resource: "ANALYTICS", action: "READ", column: "tenantId", storeColumn: "locationId" },
		{ name: "reward_sales_api_key_read", rule: "apiKeyStoreRead", column: "tenantId", storeColumn: "locationId", to: "app_runtime" },
		{ name: "reward_sales_api_key_insert", rule: "apiKeyStoreInsert", column: "tenantId", storeColumn: "locationId", to: "app_runtime" },
	],
	Role: [
		{ name: "roles_write", rule: "system" },
		{ name: "roles_read", rule: "roleCatalogueReadable" },
	],
	RolePermission: [
		{ name: "role_permissions_write", rule: "system" },
		{ name: "role_permissions_read", rule: "rolePermissionFollowsRole" },
	],
	SampleCategory: [
		{ name: "sample_category_delete", rule: "systemDelete" },
		{ name: "sample_category_insert", rule: "systemInsert" },
		{ name: "sample_category_select", rule: "systemRead" },
		{ name: "sample_category_update", rule: "systemUpdate" },
	],
	SavedListView: [{ name: "saved_list_view_own", rule: "ownerOrSystem", column: "userId" }],
	SignupReferral: [
		// Signup referrals are recorded only by system operations; the referrer reads theirs.
		{ name: "signup_referrals_system", rule: "system" },
		{ name: "signup_referrals_referrer", rule: "ownerRead", column: "referrerUserId" },
		{ name: "signup_referrals_api_key_read", rule: "apiKeySignupRefereeRead", column: "refereeUserId", to: "app_runtime" },
		{ name: "signup_referrals_api_key_update", rule: "apiKeySignupRefereeUpdate", column: "refereeUserId", to: "app_runtime" },
	],
	SignupReferralCode: [
		// Codes are issued only by system operations; their owner reads them.
		{ name: "signup_referral_codes_system", rule: "system" },
		{ name: "signup_referral_codes_own", rule: "ownerRead", column: "userId" },
	],
	State: [
		{ name: "states_read", rule: "readableByAll" },
		{ name: "states_write", rule: "systemOperationWrite", operations: GEO_WRITERS },
	],
	StatusIncident: [{ name: "status_incident_bypass", rule: "system" }],
	StatusIncidentUpdate: [{ name: "status_incident_update_bypass", rule: "system" }],
	// A tenant's files follow the permission of the feature that uses them (ADR 090), not mere membership.
	StoredFile: [
		{ name: "stored_files_read", rule: "storedFileReadable" },
		{ name: "stored_files_write", rule: "storedFileWritable" },
		{ name: "stored_files_reward_image_read", rule: "publicRewardImageFile" },
		{ name: "stored_files_api_key_read", rule: "apiKeyNullableTenantRead", column: "tenantId", to: "app_runtime" },
	],
	Subregion: [
		{ name: "subregions_read", rule: "readableByAll" },
		{ name: "subregions_write", rule: "systemOperationWrite", operations: GEO_WRITERS },
	],
	// Read and written only by the `support_access.*` and `access.facts` system operations.
	SupportAccessGrant: [{ name: "support_access_grants_system", rule: "system" }],
	Tenant: [
		{ name: "tenants_write", rule: "system" },
		{ name: "tenants_member", rule: "tenantVisibleToMembers" },
		{ name: "tenants_api_key_read", rule: "apiKeyRead", column: "id", to: "app_runtime" },
	],
	TenantAccessRequest: [
		{ name: "tenant_access_requests_review", rule: "systemUpdate" },
		{ name: "tenant_access_requests_select", rule: "accessRequestReadable" },
		{ name: "tenant_access_requests_insert", rule: "accessRequestFile" },
	],
	// api_key.read lists the keys; api_key.create issues one, api_key.delete revokes one. A till's view shows its key's
	// state, so the terminal permissions read the keys too, and removing a till (terminal.delete) revokes its key. Each
	// writer reads back the rows it writes.
	TenantApiKey: [
		{ name: "tenant_api_keys_system", rule: "system", to: "app_runtime" },
		{ name: "tenant_api_keys_read", rule: "permissionRead", resource: "API_KEY", action: "READ", column: "tenantId", storeColumn: "locationId", to: "app_runtime" },
		{ name: "tenant_api_keys_manage_read", rule: "permissionRead", resource: "API_KEY", action: "CREATE", column: "tenantId", storeColumn: "locationId", to: "app_runtime" },
		{ name: "tenant_api_keys_revoker_read", rule: "permissionRead", resource: "API_KEY", action: "DELETE", column: "tenantId", storeColumn: "locationId", to: "app_runtime" },
		{ name: "tenant_api_keys_terminal_read", rule: "permissionRead", resource: "TERMINAL", action: "READ", column: "tenantId", storeColumn: "locationId", to: "app_runtime" },
		{
			name: "tenant_api_keys_terminal_manage_read",
			rule: "permissionRead",
			resource: "TERMINAL",
			action: "CREATE",
			column: "tenantId",
			storeColumn: "locationId",
			to: "app_runtime",
		},
		{
			name: "tenant_api_keys_terminal_remove_read",
			rule: "permissionRead",
			resource: "TERMINAL",
			action: "DELETE",
			column: "tenantId",
			storeColumn: "locationId",
			to: "app_runtime",
		},
		{ name: "tenant_api_keys_insert", rule: "permissionInsert", resource: "API_KEY", action: "CREATE", column: "tenantId", storeColumn: "locationId", to: "app_runtime" },
		{ name: "tenant_api_keys_revoke", rule: "permissionUpdate", resource: "API_KEY", action: "DELETE", column: "tenantId", storeColumn: "locationId", to: "app_runtime" },
		{
			name: "tenant_api_keys_terminal_revoke",
			rule: "permissionUpdate",
			resource: "TERMINAL",
			action: "DELETE",
			column: "tenantId",
			storeColumn: "locationId",
			to: "app_runtime",
		},
		{ name: "tenant_api_keys_api_key_self_read", rule: "apiKeySelfRead", to: "app_runtime" },
		{ name: "tenant_api_keys_api_key_self_update", rule: "apiKeySelfUpdate", to: "app_runtime" },
	],
	// The logo and banner: every member reads them (the merchant shell); location.update changes them.
	TenantAsset: [
		{ name: "tenant_assets_api_key_read", rule: "apiKeyRead", column: "tenantId", to: "app_runtime" },
		{ name: "tenant_assets_read", rule: "tenantMemberReadOrSystem", column: "tenantId" },
		{ name: "tenant_assets_update", rule: "permissionUpdate", resource: "LOCATION", action: "UPDATE", column: "tenantId" },
		{ name: "tenant_assets_system", rule: "system" },
	],
	// Every merchant permission check appends a row in the caller's name (allowed or denied); the caller reads back
	// only their own rows (INSERT … RETURNING); nobody but a system operation changes or deletes one.
	TenantAuditLog: [
		{ name: "tenant_audit_logs_system", rule: "system" },
		{ name: "tenant_audit_logs_append", rule: "tenantAuditAppend" },
		{ name: "tenant_audit_logs_own_read", rule: "ownTenantAuditRead" },
	],
	TenantBroadcastStrike: [{ name: "tenant_broadcast_strike_bypass", rule: "system" }],
	TenantCustomer: [
		{ name: "tenant_customer_api_key_insert", rule: "apiKeyInsert", column: "tenantId", to: "app_runtime" },
		{ name: "tenant_customer_api_key_read", rule: "apiKeyRead", column: "tenantId", to: "app_runtime" },
		{ name: "tenant_customer_api_key_update", rule: "apiKeyUpdate", column: "tenantId", to: "app_runtime" },
		{ name: "tenant_customer_write", rule: "system" },
		// The customer reads their own links; giving a reward to customers (reward.create, reward.update) reads the tenant's.
		{ name: "tenant_customer_read", rule: "ownerOrSystemRead", column: "userId" },
		{ name: "tenant_customer_reward_managers_read", rule: "permissionRead", resource: "REWARD", action: "UPDATE", column: "tenantId" },
		{ name: "tenant_customer_reward_creators_read", rule: "permissionRead", resource: "REWARD", action: "CREATE", column: "tenantId" },
	],
	// The redemption log shows a "banned" badge (redemption.read, cashiers included); the ban list is customer_ban.read.
	TenantCustomerBan: [
		{ name: "tenant_customer_bans_api_key_read", rule: "apiKeyRead", column: "tenantId", to: "app_runtime" },
		{ name: "tenant_customer_bans_write", rule: "system" },
		{ name: "tenant_customer_bans_redemption_read", rule: "permissionRead", resource: "REDEMPTION", action: "READ", column: "tenantId" },
		{ name: "tenant_customer_bans_read", rule: "permissionRead", resource: "CUSTOMER_BAN", action: "READ", column: "tenantId" },
	],
	// Encryption keys, lifecycle history, placements and slug history: system operations only.
	TenantEncryptionKey: [{ name: "tenant_encryption_keys_system", rule: "system" }],
	// Pending invitations: the team list (member.read) reads them, and so do inviting (invite.create) and revoking
	// (invite.delete); every write is a system operation.
	TenantInvitation: [
		{ name: "tenant_invitations_system", rule: "system" },
		{ name: "tenant_invitations_team_read", rule: "permissionRead", resource: "MEMBER", action: "READ", column: "tenantId" },
		{ name: "tenant_invitations_read", rule: "permissionRead", resource: "INVITE", action: "CREATE", column: "tenantId" },
		{ name: "tenant_invitations_revoker_read", rule: "permissionRead", resource: "INVITE", action: "DELETE", column: "tenantId" },
	],
	TenantInvitationLocationScope: [
		{ name: "tenant_invitation_location_scopes_system", rule: "system" },
		{ name: "tenant_invitation_location_scopes_team_read", rule: "permissionRead", resource: "MEMBER", action: "READ", column: "tenantId" },
		{ name: "tenant_invitation_location_scopes_read", rule: "permissionRead", resource: "INVITE", action: "CREATE", column: "tenantId" },
		{ name: "tenant_invitation_location_scopes_revoker_read", rule: "permissionRead", resource: "INVITE", action: "DELETE", column: "tenantId" },
	],
	// Verification documents: kyb.read reads them; kyb.update (the Owner) reads and writes them.
	TenantKybFile: [
		{ name: "tenant_kyb_files_system", rule: "system" },
		{ name: "tenant_kyb_files_read", rule: "permissionRead", resource: "KYB", action: "READ", column: "tenantId" },
		{ name: "tenant_kyb_files_manage_read", rule: "permissionRead", resource: "KYB", action: "UPDATE", column: "tenantId" },
		{ name: "tenant_kyb_files_insert", rule: "permissionInsert", resource: "KYB", action: "UPDATE", column: "tenantId" },
		{ name: "tenant_kyb_files_update", rule: "permissionUpdate", resource: "KYB", action: "UPDATE", column: "tenantId" },
	],
	TenantLifecycleEvent: [{ name: "tenant_lifecycle_events_system", rule: "system" }],
	// Every member reads the merchant profile (the merchant shell); verification (kyb.update) and the POS settings
	// (api_key.create, which the terminal routes check) change it.
	TenantMerchantProfile: [
		{ name: "tenant_merchant_profiles_read", rule: "tenantMemberReadOrSystem", column: "tenantId" },
		{ name: "tenant_merchant_profiles_kyb_update", rule: "permissionUpdate", resource: "KYB", action: "UPDATE", column: "tenantId" },
		{ name: "tenant_merchant_profiles_pos_update", rule: "permissionUpdate", resource: "API_KEY", action: "CREATE", column: "tenantId" },
		{ name: "tenant_merchant_profiles_system", rule: "system" },
	],
	TenantPlacement: [{ name: "tenant_placements_system", rule: "system" }],
	TenantRateLimitOverride: [{ name: "tenant_rate_limit_override_bypass", rule: "system" }],
	TenantSlugHistory: [{ name: "tenant_slug_history_system", rule: "system" }],
	TenantSuspensionAppeal: [{ name: "tenant_suspension_appeals_write", rule: "system" }],
	// terminal.read lists the tills; terminal.create registers one and issues its pairing code; terminal.delete removes
	// one — each at the till's store. Each writer reads back the rows it writes.
	TenantTerminal: [
		{ name: "tenant_terminals_system", rule: "system", to: "app_runtime" },
		{ name: "tenant_terminals_read", rule: "permissionRead", resource: "TERMINAL", action: "READ", column: "tenantId", storeColumn: "locationId", to: "app_runtime" },
		{ name: "tenant_terminals_manage_read", rule: "permissionRead", resource: "TERMINAL", action: "CREATE", column: "tenantId", storeColumn: "locationId", to: "app_runtime" },
		{
			name: "tenant_terminals_remover_read",
			rule: "permissionRead",
			resource: "TERMINAL",
			action: "DELETE",
			column: "tenantId",
			storeColumn: "locationId",
			to: "app_runtime",
		},
		{ name: "tenant_terminals_insert", rule: "permissionInsert", resource: "TERMINAL", action: "CREATE", column: "tenantId", storeColumn: "locationId", to: "app_runtime" },
		{ name: "tenant_terminals_update", rule: "permissionUpdate", resource: "TERMINAL", action: "CREATE", column: "tenantId", storeColumn: "locationId", to: "app_runtime" },
		{ name: "tenant_terminals_remove", rule: "permissionUpdate", resource: "TERMINAL", action: "DELETE", column: "tenantId", storeColumn: "locationId", to: "app_runtime" },
		{ name: "tenant_terminals_api_key_read", rule: "apiKeyStoreRead", column: "tenantId", storeColumn: "locationId", to: "app_runtime" },
		{ name: "tenant_terminals_api_key_update", rule: "apiKeyStoreUpdate", column: "tenantId", storeColumn: "locationId", to: "app_runtime" },
	],
	TwoFactorLoginChallenge: [{ name: "two_factor_login_challenges_own", rule: "ownerOrSystem", column: "userId" }],
	TwoFactorPendingSetup: [{ name: "two_factor_pending_setups_own", rule: "ownerOrSystem", column: "userId" }],
	User: [{ name: "users_own", rule: "systemOrOwner", column: "id" }],
	UserAvatar: [{ name: "user_avatars_owner", rule: "ownerOrSystem", column: "userId" }],
	UserPermission: [{ name: "user_permissions_own", rule: "ownerOrSystem", column: "userId" }],
	UserPreference: [{ name: "user_preferences_owner", rule: "ownerOrSystem", column: "userId" }],
	UserRole: [{ name: "user_roles_own", rule: "ownerOrSystem", column: "userId" }],
	WebAuthnChallenge: [{ name: "web_authn_challenges_own", rule: "ownerOrSystem", column: "userId" }],
	WebAuthnCredential: [{ name: "web_authn_credentials_own", rule: "ownerOrSystem", column: "userId" }],
	// Outgoing webhooks (ADR 082): webhook.read reads them; webhook.update tests, redelivers and changes an endpoint
	// (writing deliveries); webhook.create adds one and webhook.delete removes one. Each writer reads back its rows.
	WebhookDelivery: [
		{ name: "webhook_delivery_system", rule: "system" },
		{ name: "webhook_delivery_read", rule: "permissionRead", resource: "WEBHOOK", action: "READ", column: "tenantId" },
		{ name: "webhook_delivery_manage_read", rule: "permissionRead", resource: "WEBHOOK", action: "UPDATE", column: "tenantId" },
		{ name: "webhook_delivery_insert", rule: "permissionInsert", resource: "WEBHOOK", action: "UPDATE", column: "tenantId" },
		{ name: "webhook_delivery_update", rule: "permissionUpdate", resource: "WEBHOOK", action: "UPDATE", column: "tenantId" },
	],
	WebhookEndpoint: [
		{ name: "webhook_endpoint_system", rule: "system" },
		{ name: "webhook_endpoint_read", rule: "permissionRead", resource: "WEBHOOK", action: "READ", column: "tenantId" },
		{ name: "webhook_endpoint_manage_read", rule: "permissionRead", resource: "WEBHOOK", action: "UPDATE", column: "tenantId" },
		{ name: "webhook_endpoint_creator_read", rule: "permissionRead", resource: "WEBHOOK", action: "CREATE", column: "tenantId" },
		{ name: "webhook_endpoint_remover_read", rule: "permissionRead", resource: "WEBHOOK", action: "DELETE", column: "tenantId" },
		{ name: "webhook_endpoint_insert", rule: "permissionInsert", resource: "WEBHOOK", action: "CREATE", column: "tenantId" },
		{ name: "webhook_endpoint_update", rule: "permissionUpdate", resource: "WEBHOOK", action: "UPDATE", column: "tenantId" },
		{ name: "webhook_endpoint_remove", rule: "permissionUpdate", resource: "WEBHOOK", action: "DELETE", column: "tenantId" },
	],
	WebhookEvent: [
		{ name: "webhook_event_bypass", rule: "system" },
		{ name: "webhook_event_append", rule: "webhookEventAppend" },
	],
};
