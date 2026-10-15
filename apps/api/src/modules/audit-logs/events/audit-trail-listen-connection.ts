// The audit trail's live signal: the channel its triggers notify
// (prisma/rls/95-audit-trail-notify.sql) and the injection token of the
// listen connection (src/infrastructure/database/pg-listen-connection.ts).

/** The PostgreSQL channel the audit trail's triggers notify. */
export const AUDIT_TRAIL_CHANNEL = "audit_trail";

export const AUDIT_TRAIL_LISTEN_CONNECTION = Symbol("AUDIT_TRAIL_LISTEN_CONNECTION");
