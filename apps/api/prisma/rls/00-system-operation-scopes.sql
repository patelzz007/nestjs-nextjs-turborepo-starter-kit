-- ============================================================================
-- GENERATED from src/prisma/system-operation.registry.ts by
-- prisma/rls/system-operation-scopes.ts — do not edit by hand.
-- Regenerate: pnpm --filter @workspace/api db:generate-system-operation-scopes
-- ============================================================================
-- Which tables each allowlisted system operation's RLS bypass reaches (ADR 012).
-- Every policy admits a system operation only through
-- `(SELECT app_rls_bypass_on('<its table>'))`: the session must ask for a
-- bypass, name its operation, and that operation must list the table.
-- An unlisted operation matches no branch and bypasses nothing.
-- ============================================================================

CREATE OR REPLACE FUNCTION app_rls_bypass_on(table_name text) RETURNS boolean
LANGUAGE sql STABLE AS $$
  SELECT app_rls_bypass() AND CASE app_system_operation()
    WHEN 'audit.data_change.read' THEN table_name IN ('AuditLog', 'DataChangeLog', 'Organization', 'User')
    WHEN 'audit.http_request.read' THEN table_name IN ('AuditLog', 'Organization', 'User')
    WHEN 'audit.http_request.record' THEN table_name IN ('AuditLog')
    WHEN 'audit.trail.read' THEN table_name IN ('AuditLog', 'DataChangeLog', 'Organization', 'User')
    WHEN 'auth.mfa_recovery.request' THEN true -- every table: not_yet_narrowed
    WHEN 'auth.mfa_recovery.review' THEN true -- every table: not_yet_narrowed
    WHEN 'auth.profile.update' THEN true -- every table: not_yet_narrowed
    WHEN 'auth.signup_referrals.list_referees' THEN true -- every table: not_yet_narrowed
    WHEN 'auth.signup_referrals.notify_success' THEN true -- every table: not_yet_narrowed
    WHEN 'auth.superadmin.bootstrap' THEN true -- every table: not_yet_narrowed
    WHEN 'authorization.audit_log.read' THEN true -- every table: not_yet_narrowed
    WHEN 'authorization.capability_catalog.sync' THEN true -- every table: not_yet_narrowed
    WHEN 'authorization.permission_registry.sync' THEN true -- every table: not_yet_narrowed
    WHEN 'authorization.rbac.inspect' THEN true -- every table: not_yet_narrowed
    WHEN 'authorization.rbac.mutate' THEN true -- every table: not_yet_narrowed
    WHEN 'catalog.product_catalog.read' THEN table_name IN ('Product', 'SampleCategory')
    WHEN 'catalog.product_catalog.write' THEN table_name IN ('OutboxEvent', 'Product', 'SampleCategory')
    WHEN 'email.log.write' THEN table_name IN ('EmailDeliveryEvent', 'EmailLog', 'OutboxEvent')
    WHEN 'encryption.tenant_key.provision' THEN table_name IN ('OrganizationAuditLog', 'TenantEncryptionKey')
    WHEN 'encryption.tenant_key.rewrap' THEN table_name IN ('OrganizationAuditLog', 'TenantEncryptionKey', 'User')
    WHEN 'encryption.tenant_key.unwrap' THEN table_name IN ('OrganizationAuditLog', 'TenantEncryptionKey')
    WHEN 'files.authorization' THEN true -- every table: not_yet_narrowed
    WHEN 'files.delete' THEN true -- every table: not_yet_narrowed
    WHEN 'files.scan_verdict.apply' THEN true -- every table: not_yet_narrowed
    WHEN 'geo.reference_data.write' THEN table_name IN ('AuditLog', 'City', 'Country', 'Region', 'State', 'Subregion')
    WHEN 'github.webhook.deliveries' THEN table_name IN ('GithubWebhookDelivery')
    WHEN 'github.webhook.subscriptions' THEN table_name IN ('GithubWebhookSubscription')
    WHEN 'http.idempotency' THEN table_name IN ('PlatformResourceIdempotencyRecord')
    WHEN 'idempotency.retention' THEN table_name IN ('PlatformResourceIdempotencyRecord')
    WHEN 'maintenance.audit_log_retention' THEN true -- every table: not_yet_narrowed
    WHEN 'maintenance.authorization_change_sweep' THEN table_name IN ('User')
    WHEN 'maintenance.mfa_recovery_unlock' THEN true -- every table: not_yet_narrowed
    WHEN 'maintenance.password_reset_token_cleanup' THEN true -- every table: not_yet_narrowed
    WHEN 'maintenance.permission_expiry' THEN true -- every table: not_yet_narrowed
    WHEN 'maintenance.signup_referral_codes' THEN true -- every table: not_yet_narrowed
    WHEN 'organization.access_request.create' THEN true -- every table: not_yet_narrowed
    WHEN 'organization.access_request.review' THEN true -- every table: not_yet_narrowed
    WHEN 'organization.context.list_memberships' THEN true -- every table: not_yet_narrowed
    WHEN 'organization.context.location_access' THEN true -- every table: not_yet_narrowed
    WHEN 'organization.context.resolve_membership' THEN true -- every table: not_yet_narrowed
    WHEN 'organization.context.resolve_route_key' THEN true -- every table: not_yet_narrowed
    WHEN 'organization.display_data.read' THEN true -- every table: not_yet_narrowed
    WHEN 'organization.invitation.accept_merchant_onboarding' THEN true -- every table: not_yet_narrowed
    WHEN 'organization.invitation.create' THEN true -- every table: not_yet_narrowed
    WHEN 'organization.invitation.register_and_accept' THEN true -- every table: not_yet_narrowed
    WHEN 'organization.invitation.resolve_token' THEN true -- every table: not_yet_narrowed
    WHEN 'organization.invitation.revoke' THEN true -- every table: not_yet_narrowed
    WHEN 'organization.invitation.submit_onboarding_documents' THEN true -- every table: not_yet_narrowed
    WHEN 'organization.kyb.admin_decide' THEN true -- every table: not_yet_narrowed
    WHEN 'organization.location.admin_create' THEN true -- every table: not_yet_narrowed
    WHEN 'organization.location.admin_list' THEN true -- every table: not_yet_narrowed
    WHEN 'organization.location.admin_review' THEN true -- every table: not_yet_narrowed
    WHEN 'organization.location.close' THEN true -- every table: not_yet_narrowed
    WHEN 'organization.membership.accept' THEN true -- every table: not_yet_narrowed
    WHEN 'organization.membership.remove_from_store' THEN true -- every table: not_yet_narrowed
    WHEN 'organization.membership.roster' THEN true -- every table: not_yet_narrowed
    WHEN 'organization.merchant.admin_read' THEN true -- every table: not_yet_narrowed
    WHEN 'organization.provision.admin_merchant_invite' THEN true -- every table: not_yet_narrowed
    WHEN 'organization.provision.platform_invite' THEN true -- every table: not_yet_narrowed
    WHEN 'outbox.enqueue' THEN table_name IN ('OutboxEvent')
    WHEN 'outbox.publish' THEN table_name IN ('OutboxEvent')
    WHEN 'outbox.retention' THEN table_name IN ('OutboxEvent')
    WHEN 'platform.staff_single_tenant' THEN true -- every table: request_scope
    WHEN 'platform.superadmin' THEN true -- every table: request_scope
    WHEN 'policy.bundle.load' THEN table_name IN ('AuthorizationPolicyVersion')
    WHEN 'policy.draft.create' THEN true -- every table: not_yet_narrowed
    WHEN 'policy.draft.simulate' THEN true -- every table: not_yet_narrowed
    WHEN 'policy.publish' THEN true -- every table: not_yet_narrowed
    WHEN 'pos.terminal.pair' THEN true -- every table: not_yet_narrowed
    WHEN 'queue.claims.expire_pending' THEN true -- every table: not_yet_narrowed
    WHEN 'queue.claims.expire_referrer' THEN true -- every table: not_yet_narrowed
    WHEN 'queue.email.send' THEN table_name IN ('EmailDeliveryEvent', 'EmailLog', 'OutboxEvent')
    WHEN 'queue.rewards.auto_publish' THEN true -- every table: not_yet_narrowed
    WHEN 'queue.rewards.referral_credit_notify' THEN true -- every table: not_yet_narrowed
    WHEN 'queue.storage.cleanup' THEN true -- every table: not_yet_narrowed
    WHEN 'queue.storage.delete' THEN true -- every table: not_yet_narrowed
    WHEN 'queue.storage.scan' THEN true -- every table: not_yet_narrowed
    WHEN 'reference_data.sync' THEN true -- every table: not_yet_narrowed
    WHEN 'request.pre_handler' THEN true -- every table: request_scope
    WHEN 'rewards.referral_credit.deliver' THEN true -- every table: not_yet_narrowed
    WHEN 'rewards.sales.merchant_summary' THEN true -- every table: not_yet_narrowed
    WHEN 'route.rls_bypass' THEN true -- every table: request_scope
    WHEN 'support_access.approve' THEN true -- every table: not_yet_narrowed
    WHEN 'support_access.grant' THEN true -- every table: not_yet_narrowed
    WHEN 'support_access.revoke' THEN true -- every table: not_yet_narrowed
    WHEN 'support_access.verify' THEN table_name IN ('SupportAccessGrant')
    WHEN 'tenancy.default_organization.verify' THEN table_name IN ('Organization')
    WHEN 'tenant.enumerate' THEN table_name IN ('Organization')
    ELSE false
  END;
$$;

COMMENT ON FUNCTION app_rls_bypass_on(text) IS
  'ADR 012: true only when the session runs an allowlisted system operation whose registry scope lists table_name.';
