// Unsigned JWTs for tests: the app decodes (never verifies) the access token's
// claims to pick its screens (src/features/session/access-token-claims.ts).

interface TestClaims {
	readonly sub?: string;
	readonly sessionScope?: "full" | "restricted";
	readonly isEmailVerified?: boolean;
}

function base64Url(text: string): string {
	return btoa(text).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

/** A token whose payload carries `claims` (signature is a placeholder). */
export function testAccessToken(claims: TestClaims = {}, nonce = "a"): string {
	const header = base64Url(JSON.stringify({ alg: "HS256", typ: "JWT" }));
	const payload = base64Url(JSON.stringify({ sub: "user-1", sessionScope: "full", isEmailVerified: true, nonce, ...claims }));
	return `${header}.${payload}.signature`;
}

export const FULL_ACCESS_TOKEN = testAccessToken();
export const REFRESH_TOKEN = "refresh-token-1";
