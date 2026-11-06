import { afterEach, describe, expect, it } from "vitest";

import { type DemoAccount, DEFAULT_RATE_LIMIT_WAIT_MS, cookieHeaderFrom, rateLimitWaitMs, signIn } from "../session.ts";
import { startFakeServer, type FakeServer } from "./fake-server.ts";

const ACCOUNT: DemoAccount = { email: "admin@example.com", password: "Admin@123", clientType: "web", origin: "http://localhost:3000" };
const SESSION_COOKIES = ["access_token=aaa; Path=/; HttpOnly; SameSite=Lax", "refresh_token=rrr; Path=/api/v1/auth; HttpOnly"];

const servers: FakeServer[] = [];
async function fakeApi(routes: Readonly<Record<string, { status?: number; body: object; cookies?: string[] }>>): Promise<FakeServer> {
	const server = await startFakeServer((request, response) => {
		const route = routes[request.url ?? ""];
		if (route === undefined) {
			response.writeHead(404).end();
			return;
		}
		const { status = 201, body, cookies = [] } = route;
		response.writeHead(status, { "content-type": "application/json", "set-cookie": cookies }).end(JSON.stringify(body));
	});
	servers.push(server);
	return server;
}

afterEach(async () => {
	await Promise.all(servers.splice(0).map((server) => server.close()));
});

const noCode = (): Promise<undefined> => Promise.resolve(undefined);
const failIfAskedForCode = (): Promise<string> => Promise.reject(new Error("no code expected"));

describe("cookieHeaderFrom", () => {
	it("keeps only each cookie's name=value pair", () => {
		expect(cookieHeaderFrom(SESSION_COOKIES)).toBe("access_token=aaa; refresh_token=rrr");
	});

	it("drops headers without a pair", () => {
		expect(cookieHeaderFrom(["", "garbage"])).toBe("");
	});
});

describe("signIn", () => {
	it("posts the credentials as a browser client and returns the session cookies", async () => {
		const api = await fakeApi({ "/api/v1/auth/login": { body: { success: true, data: { user: { email: ACCOUNT.email } } }, cookies: SESSION_COOKIES } });
		const cookie = await signIn({ apiUrl: api.url(""), account: ACCOUNT, readLoginCode: failIfAskedForCode, readCurrentCode: noCode });
		expect(cookie).toBe("access_token=aaa; refresh_token=rrr");
		const [login] = api.requests;
		expect(login?.method).toBe("POST");
		expect(JSON.parse(login?.body ?? "{}")).toEqual({ email: ACCOUNT.email, password: ACCOUNT.password });
		expect(login?.headers).toMatchObject({ "x-client-type": "web", "x-mutation-intent": "same-origin", origin: "http://localhost:3000", "content-type": "application/json" });
	});

	it("completes a login verification with a code newer than the one already in the inbox", async () => {
		const api = await fakeApi({
			"/api/v1/auth/login": { body: { data: { requiresVerification: true, verificationId: "ver_1", message: "check your inbox" } } },
			"/api/v1/auth/verify-login": { status: 200, body: { data: { user: { email: ACCOUNT.email } } }, cookies: SESSION_COOKIES },
		});
		const asked: { email: string; previousCode: string | undefined }[] = [];
		const cookie = await signIn({
			apiUrl: api.url(""),
			account: ACCOUNT,
			readCurrentCode: () => Promise.resolve("111111"),
			readLoginCode: (email, previousCode) => {
				asked.push({ email, previousCode });
				return Promise.resolve("222222");
			},
		});
		expect(cookie).toBe("access_token=aaa; refresh_token=rrr");
		expect(asked).toEqual([{ email: ACCOUNT.email, previousCode: "111111" }]);
		const verify = api.requests.find((request) => request.url === "/api/v1/auth/verify-login");
		expect(JSON.parse(verify?.body ?? "{}")).toEqual({ verificationId: "ver_1", code: "222222" });
	});

	it("fails on a verification answer without its id", async () => {
		const api = await fakeApi({ "/api/v1/auth/login": { body: { data: { requiresVerification: true } } } });
		await expect(signIn({ apiUrl: api.url(""), account: ACCOUNT, readLoginCode: failIfAskedForCode, readCurrentCode: noCode })).rejects.toThrow(/without a verificationId/);
	});

	it("refuses an account with two-factor authentication", async () => {
		const api = await fakeApi({ "/api/v1/auth/login": { body: { data: { requiresTwoFactor: true, tempToken: "t", message: "2fa" } } } });
		await expect(signIn({ apiUrl: api.url(""), account: ACCOUNT, readLoginCode: failIfAskedForCode, readCurrentCode: noCode })).rejects.toThrow(/two-factor/);
	});

	it("refuses an account that must finish enrollment (its pages would redirect)", async () => {
		const api = await fakeApi({ "/api/v1/auth/login": { body: { data: { requiresEnrollment: true, enrollmentReason: "mfa_enrollment" } }, cookies: SESSION_COOKIES } });
		await expect(signIn({ apiUrl: api.url(""), account: ACCOUNT, readLoginCode: failIfAskedForCode, readCurrentCode: noCode })).rejects.toThrow(
			/enrollment \(mfa_enrollment\)/,
		);
	});

	it("reports a rejected login with its status", async () => {
		const api = await fakeApi({ "/api/v1/auth/login": { status: 401, body: { success: false, error: { code: "INVALID_CREDENTIALS" } } } });
		await expect(signIn({ apiUrl: api.url(""), account: ACCOUNT, readLoginCode: failIfAskedForCode, readCurrentCode: noCode })).rejects.toThrow(
			/answered HTTP 401.*INVALID_CREDENTIALS/,
		);
	});

	it("fails when the login sets no cookies", async () => {
		const api = await fakeApi({ "/api/v1/auth/login": { body: { data: {} } } });
		await expect(signIn({ apiUrl: api.url(""), account: ACCOUNT, readLoginCode: failIfAskedForCode, readCurrentCode: noCode })).rejects.toThrow(/set no session cookies/);
	});

	it("fails on an answer that is not the API envelope", async () => {
		const api = await fakeApi({ "/api/v1/auth/login": { body: { ok: true } } });
		await expect(signIn({ apiUrl: api.url(""), account: ACCOUNT, readLoginCode: failIfAskedForCode, readCurrentCode: noCode })).rejects.toThrow();
	});
});

