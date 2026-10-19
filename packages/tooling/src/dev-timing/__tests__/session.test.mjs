import { afterEach, describe, expect, it } from "vitest";

import { cookieHeaderFrom, signIn } from "../session.mjs";
import { startFakeServer } from "./fake-server.mjs";

const ACCOUNT = { email: "admin@example.com", password: "Admin@123", clientType: "web", origin: "http://localhost:3000" };
const SESSION_COOKIES = ["access_token=aaa; Path=/; HttpOnly; SameSite=Lax", "refresh_token=rrr; Path=/api/v1/auth; HttpOnly"];

const servers = [];
async function fakeApi(routes) {
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

const noCode = async () => undefined;
const failIfAskedForCode = async () => {
	throw new Error("no code expected");
};

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
		const asked = [];
		const cookie = await signIn({
			apiUrl: api.url(""),
			account: ACCOUNT,
			readCurrentCode: async () => "111111",
			readLoginCode: async (email, previousCode) => {
				asked.push({ email, previousCode });
				return "222222";
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
