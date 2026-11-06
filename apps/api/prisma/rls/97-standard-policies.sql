-- ============================================================================
-- GENERATED from prisma/rls/table-policies.ts by prisma/rls/standard-policies.ts
-- — do not edit by hand. Regenerate: pnpm --filter @workspace/api db:generate-rls-policies
-- ============================================================================
-- The policies that repeat across tables, one spelling per rule (ADR 083). One-off
-- policies stay hand-written in the other numbered fragments. This file runs after
-- them, so every helper it calls is defined.

DROP POLICY IF EXISTS account_erasure_system_write ON public."AccountErasure";
CREATE POLICY account_erasure_system_write ON public."AccountErasure"
  USING ((SELECT app_rls_bypass_on('AccountErasure')))
  WITH CHECK ((SELECT app_rls_bypass_on('AccountErasure')));

DROP POLICY IF EXISTS analytics_events_bypass ON public."AnalyticsEvent";
CREATE POLICY analytics_events_bypass ON public."AnalyticsEvent"
  TO app_runtime
  USING ((SELECT app_rls_bypass_on('AnalyticsEvent')))
  WITH CHECK ((SELECT app_rls_bypass_on('AnalyticsEvent')));

DROP POLICY IF EXISTS audit_legal_hold_bypass ON public."AuditLegalHold";
CREATE POLICY audit_legal_hold_bypass ON public."AuditLegalHold"
  USING ((SELECT app_rls_bypass_on('AuditLegalHold')))
  WITH CHECK ((SELECT app_rls_bypass_on('AuditLegalHold')));

DROP POLICY IF EXISTS audit_logs_insert ON public."AuditLog";
CREATE POLICY audit_logs_insert ON public."AuditLog"
  FOR INSERT
  WITH CHECK ((SELECT app_rls_bypass_on('AuditLog')));

DROP POLICY IF EXISTS audit_logs_select ON public."AuditLog";
CREATE POLICY audit_logs_select ON public."AuditLog"
  FOR SELECT
  USING ((SELECT app_rls_bypass_on('AuditLog')));

DROP POLICY IF EXISTS authorization_audits_bypass ON public."AuthorizationAudit";
CREATE POLICY authorization_audits_bypass ON public."AuthorizationAudit"
  USING ((SELECT app_rls_bypass_on('AuthorizationAudit')))
  WITH CHECK ((SELECT app_rls_bypass_on('AuthorizationAudit')));

DROP POLICY IF EXISTS backup_codes_own ON public."BackupCode";
CREATE POLICY backup_codes_own ON public."BackupCode"
  USING (app_owns("userId") OR (SELECT app_rls_bypass_on('BackupCode')))
  WITH CHECK (app_owns("userId") OR (SELECT app_rls_bypass_on('BackupCode')));

DROP POLICY IF EXISTS broadcast_write ON public."Broadcast";
CREATE POLICY broadcast_write ON public."Broadcast"
  USING ((SELECT app_rls_bypass_on('Broadcast')))
  WITH CHECK ((SELECT app_rls_bypass_on('Broadcast')));

DROP POLICY IF EXISTS broadcast_report_review ON public."BroadcastReport";
CREATE POLICY broadcast_report_review ON public."BroadcastReport"
  FOR UPDATE
  USING ((SELECT app_rls_bypass_on('BroadcastReport')))
  WITH CHECK ((SELECT app_rls_bypass_on('BroadcastReport')));

DROP POLICY IF EXISTS capability_definitions_read ON public."CapabilityDefinition";
CREATE POLICY capability_definitions_read ON public."CapabilityDefinition"
  FOR SELECT
  USING (true);

DROP POLICY IF EXISTS capability_definitions_write ON public."CapabilityDefinition";
CREATE POLICY capability_definitions_write ON public."CapabilityDefinition"
  USING ((SELECT app_rls_bypass_on('CapabilityDefinition')))
  WITH CHECK ((SELECT app_rls_bypass_on('CapabilityDefinition')));

DROP POLICY IF EXISTS cities_read ON public."City";
CREATE POLICY cities_read ON public."City"
  FOR SELECT
  USING (true);

DROP POLICY IF EXISTS countries_read ON public."Country";
CREATE POLICY countries_read ON public."Country"
  FOR SELECT
  USING (true);

DROP POLICY IF EXISTS data_change_logs_select ON public."DataChangeLog";
CREATE POLICY data_change_logs_select ON public."DataChangeLog"
  FOR SELECT
  USING ((SELECT app_rls_bypass_on('DataChangeLog')));

DROP POLICY IF EXISTS email_delivery_events_bypass ON public."EmailDeliveryEvent";
CREATE POLICY email_delivery_events_bypass ON public."EmailDeliveryEvent"
  USING ((SELECT app_rls_bypass_on('EmailDeliveryEvent')))
  WITH CHECK ((SELECT app_rls_bypass_on('EmailDeliveryEvent')));

DROP POLICY IF EXISTS email_logs_delete ON public."EmailLog";
CREATE POLICY email_logs_delete ON public."EmailLog"
  FOR DELETE
  USING ((SELECT app_rls_bypass_on('EmailLog')));

DROP POLICY IF EXISTS email_logs_select ON public."EmailLog";
CREATE POLICY email_logs_select ON public."EmailLog"
  FOR SELECT
  USING ((SELECT app_rls_bypass_on('EmailLog')));

DROP POLICY IF EXISTS email_logs_update ON public."EmailLog";
CREATE POLICY email_logs_update ON public."EmailLog"
  FOR UPDATE
  USING ((SELECT app_rls_bypass_on('EmailLog')))
  WITH CHECK ((SELECT app_rls_bypass_on('EmailLog')));

DROP POLICY IF EXISTS feature_flag_setting_bypass ON public."FeatureFlagSetting";
CREATE POLICY feature_flag_setting_bypass ON public."FeatureFlagSetting"
  USING ((SELECT app_rls_bypass_on('FeatureFlagSetting')))
  WITH CHECK ((SELECT app_rls_bypass_on('FeatureFlagSetting')));

DROP POLICY IF EXISTS feature_flag_store_override_bypass ON public."FeatureFlagStoreOverride";
CREATE POLICY feature_flag_store_override_bypass ON public."FeatureFlagStoreOverride"
  USING ((SELECT app_rls_bypass_on('FeatureFlagStoreOverride')))
  WITH CHECK ((SELECT app_rls_bypass_on('FeatureFlagStoreOverride')));

DROP POLICY IF EXISTS github_account_links_own ON public."GithubAccountLink";
CREATE POLICY github_account_links_own ON public."GithubAccountLink"
  USING (app_owns("userId") OR (SELECT app_rls_bypass_on('GithubAccountLink')))
  WITH CHECK (app_owns("userId") OR (SELECT app_rls_bypass_on('GithubAccountLink')));

