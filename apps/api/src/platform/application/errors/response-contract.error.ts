import type { z } from "zod";

/** At most this many zod issues are written into the server log line. */
export const MAX_LOGGED_RESPONSE_ISSUES = 10;

/**
 * A route handler returned something its response contract does not allow
 * (ADR 022). This is a SERVER bug, never a client error: it is deliberately
 * NOT an `AppError`, so the global exception filter maps it to a generic
 * `500 INTERNAL_ERROR` envelope and logs it at `error` level with the stack.
 * The message names the route and the failing paths — never the values, which
 * may be personal data — and only ever reaches the server log.
 */
export class ResponseContractViolationError extends Error {
	public readonly route: string;
	public readonly issues: readonly string[];

	public constructor(route: string, error: z.ZodError) {
		const issues: readonly string[] = error.issues.slice(0, MAX_LOGGED_RESPONSE_ISSUES).map((issue: z.core.$ZodIssue): string => {
			const path: string = issue.path.length === 0 ? "root" : issue.path.map((segment: PropertyKey): string => String(segment)).join(".");
			return `${path}: ${issue.message}`;
		});
		super(`Response of ${route} violates its response contract — ${issues.join("; ")}`);
		this.name = "ResponseContractViolationError";
		this.route = route;
		this.issues = issues;
	}
}

/** A JSON route handler without a response contract (`@ZodResponse` & co.) — a server bug, answered with a 500. */
export class MissingResponseContractError extends Error {
	public constructor(route: string) {
		super(`Route ${route} has no response contract — decorate the handler with @ZodResponse, @ZodPaginatedResponse or @ZodRawResponse (ADR 022).`);
		this.name = "MissingResponseContractError";
	}
}
