import type { CallHandler } from "@nestjs/common";
import type { JsonValue } from "@workspace/shared";
import { firstValueFrom, of, type Observable } from "rxjs";
import { describe, expect, it } from "vitest";

import { fakeCookieReply, type RecordedCookie } from "../../../../test/support/fake-reply";
import { createHttpContext, testRequest } from "../../../../test/support/http-execution-context";
import { createTestTypedConfig } from "../../../../test/support/test-api-env";
import { CookieConfigService } from "../constants/cookie.config";
import { ClearAuthCookiesInterceptor, ClearAuthCookiesOnSessionEndInterceptor } from "./clear-auth-cookies.interceptor";

const interceptor = new ClearAuthCookiesInterceptor(new CookieConfigService(createTestTypedConfig()));
const LOGGED_OUT: JsonValue = { message: "Logged out successfully" };

async function clearedCookies(headers: Record<string, string>): Promise<readonly RecordedCookie[]> {
	const reply = fakeCookieReply();
	const next: CallHandler<JsonValue> = { handle: (): Observable<JsonValue> => of(LOGGED_OUT) };
	const body: JsonValue = await firstValueFrom(interceptor.intercept(createHttpContext(testRequest({ headers }), {}, reply), next));
	expect(body).toEqual(LOGGED_OUT);
	return reply.cookies;
}

describe("ClearAuthCookiesInterceptor", () => {
	it.each<[string, Record<string, string>, string, string]>([
		["web (no header)", {}, "accessToken", "refreshToken"],
		["admin", { "x-client-type": "admin" }, "adminAccessToken", "adminRefreshToken"],
		["merchant", { "x-client-type": "merchant" }, "merchantAccessToken", "merchantRefreshToken"],
	])("%s: clears only that app's cookie pair", async (_label: string, headers: Record<string, string>, accessName: string, refreshName: string) => {
		const cookies = await clearedCookies(headers);

		expect(cookies.map(({ name, value }) => ({ name, value }))).toEqual([
			{ name: accessName, value: null },
			{ name: refreshName, value: null },
		]);
	});

	it("clears no cookie for client type mobile (it has none) and passes the body through", async () => {
		expect(await clearedCookies({ "x-client-type": "mobile" })).toEqual([]);
	});
});

describe("ClearAuthCookiesOnSessionEndInterceptor (POST /auth/sessions/:sessionId/revoke)", () => {
	const onSessionEnd = new ClearAuthCookiesOnSessionEndInterceptor(new CookieConfigService(createTestTypedConfig()));

	async function cookiesAfter(body: JsonValue, headers: Record<string, string>): Promise<readonly RecordedCookie[]> {
		const reply = fakeCookieReply();
		const next: CallHandler<JsonValue> = { handle: (): Observable<JsonValue> => of(body) };
		expect(await firstValueFrom(onSessionEnd.intercept(createHttpContext(testRequest({ headers }), {}, reply), next))).toEqual(body);
		return reply.cookies;
	}

	it("signs this browser out when the revoked session was its own", async () => {
		const cookies = await cookiesAfter({ message: "Signed out of this device", revokedCurrentSession: true }, { "x-client-type": "merchant" });

		expect(cookies.map(({ name, value }) => ({ name, value }))).toEqual([
			{ name: "merchantAccessToken", value: null },
			{ name: "merchantRefreshToken", value: null },
		]);
	});

	it("leaves this browser signed in when another device was revoked", async () => {
		expect(await cookiesAfter({ message: "Device signed out", revokedCurrentSession: false }, {})).toEqual([]);
	});

	it("clears nothing for client type mobile (the app drops its own tokens)", async () => {
		expect(await cookiesAfter({ message: "Signed out of this device", revokedCurrentSession: true }, { "x-client-type": "mobile" })).toEqual([]);
	});

	it("clears nothing for a body that is not a revoke result", async () => {
		expect(await cookiesAfter(LOGGED_OUT, {})).toEqual([]);
	});
});
