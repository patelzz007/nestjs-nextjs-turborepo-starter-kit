/**
 * The current HTTP request's audit row, appended inside the write's own
 * transaction: it commits or rolls back WITH the change, and the global audit
 * interceptor does not write it again. `result` is what the request answers.
 */
export interface RequestAuditPort {
	recordInTransaction(result: object): Promise<void>;
}
