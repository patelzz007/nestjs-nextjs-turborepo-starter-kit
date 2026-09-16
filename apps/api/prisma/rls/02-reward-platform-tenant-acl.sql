-- ============================================================================
-- Reward platform: tenant-scoped membership + location ACL (sample fragment)
-- ============================================================================
-- Runs after rls.sql and 01-acl-location-access.sql.
-- Replaces legacy app_organization_member_of-only policies with tenant-aware
-- checks (session org + membership), with legacy fallback when org context is unset.
-- ============================================================================

CREATE OR REPLACE FUNCTION app_reward_platform_org_member(org_id text) RETURNS boolean
LANGUAGE sql
STABLE
AS $$
  SELECT app_rls_bypass()
    OR app_tenant_organization_member_of(org_id)
    OR app_organization_member_of(org_id);
$$;

COMMENT ON FUNCTION app_reward_platform_org_member(text) IS
  'Tenant-scoped org membership for RewardHub tables, with legacy membership fallback.';

GRANT EXECUTE ON FUNCTION app_reward_platform_org_member(text) TO app_runtime;

CREATE OR REPLACE FUNCTION app_tenant_org_optional_location_access(
  row_organization_id text,
  row_location_id text
) RETURNS boolean
LANGUAGE sql
STABLE
AS $$
  SELECT app_rls_bypass()
    OR (
      app_reward_platform_org_member(row_organization_id)
      AND (
        row_location_id IS NULL
        OR row_location_id = ''
        OR app_tenant_has_location_access(row_location_id)
      )
    );
$$;

COMMENT ON FUNCTION app_tenant_org_optional_location_access(text, text) IS
  'Org tenant access; when location_id is set, user must have ACL for that branch.';

GRANT EXECUTE ON FUNCTION app_tenant_org_optional_location_access(text, text) TO app_runtime;

-- ── Location-scoped POS resources (ACL template) ─────────────────────────────

DROP POLICY IF EXISTS organization_terminals_org ON public.organization_terminals;
DROP POLICY IF EXISTS organization_terminals_tenant_acl ON public.organization_terminals;
CREATE POLICY organization_terminals_tenant_acl ON public.organization_terminals
  FOR ALL
  TO app_runtime
  USING (app_tenant_row_org_location_access(organization_id, location_id))
  WITH CHECK (app_tenant_row_org_location_access(organization_id, location_id));

DROP POLICY IF EXISTS organization_api_keys_org ON public.organization_api_keys;
DROP POLICY IF EXISTS organization_api_keys_tenant_acl ON public.organization_api_keys;
CREATE POLICY organization_api_keys_tenant_acl ON public.organization_api_keys
  FOR ALL
  TO app_runtime
  USING (app_tenant_org_optional_location_access(organization_id, location_id))
  WITH CHECK (app_tenant_org_optional_location_access(organization_id, location_id));

-- ── Organization-scoped RewardHub tables (tenant member helper) ────────────

DROP POLICY IF EXISTS organization_kyb_documents_org ON public.organization_kyb_documents;
CREATE POLICY organization_kyb_documents_org ON public.organization_kyb_documents
  USING (app_reward_platform_org_member(organization_id) OR app_rls_bypass())
  WITH CHECK (app_reward_platform_org_member(organization_id) OR app_rls_bypass());

DROP POLICY IF EXISTS stored_files_owner ON public.stored_files;
CREATE POLICY stored_files_owner ON public.stored_files
  USING (
    app_owns(uploaded_by_id)
    OR (organization_id IS NOT NULL AND app_reward_platform_org_member(organization_id))
    OR app_rls_bypass()
  )
  WITH CHECK (
    app_owns(uploaded_by_id)
    OR (organization_id IS NOT NULL AND app_reward_platform_org_member(organization_id))
    OR app_rls_bypass()
  );

DROP POLICY IF EXISTS file_variants_file ON public.file_variants;
CREATE POLICY file_variants_file ON public.file_variants
  USING (
    app_rls_bypass()
    OR EXISTS (
      SELECT 1 FROM public.stored_files sf
      WHERE sf.id = file_id
        AND (
          app_owns(sf.uploaded_by_id)
          OR (sf.organization_id IS NOT NULL AND app_reward_platform_org_member(sf.organization_id))
        )
    )
  )
  WITH CHECK (
    app_rls_bypass()
    OR EXISTS (
      SELECT 1 FROM public.stored_files sf
      WHERE sf.id = file_id
        AND (
          app_owns(sf.uploaded_by_id)
          OR (sf.organization_id IS NOT NULL AND app_reward_platform_org_member(sf.organization_id))
        )
    )
  );

