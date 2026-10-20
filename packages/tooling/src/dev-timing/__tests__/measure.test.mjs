import { afterEach, describe, expect, it } from "vitest";

import { ALL_SERVERS_TARGET } from "../dev-timing-plan.mjs";
import { apiBootMeasurement, measureDownload, measureReadiness } from "../measure.mjs";
import { METRO_RUNNING_BODY } from "../probes.mjs";
import { startFakeServer } from "./fake-server.mjs";

const servers = [];
async function serve(handler) {
	const server = await startFakeServer(handler);
	servers.push(server);
	return server;
}

afterEach(async () => {
	await Promise.all(servers.splice(0).map((server) => server.close()));
});

/** Time advances only by sleeping, so readiness times are exact multiples of the poll interval. */
function fakeClock(start = 0) {
	let time = start;
	return {
		now: () => time,
		sleep: async (ms) => {
			time += ms;
		},
	};
}

describe("measureReadiness", () => {
	it("times each server from the spawn and adds the slowest as `all`", async () => {
		let apiPolls = 0;
		const api = await serve((_request, response) => {
			apiPolls += 1;
			response.writeHead(apiPolls >= 3 ? 200 : 503).end();
		});
		const web = await serve((_request, response) => {
			response.writeHead(307, { location: "/auth/login" }).end();
		});
		const metro = await serve((_request, response) => {
			response.end(METRO_RUNNING_BODY);
		});
		const devServers = [
			{ id: "api", port: api.port, path: "/health/ready", readiness: "ok" },
			{ id: "web", port: web.port, path: "/", readiness: "responds" },
			{ id: "mobile", port: metro.port, path: "/status", readiness: "metro" },
		];
		const clock = fakeClock(1_000);
		const { measurements, readyAt } = await measureReadiness({
			servers: devServers,
			spawnedAt: 1_000,
			timeoutMs: 60_000,
			pollIntervalMs: 250,
			...clock,
			host: (server) => `http://127.0.0.1:${String(server.port)}${server.path}`,
		});
		// The three polls share one fake clock, so only the order and the API's two failed polls are fixed.
		const api_ = measurements.find((measurement) => measurement.target === "api");
		const all = measurements.find((measurement) => measurement.target === ALL_SERVERS_TARGET);
		expect(measurements.map((measurement) => measurement.target)).toEqual(["api", "web", "mobile", ALL_SERVERS_TARGET]);
		expect(measurements.every((measurement) => measurement.phase === "A")).toBe(true);
		expect(api_?.ms).toBeGreaterThanOrEqual(500);
		expect(all?.ms).toBe(Math.max(...measurements.filter((measurement) => measurement.target !== ALL_SERVERS_TARGET).map((measurement) => measurement.ms)));
		expect(readyAt.get("api")).toBe(1_000 + (api_?.ms ?? Number.NaN));
		expect(api.requests.map((request) => request.url)).toEqual(["/health/ready", "/health/ready", "/health/ready"]);
	});

	it("fails when a server never becomes ready", async () => {
		const api = await serve((_request, response) => {
			response.writeHead(503).end();
		});
		await expect(
			measureReadiness({
				servers: [{ id: "api", port: api.port, path: "/health/ready", readiness: "ok" }],
				spawnedAt: 0,
				timeoutMs: 1_000,
				pollIntervalMs: 500,
				...fakeClock(),
				host: (server) => `http://127.0.0.1:${String(server.port)}${server.path}`,
			}),
		).rejects.toThrow(/^api \(.*\/health\/ready\) not ready after 1000 ms$/);
	});
});

describe("measureDownload", () => {
	it("times a 200 download and notes its size, sending the session cookie", async () => {
		const page = await serve((_request, response) => {
			response.end("<html>dashboard</html>");
		});
		let time = 0;
		const now = () => {
			time += 1_250;
			return time;
		};
		const measurement = await measureDownload({ phase: "C", target: "web", url: page.url("/dashboard"), headers: { cookie: "access_token=a" }, now });
		expect(measurement).toEqual({ phase: "C", target: "web", ms: 1_250, detail: "22 bytes" });
		expect(page.requests.map((request) => request.headers.cookie)).toEqual(["access_token=a"]);
	});

	it.each([307, 500])("rejects HTTP %i (it compiled something else, or failed)", async (status) => {
		const page = await serve((_request, response) => {
			response.writeHead(status, { location: "/auth/login" }).end();
		});
		await expect(measureDownload({ phase: "C", target: "web", url: page.url("/dashboard"), now: () => 0 })).rejects.toThrow(`answered HTTP ${String(status)}, expected 200`);
	});
});

describe("apiBootMeasurement", () => {
	it("is the time from the API's first compile to its readiness", () => {
		expect(apiBootMeasurement({ compiledAt: 2_000, readyAt: 6_500 })).toEqual({ phase: "B", target: "api", ms: 4_500 });
	});

	it("fails without a compile line", () => {
		expect(() => apiBootMeasurement({ compiledAt: undefined, readyAt: 1 })).toThrow(/never reported success/);
	});

	it("fails without readiness", () => {
		expect(() => apiBootMeasurement({ compiledAt: 1, readyAt: undefined })).toThrow(/never answered/);
	});
});