DROP POLICY IF EXISTS github_webhook_deliveries_bypass ON public."GithubWebhookDelivery";
CREATE POLICY github_webhook_deliveries_bypass ON public."GithubWebhookDelivery"
  USING ((SELECT app_rls_bypass_on('GithubWebhookDelivery')))
  WITH CHECK ((SELECT app_rls_bypass_on('GithubWebhookDelivery')));

DROP POLICY IF EXISTS github_webhook_subscriptions_bypass ON public."GithubWebhookSubscription";
CREATE POLICY github_webhook_subscriptions_bypass ON public."GithubWebhookSubscription"
  USING ((SELECT app_rls_bypass_on('GithubWebhookSubscription')))
  WITH CHECK ((SELECT app_rls_bypass_on('GithubWebhookSubscription')));

DROP POLICY IF EXISTS impersonation_audit_logs_insert ON public."ImpersonationAuditLog";
CREATE POLICY impersonation_audit_logs_insert ON public."ImpersonationAuditLog"
  FOR INSERT
  TO app_runtime
  WITH CHECK ((SELECT app_rls_bypass_on('ImpersonationAuditLog')));

DROP POLICY IF EXISTS impersonation_audit_logs_select ON public."ImpersonationAuditLog";
CREATE POLICY impersonation_audit_logs_select ON public."ImpersonationAuditLog"
  FOR SELECT
  TO app_runtime
  USING ((SELECT app_rls_bypass_on('ImpersonationAuditLog')));

DROP POLICY IF EXISTS impersonation_sessions_bypass ON public."ImpersonationSession";
CREATE POLICY impersonation_sessions_bypass ON public."ImpersonationSession"
  USING ((SELECT app_rls_bypass_on('ImpersonationSession')))
  WITH CHECK ((SELECT app_rls_bypass_on('ImpersonationSession')));

DROP POLICY IF EXISTS in_app_notification_own ON public."InAppNotification";
CREATE POLICY in_app_notification_own ON public."InAppNotification"
  USING (app_owns("userId") OR (SELECT app_rls_bypass_on('InAppNotification')))
  WITH CHECK (app_owns("userId") OR (SELECT app_rls_bypass_on('InAppNotification')));

DROP POLICY IF EXISTS inbox_dead_letters_bypass ON public."InboxDeadLetter";
CREATE POLICY inbox_dead_letters_bypass ON public."InboxDeadLetter"
  TO app_runtime
  USING ((SELECT app_rls_bypass_on('InboxDeadLetter')))
  WITH CHECK ((SELECT app_rls_bypass_on('InboxDeadLetter')));

DROP POLICY IF EXISTS inbox_processed_events_bypass ON public."InboxProcessedEvent";
CREATE POLICY inbox_processed_events_bypass ON public."InboxProcessedEvent"
  TO app_runtime
  USING ((SELECT app_rls_bypass_on('InboxProcessedEvent')))
  WITH CHECK ((SELECT app_rls_bypass_on('InboxProcessedEvent')));

DROP POLICY IF EXISTS kanban_checklist_item_insert ON public."KanbanChecklistItem";
CREATE POLICY kanban_checklist_item_insert ON public."KanbanChecklistItem"
  FOR INSERT
  WITH CHECK ((SELECT app_rls_bypass_on('KanbanChecklistItem')));

DROP POLICY IF EXISTS kanban_checklist_item_select ON public."KanbanChecklistItem";
CREATE POLICY kanban_checklist_item_select ON public."KanbanChecklistItem"
  FOR SELECT
  USING ((SELECT app_rls_bypass_on('KanbanChecklistItem')));

DROP POLICY IF EXISTS kanban_checklist_item_update ON public."KanbanChecklistItem";
CREATE POLICY kanban_checklist_item_update ON public."KanbanChecklistItem"
  FOR UPDATE
  USING ((SELECT app_rls_bypass_on('KanbanChecklistItem')))
  WITH CHECK ((SELECT app_rls_bypass_on('KanbanChecklistItem')));

DROP POLICY IF EXISTS kanban_column_insert ON public."KanbanColumn";
CREATE POLICY kanban_column_insert ON public."KanbanColumn"
  FOR INSERT
  WITH CHECK ((SELECT app_rls_bypass_on('KanbanColumn')));

DROP POLICY IF EXISTS kanban_column_select ON public."KanbanColumn";
CREATE POLICY kanban_column_select ON public."KanbanColumn"
  FOR SELECT
  USING ((SELECT app_rls_bypass_on('KanbanColumn')));

DROP POLICY IF EXISTS kanban_column_update ON public."KanbanColumn";
CREATE POLICY kanban_column_update ON public."KanbanColumn"
  FOR UPDATE
  USING ((SELECT app_rls_bypass_on('KanbanColumn')))
  WITH CHECK ((SELECT app_rls_bypass_on('KanbanColumn')));

DROP POLICY IF EXISTS kanban_conversion_stage_insert ON public."KanbanConversionStage";
CREATE POLICY kanban_conversion_stage_insert ON public."KanbanConversionStage"
  FOR INSERT
  WITH CHECK ((SELECT app_rls_bypass_on('KanbanConversionStage')));

DROP POLICY IF EXISTS kanban_conversion_stage_select ON public."KanbanConversionStage";
CREATE POLICY kanban_conversion_stage_select ON public."KanbanConversionStage"
  FOR SELECT
  USING ((SELECT app_rls_bypass_on('KanbanConversionStage')));

DROP POLICY IF EXISTS kanban_conversion_stage_update ON public."KanbanConversionStage";
CREATE POLICY kanban_conversion_stage_update ON public."KanbanConversionStage"
  FOR UPDATE
  USING ((SELECT app_rls_bypass_on('KanbanConversionStage')))
  WITH CHECK ((SELECT app_rls_bypass_on('KanbanConversionStage')));

DROP POLICY IF EXISTS kanban_execution_column_insert ON public."KanbanExecutionColumn";
CREATE POLICY kanban_execution_column_insert ON public."KanbanExecutionColumn"
  FOR INSERT
  WITH CHECK ((SELECT app_rls_bypass_on('KanbanExecutionColumn')));

DROP POLICY IF EXISTS kanban_execution_column_select ON public."KanbanExecutionColumn";
CREATE POLICY kanban_execution_column_select ON public."KanbanExecutionColumn"
  FOR SELECT
  USING ((SELECT app_rls_bypass_on('KanbanExecutionColumn')));

DROP POLICY IF EXISTS kanban_execution_column_update ON public."KanbanExecutionColumn";
CREATE POLICY kanban_execution_column_update ON public."KanbanExecutionColumn"
  FOR UPDATE
  USING ((SELECT app_rls_bypass_on('KanbanExecutionColumn')))
  WITH CHECK ((SELECT app_rls_bypass_on('KanbanExecutionColumn')));

