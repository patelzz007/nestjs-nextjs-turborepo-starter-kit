import type { RequestAuditPort } from "../../ports/request-audit.port";

/** Records each in-transaction audit row; `failWith` makes the next write fail like a database error would. */
export class RecordingRequestAudit implements RequestAuditPort {
	public readonly recorded: object[] = [];
	public failWith: Error | null = null;

	public recordInTransaction(result: object): Promise<void> {
		if (this.failWith !== null) {
			return Promise.reject(this.failWith);
		}
		this.recorded.push(result);
		return Promise.resolve();
	}
}
