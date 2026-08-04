// ============================================
// lib/proxy-refresh.ts - Server-side (proxy) token refresh
// Node-safe: uses only fetch/atob (no Node APIs), so it runs wherever the
// proxy does. Next.js 16 runs `proxy.ts` on the Node.js runtime by design
// (only legacy `middleware.ts` can opt into Edge), so no Edge runtime setup
// is needed on Node hosts (DigitalOcean / Linode droplets, etc.).
// Imported by apps/web/proxy.ts and apps/admin/proxy.ts.
// ============================================

import { decodeJwtPayload } from "./jwt";

/** How early (ms) before `exp` we refresh on navigation (absorbs clock drift). */
export const REFRESH_SKEW_MS = 30_000;

/** Hard timeout (ms) for the proxy→API refresh call so navigation never blocks. */
export const REFRESH_TIMEOUT_MS = 3_000;

export interface ProxyRefreshConfig {
	readonly apiBaseUrl: string;
	/** Cookie name carrying the refresh token (`refreshToken` | `adminRefreshToken`). */
	readonly refreshTokenName: string;
	readonly refreshToken: string;
	readonly clientType: "web" | "admin";
}

export interface ProxyRefreshResult {
	readonly ok: boolean;
	readonly status: number;
	/** Raw `Set-Cookie` header strings returned by the API (the rotated tokens). */
	readonly setCookies: readonly string[];
	/**
	 * Underlying failure detail when the fetch threw (status 0), e.g.
	 * `connect ECONNREFUSED 127.0.0.1:8080` for a dead API or `Aborted` for a
	 * timeout. Lets the proxy log say WHY the refresh failed, not just that it did.
	 */
	readonly errorDetail?: string;
	/**
	 * True when the attempt was short-circuited by the transient-failure cooldown
	 * (see `createProxyRefreshCooldown`) — no network call was made.
	 */
	readonly skipped?: boolean;
}

/**
 * True when the access token is already expired or expires within `skewMs`,
 * i.e. the proxy should try a silent refresh before serving the page.
 * Tokens that can't be decoded (no `exp` claim) are left alone — the API
 * decides validity on the next authenticated call.
 */
export function isAccessTokenExpired(accessToken: string, skewMs: number = REFRESH_SKEW_MS): boolean {
	const payload: Record<string, unknown> | null = decodeJwtPayload(accessToken);
	const exp: unknown = payload?.exp;
	if (typeof exp !== "number") return false;
	return exp * 1000 <= Date.now() + skewMs;
}

/** Minimal structural type so the helper stays framework-free (no `next/*` import). */
interface HeaderProvider {
	get(name: string): string | null;
}

/**
 * True for full page navigations (not prefetches / RSC data requests). The
 * proxy only refreshes on real navigations — that's when a stale access token
 * would otherwise 401 on the first API call after the page loads.
 */
export function isDocumentNavigation(headers: HeaderProvider): boolean {
	const secFetchMode: string | null = headers.get("sec-fetch-mode");
	if (secFetchMode === "navigate") return true;
	return headers.get("accept")?.includes("text/html") ?? false;
}

/** Structural subset so `collectSetCookies` stays framework-free and testable. */
interface CookieHeaders {
	get(name: string): string | null;
	getSetCookie?: () => string[];
}

/**
 * Read every `Set-Cookie` header from a fetch response. Prefers
 * `Headers.getSetCookie()` (available on the Node runtime where Next.js 16
 * runs `proxy.ts`). The `get("set-cookie")` split fallback below is
 * effectively unreachable given this repo requires Node >= 20 (getSetCookie
 * landed in 18.18) — it's kept purely as defense-in-depth for older runtimes.
 * The naive split is safe here because our cookie values are base64url JWTs
 * (which never contain commas); quoted comma-bearing values would be mis-split.
 */
export function collectSetCookies(headers: CookieHeaders): string[] {
	const setCookies: string[] | undefined = headers.getSetCookie?.();
	if (setCookies !== undefined) return setCookies;
	const combined: string | null = headers.get("set-cookie");
	return combined === null || combined === "" ? [] : combined.split(", ");
}