DROP POLICY IF EXISTS organization_assets_org ON public.organization_assets;
CREATE POLICY organization_assets_org ON public.organization_assets
  USING (app_reward_platform_org_member(organization_id) OR app_rls_bypass())
  WITH CHECK (app_reward_platform_org_member(organization_id) OR app_rls_bypass());

DROP POLICY IF EXISTS organization_kyb_files_org ON public.organization_kyb_files;
CREATE POLICY organization_kyb_files_org ON public.organization_kyb_files
  USING (app_reward_platform_org_member(organization_id) OR app_rls_bypass())
  WITH CHECK (app_reward_platform_org_member(organization_id) OR app_rls_bypass());

DROP POLICY IF EXISTS rewards_read ON public.rewards;
CREATE POLICY rewards_read ON public.rewards
  FOR SELECT
  USING (
    app_rls_bypass()
    OR app_reward_platform_org_member(organization_id)
    OR (
      is_deleted = false
      AND reward_kind = 'CONSUMER'
      AND status = 'PUBLISHED'
    )
  );

DROP POLICY IF EXISTS rewards_write ON public.rewards;
CREATE POLICY rewards_write ON public.rewards
  FOR INSERT
  WITH CHECK (app_reward_platform_org_member(organization_id) OR app_rls_bypass());

DROP POLICY IF EXISTS rewards_update ON public.rewards;
CREATE POLICY rewards_update ON public.rewards
  FOR UPDATE
  USING (app_reward_platform_org_member(organization_id) OR app_rls_bypass())
  WITH CHECK (app_reward_platform_org_member(organization_id) OR app_rls_bypass());

DROP POLICY IF EXISTS rewards_delete ON public.rewards;
CREATE POLICY rewards_delete ON public.rewards
  FOR DELETE
  USING (app_reward_platform_org_member(organization_id) OR app_rls_bypass());

DROP POLICY IF EXISTS reward_location_scopes_read ON public.reward_location_scopes;
CREATE POLICY reward_location_scopes_read ON public.reward_location_scopes
  FOR SELECT
  USING (
    app_rls_bypass()
    OR app_reward_platform_org_member(organization_id)
    OR EXISTS (
      SELECT 1 FROM public.rewards r
      WHERE r.id = reward_location_scopes.reward_id
        AND r.is_deleted = false
        AND r.reward_kind = 'CONSUMER'
        AND r.status = 'PUBLISHED'
    )
  );

DROP POLICY IF EXISTS reward_location_scopes_write ON public.reward_location_scopes;
CREATE POLICY reward_location_scopes_write ON public.reward_location_scopes
  FOR ALL
  USING (app_reward_platform_org_member(organization_id) OR app_rls_bypass())
  WITH CHECK (app_reward_platform_org_member(organization_id) OR app_rls_bypass());

DROP POLICY IF EXISTS reward_redemptions_access ON public.reward_redemptions;
CREATE POLICY reward_redemptions_access ON public.reward_redemptions
  USING (
    app_owns(user_id)
    OR app_reward_platform_org_member(organization_id)
    OR app_rls_bypass()
  )
  WITH CHECK (
    app_owns(user_id)
    OR app_reward_platform_org_member(organization_id)
    OR app_rls_bypass()
  );

DROP POLICY IF EXISTS reward_audit_insert ON public.reward_audit_logs;
CREATE POLICY reward_audit_insert ON public.reward_audit_logs
  FOR INSERT
  WITH CHECK (app_rls_bypass() OR (organization_id IS NOT NULL AND app_reward_platform_org_member(organization_id)));

DROP POLICY IF EXISTS reward_audit_select ON public.reward_audit_logs;
CREATE POLICY reward_audit_select ON public.reward_audit_logs
  FOR SELECT
  USING (
    app_rls_bypass()
    OR (organization_id IS NOT NULL AND app_reward_platform_org_member(organization_id))
  );

DROP POLICY IF EXISTS organization_merchant_profiles_member ON public.organization_merchant_profiles;
CREATE POLICY organization_merchant_profiles_member ON public.organization_merchant_profiles
  USING (app_rls_bypass() OR app_reward_platform_org_member(organization_id))
  WITH CHECK (app_rls_bypass() OR app_reward_platform_org_member(organization_id));