DROP POLICY IF EXISTS kanban_level_counter_insert ON public."KanbanLevelCounter";
CREATE POLICY kanban_level_counter_insert ON public."KanbanLevelCounter"
  FOR INSERT
  WITH CHECK ((SELECT app_rls_bypass_on('KanbanLevelCounter')));

DROP POLICY IF EXISTS kanban_level_counter_select ON public."KanbanLevelCounter";
CREATE POLICY kanban_level_counter_select ON public."KanbanLevelCounter"
  FOR SELECT
  USING ((SELECT app_rls_bypass_on('KanbanLevelCounter')));

DROP POLICY IF EXISTS kanban_level_counter_update ON public."KanbanLevelCounter";
CREATE POLICY kanban_level_counter_update ON public."KanbanLevelCounter"
  FOR UPDATE
  USING ((SELECT app_rls_bypass_on('KanbanLevelCounter')))
  WITH CHECK ((SELECT app_rls_bypass_on('KanbanLevelCounter')));

DROP POLICY IF EXISTS kanban_planning_column_insert ON public."KanbanPlanningColumn";
CREATE POLICY kanban_planning_column_insert ON public."KanbanPlanningColumn"
  FOR INSERT
  WITH CHECK ((SELECT app_rls_bypass_on('KanbanPlanningColumn')));

DROP POLICY IF EXISTS kanban_planning_column_select ON public."KanbanPlanningColumn";
CREATE POLICY kanban_planning_column_select ON public."KanbanPlanningColumn"
  FOR SELECT
  USING ((SELECT app_rls_bypass_on('KanbanPlanningColumn')));

DROP POLICY IF EXISTS kanban_planning_column_update ON public."KanbanPlanningColumn";
CREATE POLICY kanban_planning_column_update ON public."KanbanPlanningColumn"
  FOR UPDATE
  USING ((SELECT app_rls_bypass_on('KanbanPlanningColumn')))
  WITH CHECK ((SELECT app_rls_bypass_on('KanbanPlanningColumn')));

DROP POLICY IF EXISTS kanban_task_insert ON public."KanbanTask";
CREATE POLICY kanban_task_insert ON public."KanbanTask"
  FOR INSERT
  WITH CHECK ((SELECT app_rls_bypass_on('KanbanTask')));

DROP POLICY IF EXISTS kanban_task_select ON public."KanbanTask";
CREATE POLICY kanban_task_select ON public."KanbanTask"
  FOR SELECT
  USING ((SELECT app_rls_bypass_on('KanbanTask')));

DROP POLICY IF EXISTS kanban_task_update ON public."KanbanTask";
CREATE POLICY kanban_task_update ON public."KanbanTask"
  FOR UPDATE
  USING ((SELECT app_rls_bypass_on('KanbanTask')))
  WITH CHECK ((SELECT app_rls_bypass_on('KanbanTask')));

DROP POLICY IF EXISTS kanban_task_activity_insert ON public."KanbanTaskActivity";
CREATE POLICY kanban_task_activity_insert ON public."KanbanTaskActivity"
  FOR INSERT
  WITH CHECK ((SELECT app_rls_bypass_on('KanbanTaskActivity')));

DROP POLICY IF EXISTS kanban_task_activity_select ON public."KanbanTaskActivity";
CREATE POLICY kanban_task_activity_select ON public."KanbanTaskActivity"
  FOR SELECT
  USING ((SELECT app_rls_bypass_on('KanbanTaskActivity')));

DROP POLICY IF EXISTS kanban_task_activity_update ON public."KanbanTaskActivity";
CREATE POLICY kanban_task_activity_update ON public."KanbanTaskActivity"
  FOR UPDATE
  USING ((SELECT app_rls_bypass_on('KanbanTaskActivity')))
  WITH CHECK ((SELECT app_rls_bypass_on('KanbanTaskActivity')));

DROP POLICY IF EXISTS kanban_task_attachment_insert ON public."KanbanTaskAttachment";
CREATE POLICY kanban_task_attachment_insert ON public."KanbanTaskAttachment"
  FOR INSERT
  WITH CHECK ((SELECT app_rls_bypass_on('KanbanTaskAttachment')));

DROP POLICY IF EXISTS kanban_task_attachment_select ON public."KanbanTaskAttachment";
CREATE POLICY kanban_task_attachment_select ON public."KanbanTaskAttachment"
  FOR SELECT
  USING ((SELECT app_rls_bypass_on('KanbanTaskAttachment')));

DROP POLICY IF EXISTS kanban_task_attachment_update ON public."KanbanTaskAttachment";
CREATE POLICY kanban_task_attachment_update ON public."KanbanTaskAttachment"
  FOR UPDATE
  USING ((SELECT app_rls_bypass_on('KanbanTaskAttachment')))
  WITH CHECK ((SELECT app_rls_bypass_on('KanbanTaskAttachment')));

DROP POLICY IF EXISTS kanban_task_comment_insert ON public."KanbanTaskComment";
CREATE POLICY kanban_task_comment_insert ON public."KanbanTaskComment"
  FOR INSERT
  WITH CHECK ((SELECT app_rls_bypass_on('KanbanTaskComment')));

DROP POLICY IF EXISTS kanban_task_comment_select ON public."KanbanTaskComment";
CREATE POLICY kanban_task_comment_select ON public."KanbanTaskComment"
  FOR SELECT
  USING ((SELECT app_rls_bypass_on('KanbanTaskComment')));

DROP POLICY IF EXISTS kanban_task_comment_update ON public."KanbanTaskComment";
CREATE POLICY kanban_task_comment_update ON public."KanbanTaskComment"
  FOR UPDATE
  USING ((SELECT app_rls_bypass_on('KanbanTaskComment')))
  WITH CHECK ((SELECT app_rls_bypass_on('KanbanTaskComment')));

DROP POLICY IF EXISTS kanban_task_link_insert ON public."KanbanTaskLink";
CREATE POLICY kanban_task_link_insert ON public."KanbanTaskLink"
  FOR INSERT
  WITH CHECK ((SELECT app_rls_bypass_on('KanbanTaskLink')));

DROP POLICY IF EXISTS kanban_task_link_select ON public."KanbanTaskLink";
CREATE POLICY kanban_task_link_select ON public."KanbanTaskLink"
  FOR SELECT
  USING ((SELECT app_rls_bypass_on('KanbanTaskLink')));

DROP POLICY IF EXISTS kanban_task_link_update ON public."KanbanTaskLink";
CREATE POLICY kanban_task_link_update ON public."KanbanTaskLink"
  FOR UPDATE
  USING ((SELECT app_rls_bypass_on('KanbanTaskLink')))
  WITH CHECK ((SELECT app_rls_bypass_on('KanbanTaskLink')));

