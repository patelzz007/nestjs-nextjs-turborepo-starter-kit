// @vitest-environment jsdom
import { act, renderHook, waitFor } from "@testing-library/react";
import { NETWORK_TEST_SAMPLES, type LatencyProbe } from "@workspace/shared";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { pingApi, useNetworkQuality } from "../use-network-quality";

/** Requests per test: the warm-up and the timed samples. */
const REQUESTS_PER_TEST = NETWORK_TEST_SAMPLES + 1;
const INTERVAL_MS = 60_000;

let online = true;
let visibility: DocumentVisibilityState = "visible";

beforeEach(() => {
	online = true;
	visibility = "visible";
	vi.spyOn(navigator, "onLine", "get").mockImplementation((): boolean => online);
	vi.spyOn(document, "visibilityState", "get").mockImplementation((): DocumentVisibilityState => visibility);
});

afterEach(() => {
	vi.useRealTimers();
	vi.restoreAllMocks();
});

function goOffline(): void {
	online = false;
	window.dispatchEvent(new Event("offline"));
}

function goOnline(): void {
	online = true;
	window.dispatchEvent(new Event("online"));
}

/** A probe whose every request is answered at once; `calls` counts them. */
function instantProbe(): { readonly probe: LatencyProbe; readonly calls: () => number } {
	let calls = 0;
	return {
		probe: async (): Promise<void> => {
			calls += 1;
			await Promise.resolve();
		},
		calls: (): number => calls,
	};
}

describe("useNetworkQuality", () => {
	it("tests right away and reports the measured connection", async () => {
		const network = instantProbe();
		const { result } = renderHook(() => useNetworkQuality({ probe: network.probe }));
		expect(result.current.reading).toEqual({ status: "measuring" });
		await waitFor(() => {
			expect(result.current.reading.status).toBe("measured");
		});
		expect(result.current.reading).toMatchObject({ status: "measured", quality: { kind: "measured", lossPercent: 0, strength: "strong" } });
		expect(result.current.testing).toBe(false);
		expect(network.calls()).toBe(REQUESTS_PER_TEST);
	});

	it("is unreachable when the API answers nothing", async () => {
		const probe: LatencyProbe = (): Promise<void> => Promise.reject(new Error("503"));
		const { result } = renderHook(() => useNetworkQuality({ probe }));
		await waitFor(() => {
			expect(result.current.reading.status).toBe("unreachable");
		});
	});

	it("shows offline while the browser is, then measures afresh once it is back", async () => {
		const network = instantProbe();
		const { result } = renderHook(() => useNetworkQuality({ probe: network.probe }));
		await waitFor(() => {
			expect(result.current.reading.status).toBe("measured");
		});

		act(goOffline);
		expect(result.current.reading).toEqual({ status: "offline" });
		act(() => {
			result.current.testAgain();
		});
		expect(network.calls()).toBe(REQUESTS_PER_TEST);

		act(goOnline);
		expect(result.current.reading).toEqual({ status: "measuring" });
		await waitFor(() => {
			expect(result.current.reading.status).toBe("measured");
		});
		expect(network.calls()).toBe(REQUESTS_PER_TEST * 2);
	});

	it("re-tests every interval while the tab is visible, and never while it is hidden", async () => {
		vi.useFakeTimers();
		const network = instantProbe();
		renderHook(() => useNetworkQuality({ probe: network.probe, intervalMs: INTERVAL_MS }));
		await act(async () => {
			await vi.advanceTimersByTimeAsync(0);
		});
		expect(network.calls()).toBe(REQUESTS_PER_TEST);

		await act(async () => {
			await vi.advanceTimersByTimeAsync(INTERVAL_MS);
		});
		expect(network.calls()).toBe(REQUESTS_PER_TEST * 2);

		visibility = "hidden";
		await act(async () => {
			document.dispatchEvent(new Event("visibilitychange"));
			await vi.advanceTimersByTimeAsync(INTERVAL_MS * 3);
		});
		expect(network.calls()).toBe(REQUESTS_PER_TEST * 2);

		// Back in view with a result older than the interval: test at once, not at the next tick.
		visibility = "visible";
		await act(async () => {
			document.dispatchEvent(new Event("visibilitychange"));
			await vi.advanceTimersByTimeAsync(0);
		});
		expect(network.calls()).toBe(REQUESTS_PER_TEST * 3);
	});

	it("starts no second test while one runs", async () => {
		const pending: (() => void)[] = [];
		const probe: LatencyProbe = (): Promise<void> =>
			new Promise<void>((resolve: () => void): void => {
				pending.push(resolve);
			});
		const { result } = renderHook(() => useNetworkQuality({ probe }));
		await waitFor(() => {
			expect(result.current.testing).toBe(true);
		});
		act(() => {
			result.current.testAgain();
		});
		expect(pending).toHaveLength(1);
	});
});

describe("pingApi", () => {
	it("fetches the API's ping route uncached and without cookies, reading the whole answer", async () => {
		const fetchStub = vi.fn((): Promise<Response> => Promise.resolve(new Response('{"success":true}', { status: 200 })));
		vi.stubGlobal("fetch", fetchStub);
		const signal = new AbortController().signal;
		await pingApi(signal);
		expect(fetchStub).toHaveBeenCalledWith("http://api.test/health/ping", { cache: "no-store", credentials: "omit", signal });
		vi.unstubAllGlobals();
	});

	it("fails when the API does not answer 200, so the request counts as lost", async () => {
		vi.stubGlobal("fetch", (): Promise<Response> => Promise.resolve(new Response(null, { status: 503 })));
		await expect(pingApi(new AbortController().signal)).rejects.toThrow("GET /health/ping answered 503");
		vi.unstubAllGlobals();
	});
});
