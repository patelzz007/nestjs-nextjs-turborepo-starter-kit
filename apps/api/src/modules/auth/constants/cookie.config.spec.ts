import { describe, expect, it } from "vitest";

import { createTestTypedConfig } from "../../../../test/support/test-api-env";
import { CookieConfigService } from "./cookie.config";

describe("CookieConfigService", () => {
	it("shares auth cookies across localhost ports in development and does not require HTTPS", () => {
		const cookies = new CookieConfigService(createTestTypedConfig({ NODE_ENV: "development", COOKIE_DOMAIN: "localhost" }));

		expect(cookies.accessTokenOptions).toEqual({ domain: "localhost", httpOnly: true, secure: false, sameSite: "lax", path: "/" });
		expect(cookies.refreshTokenOptions).toEqual(cookies.accessTokenOptions);
	});

	it("marks cookies Secure in production and leaves them host-only without COOKIE_DOMAIN", () => {
		const cookies = new CookieConfigService(createTestTypedConfig({ NODE_ENV: "production", REDIS_URL: "redis://cache:6379" }));

		expect(cookies.accessTokenOptions.secure).toBe(true);
		expect(cookies.accessTokenOptions.domain).toBeUndefined();
		expect(cookies.refreshTokenOptions.secure).toBe(true);
	});

	it("gives each cookie its own options object", () => {
		const cookies = new CookieConfigService(createTestTypedConfig());

		expect(cookies.refreshTokenOptions).not.toBe(cookies.accessTokenOptions);
	});
});
