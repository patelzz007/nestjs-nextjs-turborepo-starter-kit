import { fireEvent, render, screen } from "@testing-library/react-native";
import ShieldCheckIcon from "lucide-react-native/icons/shield-check";
import UserIcon from "lucide-react-native/icons/user";
import * as React from "react";
import { SafeAreaProvider, type Metrics } from "react-native-safe-area-context";

import { OnboardingCarousel, type OnboardingLabels, type OnboardingSlide } from "./onboarding-carousel";

/** A phone-sized frame: SafeAreaProvider renders nothing until it knows the metrics. */
const METRICS: Metrics = { frame: { x: 0, y: 0, width: 390, height: 844 }, insets: { top: 47, left: 0, right: 0, bottom: 34 } };

const LABELS: OnboardingLabels = {
	skip: "Skip",
	next: "Next",
	finish: "Get started",
	step: (current: number, total: number): string => `Step ${String(current)} of ${String(total)}`,
};

const SLIDES: readonly OnboardingSlide[] = [
	{ key: "one", mark: { kind: "brand" }, accents: [UserIcon, ShieldCheckIcon], title: "Welcome", description: "First page." },
	{ key: "two", mark: { kind: "icon", icon: ShieldCheckIcon }, accents: [UserIcon, ShieldCheckIcon], title: "Secure", description: "Second page." },
];

async function renderCarousel(onFinish: () => void): Promise<void> {
	await render(
		<SafeAreaProvider initialMetrics={METRICS}>
			<OnboardingCarousel brandName="Starter" slides={SLIDES} labels={LABELS} onFinish={onFinish} testID="onboarding" />
		</SafeAreaProvider>,
	);
}

describe("OnboardingCarousel", () => {
	it("shows the brand, every slide's title and words, and where the reader is", async () => {
		await renderCarousel(jest.fn());

		expect(screen.getByText("Starter")).toBeOnTheScreen();
		expect(screen.getByRole("header", { name: "Welcome" })).toBeOnTheScreen();
		expect(screen.getByRole("header", { name: "Secure" })).toBeOnTheScreen();
		expect(screen.getByLabelText("Step 1 of 2")).toBeOnTheScreen();
	});

	it("can be skipped from the first page", async () => {
		const onFinish = jest.fn();
		await renderCarousel(onFinish);

		await fireEvent.press(screen.getByRole("button", { name: "Skip" }));

		expect(onFinish).toHaveBeenCalledTimes(1);
	});

	it("moves page by page, then finishes from the last page — where Skip is gone", async () => {
		const onFinish = jest.fn();
		await renderCarousel(onFinish);

		await fireEvent.press(screen.getByRole("button", { name: "Next" }));
		expect(screen.getByLabelText("Step 2 of 2")).toBeOnTheScreen();
		expect(screen.queryByRole("button", { name: "Skip" })).toBeNull();
		expect(onFinish).not.toHaveBeenCalled();

		await fireEvent.press(screen.getByRole("button", { name: "Get started" }));
		expect(onFinish).toHaveBeenCalledTimes(1);
	});

	it("follows a swipe: the page settles where the scroll stops", async () => {
		await renderCarousel(jest.fn());

		await fireEvent(screen.getByTestId("onboarding-pager"), "momentumScrollEnd", { nativeEvent: { contentOffset: { x: 390, y: 0 } } });

		expect(screen.getByLabelText("Step 2 of 2")).toBeOnTheScreen();
		expect(screen.getByRole("button", { name: "Get started" })).toBeOnTheScreen();
	});
});
