import { act, renderHook, waitFor } from "@testing-library/react-native";
import * as React from "react";
import { AppState, type AppStateStatus, type EventSubscription } from "react-native";

import { dynamic, fail, ok, stubApi, type ApiStub, type StubResponse } from "../../../../test/api-stub";
import { AppProviders, createTestRuntime } from "../../../../test/app-harness";
import { NOW_MS, sessionStatusJson } from "../../../../test/fixtures";
import { testAccessToken } from "../../../../test/jwt";
import { listenerCount, OFFLINE_STATE, ONLINE_STATE, setState } from "../../../../test/network-fake";
import { NETWORK_TEST_INTERVAL_MS, NETWORK_TEST_SAMPLES, type NetworkQualityReading } from "@workspace/shared";

import { AppStatusProvider, MissingAppStatusProviderError, useNetworkStatus, useSessionIndicator } from "../facade";
import { ROTATION_PULSE_MS, type SessionIndicator } from "../indicators";

const TICK_MS = 1_000;
const TOKEN_LIFETIME_MS = 900_000;
const SESSION_ROUTE = "GET /session";
const PING_ROUTE = "GET /health/ping";
/** Requests per connection test: the warm-up and the timed samples. */
const REQUESTS_PER_TEST = NETWORK_TEST_SAMPLES + 1;

interface AppStatus {
	readonly network: NetworkQualityReading;
	readonly testing: boolean;
	readonly testAgain: () => void;
	readonly session: SessionIndicator;
}

function useAppStatus(): AppStatus {
	const { reading, testing, testAgain } = useNetworkStatus();
	return { network: reading, testing, testAgain, session: useSessionIndicator() };
}

/** Answers `GET /session` with each expiry in turn, the last one from then on. */
function sessionAnswers(...expiries: readonly number[]): StubResponse[] {
	return expiries.map((expiresAt: number): StubResponse => ok(sessionStatusJson(expiresAt)));
}

/** Answers `GET /session` with each answer in turn, and the connection test's `GET /health/ping` with `ping` (200 by default). */
function stubSessionStatus(answers: readonly StubResponse[], ping: StubResponse = ok({ timestamp: NOW_MS })): ApiStub {
	let served = 0;
	return stubApi({
		[SESSION_ROUTE]: dynamic((): StubResponse => {
			const answer = answers.at(Math.min(served, answers.length - 1)) ?? fail(500, "NO_ANSWER", "No answer left");
			served += 1;
			return answer;
		}),
		[PING_ROUTE]: ping,
	});
}

interface Harness {
	readonly result: { readonly current: AppStatus };
	readonly emitAppState: (state: AppStateStatus) => void;
	readonly unmount: () => Promise<void>;
}

async function renderAppStatus(): Promise<Harness> {
	let appStateListener: ((state: AppStateStatus) => void) | null = null;
	jest.spyOn(AppState, "addEventListener").mockImplementation((_type, handler): EventSubscription => {
		appStateListener = handler;
		return { remove: jest.fn() };
	});
	const runtime = createTestRuntime({}, { status: "signedIn", session: { scope: "full" } });
	await runtime.tokenProvider.saveTokens({ accessToken: testAccessToken(), refreshToken: "refresh-1" });
	function Wrapper({ children }: { readonly children: React.ReactNode }): React.JSX.Element {
		return (
			<AppProviders runtime={runtime}>
				<AppStatusProvider>{children}</AppStatusProvider>
			</AppProviders>
		);
	}
	const { result, unmount } = await renderHook(useAppStatus, { wrapper: Wrapper });
	return {
		result,
		emitAppState: (state: AppStateStatus): void => {
			appStateListener?.(state);
		},
		unmount,
	};
}

