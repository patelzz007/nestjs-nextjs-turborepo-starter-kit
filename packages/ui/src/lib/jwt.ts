// ============================================
// lib/jwt.ts - JWT decode utility (Edge-safe)
// ============================================

/**
 * Decode a JWT payload without verifying the signature.
 *
 * Safe for Edge runtimes (Next.js Edge, Cloudflare Workers) because it uses
 * only `atob()` — no Node.js `Buffer` API.
 *
 * Decoding without verification is sufficient for route-protection decisions
 * (e.g., checking `hasAdminAccess` in the proxy). A tampered token would be
 * rejected by the backend on the next authenticated API call.
 *
 * @param token - The JWT string (three dot-separated base64url parts)
 * @returns The decoded payload object, or `null` if the token is malformed
 */
export function decodeJwtPayload(token: string): Record<string, unknown> | null {
	try {
		const parts: string[] = token.split(".");
		if (parts.length !== 3) return null;

		const payload: string | undefined = parts[1];
		if (!payload) return null;

		// Convert URL-safe base64url to standard base64
		const base64: string = payload.replace(/-/g, "+").replace(/_/g, "/");
		const decoded: string = atob(base64);

		return JSON.parse(decoded) as Record<string, unknown>;
	} catch {
		return null;
	}
}