export type ProxyRefreshOutcome = "refreshed" | "dead-session" | "transient-failure" | "cooldown-active";
export interface ProxyRefreshLogEntry {
	readonly app: "web" | "admin";
	readonly pathname: string;
	readonly status: number;
	readonly elapsedMs: number;
	readonly outcome: ProxyRefreshOutcome;
	/** Number of rotated `Set-Cookie` headers (0 unless `outcome === "refreshed"`). */
	readonly rotatedCookieCount: number;
	/** Underlying failure detail for `transient-failure` (e.g. `ECONNREFUSED`), omitted otherwise. */
	readonly errorDetail?: string;
}

/**
 * Log a proxy refresh attempt to the Next.js server console. This is the only
 * place the server-side refresh is observable — the request never appears in
 * the browser's Network tab. Silently no-ops under vitest (`NODE_ENV ===
 * "test"`) so proxy tests stay quiet.
 */
export function logProxyRefresh(entry: ProxyRefreshLogEntry): void {
	if (process.env.NODE_ENV === "test") return;

	const detail: Record<ProxyRefreshOutcome, string> = {
		refreshed: `rotated ${String(entry.rotatedCookieCount)} cookie(s)`,
		"dead-session": "refresh rejected, clearing cookies",
		"transient-failure": `refresh failed (network/5xx)${entry.errorDetail === undefined ? "" : ` — ${entry.errorDetail}`}, keeping stale session`,
		"cooldown-active": "transient failure recently — refresh skipped (cooldown)",
	};
	// `warn` is the only lint-clean channel (`no-console` allows warn/error);
	// the [proxy:*] prefix makes these lines easy to grep in server logs.
	console.warn(`[proxy:${entry.app}] ${entry.pathname}: ${entry.outcome} — ${detail[entry.outcome]} (API ${String(entry.status)}, ${String(entry.elapsedMs)}ms)`);
}

/**
 * Call `POST /auth/refresh` from the proxy (server-to-server), forwarding the
 * refresh-token cookie (+ `X-Client-Type: admin` for the admin cookie set).
 * Returns the rotated tokens as raw `Set-Cookie` header strings so the proxy
 * can forward them to the browser. Never throws: network/timeout errors
 * surface as `{ ok: false, status: 0 }`.
 */
/**
 * How long (ms) the proxy suppresses refresh re-attempts after a transient
 * failure (dead / 5xx API) so a broken API isn't hammered on every navigation
 * inside the expiry-skew window. `Date.now()`-based, not wall-clock-based.
 */
export const PROXY_REFRESH_COOLDOWN_MS = 60_000;

/**
 * Wrap a proxy refresh attempt with a transient-failure cooldown. After a
 * network/5xx failure, calls within `cooldownMs` short-circuit to
 * `{ ok: false, status: 0, skipped: true }` without making a network call —
 * this is what kills the ECONNREFUSED log noise when the API is down and the
 * user navigates repeatedly inside the expiry-skew window. A success, a
 * dead-session (401/403), or a fresh login (different token ⇒ different
 * attempt closure) resets the cooldown.
 *
 * The returned function owns the closure state, so the proxies instantiate it
 * once at module scope — it then survives across requests in the server
 * process, which is what makes the cooldown effective for real navigations.
 * (Dev-mode hot reloads can reset module state; that only re-arms the cooldown
 * window, which is harmless.)
 */
export function createProxyRefreshCooldown(
	refreshAttempt: (refreshToken: string) => Promise<ProxyRefreshResult>,
	cooldownMs: number = PROXY_REFRESH_COOLDOWN_MS,
): (refreshToken: string) => Promise<ProxyRefreshResult> {
	let lastTransientFailureAt: number | null = null;

	return async (refreshToken: string): Promise<ProxyRefreshResult> => {
		if (lastTransientFailureAt !== null && Date.now() - lastTransientFailureAt < cooldownMs) {
			return { ok: false, status: 0, setCookies: [], skipped: true };
		}

		const result: ProxyRefreshResult = await refreshAttempt(refreshToken);
		// Transient = network failure (status 0) or server error (5xx). A 401/403
		// is a dead session, not a blip — never memoize it (the proxy must clear
		// cookies and redirect to login on every navigation until re-login).
		if (!result.ok && result.status !== 401 && result.status !== 403) {
			lastTransientFailureAt = Date.now();
		} else {
			lastTransientFailureAt = null;
		}
		return result;
	};
}