describe("AppStatusProvider", () => {
	beforeEach(() => {
		jest.useFakeTimers({ now: NOW_MS });
	});

	afterEach(() => {
		jest.useRealTimers();
	});

	it("checks the session, then counts down to the token's expiry every second", async () => {
		stubSessionStatus(sessionAnswers(NOW_MS + TOKEN_LIFETIME_MS));
		const { result } = await renderAppStatus();

		await waitFor(() => {
			expect(result.current.session).toEqual({ status: "verified", secondsLeft: 900, refreshed: false });
		});
		await act((): void => {
			jest.advanceTimersByTime(TICK_MS * 3);
		});
		expect(result.current.session).toEqual({ status: "verified", secondsLeft: 897, refreshed: false });
	});

	it("checks again on return to the foreground, and lights up when a refresh rotated the token", async () => {
		const api = stubSessionStatus(sessionAnswers(NOW_MS + TOKEN_LIFETIME_MS, NOW_MS + TOKEN_LIFETIME_MS * 2));
		const harness = await renderAppStatus();
		await waitFor(() => {
			expect(harness.result.current.session).toMatchObject({ status: "verified", secondsLeft: 900 });
		});

		await act((): void => {
			harness.emitAppState("background");
		});
		await act((): void => {
			harness.emitAppState("active");
		});

		await waitFor(() => {
			expect(harness.result.current.session).toMatchObject({ status: "verified", refreshed: true });
		});
		expect(api.callsTo(SESSION_ROUTE)).toHaveLength(2);
		await act((): void => {
			jest.advanceTimersByTime(ROTATION_PULSE_MS + TICK_MS);
		});
		expect(harness.result.current.session).toMatchObject({ status: "verified", refreshed: false });
	});

	it("does not tick in the background", async () => {
		stubSessionStatus(sessionAnswers(NOW_MS + TOKEN_LIFETIME_MS));
		const harness = await renderAppStatus();
		await waitFor(() => {
			expect(harness.result.current.session).toMatchObject({ secondsLeft: 900 });
		});

		await act((): void => {
			harness.emitAppState("background");
		});
		await act((): void => {
			jest.advanceTimersByTime(TICK_MS * 10);
		});

		expect(harness.result.current.session).toMatchObject({ secondsLeft: 900 });
	});

	it("checks again when the countdown reaches zero — the check that refreshes the token", async () => {
		const api = stubSessionStatus(sessionAnswers(NOW_MS + TICK_MS * 2, NOW_MS + TOKEN_LIFETIME_MS));
		const { result } = await renderAppStatus();
		await waitFor(() => {
			expect(result.current.session).toMatchObject({ secondsLeft: 2 });
		});

		await act((): void => {
			jest.advanceTimersByTime(TICK_MS * 2);
		});

		await waitFor(() => {
			expect(result.current.session).toMatchObject({ status: "verified", refreshed: true });
		});
		expect(api.callsTo(SESSION_ROUTE)).toHaveLength(2);
	});

	it("checks once at expiry, not in a loop, when the answer is still an expired token", async () => {
		const api = stubSessionStatus(sessionAnswers(NOW_MS + TICK_MS, NOW_MS + TICK_MS));
		const { result } = await renderAppStatus();
		await waitFor(() => {
			expect(result.current.session).toMatchObject({ secondsLeft: 1 });
		});

		await act((): void => {
			jest.advanceTimersByTime(TICK_MS * 30);
		});

		expect(result.current.session).toMatchObject({ status: "verified", secondsLeft: 0 });
		expect(api.callsTo(SESSION_ROUTE)).toHaveLength(2);
	});

	it("follows the connection, and checks the session again when it comes back", async () => {
		const api = stubSessionStatus(sessionAnswers(NOW_MS + TOKEN_LIFETIME_MS));
		const { result } = await renderAppStatus();
		await waitFor(() => {
			expect(result.current.session).toMatchObject({ status: "verified" });
		});
		await waitFor(() => {
			expect(result.current.network.status).toBe("measured");
		});

		await act((): void => {
			setState(OFFLINE_STATE);
		});
		expect(result.current.network).toEqual({ status: "offline" });
		expect(api.callsTo(SESSION_ROUTE)).toHaveLength(1);

		await act((): void => {
			setState(ONLINE_STATE);
		});
		await waitFor(() => {
			expect(api.callsTo(SESSION_ROUTE)).toHaveLength(2);
		});
		await waitFor(() => {
			expect(result.current.network.status).toBe("measured");
		});
		expect(api.callsTo(PING_ROUTE)).toHaveLength(REQUESTS_PER_TEST * 2);
	});

	it("times the API's ping route and grades the connection", async () => {
		const api = stubSessionStatus(sessionAnswers(NOW_MS + TOKEN_LIFETIME_MS));
		const { result } = await renderAppStatus();
		await waitFor(() => {
			expect(result.current.network).toMatchObject({ status: "measured", quality: { kind: "measured", lossPercent: 0, strength: "strong" } });
		});
		expect(api.callsTo(PING_ROUTE)).toHaveLength(REQUESTS_PER_TEST);
		expect(api.callsTo(PING_ROUTE).at(0)?.headers.authorization).toBeUndefined();
	});

	it("reads no response when the API does not answer the ping", async () => {
		stubSessionStatus(sessionAnswers(NOW_MS + TOKEN_LIFETIME_MS), fail(503, "SERVICE_UNAVAILABLE", "Down"));
		const { result } = await renderAppStatus();
		await waitFor(() => {
			expect(result.current.network.status).toBe("unreachable");
		});
	});

	it("re-tests every minute in the foreground, never in the background, and on request", async () => {
		const api = stubSessionStatus(sessionAnswers(NOW_MS + TOKEN_LIFETIME_MS));
		const harness = await renderAppStatus();
		await waitFor(() => {
			expect(harness.result.current.network.status).toBe("measured");
		});
		await act(async (): Promise<void> => {
			await jest.advanceTimersByTimeAsync(NETWORK_TEST_INTERVAL_MS);
		});
		await waitFor(() => {
			expect(api.callsTo(PING_ROUTE)).toHaveLength(REQUESTS_PER_TEST * 2);
		});

		await act((): void => {
			harness.emitAppState("background");
		});
		await act(async (): Promise<void> => {
			await jest.advanceTimersByTimeAsync(NETWORK_TEST_INTERVAL_MS * 3);
		});
		expect(api.callsTo(PING_ROUTE)).toHaveLength(REQUESTS_PER_TEST * 2);

		// Back in the foreground with a result older than a minute: test at once.
		await act((): void => {
			harness.emitAppState("active");
		});
		await waitFor(() => {
			expect(api.callsTo(PING_ROUTE)).toHaveLength(REQUESTS_PER_TEST * 3);
		});
		await waitFor(() => {
			expect(harness.result.current.testing).toBe(false);
		});

		await act((): void => {
			harness.result.current.testAgain();
		});
		await waitFor(() => {
			expect(api.callsTo(PING_ROUTE)).toHaveLength(REQUESTS_PER_TEST * 4);
		});
	});

	it("reports a check that could not reach the server", async () => {
		stubSessionStatus([fail(503, "SERVICE_UNAVAILABLE", "Down")]);
		const { result } = await renderAppStatus();

		// The query client retries a 5xx before it gives up.
		await waitFor(() => {
			jest.advanceTimersByTime(TICK_MS * 10);
			expect(result.current.session).toEqual({ status: "failed", failure: "unreachable" });
		});
	});

	it("leaves no network listener behind when it unmounts", async () => {
		stubSessionStatus(sessionAnswers(NOW_MS + TOKEN_LIFETIME_MS));
		const { unmount } = await renderAppStatus();
		expect(listenerCount()).toBe(1);

		await unmount();
		expect(listenerCount()).toBe(0);
	});

	it("refuses to be read outside its provider — a wiring bug", async () => {
		jest.spyOn(console, "error").mockImplementation((): void => undefined);
		await expect(renderHook(useNetworkStatus)).rejects.toThrow(MissingAppStatusProviderError);
		await expect(renderHook(useSessionIndicator)).rejects.toThrow(MissingAppStatusProviderError);
	});
});