DROP POLICY IF EXISTS kanban_task_watcher_insert ON public."KanbanTaskWatcher";
CREATE POLICY kanban_task_watcher_insert ON public."KanbanTaskWatcher"
  FOR INSERT
  WITH CHECK ((SELECT app_rls_bypass_on('KanbanTaskWatcher')));

DROP POLICY IF EXISTS kanban_task_watcher_select ON public."KanbanTaskWatcher";
CREATE POLICY kanban_task_watcher_select ON public."KanbanTaskWatcher"
  FOR SELECT
  USING ((SELECT app_rls_bypass_on('KanbanTaskWatcher')));

DROP POLICY IF EXISTS kanban_task_watcher_update ON public."KanbanTaskWatcher";
CREATE POLICY kanban_task_watcher_update ON public."KanbanTaskWatcher"
  FOR UPDATE
  USING ((SELECT app_rls_bypass_on('KanbanTaskWatcher')))
  WITH CHECK ((SELECT app_rls_bypass_on('KanbanTaskWatcher')));

DROP POLICY IF EXISTS load_test_point_bypass ON public."LoadTestPoint";
CREATE POLICY load_test_point_bypass ON public."LoadTestPoint"
  USING ((SELECT app_rls_bypass_on('LoadTestPoint')))
  WITH CHECK ((SELECT app_rls_bypass_on('LoadTestPoint')));

DROP POLICY IF EXISTS load_test_run_bypass ON public."LoadTestRun";
CREATE POLICY load_test_run_bypass ON public."LoadTestRun"
  USING ((SELECT app_rls_bypass_on('LoadTestRun')))
  WITH CHECK ((SELECT app_rls_bypass_on('LoadTestRun')));

DROP POLICY IF EXISTS load_test_step_stat_bypass ON public."LoadTestStepStat";
CREATE POLICY load_test_step_stat_bypass ON public."LoadTestStepStat"
  USING ((SELECT app_rls_bypass_on('LoadTestStepStat')))
  WITH CHECK ((SELECT app_rls_bypass_on('LoadTestStepStat')));

DROP POLICY IF EXISTS locations_api_key_read ON public."Location";
CREATE POLICY locations_api_key_read ON public."Location"
  FOR SELECT
  TO app_runtime
  USING (app_api_key_org_access("tenantId"));

DROP POLICY IF EXISTS mfa_recovery_audit_logs_insert ON public."MfaRecoveryAuditLog";
CREATE POLICY mfa_recovery_audit_logs_insert ON public."MfaRecoveryAuditLog"
  FOR INSERT
  TO app_runtime
  WITH CHECK ((SELECT app_rls_bypass_on('MfaRecoveryAuditLog')));

DROP POLICY IF EXISTS mfa_recovery_audit_logs_select ON public."MfaRecoveryAuditLog";
CREATE POLICY mfa_recovery_audit_logs_select ON public."MfaRecoveryAuditLog"
  FOR SELECT
  TO app_runtime
  USING ((SELECT app_rls_bypass_on('MfaRecoveryAuditLog')));

DROP POLICY IF EXISTS mfa_recovery_requests_own ON public."MfaRecoveryRequest";
CREATE POLICY mfa_recovery_requests_own ON public."MfaRecoveryRequest"
  USING (app_owns("userId") OR (SELECT app_rls_bypass_on('MfaRecoveryRequest')))
  WITH CHECK (app_owns("userId") OR (SELECT app_rls_bypass_on('MfaRecoveryRequest')));

DROP POLICY IF EXISTS notification_delete ON public."Notification";
CREATE POLICY notification_delete ON public."Notification"
  FOR DELETE
  USING ((SELECT app_rls_bypass_on('Notification')));

DROP POLICY IF EXISTS notification_select ON public."Notification";
CREATE POLICY notification_select ON public."Notification"
  FOR SELECT
  USING ((SELECT app_rls_bypass_on('Notification')));

DROP POLICY IF EXISTS notification_update ON public."Notification";
CREATE POLICY notification_update ON public."Notification"
  FOR UPDATE
  USING ((SELECT app_rls_bypass_on('Notification')))
  WITH CHECK ((SELECT app_rls_bypass_on('Notification')));

DROP POLICY IF EXISTS notification_delivery_bypass ON public."NotificationDelivery";
CREATE POLICY notification_delivery_bypass ON public."NotificationDelivery"
  USING ((SELECT app_rls_bypass_on('NotificationDelivery')))
  WITH CHECK ((SELECT app_rls_bypass_on('NotificationDelivery')));

DROP POLICY IF EXISTS notification_preference_own ON public."NotificationPreference";
CREATE POLICY notification_preference_own ON public."NotificationPreference"
  USING (app_owns("userId") OR (SELECT app_rls_bypass_on('NotificationPreference')))
  WITH CHECK (app_owns("userId") OR (SELECT app_rls_bypass_on('NotificationPreference')));

DROP POLICY IF EXISTS notification_schedule_own ON public."NotificationSchedule";
CREATE POLICY notification_schedule_own ON public."NotificationSchedule"
  USING (app_owns("userId") OR (SELECT app_rls_bypass_on('NotificationSchedule')))
  WITH CHECK (app_owns("userId") OR (SELECT app_rls_bypass_on('NotificationSchedule')));

DROP POLICY IF EXISTS notification_suppression_bypass ON public."NotificationSuppression";
CREATE POLICY notification_suppression_bypass ON public."NotificationSuppression"
  USING ((SELECT app_rls_bypass_on('NotificationSuppression')))
  WITH CHECK ((SELECT app_rls_bypass_on('NotificationSuppression')));

DROP POLICY IF EXISTS ops_alert_bypass ON public."OpsAlert";
CREATE POLICY ops_alert_bypass ON public."OpsAlert"
  USING ((SELECT app_rls_bypass_on('OpsAlert')))
  WITH CHECK ((SELECT app_rls_bypass_on('OpsAlert')));

DROP POLICY IF EXISTS ops_backup_bypass ON public."OpsBackup";
CREATE POLICY ops_backup_bypass ON public."OpsBackup"
  USING ((SELECT app_rls_bypass_on('OpsBackup')))
  WITH CHECK ((SELECT app_rls_bypass_on('OpsBackup')));

DROP POLICY IF EXISTS ops_dependency_sample_bypass ON public."OpsDependencySample";
CREATE POLICY ops_dependency_sample_bypass ON public."OpsDependencySample"
  USING ((SELECT app_rls_bypass_on('OpsDependencySample')))
  WITH CHECK ((SELECT app_rls_bypass_on('OpsDependencySample')));

DROP POLICY IF EXISTS ops_instance_sample_bypass ON public."OpsInstanceSample";
CREATE POLICY ops_instance_sample_bypass ON public."OpsInstanceSample"
  USING ((SELECT app_rls_bypass_on('OpsInstanceSample')))
  WITH CHECK ((SELECT app_rls_bypass_on('OpsInstanceSample')));

