-- ============================================================================
-- Durable stamp of every change to an account's access (cache invalidation backstop)
-- ============================================================================
-- Revoking access — a role or permission change, a password reset, signing out
-- every device, deactivating or deleting the account — always bumps
-- `users."tokenVersion"` or flips `"isActive"` / `"isDeleted"`, in the SAME
-- transaction as the change. This trigger turns that into an epoch-ms stamp in
-- `users."authorizationChangedAt"`, taken from the database clock, so it commits
-- (or rolls back) with the change itself and no write path can forget it.
--
-- The after-commit invalidation (Redis `authz:invalidate`) stays the fast path.
-- The stamp is its backstop: every API instance sweeps the stamps of the last
-- few minutes (AuthorizationChangeSweep, identity context) and drops what it
-- cached for those accounts, so an invalidation lost to a crash or a Redis
-- outage leaves an instance stale for one sweep interval instead of a cache TTL.
-- ============================================================================

CREATE OR REPLACE FUNCTION app_stamp_authorization_change() RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
  IF NEW."tokenVersion" IS DISTINCT FROM OLD."tokenVersion"
     OR NEW."isActive" IS DISTINCT FROM OLD."isActive"
     OR NEW."isDeleted" IS DISTINCT FROM OLD."isDeleted" THEN
    NEW."authorizationChangedAt" := (extract(epoch FROM clock_timestamp()) * 1000)::bigint;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS users_authorization_change_stamp ON public."User";
CREATE TRIGGER users_authorization_change_stamp
  BEFORE UPDATE OF "tokenVersion", "isActive", "isDeleted" ON public."User"
  FOR EACH ROW
  EXECUTE FUNCTION app_stamp_authorization_change();
