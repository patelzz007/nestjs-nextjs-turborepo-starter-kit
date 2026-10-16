import { fireEvent, screen } from "expo-router/testing-library";
import * as Haptics from "expo-haptics";

import { stubApi } from "../../../../../test/api-stub";
import { createTestRuntime, renderInApp } from "../../../../../test/app-harness";
import { testAccessToken } from "../../../../../test/jwt";
import ComponentsScreen from "../../../../app/(app)/settings/components";

async function renderComponents(): Promise<void> {
	const runtime = createTestRuntime({}, { status: "signedIn", session: { scope: "full" } });
	await runtime.tokenProvider.saveTokens({ accessToken: testAccessToken(), refreshToken: "refresh-1" });
	await renderInApp(runtime, { "settings/components": ComponentsScreen }, "/settings/components");
}

describe("Components (the UI kit gallery)", () => {
	beforeEach(() => {
		jest.spyOn(Haptics, "selectionAsync").mockResolvedValue(undefined);
	});

	it("opens on the form inputs, one family at a time, and makes no request", async () => {
		const api = stubApi({});
		await renderComponents();

		expect(screen.getByRole("radio", { name: "Inputs" })).toBeChecked();
		expect(screen.getByTestId("demo-Input")).toBeOnTheScreen();
		expect(screen.queryByTestId("demo-QrCode")).toBeNull();
		expect(api.calls).toHaveLength(0);
	});

	it("swaps the section when another family is chosen", async () => {
		stubApi({});
		await renderComponents();

		await fireEvent.press(screen.getByRole("radio", { name: "Media" }));

		expect(screen.getByRole("radio", { name: "Media" })).toBeChecked();
		expect(screen.getByTestId("demo-QrCode")).toBeOnTheScreen();
		expect(screen.queryByTestId("demo-Input")).toBeNull();
	});
});