DROP POLICY IF EXISTS ops_restore_drill_bypass ON public."OpsRestoreDrill";
CREATE POLICY ops_restore_drill_bypass ON public."OpsRestoreDrill"
  USING ((SELECT app_rls_bypass_on('OpsRestoreDrill')))
  WITH CHECK ((SELECT app_rls_bypass_on('OpsRestoreDrill')));

DROP POLICY IF EXISTS ops_server_bypass ON public."OpsServer";
CREATE POLICY ops_server_bypass ON public."OpsServer"
  USING ((SELECT app_rls_bypass_on('OpsServer')))
  WITH CHECK ((SELECT app_rls_bypass_on('OpsServer')));

DROP POLICY IF EXISTS ops_server_sample_bypass ON public."OpsServerSample";
CREATE POLICY ops_server_sample_bypass ON public."OpsServerSample"
  USING ((SELECT app_rls_bypass_on('OpsServerSample')))
  WITH CHECK ((SELECT app_rls_bypass_on('OpsServerSample')));

DROP POLICY IF EXISTS ops_settings_bypass ON public."OpsSettings";
CREATE POLICY ops_settings_bypass ON public."OpsSettings"
  USING ((SELECT app_rls_bypass_on('OpsSettings')))
  WITH CHECK ((SELECT app_rls_bypass_on('OpsSettings')));

DROP POLICY IF EXISTS outbox_events_bypass ON public."OutboxEvent";
CREATE POLICY outbox_events_bypass ON public."OutboxEvent"
  USING ((SELECT app_rls_bypass_on('OutboxEvent')))
  WITH CHECK ((SELECT app_rls_bypass_on('OutboxEvent')));

DROP POLICY IF EXISTS password_history_own ON public."PasswordHistory";
CREATE POLICY password_history_own ON public."PasswordHistory"
  USING (app_owns("userId") OR (SELECT app_rls_bypass_on('PasswordHistory')))
  WITH CHECK (app_owns("userId") OR (SELECT app_rls_bypass_on('PasswordHistory')));

DROP POLICY IF EXISTS password_reset_tokens_own ON public."PasswordResetToken";
CREATE POLICY password_reset_tokens_own ON public."PasswordResetToken"
  USING (app_owns("userId") OR (SELECT app_rls_bypass_on('PasswordResetToken')))
  WITH CHECK (app_owns("userId") OR (SELECT app_rls_bypass_on('PasswordResetToken')));

DROP POLICY IF EXISTS payment_events_select ON public."PaymentEvent";
CREATE POLICY payment_events_select ON public."PaymentEvent"
  FOR SELECT
  USING (app_tenant_org_member("tenantId") OR (SELECT app_rls_bypass_on('PaymentEvent')));

DROP POLICY IF EXISTS payment_events_system_write ON public."PaymentEvent";
CREATE POLICY payment_events_system_write ON public."PaymentEvent"
  USING ((SELECT app_rls_bypass_on('PaymentEvent')))
  WITH CHECK ((SELECT app_rls_bypass_on('PaymentEvent')));

DROP POLICY IF EXISTS payment_intents_select ON public."PaymentIntent";
CREATE POLICY payment_intents_select ON public."PaymentIntent"
  FOR SELECT
  USING (app_tenant_org_member("tenantId") OR (SELECT app_rls_bypass_on('PaymentIntent')));

DROP POLICY IF EXISTS payment_intents_system_write ON public."PaymentIntent";
CREATE POLICY payment_intents_system_write ON public."PaymentIntent"
  USING ((SELECT app_rls_bypass_on('PaymentIntent')))
  WITH CHECK ((SELECT app_rls_bypass_on('PaymentIntent')));

DROP POLICY IF EXISTS permissions_read ON public."Permission";
CREATE POLICY permissions_read ON public."Permission"
  FOR SELECT
  USING (true);

DROP POLICY IF EXISTS permissions_write ON public."Permission";
CREATE POLICY permissions_write ON public."Permission"
  USING ((SELECT app_rls_bypass_on('Permission')))
  WITH CHECK ((SELECT app_rls_bypass_on('Permission')));

DROP POLICY IF EXISTS permission_audit_logs_bypass ON public."PermissionAuditLog";
CREATE POLICY permission_audit_logs_bypass ON public."PermissionAuditLog"
  USING ((SELECT app_rls_bypass_on('PermissionAuditLog')))
  WITH CHECK ((SELECT app_rls_bypass_on('PermissionAuditLog')));

DROP POLICY IF EXISTS platform_resource_idempotency_bypass ON public."PlatformResourceIdempotencyRecord";
CREATE POLICY platform_resource_idempotency_bypass ON public."PlatformResourceIdempotencyRecord"
  USING ((SELECT app_rls_bypass_on('PlatformResourceIdempotencyRecord')))
  WITH CHECK ((SELECT app_rls_bypass_on('PlatformResourceIdempotencyRecord')));

DROP POLICY IF EXISTS product_delete ON public."Product";
CREATE POLICY product_delete ON public."Product"
  FOR DELETE
  USING ((SELECT app_rls_bypass_on('Product')));

DROP POLICY IF EXISTS product_insert ON public."Product";
CREATE POLICY product_insert ON public."Product"
  FOR INSERT
  WITH CHECK ((SELECT app_rls_bypass_on('Product')));

DROP POLICY IF EXISTS product_select ON public."Product";
CREATE POLICY product_select ON public."Product"
  FOR SELECT
  USING ((SELECT app_rls_bypass_on('Product')));

DROP POLICY IF EXISTS product_update ON public."Product";
CREATE POLICY product_update ON public."Product"
  FOR UPDATE
  USING ((SELECT app_rls_bypass_on('Product')))
  WITH CHECK ((SELECT app_rls_bypass_on('Product')));

DROP POLICY IF EXISTS product_images_catalog ON public."ProductImage";
CREATE POLICY product_images_catalog ON public."ProductImage"
  USING ((SELECT app_rls_bypass_on('ProductImage')))
  WITH CHECK ((SELECT app_rls_bypass_on('ProductImage')));

DROP POLICY IF EXISTS push_device_own ON public."PushDevice";
CREATE POLICY push_device_own ON public."PushDevice"
  USING (app_owns("userId") OR (SELECT app_rls_bypass_on('PushDevice')))
  WITH CHECK (app_owns("userId") OR (SELECT app_rls_bypass_on('PushDevice')));

DROP POLICY IF EXISTS received_webhook_bypass ON public."ReceivedWebhook";
CREATE POLICY received_webhook_bypass ON public."ReceivedWebhook"
  USING ((SELECT app_rls_bypass_on('ReceivedWebhook')))
  WITH CHECK ((SELECT app_rls_bypass_on('ReceivedWebhook')));

