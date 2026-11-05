// ============================================
// platform/presentation/http/routed-path.ts — the path a security decision must use
// ============================================
// Fastify routes on the percent-decoded path, without the query string or a `#` fragment, while
// `request.url` is the raw request target. A gate that decides on `request.url` can therefore disagree
// with the router about which handler runs: `/v1/%64ocs-json` reaches the docs route, and
// `/admin/users#/merchant/me` reaches `/admin/users` (SECURITY-AUDIT-2026-10-25, findings 1 and 2).
// Every security decision on "which route is this" uses these helpers instead of `request.url`.

/** The parts of a Fastify request the helpers read. */
export interface RoutedRequest {
	readonly url: string;
	readonly routeOptions: { readonly url?: string | undefined };
}

/** Matches the request target up to (not including) the query string or a fragment. */
const PATH_OF_TARGET = /^(?<path>[^?#]*)/u;

/**
 * The decoded path of a raw request target (no query, no fragment), or `null` when it can't be decoded
 * (a malformed `%` escape): callers must treat `null` as "could be anything" and fail closed.
 */
export function decodedRequestPath(url: string): string | null {
	const path = PATH_OF_TARGET.exec(url)?.groups?.path ?? "";
	try {
		return decodeURIComponent(path);
	} catch {
		return null;
	}
}

/**
 * The route template Fastify matched (`/v1/files/:fileId`), which no caller-controlled text can change,
 * or `undefined` when no route matched. Use it after routing (guards, interceptors, `onRequest` hooks).
 */
export function routeTemplateOf(request: RoutedRequest): string | undefined {
	return request.routeOptions.url;
}
