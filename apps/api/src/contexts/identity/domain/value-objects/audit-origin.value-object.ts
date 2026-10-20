/**
 * Where a state change came from, copied onto identity's own audit rows (`MfaRecoveryAuditLog`,
 * `ImpersonationAuditLog`): the request correlation id, the client, and the real administrator
 * behind an impersonation session. All `null` for background work (cron, CLI).
 */
export interface AuditOrigin {
	readonly correlationId: string | null;
	readonly ipAddress: string | null;
	readonly userAgent: string | null;
	readonly impersonatorId: string | null;
}

/** The origin of work with no request (a cron run, the CLI). */
export const BACKGROUND_AUDIT_ORIGIN: AuditOrigin = { correlationId: null, ipAddress: null, userAgent: null, impersonatorId: null };
