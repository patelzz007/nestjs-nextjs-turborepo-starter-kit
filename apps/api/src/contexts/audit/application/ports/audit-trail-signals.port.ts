import type { Observable } from "rxjs";

/**
 * "Something was written to the audit trail" signals (the database's `NOTIFY audit_trail`).
 * A signal carries nothing from the trail: the admin page refetches through the authorized list.
 * Subscribing opens the shared listener; the last unsubscribe closes it.
 */
export interface AuditTrailSignalsPort {
	observe(): Observable<void>;
}

export const AUDIT_TRAIL_SIGNALS = Symbol("AUDIT_TRAIL_SIGNALS");
