// ============================================
// response-contract.ts - the ONE place a response body is validated
// ============================================
// Every successful API response is parsed with the envelope schema of its
// shared contract leaf (`apiContract.*.response.envelope`, ADR 022) before any
// caller sees it — the client transport (`request.ts`), the body-token refresh
// (`refresh.ts`) and the web SSR prefetch pipeline (`@workspace/client`,
// `server-request.ts`) all call `parseResponseText`. A body that does not match
// is NOT passed on as "probably fine": it becomes a typed
// `ApiResponseContractError`, which callers can branch on (it is an API/client
// version drift or an API bug, never a user error).

import type { DataValue } from "@workspace/shared";
import type { ZodType, z } from "zod";

/** At most this many issues are kept on the error (enough to diagnose, bounded for logs). */
export const MAX_RESPONSE_CONTRACT_ISSUES = 10;

/** One mismatch between a response body and its contract. */
export interface ApiResponseContractIssue {
	/** Dotted path inside the envelope (`data.items.0.price`), or `root`. */
	readonly path: string;
	readonly message: string;
}

/** Where the mismatching response came from. */
export interface ResponseContractSource {
	readonly method: string;
	readonly url: string;
	readonly status: number;
}

/**
 * A 2xx response whose body does not match the endpoint's shared response
 * contract. Carries the request it belongs to and the (bounded) issue list;
 * never the body itself, which may contain personal data.
 */
export class ApiResponseContractError extends Error {
	public readonly method: string;
	public readonly url: string;
	public readonly status: number;
	public readonly issues: readonly ApiResponseContractIssue[];

	public constructor(source: ResponseContractSource, issues: readonly ApiResponseContractIssue[]) {
		const summary: string = issues.map((issue: ApiResponseContractIssue): string => `${issue.path}: ${issue.message}`).join("; ");
		super(`Response of ${source.method} ${source.url} (HTTP ${String(source.status)}) does not match its contract — ${summary}`);
		this.name = "ApiResponseContractError";
		this.method = source.method;
		this.url = source.url;
		this.status = source.status;
		this.issues = issues;
	}
}

function toIssue(issue: z.core.$ZodIssue): ApiResponseContractIssue {
	return {
		path: issue.path.length === 0 ? "root" : issue.path.map((segment: PropertyKey): string => String(segment)).join("."),
		message: issue.message,
	};
}

/**
 * Parse a response body with its contract envelope schema. Returns the PARSED
 * value (unknown keys stripped, so additive API fields never break an older
 * client); throws {@link ApiResponseContractError} on a mismatch.
 */
export function parseResponseContract<T>(schema: ZodType<T>, body: DataValue, source: ResponseContractSource): T {
	return unwrapContractResult(schema.safeParse(body), source);
}

/**
 * Parse a raw 2xx response body (its text) with its contract envelope schema —
 * the transport's single entry point. The JSON text goes straight into the
 * contract schema (one validation pass, no intermediate "it is JSON" cast). An
 * empty body is `null`; a body that is not JSON at all breaks the contract
 * like a mismatching one, so it becomes the same typed
 * {@link ApiResponseContractError} — never a transport failure, which callers
 * read as "the API is unreachable".
 */
export function parseResponseText<T>(schema: ZodType<T>, text: string, source: ResponseContractSource): T {
	return unwrapContractResult(safeParseJsonText(schema, text, source), source);
}

function safeParseJsonText<T>(schema: ZodType<T>, text: string, source: ResponseContractSource): z.ZodSafeParseResult<T> {
	try {
		return schema.safeParse(text.length === 0 ? null : JSON.parse(text));
	} catch {
		throw new ApiResponseContractError(source, [{ path: "root", message: "Response body is not valid JSON" }]);
	}
}

function unwrapContractResult<T>(result: z.ZodSafeParseResult<T>, source: ResponseContractSource): T {
	if (result.success) {
		return result.data;
	}
	throw new ApiResponseContractError(source, result.error.issues.slice(0, MAX_RESPONSE_CONTRACT_ISSUES).map(toIssue));
}
