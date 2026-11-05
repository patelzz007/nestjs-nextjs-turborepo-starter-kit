-- ============================================================================
-- 80 — Saved list views (enhancement 5.10)
-- ============================================================================
-- Why hand-written (ADR 078 §1): Prisma has no syntax for row-level security policies.
--
-- A person reads and writes their own saved views (`app_owns`). Other staff's SHARED views are read only under
-- the `saved_views.shared.read` system operation, which the API runs after its admin-access check: there is no
-- "is platform staff" fact in the database to test here, so the API is the gate and the bypass is named.
-- Idempotent: re-applied by every `db:apply-security`.
--
-- Rollback: `DROP POLICY saved_list_view_own ON public."SavedListView";` (the table then admits nobody).
-- ============================================================================

ALTER TABLE public."SavedListView" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."SavedListView" FORCE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS saved_list_view_own ON public."SavedListView";
CREATE POLICY saved_list_view_own ON public."SavedListView"
  USING (app_owns("userId") OR (SELECT app_rls_bypass_on('SavedListView')))
  WITH CHECK (app_owns("userId") OR (SELECT app_rls_bypass_on('SavedListView')));
