/**
 * Every table's standard row-level security rules, the source of `97-standard-policies.sql` (ADR 083).
 * Every table is named here, so a table nobody thought about fails `table-policies.spec.ts`. An empty
 * list means the table's policies are all one-offs, hand-written in the numbered `.sql` fragments.
 */

/** The rules that repeat across tables; anything else stays hand-written SQL. */
export type StandardRule =
	| "system"
	| "systemRead"
	| "systemInsert"
	| "systemUpdate"
	| "systemDelete"
	| "ownerOrSystem"
	| "tenantMemberOrSystem"
	| "tenantMemberReadOrSystem"
	| "readableByAll"
	| "apiKeyRead"
	| "apiKeyInsert"
	| "apiKeyUpdate";

/** One generated policy of a table. */
export interface TablePolicy {
	readonly name: string;
	readonly rule: StandardRule;
	/** The owner or tenant column the rule checks. */
	readonly column?: string;
	/** Limits the policy to one role; left out, it applies to every role. */
	readonly to?: "app_runtime";
}

export const TABLE_POLICIES: Readonly<Record<string, readonly TablePolicy[]>> = {
	AccountErasure: [{ name: "account_erasure_system_write", rule: "system" }],
	AnalyticsEvent: [{ name: "analytics_events_bypass", rule: "system", to: "app_runtime" }],
	AuditLegalHold: [{ name: "audit_legal_hold_bypass", rule: "system" }],
	AuditLog: [
		{ name: "audit_logs_insert", rule: "systemInsert" },
		{ name: "audit_logs_select", rule: "systemRead" },
	],
	AuthorizationAudit: [{ name: "authorization_audits_bypass", rule: "system" }],
	BackupCode: [{ name: "backup_codes_own", rule: "ownerOrSystem", column: "userId" }],
	Broadcast: [{ name: "broadcast_write", rule: "system" }],
	BroadcastReport: [{ name: "broadcast_report_review", rule: "systemUpdate" }],
	CapabilityDefinition: [
		{ name: "capability_definitions_read", rule: "readableByAll" },
		{ name: "capability_definitions_write", rule: "system" },
	],
	City: [{ name: "cities_read", rule: "readableByAll" }],
	Country: [{ name: "countries_read", rule: "readableByAll" }],
	DataChangeGroup: [],
	DataChangeLog: [{ name: "data_change_logs_select", rule: "systemRead" }],
	EmailDeliveryEvent: [{ name: "email_delivery_events_bypass", rule: "system" }],
	EmailLog: [
		{ name: "email_logs_delete", rule: "systemDelete" },
		{ name: "email_logs_select", rule: "systemRead" },
		{ name: "email_logs_update", rule: "systemUpdate" },
	],
	FeatureFlagSetting: [{ name: "feature_flag_setting_bypass", rule: "system" }],
	FeatureFlagStoreOverride: [{ name: "feature_flag_store_override_bypass", rule: "system" }],
	FileVariant: [],
	GithubAccountLink: [{ name: "github_account_links_own", rule: "ownerOrSystem", column: "userId" }],
	GithubWebhookDelivery: [{ name: "github_webhook_deliveries_bypass", rule: "system" }],
	GithubWebhookSubscription: [{ name: "github_webhook_subscriptions_bypass", rule: "system" }],
	ImpersonationAuditLog: [
		{ name: "impersonation_audit_logs_insert", rule: "systemInsert", to: "app_runtime" },
		{ name: "impersonation_audit_logs_select", rule: "systemRead", to: "app_runtime" },
	],
	ImpersonationSession: [{ name: "impersonation_sessions_bypass", rule: "system" }],
	InAppNotification: [{ name: "in_app_notification_own", rule: "ownerOrSystem", column: "userId" }],
	InboxDeadLetter: [{ name: "inbox_dead_letters_bypass", rule: "system", to: "app_runtime" }],
	InboxProcessedEvent: [{ name: "inbox_processed_events_bypass", rule: "system", to: "app_runtime" }],
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
	Location: [{ name: "locations_api_key_read", rule: "apiKeyRead", column: "tenantId", to: "app_runtime" }],
	MarketingConsent: [],
	Membership: [],
	MembershipLocationScope: [],
	MfaRecoveryAuditLog: [
		{ name: "mfa_recovery_audit_logs_insert", rule: "systemInsert", to: "app_runtime" },
		{ name: "mfa_recovery_audit_logs_select", rule: "systemRead", to: "app_runtime" },
	],
	MfaRecoveryRequest: [{ name: "mfa_recovery_requests_own", rule: "ownerOrSystem", column: "userId" }],
	Notification: [
		{ name: "notification_delete", rule: "systemDelete" },
		{ name: "notification_select", rule: "systemRead" },
		{ name: "notification_update", rule: "systemUpdate" },
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
	OutboxEvent: [{ name: "outbox_events_bypass", rule: "system" }],
	PasswordHistory: [{ name: "password_history_own", rule: "ownerOrSystem", column: "userId" }],
	PasswordResetToken: [{ name: "password_reset_tokens_own", rule: "ownerOrSystem", column: "userId" }],
	PaymentEvent: [
		{ name: "payment_events_select", rule: "tenantMemberReadOrSystem", column: "tenantId" },
		{ name: "payment_events_system_write", rule: "system" },
	],
	PaymentIntent: [
		{ name: "payment_intents_select", rule: "tenantMemberReadOrSystem", column: "tenantId" },
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
	RefreshToken: [{ name: "refresh_tokens_own", rule: "ownerOrSystem", column: "userId" }],
	Region: [{ name: "regions_read", rule: "readableByAll" }],
	ResourceAcl: [],
	RetentionRun: [{ name: "retention_run_bypass", rule: "system" }],
	Reward: [
		{ name: "rewards_api_key_insert", rule: "apiKeyInsert", column: "tenantId", to: "app_runtime" },
		{ name: "rewards_api_key_read", rule: "apiKeyRead", column: "tenantId", to: "app_runtime" },
		{ name: "rewards_api_key_update", rule: "apiKeyUpdate", column: "tenantId", to: "app_runtime" },
	],
	RewardAudienceMember: [
		{ name: "reward_audience_members_api_key_insert", rule: "apiKeyInsert", column: "tenantId", to: "app_runtime" },
		{ name: "reward_audience_members_api_key_read", rule: "apiKeyRead", column: "tenantId", to: "app_runtime" },
		{ name: "reward_audience_members_api_key_update", rule: "apiKeyUpdate", column: "tenantId", to: "app_runtime" },
		{ name: "reward_audience_members_read", rule: "tenantMemberReadOrSystem", column: "tenantId" },
		{ name: "reward_audience_members_write", rule: "tenantMemberOrSystem", column: "tenantId" },
	],
	RewardAuditLog: [],
	RewardClaim: [{ name: "reward_claims_own", rule: "ownerOrSystem", column: "userId" }],
	RewardClaimHold: [{ name: "reward_claim_hold_own", rule: "ownerOrSystem", column: "userId" }],
	RewardImage: [
		{ name: "reward_images_api_key_insert", rule: "apiKeyInsert", column: "tenantId", to: "app_runtime" },
		{ name: "reward_images_api_key_read", rule: "apiKeyRead", column: "tenantId", to: "app_runtime" },
		{ name: "reward_images_api_key_update", rule: "apiKeyUpdate", column: "tenantId", to: "app_runtime" },
		{ name: "reward_images_write", rule: "tenantMemberOrSystem", column: "tenantId" },
	],
	RewardLegalAcceptance: [{ name: "reward_legal_own", rule: "ownerOrSystem", column: "userId" }],
	RewardLocationScope: [
		{ name: "reward_location_scopes_api_key_insert", rule: "apiKeyInsert", column: "tenantId", to: "app_runtime" },
		{ name: "reward_location_scopes_api_key_read", rule: "apiKeyRead", column: "tenantId", to: "app_runtime" },
		{ name: "reward_location_scopes_write", rule: "tenantMemberOrSystem", column: "tenantId" },
	],
	RewardNotification: [{ name: "reward_notifications_own", rule: "ownerOrSystem", column: "userId" }],
	RewardOtpChallenge: [{ name: "reward_otp_own", rule: "ownerOrSystem", column: "userId" }],
	RewardRedemption: [{ name: "reward_redemptions_system_write", rule: "system" }],
	RewardReferral: [],
	RewardSale: [{ name: "reward_sales_system_write", rule: "system" }],
	Role: [{ name: "roles_write", rule: "system" }],
	RolePermission: [{ name: "role_permissions_write", rule: "system" }],
	SampleCategory: [
		{ name: "sample_category_delete", rule: "systemDelete" },
		{ name: "sample_category_insert", rule: "systemInsert" },
		{ name: "sample_category_select", rule: "systemRead" },
		{ name: "sample_category_update", rule: "systemUpdate" },
	],
	SavedListView: [{ name: "saved_list_view_own", rule: "ownerOrSystem", column: "userId" }],
	SignupReferral: [],
	SignupReferralCode: [],
	State: [{ name: "states_read", rule: "readableByAll" }],
	StatusIncident: [{ name: "status_incident_bypass", rule: "system" }],
	StatusIncidentUpdate: [{ name: "status_incident_update_bypass", rule: "system" }],
	StoredFile: [],
	Subregion: [{ name: "subregions_read", rule: "readableByAll" }],
	SupportAccessGrant: [],
	Tenant: [{ name: "tenants_write", rule: "system" }],
	TenantAccessRequest: [{ name: "tenant_access_requests_review", rule: "systemUpdate" }],
	TenantApiKey: [],
	TenantAsset: [
		{ name: "tenant_assets_api_key_read", rule: "apiKeyRead", column: "tenantId", to: "app_runtime" },
		{ name: "tenant_assets_org", rule: "tenantMemberOrSystem", column: "tenantId" },
	],
	TenantAuditLog: [],
	TenantBroadcastStrike: [{ name: "tenant_broadcast_strike_bypass", rule: "system" }],
	TenantCustomer: [
		{ name: "tenant_customer_api_key_insert", rule: "apiKeyInsert", column: "tenantId", to: "app_runtime" },
		{ name: "tenant_customer_api_key_read", rule: "apiKeyRead", column: "tenantId", to: "app_runtime" },
		{ name: "tenant_customer_api_key_update", rule: "apiKeyUpdate", column: "tenantId", to: "app_runtime" },
		{ name: "tenant_customer_write", rule: "system" },
	],
	TenantCustomerBan: [
		{ name: "tenant_customer_bans_api_key_read", rule: "apiKeyRead", column: "tenantId", to: "app_runtime" },
		{ name: "tenant_customer_bans_write", rule: "system" },
	],
	TenantEncryptionKey: [],
	TenantInvitation: [],
	TenantInvitationLocationScope: [],
	TenantKybFile: [{ name: "tenant_kyb_files_org", rule: "tenantMemberOrSystem", column: "tenantId" }],
	TenantLifecycleEvent: [],
	TenantMerchantProfile: [],
	TenantPlacement: [],
	TenantRateLimitOverride: [{ name: "tenant_rate_limit_override_bypass", rule: "system" }],
	TenantSlugHistory: [],
	TenantSuspensionAppeal: [{ name: "tenant_suspension_appeals_write", rule: "system" }],
	TenantTerminal: [],
	TwoFactorLoginChallenge: [{ name: "two_factor_login_challenges_own", rule: "ownerOrSystem", column: "userId" }],
	TwoFactorPendingSetup: [{ name: "two_factor_pending_setups_own", rule: "ownerOrSystem", column: "userId" }],
	User: [],
	UserAvatar: [{ name: "user_avatars_owner", rule: "ownerOrSystem", column: "userId" }],
	UserPermission: [{ name: "user_permissions_own", rule: "ownerOrSystem", column: "userId" }],
	UserPreference: [{ name: "user_preferences_owner", rule: "ownerOrSystem", column: "userId" }],
	UserRole: [{ name: "user_roles_own", rule: "ownerOrSystem", column: "userId" }],
	WebAuthnChallenge: [{ name: "web_authn_challenges_own", rule: "ownerOrSystem", column: "userId" }],
	WebAuthnCredential: [{ name: "web_authn_credentials_own", rule: "ownerOrSystem", column: "userId" }],
	WebhookDelivery: [{ name: "webhook_delivery_tenant", rule: "tenantMemberOrSystem", column: "tenantId" }],
	WebhookEndpoint: [{ name: "webhook_endpoint_tenant", rule: "tenantMemberOrSystem", column: "tenantId" }],
	WebhookEvent: [{ name: "webhook_event_bypass", rule: "system" }],
};
