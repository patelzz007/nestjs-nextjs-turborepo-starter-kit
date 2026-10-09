import { renderRouter, screen } from "expo-router/testing-library";
import * as React from "react";

import { markerScreen, SlotLayout } from "../../test/app-harness";
import type { RootRoute } from "../features/session/selectors";
import { RootStack } from "./root-navigator";

function rootLayout(route: Exclude<RootRoute, "starting">): () => React.JSX.Element {
	return function RootLayoutUnderTest(): React.JSX.Element {
		return <RootStack route={route} />;
	};
}

const SCREEN_NAMES = ["config-error screen", "update-required screen", "lock screen", "sign-in screen", "home screen"];

function routesFor(route: Exclude<RootRoute, "starting">): Record<string, () => React.JSX.Element> {
	return {
		_layout: rootLayout(route),
		"config-error": markerScreen("config-error screen"),
		"update-required": markerScreen("update-required screen"),
		lock: markerScreen("lock screen"),
		"(auth)/_layout": SlotLayout,
		"(auth)/sign-in": markerScreen("sign-in screen"),
		"(app)/_layout": SlotLayout,
		"(app)/index": markerScreen("home screen"),
	};
}

describe("RootStack — exactly one route group per state (§9.6)", () => {
	it.each([
		["config-error", "config-error screen"],
		["update-required", "update-required screen"],
		["lock", "lock screen"],
		["auth", "sign-in screen"],
		["app", "home screen"],
	] satisfies [Exclude<RootRoute, "starting">, string][])("route %s shows only %s, whatever URL was asked for", async (route, expected) => {
		for (const initialUrl of ["/", "/lock", "/update-required", "/config-error", "/sign-in"]) {
			const view = renderRouter(routesFor(route), { initialUrl });
			await view;
			expect(screen.getByText(expected)).toBeOnTheScreen();
			for (const other of SCREEN_NAMES.filter((name: string): boolean => name !== expected)) {
				expect(screen.queryByText(other)).toBeNull();
			}
			await screen.unmount();
		}
	});
});
