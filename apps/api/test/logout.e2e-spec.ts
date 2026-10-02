import type { NestFastifyApplication } from "@nestjs/platform-fastify";
import { API_VERSION_PREFIX } from "@workspace/shared";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { createE2eApp, extractCookie, login, mutationHeaders, uniqueClientIp } from "./e2e-helpers";

/**
 * `POST /auth/logout` is idempotent: it always clears the auth cookies, and
 * revokes the device session only when a valid refresh token identifies it.
 * Before, a missing/expired refresh token answered 401 BEFORE the cookies were
 * cleared — a stale httpOnly access cookie (which JavaScript cannot remove)
 * then stayed, and every guest 401 logged "Session clear request failed: 401".
 */

const SUPER_ADMIN_EMAIL = "superadmin@example.com";
const SUPER_ADMIN_PASSWORD = "SuperAdmin@123";

/** A Set-Cookie header that deletes `name` (empty value, already expired). */
function clearsCookie(setCookie: string | string[] | undefined, name: string): boolean {
	const headers: readonly string[] = setCookie === undefined ? [] : Array.isArray(setCookie) ? setCookie : [setCookie];
	return headers.some((header: string): boolean => header.startsWith(`${name}=;`) && /(Max-Age=0|Expires=Thu, 01 Jan 1970)/i.test(header));
}

describe("POST /auth/logout (e2e)", () => {
	let app: NestFastifyApplication;
	const logoutUrl = `${API_VERSION_PREFIX}/auth/logout`;

	beforeAll(async () => {
		app = await createE2eApp();
	});

	afterAll(async () => {
		await app.close();
	});

	it("succeeds for a guest with no cookies at all, and still clears the cookie pair", async () => {
		const response = await app.inject({ method: "POST", url: logoutUrl, headers: mutationHeaders({ "cf-connecting-ip": uniqueClientIp() }) });

		expect(response.statusCode, response.body).toBe(201);
		expect(clearsCookie(response.headers["set-cookie"], "accessToken")).toBe(true);
		expect(clearsCookie(response.headers["set-cookie"], "refreshToken")).toBe(true);
	});

	it("clears a stale access cookie even when the refresh token is gone", async () => {
		const response = await app.inject({
			method: "POST",
			url: logoutUrl,
			headers: mutationHeaders({ "cf-connecting-ip": uniqueClientIp(), cookie: "accessToken=stale.access.token" }),
		});

		expect(response.statusCode, response.body).toBe(201);
		expect(clearsCookie(response.headers["set-cookie"], "accessToken")).toBe(true);
	});

	it("revokes the device session when a valid refresh token identifies it", async () => {
		const session = await login(app, SUPER_ADMIN_EMAIL, SUPER_ADMIN_PASSWORD);

		const loggedOut = await app.inject({
			method: "POST",
			url: logoutUrl,
			headers: mutationHeaders({ "cf-connecting-ip": uniqueClientIp(), cookie: `refreshToken=${session.refreshToken}` }),
		});
		expect(loggedOut.statusCode, loggedOut.body).toBe(201);

		const refreshed = await app.inject({
			method: "POST",
			url: `${API_VERSION_PREFIX}/auth/refresh`,
			headers: mutationHeaders({ "cf-connecting-ip": uniqueClientIp(), cookie: `refreshToken=${session.refreshToken}` }),
		});
		expect(refreshed.statusCode).toBe(401);
		expect(extractCookie(refreshed.headers["set-cookie"], "accessToken")).toBeUndefined();
	});
});
