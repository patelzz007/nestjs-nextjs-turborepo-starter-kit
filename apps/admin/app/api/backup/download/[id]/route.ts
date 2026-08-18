// ============================================
// app/api/backup/download/[id]/route.ts - Same-origin backup download proxy
// ============================================
// Proxies `GET /api/backup/download/:id?token=…` → `${API_BASE_URL}/api/v1/backup/:id/download?token=…`
// so the browser downloads through its own origin (localhost:3001) instead of
// the API origin (localhost:8080). Same rationale as the telescope SSE proxy:
//
//   - The file is served with `Content-Disposition: attachment`, so a raw
//     cross-origin navigation works — but same-origin keeps the whole flow
//     CORS-free (the download mints a signed token via the JSON API, and the
//     file fetch just rides cookies like every other admin request).
//   - Auth rides the admin cookies exactly like proxy.ts: the browser sends
//     `adminAccessToken` to :3001, we forward the `Cookie` header upstream,
//     and the API's AuthGuard + BackupAdminGuard still enforce access. The
//     signed `token` query param is a second, short-lived gate on the file.
//
// If the access token is stale we silently rotate it server-side (same
// `refreshSessionFromProxy` machinery the SSE proxy uses) so a download after
// a long idle session still works without a redirect to the login page.

import { API_BASE_URL, API_URL_PREFIX } from "@workspace/client/lib/api/config";
import { isAccessTokenExpired, parseSetCookie, refreshSessionFromProxy } from "@workspace/client/lib/auth/proxy-refresh";
import type { NextRequest } from "next/server";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const ACCESS_TOKEN_COOKIE = "adminAccessToken";
const REFRESH_TOKEN_COOKIE = "adminRefreshToken";

/** Replaces one cookie's value inside a raw `Cookie` request-header string. */
function rebuildCookieHeader(cookieHeader: string, name: string, newValue: string): string {
	const prefix = `${name}=`;
	const parts: string[] = cookieHeader.split(";").map((part: string): string => part.trim());
	const index: number = parts.findIndex((part: string): boolean => part.startsWith(prefix));
	if (index === -1) {
		return cookieHeader.length > 0 ? `${cookieHeader}; ${prefix}${newValue}` : `${prefix}${newValue}`;
	}
	parts[index] = `${prefix}${newValue}`;
	return parts.join("; ");
}

export async function GET(request: NextRequest, context: { readonly params: Promise<{ readonly id: string }> }): Promise<Response> {
	const { id } = await context.params;
	const token: string | null = request.nextUrl.searchParams.get("token");
	if (token === null) {
		return new Response("Missing download token", { status: 400, headers: { "Content-Type": "text/plain; charset=utf-8" } });
	}

	const cookieHeader: string = request.headers.get("cookie") ?? "";
	const accessToken: string | undefined = request.cookies.get(ACCESS_TOKEN_COOKIE)?.value;
	const refreshToken: string | undefined = request.cookies.get(REFRESH_TOKEN_COOKIE)?.value;

	// Silent refresh when the access token is expired (or expires within the
	// skew window) — mirrors proxy.ts so a stale session can't 401 the download.
	let upstreamCookie: string = cookieHeader;
	const rotatedSetCookies: string[] = [];
	if (accessToken !== undefined && refreshToken !== undefined && isAccessTokenExpired(accessToken)) {
		const result = await refreshSessionFromProxy({
			apiBaseUrl: API_BASE_URL,
			refreshTokenName: REFRESH_TOKEN_COOKIE,
			refreshToken,
			clientType: "admin",
		});
		if (result.ok && result.setCookies.length > 0) {
			const newAccess = result.setCookies
				.map((header: string) => parseSetCookie(header))
				.find((cookie): cookie is NonNullable<ReturnType<typeof parseSetCookie>> => cookie?.name === ACCESS_TOKEN_COOKIE);
			if (newAccess !== undefined) {
				upstreamCookie = rebuildCookieHeader(cookieHeader, ACCESS_TOKEN_COOKIE, newAccess.value);
			}
			for (const setCookie of result.setCookies) {
				rotatedSetCookies.push(setCookie);
			}
		}
	}

	const upstreamUrl: URL = new URL(`${API_URL_PREFIX}/backup/${encodeURIComponent(id)}/download`, API_BASE_URL);
	upstreamUrl.searchParams.set("token", token);

	let upstream: Response;
	try {
		upstream = await fetch(upstreamUrl, {
			headers: {
				Accept: "application/gzip, application/octet-stream, */*",
				Cookie: upstreamCookie,
			},
			cache: "no-store",
			signal: request.signal,
		});
	} catch {
		return new Response("Backup download unavailable", { status: 502, headers: { "Content-Type": "text/plain; charset=utf-8" } });
	}

	if (!upstream.ok || upstream.body === null) {
		// Pass the upstream status through (401/403/404 → the UI shows the reason).
		return new Response(upstream.body, { status: upstream.status, headers: { "Content-Type": "text/plain; charset=utf-8" } });
	}

	const headers = new Headers();
	const contentType: string | null = upstream.headers.get("content-type");
	const contentDisposition: string | null = upstream.headers.get("content-disposition");
	const contentLength: string | null = upstream.headers.get("content-length");
	const checksum: string | null = upstream.headers.get("x-checksum-sha256");
	if (contentType !== null) headers.set("Content-Type", contentType);
	if (contentDisposition !== null) headers.set("Content-Disposition", contentDisposition);
	if (contentLength !== null) headers.set("Content-Length", contentLength);
	if (checksum !== null) headers.set("X-Checksum-Sha256", checksum);
	for (const setCookie of rotatedSetCookies) {
		headers.append("Set-Cookie", setCookie);
	}

	return new Response(upstream.body, { status: 200, headers });
}