DROP POLICY IF EXISTS refresh_tokens_own ON public."RefreshToken";
CREATE POLICY refresh_tokens_own ON public."RefreshToken"
  USING (app_owns("userId") OR (SELECT app_rls_bypass_on('RefreshToken')))
  WITH CHECK (app_owns("userId") OR (SELECT app_rls_bypass_on('RefreshToken')));

DROP POLICY IF EXISTS regions_read ON public."Region";
CREATE POLICY regions_read ON public."Region"
  FOR SELECT
  USING (true);

DROP POLICY IF EXISTS retention_run_bypass ON public."RetentionRun";
CREATE POLICY retention_run_bypass ON public."RetentionRun"
  USING ((SELECT app_rls_bypass_on('RetentionRun')))
  WITH CHECK ((SELECT app_rls_bypass_on('RetentionRun')));

DROP POLICY IF EXISTS rewards_api_key_insert ON public."Reward";
CREATE POLICY rewards_api_key_insert ON public."Reward"
  FOR INSERT
  TO app_runtime
  WITH CHECK (app_api_key_org_access("tenantId"));

DROP POLICY IF EXISTS rewards_api_key_read ON public."Reward";
CREATE POLICY rewards_api_key_read ON public."Reward"
  FOR SELECT
  TO app_runtime
  USING (app_api_key_org_access("tenantId"));

DROP POLICY IF EXISTS rewards_api_key_update ON public."Reward";
CREATE POLICY rewards_api_key_update ON public."Reward"
  FOR UPDATE
  TO app_runtime
  USING (app_api_key_org_access("tenantId"))
  WITH CHECK (app_api_key_org_access("tenantId"));

DROP POLICY IF EXISTS reward_audience_members_api_key_insert ON public."RewardAudienceMember";
CREATE POLICY reward_audience_members_api_key_insert ON public."RewardAudienceMember"
  FOR INSERT
  TO app_runtime
  WITH CHECK (app_api_key_org_access("tenantId"));

DROP POLICY IF EXISTS reward_audience_members_api_key_read ON public."RewardAudienceMember";
CREATE POLICY reward_audience_members_api_key_read ON public."RewardAudienceMember"
  FOR SELECT
  TO app_runtime
  USING (app_api_key_org_access("tenantId"));

DROP POLICY IF EXISTS reward_audience_members_api_key_update ON public."RewardAudienceMember";
CREATE POLICY reward_audience_members_api_key_update ON public."RewardAudienceMember"
  FOR UPDATE
  TO app_runtime
  USING (app_api_key_org_access("tenantId"))
  WITH CHECK (app_api_key_org_access("tenantId"));

DROP POLICY IF EXISTS reward_audience_members_read ON public."RewardAudienceMember";
CREATE POLICY reward_audience_members_read ON public."RewardAudienceMember"
  FOR SELECT
  USING (app_tenant_org_member("tenantId") OR (SELECT app_rls_bypass_on('RewardAudienceMember')));

DROP POLICY IF EXISTS reward_audience_members_write ON public."RewardAudienceMember";
CREATE POLICY reward_audience_members_write ON public."RewardAudienceMember"
  USING (app_tenant_org_member("tenantId") OR (SELECT app_rls_bypass_on('RewardAudienceMember')))
  WITH CHECK (app_tenant_org_member("tenantId") OR (SELECT app_rls_bypass_on('RewardAudienceMember')));

DROP POLICY IF EXISTS reward_claims_own ON public."RewardClaim";
CREATE POLICY reward_claims_own ON public."RewardClaim"
  USING (app_owns("userId") OR (SELECT app_rls_bypass_on('RewardClaim')))
  WITH CHECK (app_owns("userId") OR (SELECT app_rls_bypass_on('RewardClaim')));

DROP POLICY IF EXISTS reward_claim_hold_own ON public."RewardClaimHold";
CREATE POLICY reward_claim_hold_own ON public."RewardClaimHold"
  USING (app_owns("userId") OR (SELECT app_rls_bypass_on('RewardClaimHold')))
  WITH CHECK (app_owns("userId") OR (SELECT app_rls_bypass_on('RewardClaimHold')));

DROP POLICY IF EXISTS reward_images_api_key_insert ON public."RewardImage";
CREATE POLICY reward_images_api_key_insert ON public."RewardImage"
  FOR INSERT
  TO app_runtime
  WITH CHECK (app_api_key_org_access("tenantId"));

DROP POLICY IF EXISTS reward_images_api_key_read ON public."RewardImage";
CREATE POLICY reward_images_api_key_read ON public."RewardImage"
  FOR SELECT
  TO app_runtime
  USING (app_api_key_org_access("tenantId"));

DROP POLICY IF EXISTS reward_images_api_key_update ON public."RewardImage";
CREATE POLICY reward_images_api_key_update ON public."RewardImage"
  FOR UPDATE
  TO app_runtime
  USING (app_api_key_org_access("tenantId"))
  WITH CHECK (app_api_key_org_access("tenantId"));

DROP POLICY IF EXISTS reward_images_write ON public."RewardImage";
CREATE POLICY reward_images_write ON public."RewardImage"
  USING (app_tenant_org_member("tenantId") OR (SELECT app_rls_bypass_on('RewardImage')))
  WITH CHECK (app_tenant_org_member("tenantId") OR (SELECT app_rls_bypass_on('RewardImage')));

DROP POLICY IF EXISTS reward_legal_own ON public."RewardLegalAcceptance";
CREATE POLICY reward_legal_own ON public."RewardLegalAcceptance"
  USING (app_owns("userId") OR (SELECT app_rls_bypass_on('RewardLegalAcceptance')))
  WITH CHECK (app_owns("userId") OR (SELECT app_rls_bypass_on('RewardLegalAcceptance')));

DROP POLICY IF EXISTS reward_location_scopes_api_key_insert ON public."RewardLocationScope";
CREATE POLICY reward_location_scopes_api_key_insert ON public."RewardLocationScope"
  FOR INSERT
  TO app_runtime
  WITH CHECK (app_api_key_org_access("tenantId"));

DROP POLICY IF EXISTS reward_location_scopes_api_key_read ON public."RewardLocationScope";
CREATE POLICY reward_location_scopes_api_key_read ON public."RewardLocationScope"
  FOR SELECT
  TO app_runtime
  USING (app_api_key_org_access("tenantId"));

DROP POLICY IF EXISTS reward_location_scopes_write ON public."RewardLocationScope";
CREATE POLICY reward_location_scopes_write ON public."RewardLocationScope"
  USING (app_tenant_org_member("tenantId") OR (SELECT app_rls_bypass_on('RewardLocationScope')))
  WITH CHECK (app_tenant_org_member("tenantId") OR (SELECT app_rls_bypass_on('RewardLocationScope')));

