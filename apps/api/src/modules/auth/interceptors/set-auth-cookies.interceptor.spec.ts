import type { CallHandler } from "@nestjs/common";
import { LoginTokenFieldsSchema, RefreshClientResponseSchema, type JsonValue } from "@workspace/shared";
import { firstValueFrom, of, type Observable } from "rxjs";
import { describe, expect, it } from "vitest";

import { fakeCookieReply, type FakeCookieReply } from "../../../../test/support/fake-reply";
import { createHttpContext, testRequest } from "../../../../test/support/http-execution-context";
import { createTestTypedConfig } from "../../../../test/support/test-api-env";
import { CookieConfigService } from "../constants/cookie.config";
import { SetAuthCookiesInterceptor } from "./set-auth-cookies.interceptor";

const USER = { id: "user-1", email: "a@b.com" };
const TOKENS = { accessToken: "access-token", refreshToken: "refresh-token" };

const interceptor = new SetAuthCookiesInterceptor(new CookieConfigService(createTestTypedConfig()));

function handlerReturning(body: JsonValue): CallHandler<JsonValue> {
	return { handle: (): Observable<JsonValue> => of(body) };
}

async function deliver(headers: Record<string, string>, body: JsonValue): Promise<{ readonly body: JsonValue; readonly reply: FakeCookieReply }> {
	const reply = fakeCookieReply();
	const context = createHttpContext(testRequest({ headers }), {}, reply);
	const delivered: JsonValue = await firstValueFrom(interceptor.intercept(context, handlerReturning(body)));
	return { body: delivered, reply };
}

describe("LoginTokenFieldsSchema", () => {
	it("extracts tokens from a login service response (extra user field)", (): void => {
		const parsed = LoginTokenFieldsSchema.safeParse({
			user: { id: "user-1", email: "a@b.com" },
			accessToken: "access-token",
			refreshToken: "refresh-token",
		});
		expect(parsed.success).toBe(true);
		if (!parsed.success) return;
		expect(parsed.data.accessToken).toBe("access-token");
		expect(parsed.data.refreshToken).toBe("refresh-token");
	});

	it("extracts tokens from a refresh response (extra message field)", (): void => {
		const parsed = LoginTokenFieldsSchema.safeParse({
			accessToken: "access-token",
			refreshToken: "refresh-token",
			message: "Tokens refreshed successfully",
		});
		expect(parsed.success).toBe(true);
		if (!parsed.success) return;
		expect(parsed.data.accessToken).toBe("access-token");
		expect(parsed.data.refreshToken).toBe("refresh-token");
	});
});

describe("SetAuthCookiesInterceptor — cookie transport (browser client types)", () => {
	it.each<[string, Record<string, string>, string, string]>([
		["web (no header)", {}, "accessToken", "refreshToken"],
		["web", { "x-client-type": "web" }, "accessToken", "refreshToken"],
		["admin", { "x-client-type": "admin" }, "adminAccessToken", "adminRefreshToken"],
		["merchant", { "x-client-type": "merchant" }, "merchantAccessToken", "merchantRefreshToken"],
	])(
		"%s: sets the app's httpOnly cookie pair and strips the tokens from the body",
		async (_label: string, headers: Record<string, string>, accessName: string, refreshName: string) => {
			const { body, reply } = await deliver(headers, { user: USER, ...TOKENS });

			expect(body).toEqual({ user: USER });
			expect(reply.cookies.map(({ name, value }) => ({ name, value }))).toEqual([
				{ name: accessName, value: "access-token" },
				{ name: refreshName, value: "refresh-token" },
			]);
			expect(reply.cookies.every(({ options }) => options.httpOnly === true)).toBe(true);
		},
	);

	it("selects the cookie pair from the ?client_type= fallback", async () => {
		const reply = fakeCookieReply();
		const context = createHttpContext(testRequest({ headers: {}, query: { client_type: "admin" } }), {}, reply);

		await firstValueFrom(interceptor.intercept(context, handlerReturning({ user: USER, ...TOKENS })));

		expect(reply.cookies.map(({ name }) => name)).toEqual(["adminAccessToken", "adminRefreshToken"]);
	});

	it("never adds the body-transport marker for a browser", async () => {
		const { body } = await deliver({ "x-client-type": "web" }, { message: "Tokens refreshed successfully", ...TOKENS });

		expect(body).toEqual({ message: "Tokens refreshed successfully" });
	});

	it("passes a body without tokens (2FA pending) through unchanged and sets no cookie", async () => {
		const pending = { requiresTwoFactor: true, tempToken: "temp", message: "Enter your code" };
		const { body, reply } = await deliver({ "x-client-type": "merchant" }, pending);

		expect(body).toEqual(pending);
		expect(reply.cookies).toEqual([]);
	});
});

describe("SetAuthCookiesInterceptor — body transport (client type mobile)", () => {
	it("keeps the tokens in the body, marks it tokenTransport: body, and sets no cookie", async () => {
		const { body, reply } = await deliver({ "x-client-type": "mobile" }, { user: USER, ...TOKENS });

		expect(body).toEqual({ user: USER, ...TOKENS, tokenTransport: "body" });
		expect(reply.cookies).toEqual([]);
		expect(reply.setCookie).not.toHaveBeenCalled();
	});

	it("selects body transport from the ?client_type= fallback too", async () => {
		const reply = fakeCookieReply();
		const context = createHttpContext(testRequest({ headers: {}, query: { client_type: "mobile" } }), {}, reply);

		const body: JsonValue = await firstValueFrom(interceptor.intercept(context, handlerReturning({ user: USER, ...TOKENS })));

		expect(body).toEqual({ user: USER, ...TOKENS, tokenTransport: "body" });
		expect(reply.cookies).toEqual([]);
	});

	it("produces a refresh body the token-bearing response contract keeps intact (tokens included)", async () => {
		const refresh = await deliver({ "x-client-type": "mobile" }, { message: "Tokens refreshed successfully", ...TOKENS });

		expect(RefreshClientResponseSchema.parse(refresh.body)).toEqual({ message: "Tokens refreshed successfully", ...TOKENS, tokenTransport: "body" });
	});

	it("produces a browser refresh body from which the response contract could not recover a token", async () => {
		const refresh = await deliver({ "x-client-type": "web" }, { message: "Tokens refreshed successfully", ...TOKENS });

		expect(RefreshClientResponseSchema.parse(refresh.body)).toEqual({ message: "Tokens refreshed successfully" });
	});

	it("adds no marker when the body does not carry both tokens (pending steps, impersonation's access-token-only payload)", async () => {
		const pending = { requiresVerification: true, verificationId: "v-1", message: "Check your email" };
		const accessOnly = { message: "Impersonating", accessToken: "access-token" };

		expect((await deliver({ "x-client-type": "mobile" }, pending)).body).toEqual(pending);
		expect((await deliver({ "x-client-type": "mobile" }, accessOnly)).body).toEqual(accessOnly);
	});

	it("passes a non-object body through unchanged", async () => {
		expect((await deliver({ "x-client-type": "mobile" }, null)).body).toBeNull();
	});
});
