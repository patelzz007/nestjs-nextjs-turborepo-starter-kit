import { afterEach, describe, expect, it } from "vitest";

import { METRO_RUNNING_BODY, answersOk, downloadBody, fetchStatus, isMetroRunning, pollUntil, readLaunchAssetUrl, respondsToHttp } from "../probes.mjs";
import { closedPort, startFakeServer } from "./fake-server.mjs";

const servers = [];
async function serve(handler) {
	const server = await startFakeServer(handler);
	servers.push(server);
	return server;
}

afterEach(async () => {
	await Promise.all(servers.splice(0).map((server) => server.close()));
});

/** A fake clock whose sleep advances time instantly. */
function fakeClock() {
	let time = 0;
	const sleeps = [];
	return {
		sleeps,
		now: () => time,
		sleep: async (ms) => {
			sleeps.push(ms);
			time += ms;
		},
	};
}

describe("fetchStatus", () => {
	it("returns the status without following a redirect", async () => {
		const server = await serve((_request, response) => {
			response.writeHead(307, { location: "/auth/login" }).end();
		});
		await expect(fetchStatus(server.url("/"))).resolves.toBe(307);
		expect(server.requests.map((request) => request.url)).toEqual(["/"]);
	});

	it("sends the given headers", async () => {
		const server = await serve((_request, response) => {
			response.end("ok");
		});
		await fetchStatus(server.url("/dashboard"), { cookie: "access_token=a" });
		expect(server.requests.map((request) => request.headers.cookie)).toEqual(["access_token=a"]);
	});
});

describe("respondsToHttp", () => {
	it.each([200, 307, 404, 500])("counts HTTP %i as an answer", async (status) => {
		const server = await serve((_request, response) => {
			response.writeHead(status).end();
		});
		await expect(respondsToHttp(server.url("/"))).resolves.toBe(true);
	});

	it("is false when nothing listens", async () => {
		await expect(respondsToHttp(`http://127.0.0.1:${String(await closedPort())}/`)).resolves.toBe(false);
	});
});

describe("answersOk", () => {
	it.each([
		[200, true],
		[503, false],
		[301, false],
	])("HTTP %i → %s", async (status, expected) => {
		const server = await serve((_request, response) => {
			response.writeHead(status).end();
		});
		await expect(answersOk(server.url("/health/ready"))).resolves.toBe(expected);
	});

	it("is false when nothing listens", async () => {
		await expect(answersOk(`http://127.0.0.1:${String(await closedPort())}/health/ready`)).resolves.toBe(false);
	});
});

describe("isMetroRunning", () => {
	it("is true for Metro's running body", async () => {
		const server = await serve((_request, response) => {
			response.end(METRO_RUNNING_BODY);
		});
		await expect(isMetroRunning(server.url("/status"))).resolves.toBe(true);
	});

	it.each([
		[200, "packager-status:starting"],
		[503, METRO_RUNNING_BODY],
	])("is false for HTTP %i %s", async (status, body) => {
		const server = await serve((_request, response) => {
			response.writeHead(status).end(body);
		});
		await expect(isMetroRunning(server.url("/status"))).resolves.toBe(false);
	});

	it("is false when nothing listens", async () => {
		await expect(isMetroRunning(`http://127.0.0.1:${String(await closedPort())}/status`)).resolves.toBe(false);
	});
});

describe("downloadBody", () => {
	it("reads the whole body and reports its size and status", async () => {
		const body = "x".repeat(250_000);
		const server = await serve((_request, response) => {
			response.end(body);
		});
		await expect(downloadBody(server.url("/index.bundle?platform=ios&dev=true"))).resolves.toEqual({ status: 200, bytes: body.length });
	});
});

describe("readLaunchAssetUrl", () => {
	/** Trimmed from the manifest Expo CLI 57 served for apps/mobile (`GET /`, `expo-platform: ios`). */
	const MANIFEST = {
		id: "d7a83e3e-b5ec-41ce-b53a-c4e0a538ba8b",
		runtimeVersion: "exposdk:57.0.0",
		launchAsset: {
			key: "bundle",
			contentType: "application/javascript",
			url: "http://127.0.0.1:8081/apps/mobile/index.ts.bundle?platform=ios&dev=true&hot=false&lazy=true&transform.engine=hermes&transform.bytecode=1&transform.routerRoot=src%2Fapp&unstable_transformProfile=hermes-stable",
		},
	};

	it("returns the bundle URL of the manifest, asking as an iOS client", async () => {
		const server = await serve((_request, response) => {
			response.writeHead(200, { "content-type": "application/expo+json" }).end(JSON.stringify(MANIFEST));
		});
		await expect(readLaunchAssetUrl(server.url("/"), { "expo-platform": "ios" })).resolves.toBe(MANIFEST.launchAsset.url);
		expect(server.requests.map((request) => request.headers["expo-platform"])).toEqual(["ios"]);
	});

	it("fails on a non-200 answer", async () => {
		const server = await serve((_request, response) => {
			response.writeHead(500).end("{}");
		});
		await expect(readLaunchAssetUrl(server.url("/"), {})).rejects.toThrow(/answered HTTP 500/);
	});

	it("fails on a manifest without a launch asset URL", async () => {
		const server = await serve((_request, response) => {
			response.end(JSON.stringify({ launchAsset: { key: "bundle" } }));
		});
		await expect(readLaunchAssetUrl(server.url("/"), {})).rejects.toThrow();
	});
});

describe("pollUntil", () => {
	it("returns the clock reading of the first yes, sleeping between tries", async () => {
		const clock = fakeClock();
		const answers = [false, false, true];
		const at = await pollUntil({ label: "api", probe: async () => answers.shift() ?? false, timeoutMs: 10_000, pollIntervalMs: 200, ...clock });
		expect(at).toBe(400);
		expect(clock.sleeps).toEqual([200, 200]);
	});

	it("does not sleep when the first try succeeds", async () => {
		const clock = fakeClock();
		await expect(pollUntil({ label: "api", probe: async () => true, timeoutMs: 1_000, pollIntervalMs: 200, ...clock })).resolves.toBe(0);
		expect(clock.sleeps).toEqual([]);
	});

	it("gives up after the timeout, naming the target", async () => {
		const clock = fakeClock();
		await expect(pollUntil({ label: "web (http://localhost:3000/)", probe: async () => false, timeoutMs: 1_000, pollIntervalMs: 300, ...clock })).rejects.toThrow(
			"web (http://localhost:3000/) not ready after 1000 ms",
		);
	});

	it("stops as soon as the signal aborts", async () => {
		const clock = fakeClock();
		const controller = new AbortController();
		let tries = 0;
		const probe = async () => {
			tries += 1;
			if (tries === 2) {
				controller.abort(new Error("pnpm dev exited"));
			}
			return false;
		};
		await expect(pollUntil({ label: "api", probe, timeoutMs: 60_000, pollIntervalMs: 200, ...clock, signal: controller.signal })).rejects.toThrow("pnpm dev exited");
		expect(tries).toBe(2);
	});

	it("polls a real server until it starts answering", async () => {
		let ready = false;
		const server = await serve((_request, response) => {
			response.writeHead(ready ? 200 : 503).end();
		});
		const clock = fakeClock();
		let tries = 0;
		const probe = async () => {
			tries += 1;
			ready = tries >= 3;
			return answersOk(server.url("/health/ready"));
		};
		await expect(pollUntil({ label: "api", probe, timeoutMs: 10_000, pollIntervalMs: 100, ...clock })).resolves.toBe(200);
	});
});