DROP POLICY IF EXISTS reward_notifications_own ON public."RewardNotification";
CREATE POLICY reward_notifications_own ON public."RewardNotification"
  USING (app_owns("userId") OR (SELECT app_rls_bypass_on('RewardNotification')))
  WITH CHECK (app_owns("userId") OR (SELECT app_rls_bypass_on('RewardNotification')));

DROP POLICY IF EXISTS reward_otp_own ON public."RewardOtpChallenge";
CREATE POLICY reward_otp_own ON public."RewardOtpChallenge"
  USING (app_owns("userId") OR (SELECT app_rls_bypass_on('RewardOtpChallenge')))
  WITH CHECK (app_owns("userId") OR (SELECT app_rls_bypass_on('RewardOtpChallenge')));

DROP POLICY IF EXISTS reward_redemptions_system_write ON public."RewardRedemption";
CREATE POLICY reward_redemptions_system_write ON public."RewardRedemption"
  USING ((SELECT app_rls_bypass_on('RewardRedemption')))
  WITH CHECK ((SELECT app_rls_bypass_on('RewardRedemption')));

DROP POLICY IF EXISTS reward_sales_system_write ON public."RewardSale";
CREATE POLICY reward_sales_system_write ON public."RewardSale"
  USING ((SELECT app_rls_bypass_on('RewardSale')))
  WITH CHECK ((SELECT app_rls_bypass_on('RewardSale')));

DROP POLICY IF EXISTS roles_write ON public."Role";
CREATE POLICY roles_write ON public."Role"
  USING ((SELECT app_rls_bypass_on('Role')))
  WITH CHECK ((SELECT app_rls_bypass_on('Role')));

DROP POLICY IF EXISTS role_permissions_write ON public."RolePermission";
CREATE POLICY role_permissions_write ON public."RolePermission"
  USING ((SELECT app_rls_bypass_on('RolePermission')))
  WITH CHECK ((SELECT app_rls_bypass_on('RolePermission')));

DROP POLICY IF EXISTS sample_category_delete ON public."SampleCategory";
CREATE POLICY sample_category_delete ON public."SampleCategory"
  FOR DELETE
  USING ((SELECT app_rls_bypass_on('SampleCategory')));

DROP POLICY IF EXISTS sample_category_insert ON public."SampleCategory";
CREATE POLICY sample_category_insert ON public."SampleCategory"
  FOR INSERT
  WITH CHECK ((SELECT app_rls_bypass_on('SampleCategory')));

DROP POLICY IF EXISTS sample_category_select ON public."SampleCategory";
CREATE POLICY sample_category_select ON public."SampleCategory"
  FOR SELECT
  USING ((SELECT app_rls_bypass_on('SampleCategory')));

DROP POLICY IF EXISTS sample_category_update ON public."SampleCategory";
CREATE POLICY sample_category_update ON public."SampleCategory"
  FOR UPDATE
  USING ((SELECT app_rls_bypass_on('SampleCategory')))
  WITH CHECK ((SELECT app_rls_bypass_on('SampleCategory')));

DROP POLICY IF EXISTS saved_list_view_own ON public."SavedListView";
CREATE POLICY saved_list_view_own ON public."SavedListView"
  USING (app_owns("userId") OR (SELECT app_rls_bypass_on('SavedListView')))
  WITH CHECK (app_owns("userId") OR (SELECT app_rls_bypass_on('SavedListView')));

DROP POLICY IF EXISTS states_read ON public."State";
CREATE POLICY states_read ON public."State"
  FOR SELECT
  USING (true);

DROP POLICY IF EXISTS status_incident_bypass ON public."StatusIncident";
CREATE POLICY status_incident_bypass ON public."StatusIncident"
  USING ((SELECT app_rls_bypass_on('StatusIncident')))
  WITH CHECK ((SELECT app_rls_bypass_on('StatusIncident')));

DROP POLICY IF EXISTS status_incident_update_bypass ON public."StatusIncidentUpdate";
CREATE POLICY status_incident_update_bypass ON public."StatusIncidentUpdate"
  USING ((SELECT app_rls_bypass_on('StatusIncidentUpdate')))
  WITH CHECK ((SELECT app_rls_bypass_on('StatusIncidentUpdate')));

DROP POLICY IF EXISTS subregions_read ON public."Subregion";
CREATE POLICY subregions_read ON public."Subregion"
  FOR SELECT
  USING (true);

DROP POLICY IF EXISTS tenants_write ON public."Tenant";
CREATE POLICY tenants_write ON public."Tenant"
  USING ((SELECT app_rls_bypass_on('Tenant')))
  WITH CHECK ((SELECT app_rls_bypass_on('Tenant')));

DROP POLICY IF EXISTS tenant_access_requests_review ON public."TenantAccessRequest";
CREATE POLICY tenant_access_requests_review ON public."TenantAccessRequest"
  FOR UPDATE
  USING ((SELECT app_rls_bypass_on('TenantAccessRequest')))
  WITH CHECK ((SELECT app_rls_bypass_on('TenantAccessRequest')));

DROP POLICY IF EXISTS tenant_assets_api_key_read ON public."TenantAsset";
CREATE POLICY tenant_assets_api_key_read ON public."TenantAsset"
  FOR SELECT
  TO app_runtime
  USING (app_api_key_org_access("tenantId"));

DROP POLICY IF EXISTS tenant_assets_org ON public."TenantAsset";
CREATE POLICY tenant_assets_org ON public."TenantAsset"
  USING (app_tenant_org_member("tenantId") OR (SELECT app_rls_bypass_on('TenantAsset')))
  WITH CHECK (app_tenant_org_member("tenantId") OR (SELECT app_rls_bypass_on('TenantAsset')));

DROP POLICY IF EXISTS tenant_broadcast_strike_bypass ON public."TenantBroadcastStrike";
CREATE POLICY tenant_broadcast_strike_bypass ON public."TenantBroadcastStrike"
  USING ((SELECT app_rls_bypass_on('TenantBroadcastStrike')))
  WITH CHECK ((SELECT app_rls_bypass_on('TenantBroadcastStrike')));

DROP POLICY IF EXISTS tenant_customer_api_key_insert ON public."TenantCustomer";
CREATE POLICY tenant_customer_api_key_insert ON public."TenantCustomer"
  FOR INSERT
  TO app_runtime
  WITH CHECK (app_api_key_org_access("tenantId"));

DROP POLICY IF EXISTS tenant_customer_api_key_read ON public."TenantCustomer";
CREATE POLICY tenant_customer_api_key_read ON public."TenantCustomer"
  FOR SELECT
  TO app_runtime
  USING (app_api_key_org_access("tenantId"));

