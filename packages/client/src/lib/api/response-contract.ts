// ============================================
// lib/api/response-contract.ts - the ONE place a response body is validated
// ============================================
// Every successful API response is parsed with the envelope schema of its
// shared contract leaf (`apiContract.*.response.envelope`, ADR 022) before any
// caller sees it — the browser transport (`api-request.ts`) and the SSR
// prefetch / server mutation pipeline (`server-request.ts`) both call
// `parseResponseContract`. A body that does not match is NOT passed on as
// "probably fine": it becomes a typed `ApiResponseContractError`, which callers
// can branch on (it is an API/client version drift or an API bug, never a user
// error).

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
	const result = schema.safeParse(body);
	if (result.success) {
		return result.data;
	}
	throw new ApiResponseContractError(source, result.error.issues.slice(0, MAX_RESPONSE_CONTRACT_ISSUES).map(toIssue));
}
