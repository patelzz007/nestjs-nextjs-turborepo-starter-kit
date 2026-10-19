import { fireEvent, screen, waitFor } from "expo-router/testing-library";
import { Text } from "react-native";
import * as Haptics from "expo-haptics";

import { stubApi } from "../../../../../test/api-stub";
import { createTestRuntime, renderInApp } from "../../../../../test/app-harness";
import { testAccessToken } from "../../../../../test/jwt";
import ComponentsScreen from "../../../../app/(app)/settings/components";

import type { RenderedApp } from "../../../../../test/app-harness";
import { setDevelopmentBuild } from "../../../../../test/development-build";

function SettingsStub(): React.JSX.Element {
	return <Text>Settings</Text>;
}

async function renderComponents(): Promise<RenderedApp> {
	const runtime = createTestRuntime({}, { status: "signedIn", session: { scope: "full" } });
	await runtime.tokenProvider.saveTokens({ accessToken: testAccessToken(), refreshToken: "refresh-1" });
	return renderInApp(runtime, { "settings/components": ComponentsScreen, "settings/index": SettingsStub }, "/settings/components");
}

describe("Components (the UI kit gallery)", () => {
	beforeEach(() => {
		jest.spyOn(Haptics, "selectionAsync").mockResolvedValue(undefined);
	});

	it("opens on the form inputs, one family at a time, and makes no request", async () => {
		const api = stubApi({});
		await renderComponents();

		expect(await screen.findByRole("radio", { name: "Inputs" })).toBeChecked();
		expect(screen.getByTestId("demo-Input")).toBeOnTheScreen();
		expect(screen.queryByTestId("demo-QrCode")).toBeNull();
		expect(api.calls).toHaveLength(0);
	});

	it("swaps the section when another family is chosen", async () => {
		stubApi({});
		await renderComponents();

		await fireEvent.press(await screen.findByRole("radio", { name: "Media" }));

		expect(screen.getByRole("radio", { name: "Media" })).toBeChecked();
		expect(screen.getByTestId("demo-QrCode")).toBeOnTheScreen();
		expect(screen.queryByTestId("demo-Input")).toBeNull();
	});

	it("is left out of a store build: the route sends the person to Settings", async () => {
		const developmentBuild: boolean = __DEV__;
		setDevelopmentBuild(false);
		try {
			stubApi({});

			const app = await renderComponents();

			await waitFor((): void => {
				expect(app.pathname()).toBe("/settings");
			});
			expect(screen.queryByRole("radio", { name: "Inputs" })).toBeNull();
		} finally {
			setDevelopmentBuild(developmentBuild);
		}
	});
});
