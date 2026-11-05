import { Stack } from "expo-router";
import { act, renderRouter, screen } from "expo-router/testing-library";
import * as React from "react";

import { markerScreen, gatedMarkerScreen, gatedSlotLayout } from "../../../test/app-harness";
import AuthFolderLayout from "../../app/auth/_layout";
import { RootStack, withRootGate, type GatedRootRoute } from "../root-navigator";

function rootLayout(route: GatedRootRoute): () => React.JSX.Element {
	return function RootLayoutUnderTest(): React.JSX.Element {
		return <RootStack route={route} />;
	};
}

const SCREEN_NAMES = ["config-error screen", "update-required screen", "lock screen", "onboarding screen", "sign-in screen", "home screen"];

function routesFor(route: GatedRootRoute): Record<string, () => React.JSX.Element> {
	return {
		_layout: rootLayout(route),
		"config-error": gatedMarkerScreen(["config-error"], "config-error screen"),
		"update-required": gatedMarkerScreen(["update-required"], "update-required screen"),
		lock: gatedMarkerScreen(["lock"], "lock screen"),
		"auth/_layout": AuthFolderLayout,
		"auth/onboarding": gatedMarkerScreen(["onboarding"], "onboarding screen"),
		"auth/(forms)/_layout": gatedSlotLayout(["auth", "enroll-two-factor", "verify-email"]),
		"auth/(forms)/sign-in": gatedMarkerScreen(["auth"], "sign-in screen"),
		"(app)/_layout": gatedSlotLayout(["app"]),
		"(app)/index": markerScreen("home screen"),
	};
}

describe("RootStack — exactly one route group per state (§9.6)", () => {
	it.each([
		["config-error", "config-error screen"],
		["update-required", "update-required screen"],
		["lock", "lock screen"],
		["onboarding", "onboarding screen"],
		["auth", "sign-in screen"],
		["app", "home screen"],
	] satisfies [GatedRootRoute, string][])("route %s shows only %s, whatever URL was asked for", async (route, expected) => {
		for (const initialUrl of ["/", "/lock", "/update-required", "/config-error", "/auth/onboarding", "/auth/sign-in"]) {
			await renderRouter(routesFor(route), { initialUrl });
			expect(screen.getByText(expected)).toBeOnTheScreen();
			for (const other of SCREEN_NAMES.filter((name: string): boolean => name !== expected)) {
				expect(screen.queryByText(other)).toBeNull();
			}
			await screen.unmount();
		}
	});
});

describe("RootStack — moving between root routes", () => {
	it.each([
		["app", "auth", "sign-in screen"],
		["auth", "app", "home screen"],
		["app", "enroll-two-factor", "enroll screen"],
		["enroll-two-factor", "app", "home screen"],
		["auth", "verify-email", "verify-email screen"],
		// Inside the auth folder: the walkthrough (full screen) and the AuthShell forms are siblings.
		["onboarding", "auth", "sign-in screen"],
		["auth", "onboarding", "onboarding screen"],
		["onboarding", "app", "home screen"],
		["lock", "auth", "sign-in screen"],
	] satisfies [GatedRootRoute, GatedRootRoute, string][])("from %s to %s shows %s, with no update loop and no unhandled action", async (from, to, expected) => {
		const errors = jest.spyOn(console, "error");
		let moveTo: (route: GatedRootRoute) => void = (): void => undefined;
		let render: () => void = (): void => undefined;
		function MovingRoot(): React.JSX.Element {
			const [route, setRoute] = React.useState<GatedRootRoute>(from);
			const [, setRenders] = React.useState(0);
			moveTo = setRoute;
			render = (): void => {
				setRenders((count: number): number => count + 1);
			};
			return <RootStack route={route} />;
		}
		// The auth/(forms) group as a plain stack (the real one adds the AuthShell): the sign-in screens and the
		// enrollment steps, each gated to its own route, beside the walkthrough in the real auth folder.
		function AuthGroupLayout(): React.JSX.Element {
			return <Stack screenOptions={{ headerShown: false }} />;
		}
		await renderRouter(
			{
				_layout: MovingRoot,
				lock: gatedMarkerScreen(["lock"], "lock screen"),
				"auth/_layout": AuthFolderLayout,
				"auth/onboarding": gatedMarkerScreen(["onboarding"], "onboarding screen"),
				"auth/(forms)/_layout": withRootGate(["auth", "enroll-two-factor", "verify-email"], AuthGroupLayout),
				"auth/(forms)/sign-in": gatedMarkerScreen(["auth"], "sign-in screen"),
				"auth/(forms)/enroll-two-factor": gatedMarkerScreen(["enroll-two-factor"], "enroll screen"),
				"auth/(forms)/verify-email": gatedMarkerScreen(["verify-email"], "verify-email screen"),
				"(app)/_layout": gatedSlotLayout(["app"]),
				"(app)/index": markerScreen("home screen"),
			},
			{ initialUrl: "/" },
		);
		await act((): void => {
			moveTo(to);
		});
		expect(await screen.findByText(expected)).toBeOnTheScreen();
		// A later render of everything (the live stream reconnecting, a clock) is what set the old guards looping.
		await act((): void => {
			render();
		});
		expect(screen.getByText(expected)).toBeOnTheScreen();
		const logged = errors.mock.calls.flat().join("\n");
		errors.mockRestore();
		expect(logged).not.toContain("Maximum update depth");
		expect(logged).not.toContain("was not handled");
	});
});
