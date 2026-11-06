import type http from "node:http";

import { afterEach, describe, expect, it } from "vitest";

import { startFakeServer, type FakeServer } from "../../dev-timing/__tests__/fake-server.ts";
import { type LoadBaselines, type LoadRunTarget, POLL_INTERVAL_MS, RUN_GRACE_MS, adminHeaders, runLoadBaseline } from "../load-baseline-run.ts";

const LOAD_TESTS = "/api/v1/admin/operations/load-tests";
const RUN_ID = "01a1a34a-3bce-715b-a5d6-48fbe841139f";
const SESSION_COOKIES = ["adminAccessToken=aaa; Path=/; HttpOnly", "adminRefreshToken=rrr; Path=/; HttpOnly"];

const BASELINES: LoadBaselines = {
	run: { name: "Nightly", shape: "CONSTANT", virtualUsers: 2, requestsPerSecond: 1, durationSeconds: 10, mixWeights: { "sign-in": 1 } },
	total: { p95Ms: 500, maxErrorPercent: 1 },
	groups: { auth: { description: "Signing in", steps: ["login"], p95Ms: 400, maxErrorPercent: 1, minRequests: 1 } },
	calibration: { measuredOn: "2026-11-04", source: "test", factor: 2, provisional: false },
};

const servers: FakeServer[] = [];

/** A fake API: the login, the overview, the start, and the run's detail answering each status in turn. */

async function fakeApi({
	overview = { enabled: true, disabledReason: null },
	statuses = ["QUEUED", "RUNNING", "PASSED"],
	startStatus = 201,
}: { overview?: object; statuses?: string[]; startStatus?: number } = {}): Promise<FakeServer> {
	const remaining = [...statuses];
	const server = await startFakeServer((request, response) => {
		const send = (status: number, data: object, headers: http.OutgoingHttpHeaders = {}): void => {
			response.writeHead(status, { "content-type": "application/json", ...headers }).end(JSON.stringify({ success: status < 400, data }));
		};
		const route = `${request.method ?? ""} ${request.url ?? ""}`;
		if (route === "POST /api/v1/auth/login") {
			send(201, { user: { email: "developer@example.com" } }, { "set-cookie": SESSION_COOKIES });
		} else if (route === `GET ${LOAD_TESTS}`) {
			send(200, overview);
		} else if (route === `POST ${LOAD_TESTS}`) {
			send(startStatus, startStatus < 400 ? { id: RUN_ID, status: "QUEUED" } : { message: "refused" });
		} else if (route === `GET ${LOAD_TESTS}/${RUN_ID}`) {
			const status = remaining.length > 1 ? (remaining.shift() ?? "PASSED") : (remaining.at(0) ?? "PASSED");
			send(200, { run: { id: RUN_ID, status }, steps: [], points: [], servers: [] });
		} else if (route === `POST ${LOAD_TESTS}/${RUN_ID}/abort`) {
			send(201, { id: RUN_ID, status: "ABORTED" });
		} else {
			response.writeHead(404).end();
		}
	});
	servers.push(server);
	return server;
}

afterEach(async () => {
	await Promise.all(servers.splice(0).map((server) => server.close()));
});

/** A clock that moves forward by each sleep, so the deadline is reached without waiting. */
function fakeClock(): { slept: number[]; now: () => number; sleep: (ms: number) => Promise<void> } {
	let now = 0;
	const slept: number[] = [];
	return {
		slept,
		now: () => now,
		sleep: (ms: number): Promise<void> => {
			slept.push(ms);
			now += ms;
			return Promise.resolve();
		},
	};
}

function target(api: FakeServer): LoadRunTarget {
	return { apiUrl: api.url(""), adminOrigin: "http://localhost:3001", email: "developer@example.com", password: "Developer@123" };
}

describe("adminHeaders", () => {
	it("sends the session as the admin client, with the mutation intent", () => {
		expect(adminHeaders("a=1", "http://localhost:3001")).toEqual({
			cookie: "a=1",
			origin: "http://localhost:3001",
			"x-client-type": "admin",
			"x-mutation-intent": "same-origin",
			"content-type": "application/json",
		});
	});
});

describe("runLoadBaseline (enhancement 3.9)", () => {
	it("signs in on the admin client, starts the baselines' run and waits for it to finish", async () => {
		const api = await fakeApi();
		const clock = fakeClock();
		const lines: string[] = [];
		const detail = await runLoadBaseline({ target: target(api), baselines: BASELINES, now: clock.now, sleep: clock.sleep, log: (line) => lines.push(line) });

		expect(detail).toEqual({ run: { id: RUN_ID, status: "PASSED" }, steps: [], points: [], servers: [] });
		const [login, overview, start] = api.requests;
		expect(login?.headers).toMatchObject({ "x-client-type": "admin", origin: "http://localhost:3001" });
		expect(overview?.headers).toMatchObject({ cookie: "adminAccessToken=aaa; adminRefreshToken=rrr", "x-client-type": "admin" });
		expect(JSON.parse(start?.body ?? "{}")).toMatchObject({ name: "Nightly", target: "MIX", mixWeights: { "sign-in": 1 }, thresholdP95Ms: 500 });
		expect(clock.slept).toEqual([POLL_INTERVAL_MS, POLL_INTERVAL_MS]);
		expect(lines).toEqual([`Load test ${RUN_ID} queued: 1 requests/s for 10 s`, `Load test ${RUN_ID} ended: PASSED`]);
	});

	it("refuses when load testing is off on the API, saying why", async () => {
		const api = await fakeApi({ overview: { enabled: false, disabledReason: "Set LOAD_TESTING_ENABLED=true" } });
		await expect(runLoadBaseline({ target: target(api), baselines: BASELINES, ...fakeClock() })).rejects.toThrow(
			/load testing is off on this API: Set LOAD_TESTING_ENABLED=true/u,
		);
		const quiet = await fakeApi({ overview: { enabled: false, disabledReason: null } });
		await expect(runLoadBaseline({ target: target(quiet), baselines: BASELINES, ...fakeClock() })).rejects.toThrow(/no reason given/u);
	});

	it("quotes a refused start", async () => {
		const api = await fakeApi({ startStatus: 409 });
		await expect(runLoadBaseline({ target: target(api), baselines: BASELINES, ...fakeClock() })).rejects.toThrow(/starting the load test answered HTTP 409: .*refused/u);
	});

	it("aborts a run still going past its duration and grace, and fails", async () => {
		const api = await fakeApi({ statuses: ["RUNNING"] });
		const clock = fakeClock();
		await expect(runLoadBaseline({ target: target(api), baselines: BASELINES, now: clock.now, sleep: clock.sleep })).rejects.toThrow(/still RUNNING past its deadline/u);
		expect(api.requests.at(-1)?.url).toBe(`${LOAD_TESTS}/${RUN_ID}/abort`);
		expect(clock.slept.reduce((sum, ms) => sum + ms, 0)).toBeGreaterThanOrEqual(BASELINES.run.durationSeconds * 1000 + RUN_GRACE_MS);
	});

	it("refuses a login that asks for a verification code (CI turns verification off)", async () => {
		const server = await startFakeServer((_request, response) => {
			response.writeHead(201, { "content-type": "application/json" }).end(JSON.stringify({ data: { requiresVerification: true, verificationId: "v1" } }));
		});
		servers.push(server);
		await expect(runLoadBaseline({ target: target(server), baselines: BASELINES, ...fakeClock() })).rejects.toThrow(/LOGIN_VERIFICATION_MODE=disabled/u);
	});
});