describe("rateLimitWaitMs", () => {
	it("waits the longest Retry-After the throttler names, in milliseconds", () => {
		expect(rateLimitWaitMs(new Headers({ "retry-after-login": "12", "retry-after": "3" }))).toBe(12_000);
	});

	it("falls back to the default window without a readable header", () => {
		expect(rateLimitWaitMs(new Headers({ "retry-after": "soon" }))).toBe(DEFAULT_RATE_LIMIT_WAIT_MS);
		expect(rateLimitWaitMs(new Headers())).toBe(DEFAULT_RATE_LIMIT_WAIT_MS);
	});
});

describe("signIn under the login rate limit", () => {
	const limited = (): Response => new Response(JSON.stringify({ success: false, error: { code: "RATE_LIMITED" } }), { status: 429, headers: { "retry-after-login": "7" } });
	const signedIn = (): Response => new Response(JSON.stringify({ data: {} }), { status: 201, headers: [["set-cookie", "access_token=aaa; Path=/"]] });

	it("waits out a 429 once and signs in on the second attempt", async () => {
		const answers = [limited(), signedIn()];
		const waits: number[] = [];
		const cookie = await signIn({
			apiUrl: "http://api.test",
			account: ACCOUNT,
			readLoginCode: failIfAskedForCode,
			readCurrentCode: noCode,
			fetchImpl: () => Promise.resolve(answers.shift() ?? signedIn()),
			sleep: (ms: number): Promise<void> => {
				waits.push(ms);
				return Promise.resolve();
			},
		});
		expect(cookie).toBe("access_token=aaa");
		expect(waits).toEqual([7000]);
		expect(answers).toEqual([]);
	});

	it("reports a second 429 instead of waiting again", async () => {
		const waits: number[] = [];
		await expect(
			signIn({
				apiUrl: "http://api.test",
				account: ACCOUNT,
				readLoginCode: failIfAskedForCode,
				readCurrentCode: noCode,
				fetchImpl: () => Promise.resolve(limited()),
				sleep: (ms: number): Promise<void> => {
					waits.push(ms);
					return Promise.resolve();
				},
			}),
		).rejects.toThrow(/answered HTTP 429.*RATE_LIMITED/);
		expect(waits).toEqual([7000]);
	});
});
