import { fireEvent, screen, waitFor, within } from "expo-router/testing-library";
import { Text } from "react-native";
import * as React from "react";

import { stubApi } from "../../../../../test/api-stub";
import { createTestRuntime, renderInApp, type RenderedApp } from "../../../../../test/app-harness";
import { setDevelopmentBuild } from "../../../../../test/development-build";
import { testAccessToken } from "../../../../../test/jwt";
import ShowcaseComponentRoute from "../../../../app/(app)/showcase/[slug]/index";
import ShowcaseDocsRoute from "../../../../app/(app)/showcase/[slug]/docs";
import ShowcaseIndexRoute from "../../../../app/(app)/showcase/index";
import { SHOWCASE_CATALOG_ORDER } from "../../../../features/showcase/showcase-catalog";

function SettingsStub(): React.JSX.Element {
	return <Text>Settings</Text>;
}

async function renderShowcase(url: string): Promise<RenderedApp> {
	const runtime = createTestRuntime({}, { status: "signedIn", session: { scope: "full" } });
	await runtime.tokenProvider.saveTokens({ accessToken: testAccessToken(), refreshToken: "refresh-1" });
	return renderInApp(
		runtime,
		{ "showcase/index": ShowcaseIndexRoute, "showcase/[slug]/index": ShowcaseComponentRoute, "showcase/[slug]/docs": ShowcaseDocsRoute, "settings/index": SettingsStub },
		url,
	);
}

describe("the component showcase", () => {
	it("lists every component as a card, family by family, and makes no request", async () => {
		const api = stubApi({});
		await renderShowcase("/showcase");

		expect(await screen.findByText("Component showcase")).toBeOnTheScreen();
		expect(screen.getByTestId("showcase-family-actions")).toBeOnTheScreen();
		expect(screen.getAllByTestId(/^showcase-card-/u)).toHaveLength(SHOWCASE_CATALOG_ORDER.length);
		expect(api.calls).toHaveLength(0);
	});

	it("opens a component's screen from its card: guidance, every feature live, its Do / Don't pairs and its FAQ", async () => {
		stubApi({});
		const app = await renderShowcase("/showcase");

		await fireEvent.press(await screen.findByTestId("showcase-card-button"));

		await waitFor((): void => {
			expect(app.pathname()).toBe("/showcase/button");
		});
		expect(await screen.findByTestId("showcase-guidance")).toBeOnTheScreen();
		expect(await screen.findByTestId("showcase-feature-default")).toBeOnTheScreen();
		expect(await screen.findByTestId("showcase-guidelines")).toBeOnTheScreen();
		expect(screen.getByTestId("showcase-faq")).toBeOnTheScreen();
	});

	it("shows a feature's code on its Code tab", async () => {
		stubApi({});
		await renderShowcase("/showcase/button");

		const feature = await screen.findByTestId("showcase-feature-default");
		await fireEvent.press(within(feature).getByRole("tab", { name: "Code" }));

		expect(await screen.findByTestId("showcase-code-default")).toBeOnTheScreen();
	});

	it("opens the docs with the API reference and the examples it walks through", async () => {
		stubApi({});
		await renderShowcase("/showcase/button/docs");

		expect(await screen.findByTestId("showcase-docs-body")).toBeOnTheScreen();
		expect(screen.getByTestId("showcase-api-reference")).toBeOnTheScreen();
		expect(screen.getByTestId("showcase-docs-example-c-button-1")).toBeOnTheScreen();
	});

	it("finds a component or a feature from the search and opens it", async () => {
		stubApi({});
		const app = await renderShowcase("/showcase");

		await fireEvent.changeText(await screen.findByTestId("showcase-search-input"), "loading state");
		await fireEvent.press(within(screen.getByTestId("showcase-search-results")).getByRole("button", { name: "Loading State, Button" }));

		await waitFor((): void => {
			expect(app.pathname()).toBe("/showcase/button");
		});
	});

	it("jumps to a family from its chip on the index", async () => {
		stubApi({});
		await renderShowcase("/showcase");

		await fireEvent.press(await screen.findByRole("button", { name: /^Form inputs, \d+ components$/u }));

		expect(screen.getByTestId("showcase-index")).toBeOnTheScreen();
	});

	it("shows a component's notes, jumps to a feature from its chip, and steps to the components before and after it", async () => {
		stubApi({});
		const app = await renderShowcase("/showcase/accordion");

		expect(await screen.findByText("Notes")).toBeOnTheScreen();
		const [firstChip] = await screen.findAllByRole("button", { name: /^Go to /u });
		if (firstChip !== undefined) {
			await fireEvent.press(firstChip);
		}
		await fireEvent.press(await screen.findByRole("link", { name: /^Previous: /u }));
		await waitFor((): void => {
			expect(app.pathname()).not.toBe("/showcase/accordion");
		});
		const previous = app.pathname();
		await fireEvent.press(await screen.findByRole("link", { name: "Next: Accordion" }));
		await waitFor((): void => {
			expect(app.pathname()).toBe("/showcase/accordion");
		});
		expect(previous).toMatch(/^\/showcase\/[a-z-]+$/u);
	});

	it("says so for a component it does not have", async () => {
		stubApi({});
		await renderShowcase("/showcase/no-such-component");

		expect(await screen.findByText("No such component")).toBeOnTheScreen();
	});

	it("is left out of a store build: its routes send the person to Settings", async () => {
		const developmentBuild: boolean = __DEV__;
		setDevelopmentBuild(false);
		try {
			stubApi({});
			const app = await renderShowcase("/showcase");

			await waitFor((): void => {
				expect(app.pathname()).toBe("/settings");
			});
		} finally {
			setDevelopmentBuild(developmentBuild);
		}
	});
});
