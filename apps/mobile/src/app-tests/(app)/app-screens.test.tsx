import { act, fireEvent, screen, waitFor } from "expo-router/testing-library";
import * as React from "react";

// First: the uniwind mock factory below reads it while the screens import uniwind.
import * as mockUniwindDefaults from "../../../test/uniwind-mock";
import { dynamic, fail, ok, stubApi } from "../../../test/api-stub";
import { createTestRuntime, markerScreen, renderInApp } from "../../../test/app-harness";
import { profileJson, userJson } from "../../../test/fixtures";
import { testAccessToken } from "../../../test/jwt";
import { memorySecureStore } from "../../../test/secure-store-memory";
import AppTabsLayout from "../../app/(app)/_layout";
import HomeScreen from "../../app/(app)/index";
import ProfileScreen from "../../app/(app)/profile";

const mockSetTheme = jest.fn();

jest.mock("uniwind", () => ({
	...mockUniwindDefaults,
	Uniwind: {
		setTheme: (theme: string): void => {
			mockSetTheme(theme);
		},
	},
	useCSSVariable: (name: string): string => (name === "--primary" ? "#24364f" : "#ffffff"),
}));

async function renderSignedIn(screens: Readonly<Record<string, () => React.JSX.Element>>, url: string): Promise<ReturnType<typeof createTestRuntime>> {
	const runtime = createTestRuntime({}, { status: "signedIn", session: { scope: "full" } });
	await runtime.tokenProvider.saveTokens({ accessToken: testAccessToken(), refreshToken: "refresh-1" });
	await renderInApp(runtime, screens, url);
	return runtime;
}

describe("(app) tabs", () => {
	it("offers Home, Profile and Settings with theme colours from the tokens", async () => {
		stubApi({ "GET /auth/me": ok(userJson()), "GET /auth/profile": ok(profileJson()) });
		await renderSignedIn({ "(app)/_layout": AppTabsLayout, "(app)/index": HomeScreen, "(app)/profile": ProfileScreen, "(app)/settings": markerScreen("settings") }, "/");

		expect(await screen.findByText("Alex Morgan")).toBeOnTheScreen();
		expect(screen.getAllByText("Profile").length).toBeGreaterThan(0);
		expect(screen.getAllByText("Settings").length).toBeGreaterThan(0);
		expect(mockSetTheme).not.toHaveBeenCalled();
	});
});

describe("Home (§10.7)", () => {
	it("shows who is signed in", async () => {
		stubApi({ "GET /auth/me": ok(userJson()), "GET /auth/profile": ok(profileJson()) });
		await renderSignedIn({ index: HomeScreen }, "/");

		expect(await screen.findByText("Alex Morgan")).toBeOnTheScreen();
		expect(screen.getByText("member@example.com")).toBeOnTheScreen();
		expect(screen.getByLabelText("Alex Morgan's initials")).toHaveTextContent("AM");
		expect(screen.getByText("This is the starter shell")).toBeOnTheScreen();
	});

	it("warns when backup codes are running low", async () => {
		stubApi({
			"GET /auth/me": ok(userJson({ twoFactorEnabled: true })),
			"GET /auth/profile": ok(profileJson()),
			"GET /auth/2fa/backup-codes/remaining": ok({ remaining: 2 }),
		});
		await renderSignedIn({ index: HomeScreen }, "/");

		expect(await screen.findByText("Only 2 backup codes are left. Generate new ones in Security settings.")).toBeOnTheScreen();
	});

	it("shows an error with a retry when the account cannot be loaded", async () => {
		let attempts = 0;
		stubApi({
			"GET /auth/me": dynamic(() => {
				attempts += 1;
				return attempts === 1 ? fail(403, "FORBIDDEN", "Not allowed") : ok(userJson());
			}),
			"GET /auth/profile": ok(profileJson()),
		});
		await renderSignedIn({ index: HomeScreen }, "/");

		expect(await screen.findByText("Not allowed")).toBeOnTheScreen();
		await fireEvent.press(screen.getByRole("button", { name: "Try again" }));
		expect(await screen.findByText("Alex Morgan")).toBeOnTheScreen();
	});
});

describe("Profile (§10.8)", () => {
	it("edits the full name with the optimistic-lock version, then shows the saved profile", async () => {
		const api = stubApi({
			"GET /auth/profile": ok(profileJson(3)),
			"PATCH /auth/profile": ok(profileJson(4, "Alex Q. Morgan")),
			"GET /auth/me": ok(userJson({ fullName: "Alex Q. Morgan" })),
		});
		await renderSignedIn({ profile: ProfileScreen }, "/profile");

		await fireEvent.changeText(await screen.findByLabelText("Full name"), "  Alex Q. Morgan ");
		await fireEvent.press(screen.getByRole("button", { name: "Save changes" }));

		expect(await screen.findByText("Profile saved.")).toBeOnTheScreen();
		expect(api.callsTo("PATCH /auth/profile").at(0)?.body).toBe(JSON.stringify({ fullName: "Alex Q. Morgan", version: 3 }));
		expect(screen.getByLabelText("Full name")).toHaveDisplayValue("Alex Q. Morgan");
	});

	it("reloads after a stale version and asks to edit again", async () => {
		let reads = 0;
		stubApi({
			"GET /auth/profile": dynamic(() => {
				reads += 1;
				return ok(profileJson(reads === 1 ? 3 : 5, reads === 1 ? "Alex Morgan" : "Changed Elsewhere"));
			}),
			"PATCH /auth/profile": fail(409, "CONFLICT", "Stale version"),
		});
		await renderSignedIn({ profile: ProfileScreen }, "/profile");

		await fireEvent.changeText(await screen.findByLabelText("Full name"), "Alex M.");
		await fireEvent.press(screen.getByRole("button", { name: "Save changes" }));

		await waitFor(() => {
			expect(screen.getByLabelText("Full name")).toHaveDisplayValue("Changed Elsewhere");
		});
	});

	it("validates with the shared schema", async () => {
		const api = stubApi({ "GET /auth/profile": ok(profileJson()) });
		await renderSignedIn({ profile: ProfileScreen }, "/profile");

		await fireEvent.changeText(await screen.findByLabelText("Full name"), "A");
		await fireEvent.press(screen.getByRole("button", { name: "Save changes" }));

		expect(await screen.findByText("Full name must be at least 2 characters")).toBeOnTheScreen();
		expect(api.callsTo("PATCH /auth/profile")).toHaveLength(0);
	});

	it("shows a load error with a retry", async () => {
		stubApi({ "GET /auth/profile": fail(403, "FORBIDDEN", "No profile access") });
		await renderSignedIn({ profile: ProfileScreen }, "/profile");
		expect(await screen.findByText("No profile access")).toBeOnTheScreen();
		await act(async (): Promise<void> => {
			await fireEvent.press(screen.getByRole("button", { name: "Try again" }));
		});
	});
});

describe("session end while signed in", () => {
	it("a revoked device leaves on its next request (ADR 034)", async () => {
		stubApi({ "GET /auth/me": fail(401, "SESSION_REVOKED", "This device was signed out"), "GET /auth/profile": ok(profileJson()) });
		const runtime = await renderSignedIn({ index: HomeScreen }, "/");

		await waitFor(() => {
			expect(runtime.sessionStore.getState()).toEqual({ status: "signedOut", reason: "sessionExpired" });
		});
		expect(memorySecureStore.peek("auth.refreshToken")).toBeNull();
	});
});
