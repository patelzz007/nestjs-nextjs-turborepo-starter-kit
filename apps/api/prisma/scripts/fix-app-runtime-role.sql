-- Fix app_runtime role grants
-- Run this after db:reset if you encounter "permission denied for schema public"

-- Drop the role if it exists (to start fresh)
DO $$
BEGIN
    -- Revoke from all databases first
    EXECUTE (
        SELECT string_agg(
            format('REVOKE ALL ON DATABASE %I FROM app_runtime', datname),
            '; '
        )
        FROM pg_database
        WHERE datname NOT IN ('template0', 'template1')
    );
    
    -- Drop the role
    IF EXISTS (SELECT FROM pg_roles WHERE rolname = 'app_runtime') THEN
        DROP ROLE app_runtime;
    END IF;
END $$;

-- Recreate the role
CREATE ROLE app_runtime NOLOGIN NOSUPERUSER NOINHERIT NOBYPASSRLS;

-- Grant to current user (postgres)
GRANT app_runtime TO CURRENT_USER;

-- Grant schema privileges
GRANT USAGE ON SCHEMA public TO app_runtime;

-- Grant table privileges
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO app_runtime;

-- Grant sequence privileges  
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO app_runtime;

-- Grant for FUTURE tables/sequences
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO app_runtime;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT USAGE, SELECT ON SEQUENCES TO app_runtime;

-- Grant function privileges (RLS functions)
DO $$
BEGIN
    -- Only grant if functions exist
    IF EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'app_rls_bypass') THEN
        GRANT EXECUTE ON FUNCTION app_rls_bypass() TO app_runtime;
    END IF;
    
    IF EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'app_current_user_id') THEN
        GRANT EXECUTE ON FUNCTION app_current_user_id() TO app_runtime;
    END IF;
    
    IF EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'app_current_organization_id') THEN
        GRANT EXECUTE ON FUNCTION app_current_organization_id() TO app_runtime;
    END IF;
    
    IF EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'app_owns') THEN
        GRANT EXECUTE ON FUNCTION app_owns(text) TO app_runtime;
    END IF;
    
    IF EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'app_organization_member_of') THEN
        GRANT EXECUTE ON FUNCTION app_organization_member_of(text) TO app_runtime;
    END IF;
    
    IF EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'app_tenant_organization_member_of') THEN
        GRANT EXECUTE ON FUNCTION app_tenant_organization_member_of(text) TO app_runtime;
    END IF;
    
    IF EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'app_reward_platform_org_member') THEN
        GRANT EXECUTE ON FUNCTION app_reward_platform_org_member(text) TO app_runtime;
    END IF;
    
    IF EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'app_tenant_has_location_access') THEN
        GRANT EXECUTE ON FUNCTION app_tenant_has_location_access(text) TO app_runtime;
    END IF;
    
    IF EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'app_tenant_row_org_location_access') THEN
        GRANT EXECUTE ON FUNCTION app_tenant_row_org_location_access(text, text) TO app_runtime;
    END IF;
    
    IF EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'app_tenant_org_optional_location_access') THEN
        GRANT EXECUTE ON FUNCTION app_tenant_org_optional_location_access(text, text) TO app_runtime;
    END IF;
END $$;

SELECT 'app_runtime role fixed successfully!' as result;
