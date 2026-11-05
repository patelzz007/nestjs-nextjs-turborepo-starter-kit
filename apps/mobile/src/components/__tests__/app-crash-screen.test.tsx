import { fireEvent, render, screen } from "@testing-library/react-native";
import * as React from "react";
import { SafeAreaProvider, type Metrics } from "react-native-safe-area-context";

import { installCrashReporter, NO_CRASH_REPORTER } from "../../lib/crash-reporting/crash-reporter";
import { AppCrashScreen } from "../app-crash-screen";

/** A phone-sized frame: SafeAreaProvider renders nothing until it knows the metrics. */
const METRICS: Metrics = { frame: { x: 0, y: 0, width: 390, height: 844 }, insets: { top: 47, left: 0, right: 0, bottom: 34 } };

afterEach((): void => {
	installCrashReporter(NO_CRASH_REPORTER);
});

describe("AppCrashScreen", () => {
	it("reports the error once and tries the screen again on request", async () => {
		const recorded: string[] = [];
		installCrashReporter({
			recordError: (error: Error, where: string): void => {
				recorded.push(`${where}: ${error.message}`);
			},
		});
		const retry = jest.fn((): Promise<void> => Promise.resolve());
		await render(
			<SafeAreaProvider initialMetrics={METRICS}>
				<AppCrashScreen error={new Error("render failed")} retry={retry} />
			</SafeAreaProvider>,
		);

		expect(await screen.findByText("Something went wrong")).toBeTruthy();
		expect(recorded).toEqual(["screen: render failed"]);
		await fireEvent.press(screen.getByText("Try again"));
		expect(retry).toHaveBeenCalledTimes(1);
	});
});
