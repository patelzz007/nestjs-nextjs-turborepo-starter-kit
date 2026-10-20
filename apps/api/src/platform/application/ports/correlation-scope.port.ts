/**
 * One correlation id for a unit of background work (a system command and the
 * audit row it writes). Inside an HTTP request the request's id is reused;
 * outside one, a fresh id is opened for `work`, and every transaction `work`
 * opens stamps that same id as `app.correlation_id`.
 */
export interface CorrelationScopePort {
	run<TResult>(work: (correlationId: string) => Promise<TResult>): Promise<TResult>;
}

export const CORRELATION_SCOPE = Symbol("CORRELATION_SCOPE");
