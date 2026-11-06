import { fireEvent, render, screen, waitFor } from "@testing-library/react-native";
import { NETWORK_TEST_SAMPLES } from "@workspace/shared";
import * as React from "react";

import { ok, stubApi, type ApiStub } from "../../../../test/api-stub";
import { AppProviders, createTestRuntime } from "../../../../test/app-harness";
import { NOW_MS, sessionStatusJson } from "../../../../test/fixtures";
import { testAccessToken } from "../../../../test/jwt";
import { AppStatusProvider } from "../facade";
import { StatusCards, StatusLine } from "../status-pills";

const TOKEN_LIFETIME_MS = 900_000;
const PING_ROUTE = "GET /health/ping";
/** Requests per connection test: the warm-up and the timed samples. */
const REQUESTS_PER_TEST = NETWORK_TEST_SAMPLES + 1;

async function renderPill(status: React.JSX.Element = <StatusLine onInk={false} testID="pill" />): Promise<ApiStub> {
	const api = stubApi({ "GET /session": ok(sessionStatusJson(NOW_MS + TOKEN_LIFETIME_MS)), [PING_ROUTE]: ok({ timestamp: NOW_MS }) });
	const runtime = createTestRuntime({}, { status: "signedIn", session: { scope: "full" } });
	await runtime.tokenProvider.saveTokens({ accessToken: testAccessToken(), refreshToken: "refresh-1" });
	await render(
		<AppProviders runtime={runtime}>
			<AppStatusProvider>{status}</AppStatusProvider>
		</AppProviders>,
	);
	return api;
}

describe("the drawer's status", () => {
	beforeEach(() => {
		jest.useFakeTimers({ now: NOW_MS });
	});

	afterEach(() => {
		jest.useRealTimers();
	});

	it("shows the connection and the time left in two titled cards", async () => {
		await renderPill(<StatusCards connectionTitle="Connection" sessionTitle="Session" testID="cards" />);
		await waitFor(() => {
			expect(screen.getByText("0 ms")).toBeTruthy();
		});
		expect(screen.getByRole("button", { name: "Connection: strong, 0 ms ping" })).toBeTruthy();
		expect(screen.getByText("Connection")).toBeTruthy();
		expect(screen.getByText("Session")).toBeTruthy();
		expect(screen.getByTestId("cards-session")).toHaveTextContent(/left$/u);
	});

	it("shows the ping once the connection is measured, with the time left beside it", async () => {
		await renderPill();
		await waitFor(() => {
			expect(screen.getByRole("button", { name: "Connection: strong, 0 ms ping" })).toBeTruthy();
		});
		expect(screen.getByText("Strong, 0 ms")).toBeTruthy();
	});

	it("opens the connection sheet with ping, jitter and packet loss, and tests again on request", async () => {
		const api = await renderPill();
		await waitFor(() => {
			expect(screen.getByRole("button", { name: "Connection: strong, 0 ms ping" })).toBeTruthy();
		});

		await fireEvent.press(screen.getByTestId("pill-network-button"));
		expect(screen.getByText("Strong connection")).toBeTruthy();
		expect(screen.getByLabelText("Ping 0 ms")).toBeTruthy();
		expect(screen.getByLabelText("Jitter 0 ms")).toBeTruthy();
		expect(screen.getByLabelText("Packet loss 0 %")).toBeTruthy();

		await fireEvent.press(screen.getByTestId("network-sheet-test-again"));
		await waitFor(() => {
			expect(api.callsTo(PING_ROUTE)).toHaveLength(REQUESTS_PER_TEST * 2);
		});
	});
});
