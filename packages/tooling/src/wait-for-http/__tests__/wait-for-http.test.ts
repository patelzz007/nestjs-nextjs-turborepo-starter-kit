import { describe, expect, it } from "vitest";

import { isReadyStatus, waitForHttp } from "../wait-for-http.ts";

/** A fake clock whose sleep advances time instantly. */
function fakeClock(): { now: () => number; sleep: (ms: number) => Promise<void> } {
	let time = 0;
	return {
		now: () => time,
		sleep: (ms: number): Promise<void> => {
			time += ms;
			return Promise.resolve();
		},
	};
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
		const calls: string[] = [];
		const answers: Record<string, number[]> = { "http://api/ready": [503, 503, 200], "http://web/": [307] };
		const result = await waitForHttp({
			urls: Object.keys(answers),
			timeoutMs: 10_000,
			pollIntervalMs: 1_000,
			fetchStatus: (url) => {
				calls.push(url);
				return Promise.resolve(answers[url]?.shift() ?? 500);
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
			fetchStatus: () => {
				attempt += 1;
				return attempt < 3 ? Promise.reject(new Error("fetch failed: ECONNREFUSED")) : Promise.resolve(200);
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
			fetchStatus: (url) => {
				return url === "http://web/" ? Promise.reject(new Error("ECONNREFUSED")) : Promise.resolve(503);
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
