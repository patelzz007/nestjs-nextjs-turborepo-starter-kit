// The Discover carousel inside a real (in-memory) Expo Router, so a card's button is checked by where
// the router actually ends up.

import { fireEvent, renderRouter, screen } from "expo-router/testing-library";
import * as React from "react";
import { Text } from "react-native";

import { ROUTES } from "../../../runtime/routes";
import { APP_TABS } from "../../navigation/app-tabs";
import { HOME_HIGHLIGHTS } from "../highlights";
import { HOME_HIGHLIGHTS_GAP, HomeHighlights } from "../home-highlights";
import { HOME_HIGHLIGHTS_COPY, homeHighlightSlideLabel } from "../labels";

/** A dot's position as people count it: one more than its index. */
const POSITION_OFFSET = 1;
const SECOND_POSITION = 2;
const ROW_WIDTH = 320;

function destination(name: string): () => React.JSX.Element {
	return function Destination(): React.JSX.Element {
		return <Text>{`At ${name}`}</Text>;
	};
}

async function renderHome(): Promise<void> {
	await renderRouter(
		{
			index: HomeHighlights,
			analytics: destination("analytics"),
			"settings/index": destination("settings"),
			"settings/app-lock": destination("app lock"),
			"settings/pdf-viewer": destination("pdf viewer"),
			"settings/appearance": destination("appearance"),
		},
		{ initialUrl: ROUTES.home },
	);
}

describe("HomeHighlights", () => {
	it("shows a card per highlight, the first one in view, each with a named dot", async () => {
		await renderHome();

		expect(screen.getByText(HOME_HIGHLIGHTS_COPY.title)).toBeOnTheScreen();
		expect(screen.getByText("See your activity")).toBeOnTheScreen();
		for (const [position] of HOME_HIGHLIGHTS.entries()) {
			expect(screen.getByRole("button", { name: homeHighlightSlideLabel(position + POSITION_OFFSET, HOME_HIGHLIGHTS.length) })).toBeOnTheScreen();
		}
	});

	it("gives each card the full width of the row, with a gap so cards never touch while swiped", async () => {
		await renderHome();
		await fireEvent(screen.getByTestId("home-highlights-carousel"), "layout", { nativeEvent: { layout: { width: ROW_WIDTH, height: ROW_WIDTH, x: 0, y: 0 } } });

		// A card is the row's full width: one card plus the gap per snap, nothing of the next card shown.
		const pager = screen.getByTestId("home-highlights-carousel-pager");
		expect(pager).toHaveProp("snapToInterval", ROW_WIDTH + HOME_HIGHLIGHTS_GAP);
		expect(pager).toHaveProp("contentContainerStyle", { gap: HOME_HIGHLIGHTS_GAP });
	});

	it("switches to a tab from its card", async () => {
		await renderHome();

		await fireEvent.press(screen.getByRole("button", { name: "Open analytics: See your activity" }));

		expect(screen).toHavePathname(ROUTES.analytics);
	});

	it("opens a screen under Settings from its card", async () => {
		await renderHome();
		await fireEvent.press(screen.getByRole("button", { name: homeHighlightSlideLabel(SECOND_POSITION, HOME_HIGHLIGHTS.length) }));

		await fireEvent.press(screen.getByRole("button", { name: "Set up app lock: Lock the app" }));

		expect(screen).toHavePathname(ROUTES.appLock);
	});
});

describe("HOME_HIGHLIGHTS", () => {
	it("points every card at one of the app's screens, each card once", () => {
		const routes: ReadonlySet<string> = new Set(Object.values(ROUTES));
		for (const highlight of HOME_HIGHLIGHTS) {
			expect(routes.has(highlight.route)).toBe(true);
		}
		expect(new Set(HOME_HIGHLIGHTS.map((highlight) => highlight.key)).size).toBe(HOME_HIGHLIGHTS.length);
	});

	it("marks a card as a tab exactly when its screen is one of the tabs", () => {
		const tabRoutes: ReadonlySet<string> = new Set(APP_TABS.map((tab) => tab.route));
		for (const highlight of HOME_HIGHLIGHTS) {
			expect(highlight.isTab).toBe(tabRoutes.has(highlight.route));
		}
	});
});

describe("homeHighlightSlideLabel", () => {
	it("names a card's dot by its position", () => {
		expect(homeHighlightSlideLabel(SECOND_POSITION, HOME_HIGHLIGHTS.length)).toBe(`Highlight 2 of ${String(HOME_HIGHLIGHTS.length)}`);
	});
});
