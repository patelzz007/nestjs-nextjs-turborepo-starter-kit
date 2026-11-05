import { NextRequest, NextResponse } from "next/server";
import { describe, expect, it } from "vitest";

import { buildContentSecurityPolicy, createNonce, originOf, SECURITY_NONCE_HEADER, STATIC_SECURITY_HEADERS, withSecurityHeaders } from "../security-headers";

const API = "https://api.example.com/v1";

/** The policy as directive → sources. */
function directivesOf(policy: string): ReadonlyMap<string, readonly string[]> {
	return new Map(
		policy.split("; ").map((directive: string): [string, readonly string[]] => {
			const [name = "", ...sources] = directive.split(" ");
			return [name, sources];
		}),
	);
}

describe("buildContentSecurityPolicy", () => {
	it("runs only scripts carrying this response's nonce (and what they load), and refuses framing", () => {
		const policy = directivesOf(buildContentSecurityPolicy({ nonce: "abc", development: false, apiOrigin: "https://api.example.com" }));
		expect(policy.get("script-src")).toStrictEqual(["'self'", "'nonce-abc'", "'strict-dynamic'"]);
		expect(policy.get("frame-ancestors")).toStrictEqual(["'none'"]);
		expect(policy.get("object-src")).toStrictEqual(["'none'"]);
		expect(policy.get("base-uri")).toStrictEqual(["'self'"]);
		expect(policy.get("form-action")).toStrictEqual(["'self'"]);
		expect(policy.get("connect-src")).toContain("https://api.example.com");
		expect(policy.has("upgrade-insecure-requests")).toBe(true);
	});

	it("never allows inline scripts or eval in production", () => {
		const scripts = directivesOf(buildContentSecurityPolicy({ nonce: "abc", development: false, apiOrigin: "https://api.example.com" })).get("script-src");
		expect(scripts).not.toContain("'unsafe-inline'");
		expect(scripts).not.toContain("'unsafe-eval'");
	});

	it("allows eval, dev websockets and plain-HTTP connections (LAN upload addresses) only in development, and doesn't upgrade localhost", () => {
		const policy = directivesOf(buildContentSecurityPolicy({ nonce: "abc", development: true, apiOrigin: "http://localhost:8080" }));
		expect(policy.get("script-src")).toContain("'unsafe-eval'");
		expect(policy.get("connect-src")).toStrictEqual(["'self'", "http://localhost:8080", "https:", "wss:", "ws:", "http:"]);
		expect(policy.get("img-src")).toContain("http://localhost:8080");
		expect(policy.has("upgrade-insecure-requests")).toBe(false);
	});
});

describe("buildContentSecurityPolicy and files served by the API", () => {
	it("shows images from the API's origin in every mode (local storage serves them there), and keeps plain HTTP out of production connections", () => {
		const production = directivesOf(buildContentSecurityPolicy({ nonce: "abc", development: false, apiOrigin: "http://localhost:8080" }));
		expect(production.get("img-src")).toContain("http://localhost:8080");
		expect(production.get("connect-src")).toStrictEqual(["'self'", "http://localhost:8080", "https:", "wss:"]);
		expect(production.get("connect-src")).not.toContain("http:");
	});
});

describe("createNonce", () => {
	it("is fresh each time, base64, from 128 random bits", () => {
		const nonces = new Set(Array.from({ length: 50 }, createNonce));
		expect(nonces.size).toBe(50);
		for (const nonce of nonces) {
			expect(nonce).toMatch(/^[A-Za-z0-9+/]{22}==$/u);
		}
	});
});

describe("originOf", () => {
	it("keeps only the scheme, host and port", () => {
		expect(originOf("https://api.example.com/v1")).toBe("https://api.example.com");
		expect(originOf("http://localhost:8080/api")).toBe("http://localhost:8080");
	});
});

describe("withSecurityHeaders", () => {
	it("continues the request with the nonce and the policy, and stamps the response with every header", async () => {
		let forwarded: NextResponse | null = null;
		const response = await withSecurityHeaders(
			new NextRequest("https://app.example.com/dashboard"),
			(_request, next): Promise<NextResponse> => {
				forwarded = next();
				return Promise.resolve(forwarded);
			},
			{ apiBaseUrl: API, development: false, nonce: (): string => "fixed-nonce" },
		);
		expect(response).toBe(forwarded);
		const policy = response.headers.get("Content-Security-Policy") ?? "";
		expect(policy).toContain("'nonce-fixed-nonce'");
		// NextResponse.next({ request: { headers } }) forwards overridden request headers as x-middleware-request-*.
		expect(response.headers.get(`x-middleware-request-${SECURITY_NONCE_HEADER}`)).toBe("fixed-nonce");
		expect(response.headers.get("x-middleware-request-content-security-policy")).toBe(policy);
		for (const [name, value] of Object.entries(STATIC_SECURITY_HEADERS)) {
			expect(response.headers.get(name)).toBe(value);
		}
	});

	it("puts the headers on a redirect too", async () => {
		const response = await withSecurityHeaders(
			new NextRequest("https://app.example.com/dashboard"),
			(): Promise<NextResponse> => Promise.resolve(NextResponse.redirect("https://app.example.com/login")),
			{ apiBaseUrl: API, development: false },
		);
		expect(response.headers.get("X-Frame-Options")).toBe("DENY");
		expect(response.headers.get("Content-Security-Policy")).toContain("frame-ancestors 'none'");
	});
});
