// ============================================
// app/api/telescope/stream/route.ts - Same-origin SSE proxy
// ============================================
// Proxies `GET /api/telescope/stream` → `${API_BASE_URL}/telescope/stream` so
// the browser talks to its own origin (localhost:3001) instead of the API
// origin (localhost:8080). That kills the whole CORS class of bugs for this
// stream:
//
//   - The first connect worked before (Accept is a CORS-safelisted header),
//     but every reconnect sent `Last-Event-ID` for replay — NOT safelisted —
//     so the browser fired a preflight the API's allowedHeaders didn't
//     authorize, and the stream wedged on "reconnecting…" forever.
//   - Same-origin requests never preflight, so `Last-Event-ID` (and any
//     future replay headers) flow through untouched.
//
// Auth rides the admin cookies exactly like proxy.ts: the browser sends
// `adminAccessToken`/`adminRefreshToken` to :3001 (cookies are host-scoped to
// `localhost` regardless of port), we forward the `Cookie` header upstream,
// and the API's AuthGuard + TelescopeAdminGuard still enforce access.
//
// If the access token is expired (access tokens live ~15m, so a long pause
// before resume will hit this), we silently rotate it server-side — the same
// `refreshSessionFromProxy` machinery proxy.ts uses — and forward the rotated
// cookies to the browser on the response. Without this, a stale token would
// 401 the reconnect and the client would retry forever even with CORS solved.
//
// Streaming: the upstream response body (a ReadableStream) is passed straight
// through to the browser as `text/event-stream` (Next.js route handlers
// support raw Web Streams responses). The `request.signal` abort is forwarded
// upstream so a paused tab tears down the upstream fetch instead of leaking a
// socket.

import { API_BASE_URL } from "@workspace/client/lib/api/config";
import { isAccessTokenExpired, parseSetCookie, refreshSessionFromProxy } from "@workspace/client/lib/auth/proxy-refresh";
import type { NextRequest } from "next/server";

// Always run at request time — never prerender or cache this stream.
export const dynamic = "force-dynamic";
// SSE streaming requires the Node runtime (default), stated explicitly.
export const runtime = "nodejs";

const ACCESS_TOKEN_COOKIE = "adminAccessToken";
const REFRESH_TOKEN_COOKIE = "adminRefreshToken";

/**
 * Replace one cookie's value inside a raw `Cookie` request-header string.
 * Cookie values here are base64url JWTs (no `;` or `=`), so a plain
 * split/join is safe. If the cookie isn't present, it's appended.
 */
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

export async function GET(request: NextRequest): Promise<Response> {
	const cookieHeader: string = request.headers.get("cookie") ?? "";
	const lastEventId: string | null = request.headers.get("last-event-id");
	const accessToken: string | undefined = request.cookies.get(ACCESS_TOKEN_COOKIE)?.value;
	const refreshToken: string | undefined = request.cookies.get(REFRESH_TOKEN_COOKIE)?.value;

	// Silent refresh when the access token is expired (or expires within the
	// skew window). Mirrors apps/admin/proxy.ts so a stale token can't wedge
	// the reconnect loop. On success we swap the rotated access token into the
	// upstream Cookie header AND forward the rotated Set-Cookie headers to the
	// browser so its copy stays fresh.
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
		// A failed refresh (dead session / API blip) falls through with the
		// original cookies — the upstream API returns the authoritative 401.
	}

	// Open the upstream stream. `cache: "no-store"` prevents Next from
	// caching or duplicating the request; `request.signal` propagates a
	// client abort so the upstream fetch dies with the browser.
	let upstream: Response;
	try {
		upstream = await fetch(`${API_BASE_URL}/telescope/stream`, {
			headers: {
				Accept: "text/event-stream",
				Cookie: upstreamCookie,
				...(lastEventId !== null ? { "Last-Event-ID": lastEventId } : {}),
			},
			cache: "no-store",
			signal: request.signal,
		});
	} catch {
		return new Response("telescope stream unavailable", { status: 502, headers: { "Content-Type": "text/plain; charset=utf-8" } });
	}

	if (!upstream.ok || upstream.body === null) {
		// Pass the upstream status through (401/403 → client hook reconnects).
		return new Response(upstream.body, { status: upstream.status, headers: { "Content-Type": "text/plain; charset=utf-8" } });
	}

	const headers = new Headers();
	headers.set("Content-Type", "text/event-stream");
	headers.set("Cache-Control", "no-cache, no-transform");
	// Ask nginx/CDN layers not to buffer the stream (SSE needs progressive flush).
	headers.set("X-Accel-Buffering", "no");
	for (const setCookie of rotatedSetCookies) {
		headers.append("Set-Cookie", setCookie);
	}

	return new Response(upstream.body, { status: 200, headers });
}
