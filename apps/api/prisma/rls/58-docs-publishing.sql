-- ============================================================================
-- 58 — Docs publishing (ADR 084): the docs sync run log, bypass-only
-- ============================================================================
-- `DocsSyncRun` records what the docs sync reported. No tenant and no end user owns a row, and no session ever reads
-- one directly: reports are written under `docs_publishing.record`, the Operations console reads under
-- `docs_publishing.read` after its DOCS_SYNC check (src/prisma/system-operation.registry.ts). The one policy admits
-- exactly those operations. Idempotent.
-- ============================================================================

ALTER TABLE public."DocsSyncRun" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."DocsSyncRun" FORCE ROW LEVEL SECURITY;
