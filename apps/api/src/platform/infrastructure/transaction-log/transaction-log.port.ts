import type { HttpAuditEntry } from "../audit/http-audit-entry";

/**
 * The plain-text transaction log (docs/technical/operations/transaction-log.md):
 * a second, human-readable copy of every audit row, one entry per transaction
 * in a `.txt` file per UTC day.
 *
 * `record` hands the entry over and returns at once: it never waits for the
 * disk or the queue and never throws, so the log can neither slow down nor fail
 * a request. The `AuditLog` table stays the record of truth; a write that fails
 * here is logged, and retried when it went through the queue.
 */
export abstract class TransactionLog {
	public abstract record(entry: HttpAuditEntry): void;
}

/** TRANSACTION_LOG_ENABLED=false (and the default under tests): nothing is kept. */
export class DisabledTransactionLog extends TransactionLog {
	public record(): void {
		// Off: the audit row in the database is the only record.
	}
}