DROP POLICY IF EXISTS tenant_customer_api_key_update ON public."TenantCustomer";
CREATE POLICY tenant_customer_api_key_update ON public."TenantCustomer"
  FOR UPDATE
  TO app_runtime
  USING (app_api_key_org_access("tenantId"))
  WITH CHECK (app_api_key_org_access("tenantId"));

DROP POLICY IF EXISTS tenant_customer_write ON public."TenantCustomer";
CREATE POLICY tenant_customer_write ON public."TenantCustomer"
  USING ((SELECT app_rls_bypass_on('TenantCustomer')))
  WITH CHECK ((SELECT app_rls_bypass_on('TenantCustomer')));

DROP POLICY IF EXISTS tenant_customer_bans_api_key_read ON public."TenantCustomerBan";
CREATE POLICY tenant_customer_bans_api_key_read ON public."TenantCustomerBan"
  FOR SELECT
  TO app_runtime
  USING (app_api_key_org_access("tenantId"));

DROP POLICY IF EXISTS tenant_customer_bans_write ON public."TenantCustomerBan";
CREATE POLICY tenant_customer_bans_write ON public."TenantCustomerBan"
  USING ((SELECT app_rls_bypass_on('TenantCustomerBan')))
  WITH CHECK ((SELECT app_rls_bypass_on('TenantCustomerBan')));

DROP POLICY IF EXISTS tenant_kyb_files_org ON public."TenantKybFile";
CREATE POLICY tenant_kyb_files_org ON public."TenantKybFile"
  USING (app_tenant_org_member("tenantId") OR (SELECT app_rls_bypass_on('TenantKybFile')))
  WITH CHECK (app_tenant_org_member("tenantId") OR (SELECT app_rls_bypass_on('TenantKybFile')));

DROP POLICY IF EXISTS tenant_rate_limit_override_bypass ON public."TenantRateLimitOverride";
CREATE POLICY tenant_rate_limit_override_bypass ON public."TenantRateLimitOverride"
  USING ((SELECT app_rls_bypass_on('TenantRateLimitOverride')))
  WITH CHECK ((SELECT app_rls_bypass_on('TenantRateLimitOverride')));

DROP POLICY IF EXISTS tenant_suspension_appeals_write ON public."TenantSuspensionAppeal";
CREATE POLICY tenant_suspension_appeals_write ON public."TenantSuspensionAppeal"
  USING ((SELECT app_rls_bypass_on('TenantSuspensionAppeal')))
  WITH CHECK ((SELECT app_rls_bypass_on('TenantSuspensionAppeal')));

DROP POLICY IF EXISTS two_factor_login_challenges_own ON public."TwoFactorLoginChallenge";
CREATE POLICY two_factor_login_challenges_own ON public."TwoFactorLoginChallenge"
  USING (app_owns("userId") OR (SELECT app_rls_bypass_on('TwoFactorLoginChallenge')))
  WITH CHECK (app_owns("userId") OR (SELECT app_rls_bypass_on('TwoFactorLoginChallenge')));

DROP POLICY IF EXISTS two_factor_pending_setups_own ON public."TwoFactorPendingSetup";
CREATE POLICY two_factor_pending_setups_own ON public."TwoFactorPendingSetup"
  USING (app_owns("userId") OR (SELECT app_rls_bypass_on('TwoFactorPendingSetup')))
  WITH CHECK (app_owns("userId") OR (SELECT app_rls_bypass_on('TwoFactorPendingSetup')));

DROP POLICY IF EXISTS user_avatars_owner ON public."UserAvatar";
CREATE POLICY user_avatars_owner ON public."UserAvatar"
  USING (app_owns("userId") OR (SELECT app_rls_bypass_on('UserAvatar')))
  WITH CHECK (app_owns("userId") OR (SELECT app_rls_bypass_on('UserAvatar')));

DROP POLICY IF EXISTS user_permissions_own ON public."UserPermission";
CREATE POLICY user_permissions_own ON public."UserPermission"
  USING (app_owns("userId") OR (SELECT app_rls_bypass_on('UserPermission')))
  WITH CHECK (app_owns("userId") OR (SELECT app_rls_bypass_on('UserPermission')));

DROP POLICY IF EXISTS user_preferences_owner ON public."UserPreference";
CREATE POLICY user_preferences_owner ON public."UserPreference"
  USING (app_owns("userId") OR (SELECT app_rls_bypass_on('UserPreference')))
  WITH CHECK (app_owns("userId") OR (SELECT app_rls_bypass_on('UserPreference')));

DROP POLICY IF EXISTS user_roles_own ON public."UserRole";
CREATE POLICY user_roles_own ON public."UserRole"
  USING (app_owns("userId") OR (SELECT app_rls_bypass_on('UserRole')))
  WITH CHECK (app_owns("userId") OR (SELECT app_rls_bypass_on('UserRole')));

DROP POLICY IF EXISTS web_authn_challenges_own ON public."WebAuthnChallenge";
CREATE POLICY web_authn_challenges_own ON public."WebAuthnChallenge"
  USING (app_owns("userId") OR (SELECT app_rls_bypass_on('WebAuthnChallenge')))
  WITH CHECK (app_owns("userId") OR (SELECT app_rls_bypass_on('WebAuthnChallenge')));

DROP POLICY IF EXISTS web_authn_credentials_own ON public."WebAuthnCredential";
CREATE POLICY web_authn_credentials_own ON public."WebAuthnCredential"
  USING (app_owns("userId") OR (SELECT app_rls_bypass_on('WebAuthnCredential')))
  WITH CHECK (app_owns("userId") OR (SELECT app_rls_bypass_on('WebAuthnCredential')));

DROP POLICY IF EXISTS webhook_delivery_tenant ON public."WebhookDelivery";
CREATE POLICY webhook_delivery_tenant ON public."WebhookDelivery"
  USING (app_tenant_org_member("tenantId") OR (SELECT app_rls_bypass_on('WebhookDelivery')))
  WITH CHECK (app_tenant_org_member("tenantId") OR (SELECT app_rls_bypass_on('WebhookDelivery')));

DROP POLICY IF EXISTS webhook_endpoint_tenant ON public."WebhookEndpoint";
CREATE POLICY webhook_endpoint_tenant ON public."WebhookEndpoint"
  USING (app_tenant_org_member("tenantId") OR (SELECT app_rls_bypass_on('WebhookEndpoint')))
  WITH CHECK (app_tenant_org_member("tenantId") OR (SELECT app_rls_bypass_on('WebhookEndpoint')));

DROP POLICY IF EXISTS webhook_event_bypass ON public."WebhookEvent";
CREATE POLICY webhook_event_bypass ON public."WebhookEvent"
  USING ((SELECT app_rls_bypass_on('WebhookEvent')))
  WITH CHECK ((SELECT app_rls_bypass_on('WebhookEvent')));
