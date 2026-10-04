import { describe, expect, it } from "vitest";

import { isReadyStatus, waitForHttp } from "./wait-for-http.mjs";

/** A fake clock whose sleep advances time instantly. */
function fakeClock() {
	let time = 0;
	return { now: () => time, sleep: async (ms) => void (time += ms) };
}

describe("isReadyStatus", () => {
	it.each([
		[200, true],
		[204, true],
		[307, true],
		[399, true],
		[400, false],
		[503, false],
		[199, false],
	])("HTTP %i → %s", (status, expected) => {
		expect(isReadyStatus(status)).toBe(expected);
	});
});

describe("waitForHttp", () => {
	it("resolves once every URL answers 2xx/3xx, polling only the pending ones", async () => {
		const clock = fakeClock();
		const calls = [];
		const answers = { "http://api/ready": [503, 503, 200], "http://web/": [307] };
		const result = await waitForHttp({
			urls: Object.keys(answers),
			timeoutMs: 10_000,
			pollIntervalMs: 1_000,
			fetchStatus: async (url) => {
				calls.push(url);
				return answers[url].shift() ?? 500;
			},
			...clock,
		});
		expect(result).toEqual({ ready: true });
		expect(calls).toEqual(["http://api/ready", "http://web/", "http://api/ready", "http://api/ready"]);
	});

	it("keeps polling through connection errors", async () => {
		const clock = fakeClock();
		let attempt = 0;
		const result = await waitForHttp({
			urls: ["http://api/ready"],
			timeoutMs: 10_000,
			fetchStatus: async () => {
				attempt += 1;
				if (attempt < 3) {
					throw new Error("fetch failed: ECONNREFUSED");
				}
				return 200;
			},
			...clock,
		});
		expect(result).toEqual({ ready: true });
	});

	it("gives up at the deadline and reports each pending URL's last state", async () => {
		const clock = fakeClock();
		const result = await waitForHttp({
			urls: ["http://api/ready", "http://web/"],
			timeoutMs: 3_000,
			pollIntervalMs: 1_000,
			fetchStatus: async (url) => {
				if (url === "http://web/") {
					throw new Error("ECONNREFUSED");
				}
				return 503;
			},
			...clock,
		});
		expect(result).toEqual({
			ready: false,
			pending: [
				{ url: "http://api/ready", lastState: "HTTP 503" },
				{ url: "http://web/", lastState: "ECONNREFUSED" },
			],
		});
		expect(clock.now()).toBe(3_000);
	});
});
