import { fireEvent, render, screen } from "@testing-library/react-native";
import * as React from "react";
import { Text } from "react-native";
import { SafeAreaProvider, type Metrics } from "react-native-safe-area-context";

import { AuthPage } from "./auth-page";
import { AuthShell } from "./auth-shell";
import { TextLink } from "./text-link";

/** A phone-sized frame: SafeAreaProvider renders nothing until it knows the metrics. */
const METRICS: Metrics = { frame: { x: 0, y: 0, width: 390, height: 844 }, insets: { top: 47, left: 0, right: 0, bottom: 34 } };

function inFrame(children: React.ReactNode): React.JSX.Element {
	return <SafeAreaProvider initialMetrics={METRICS}>{children}</SafeAreaProvider>;
}

describe("AuthShell", () => {
	it("shows the brand large — tile, name and tagline — above the screens", async () => {
		await render(
			inFrame(
				<AuthShell brandName="Reward Hub" tagline="Sign in to pick up where you left off." testID="shell">
					<Text>sign-in form</Text>
				</AuthShell>,
			),
		);

		expect(screen.getByTestId("shell-brand")).toBeOnTheScreen();
		expect(screen.getByRole("header", { name: "Reward Hub" })).toBeOnTheScreen();
		expect(screen.getByText("Sign in to pick up where you left off.")).toBeOnTheScreen();
		expect(screen.getByText("sign-in form")).toBeOnTheScreen();
	});

	it("folds the brand into one compact row while the keyboard is open", async () => {
		await render(
			inFrame(
				<AuthShell brandName="Reward Hub" tagline="Sign in to pick up where you left off." compact testID="shell">
					<Text>sign-in form</Text>
				</AuthShell>,
			),
		);

		expect(screen.getByTestId("shell-brand-compact")).toBeOnTheScreen();
		expect(screen.queryByTestId("shell-brand")).toBeNull();
		expect(screen.getByRole("header", { name: "Reward Hub" })).toBeOnTheScreen();
		expect(screen.queryByText("Sign in to pick up where you left off.")).toBeNull();
	});
});

describe("AuthPage", () => {
	it("titles the screen as a header, with its description, form and footer", async () => {
		await render(
			inFrame(
				<AuthPage title="Welcome back" description="Sign in to continue." footer={<Text>footer line</Text>} testID="page">
					<Text>the form</Text>
				</AuthPage>,
			),
		);

		expect(screen.getByRole("header", { name: "Welcome back" })).toBeOnTheScreen();
		expect(screen.getByText("Sign in to continue.")).toBeOnTheScreen();
		expect(screen.getByText("the form")).toBeOnTheScreen();
		expect(screen.getByText("footer line")).toBeOnTheScreen();
	});

	it("goes without a description or footer", async () => {
		await render(
			inFrame(
				<AuthPage title="Check your email">
					<Text>the form</Text>
				</AuthPage>,
			),
		);

		expect(screen.getByRole("header", { name: "Check your email" })).toBeOnTheScreen();
		expect(screen.queryByText("footer line")).toBeNull();
	});
});

describe("TextLink", () => {
	it("is a link with an optional lead-in, reporting presses", async () => {
		const onPress = jest.fn();
		await render(<TextLink leadIn="Don't have an account?" label="Create one" onPress={onPress} testID="link" />);

		expect(screen.getByText("Don't have an account?")).toBeOnTheScreen();
		await fireEvent.press(screen.getByRole("link", { name: "Create one" }));
		expect(onPress).toHaveBeenCalledTimes(1);
	});

	it("is announced as a button when it acts in place", async () => {
		await render(<TextLink label="Sign out" role="button" onPress={jest.fn()} />);

		expect(screen.getByRole("button", { name: "Sign out" })).toBeOnTheScreen();
		expect(screen.queryByRole("link")).toBeNull();
	});
});