export async function refreshSessionFromProxy(config: ProxyRefreshConfig): Promise<ProxyRefreshResult> {
	const controller: AbortController = new AbortController();
	const timeoutId: ReturnType<typeof setTimeout> = setTimeout((): void => {
		controller.abort();
	}, REFRESH_TIMEOUT_MS);

	try {
		const response: Response = await fetch(`${config.apiBaseUrl}/auth/refresh`, {
			method: "POST",
			headers: {
				Accept: "application/json",
				Cookie: `${config.refreshTokenName}=${config.refreshToken}`,
				...(config.clientType === "admin" ? { "X-Client-Type": "admin" } : {}),
			},
			signal: controller.signal,
		});
		return { ok: response.ok, status: response.status, setCookies: collectSetCookies(response.headers) };
	} catch (error: unknown) {
		// Surface the underlying cause (e.g. `connect ECONNREFUSED 127.0.0.1:8080`
		// when the API is down) so the proxy log line is actually diagnosable.
		const cause: unknown = typeof error === "object" && error !== null && "cause" in error ? error.cause : undefined;
		const causeMessage: unknown = typeof cause === "object" && cause !== null && "message" in cause ? cause.message : undefined;
		const errorDetail: string = typeof causeMessage === "string" && causeMessage.length > 0 ? causeMessage : error instanceof Error ? error.message : String(error);
		return { ok: false, status: 0, setCookies: [], errorDetail };
	} finally {
		clearTimeout(timeoutId);
	}
}

export interface ParsedCookie {
	readonly name: string;
	readonly value: string;
	readonly httpOnly: boolean;
	readonly secure: boolean;
	readonly sameSite: "lax" | "strict" | "none";
	readonly path: string;
	/** Present only when the API emits `Domain` (most setups omit it). */
	readonly domain: string | null;
	/** Present only when the API emits `Max-Age` (session cookies omit it). */
	readonly maxAge: number | null;
	/** Present only when the API emits `Expires` (session cookies omit it). */
	readonly expires: Date | null;
}

/**
 * Parse a single `Set-Cookie` header into a name/value pair + attributes.
 * Returns null when the header is malformed (no `name=value`). Attributes the
 * API doesn't emit (e.g. `maxAge`/`expires` for its session cookies) parse to
 * null, so forwarding stays faithful to exactly what the API sent.
 */
export function parseSetCookie(header: string): ParsedCookie | null {
	const segments: readonly string[] = header.split(";").map((segment: string): string => segment.trim());
	const first: string | undefined = segments[0];
	if (first === undefined) return null;
	const eq: number = first.indexOf("=");
	if (eq <= 0) return null;
	const name: string = first.slice(0, eq);
	const value: string = first.slice(eq + 1);

	let httpOnly = false;
	let secure = false;
	let sameSite: "lax" | "strict" | "none" = "lax";
	let path = "/";
	let domain: string | null = null;
	let maxAge: number | null = null;
	let expires: Date | null = null;

	for (const segment of segments.slice(1)) {
		const lower: string = segment.toLowerCase();
		if (lower === "httponly") httpOnly = true;
		else if (lower === "secure") secure = true;
		else if (lower.startsWith("samesite=")) {
			const raw: string = segment.slice("samesite=".length).trim().toLowerCase();
			if (raw === "strict" || raw === "none") sameSite = raw;
			else sameSite = "lax";
		} else if (lower.startsWith("path=")) {
			path = segment.slice("path=".length).trim();
		} else if (lower.startsWith("domain=")) {
			domain = segment.slice("domain=".length).trim();
		} else if (lower.startsWith("max-age=")) {
			const raw = Number(segment.slice("max-age=".length).trim());
			maxAge = Number.isFinite(raw) ? raw : null;
		} else if (lower.startsWith("expires=")) {
			const parsed: Date = new Date(segment.slice("expires=".length).trim());
			expires = Number.isNaN(parsed.getTime()) ? null : parsed;
		}
	}

	return { name, value, httpOnly, secure, sameSite, path, domain, maxAge, expires };
}
