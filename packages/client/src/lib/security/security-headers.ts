// ============================================
// lib/security/security-headers.ts — the response security headers of every Next.js app
// ============================================
// One policy for web, admin and merchant (rules/10-security-auth-authorization.md): a nonce-based
// Content-Security-Policy, framing refused (`frame-ancestors 'none'` plus `X-Frame-Options: DENY` for old
// browsers), MIME sniffing off, a strict referrer policy and the powerful browser features switched off.
//
// Each app's `proxy.ts` runs its routing through `withSecurityHeaders`: a fresh nonce per request is put
// in the request's CSP header, from which Next.js reads it and stamps every script it renders
// (docs: app/guides/content-security-policy); the root layout reads it (`SECURITY_NONCE_HEADER`) for the
// one inline script it adds itself, next-themes' anti-flash script. Every app renders dynamically, which
// nonces require.
//
// Edge-safe: Web Crypto and string work only.

import { NextResponse, type NextRequest } from "next/server";

/** The request header carrying the nonce to the layout. */
export const SECURITY_NONCE_HEADER = "x-nonce";

const CONTENT_SECURITY_POLICY_HEADER = "Content-Security-Policy";

/** Bytes of randomness in a nonce (128 bits, as CSP Level 3 recommends at least). */
const NONCE_BYTES = 16;

/** The headers every response carries, whatever its content. */
export const STATIC_SECURITY_HEADERS: Readonly<Record<string, string>> = {
	"X-Frame-Options": "DENY",
	"X-Content-Type-Options": "nosniff",
	"Referrer-Policy": "strict-origin-when-cross-origin",
	"Permissions-Policy": "camera=(), microphone=(), geolocation=(), payment=(), usb=(), interest-cohort=()",
};

export interface ContentSecurityPolicyOptions {
	/** This response's nonce: the only inline or first-party script allowed to run is one carrying it. */
	readonly nonce: string;
	/** `next dev` needs `eval` (React's debugging stacks) and plain-HTTP localhost; production gets neither. */
	readonly development: boolean;
	/** The API's origin (`NEXT_PUBLIC_API_URL`), which the browser calls directly (fetch, SSE, uploads). */
	readonly apiOrigin: string;
}

/** A random nonce, base64. */
export function createNonce(): string {
	const bytes = crypto.getRandomValues(new Uint8Array(NONCE_BYTES));
	return btoa(String.fromCharCode(...bytes));
}

/**
 * The policy. Scripts: `'self'`, this nonce and `'strict-dynamic'` (scripts a nonced script loads may run;
 * an injected `<script>` or inline handler never does). Styles allow inline: server-rendered `style`
 * attributes and the chart kit's `<style>` need it, and CSS can't run code. Images and media may come from
 * any HTTPS host (merchant uploads, signed storage URLs) and from the API itself (local storage serves files
 * from the API's origin); `connect-src` adds the API and any HTTPS/WSS host for direct-to-storage uploads.
 * In development only, `connect-src` also allows any `http:` host: the API hands out local-storage upload
 * addresses on its LAN address there (so a phone on the same network can upload), which isn't the
 * `localhost` origin the browser app calls. Deployed, every address is HTTPS and `API_PUBLIC_URL` is set.
 */
export function buildContentSecurityPolicy({ nonce, development, apiOrigin }: ContentSecurityPolicyOptions): string {
	const directives: readonly (readonly string[])[] = [
		["default-src", "'self'"],
		["script-src", "'self'", `'nonce-${nonce}'`, "'strict-dynamic'", ...(development ? ["'unsafe-eval'"] : [])],
		["style-src", "'self'", "'unsafe-inline'"],
		["img-src", "'self'", "data:", "blob:", "https:", apiOrigin],
		["media-src", "'self'", "blob:", "https:"],
		["font-src", "'self'", "data:"],
		["connect-src", "'self'", apiOrigin, "https:", "wss:", ...(development ? ["ws:", "http:"] : [])],
		["worker-src", "'self'", "blob:"],
		["frame-src", "'self'"],
		["object-src", "'none'"],
		["base-uri", "'self'"],
		["form-action", "'self'"],
		["frame-ancestors", "'none'"],
		...(development ? [] : [["upgrade-insecure-requests"]]),
	];
	return directives.map((directive: readonly string[]): string => directive.join(" ")).join("; ");
}

/** `https://api.example.com/v1` → `https://api.example.com`. */
export function originOf(url: string): string {
	return new URL(url).origin;
}

/** The app's own routing, given a way to continue the request with the security request headers. */
export type SecuredProxy = (request: NextRequest, next: () => NextResponse) => Promise<NextResponse>;

export interface SecurityHeadersOptions {
	readonly apiBaseUrl: string;
	readonly development: boolean;
	/** Replaced in tests. */
	readonly nonce?: () => string;
}

/**
 * Runs `proxy` with a fresh nonce: the request continues (`next()`) with the CSP and nonce headers Next.js
 * reads while rendering, and the response (a page, a redirect, anything) carries the CSP and the static headers.
 */
export async function withSecurityHeaders(request: NextRequest, proxy: SecuredProxy, options: SecurityHeadersOptions): Promise<NextResponse> {
	const nonce: string = (options.nonce ?? createNonce)();
	const policy: string = buildContentSecurityPolicy({ nonce, development: options.development, apiOrigin: originOf(options.apiBaseUrl) });
	const requestHeaders = new Headers(request.headers);
	requestHeaders.set(SECURITY_NONCE_HEADER, nonce);
	requestHeaders.set(CONTENT_SECURITY_POLICY_HEADER, policy);
	const next = (): NextResponse => NextResponse.next({ request: { headers: requestHeaders } });
	const response: NextResponse = await proxy(request, next);
	response.headers.set(CONTENT_SECURITY_POLICY_HEADER, policy);
	for (const [name, value] of Object.entries(STATIC_SECURITY_HEADERS)) {
		response.headers.set(name, value);
	}
	return response;
}
