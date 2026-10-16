import { render, screen } from "@testing-library/react-native";
import * as React from "react";
import type { Text } from "react-native";

import { DEFAULT_RELATIVE_TIME_LABELS, RelativeTime, formatAbsoluteTime, formatRelativeTime, type RelativeTimeLabels, type RelativeTimeUnit } from "../relative-time";

/** 16 Oct 2026, 06:00 UTC. */
const NOW = Date.UTC(2026, 9, 16, 6, 0, 0);
const MINUTE_MS = 60_000;
const SECOND_MS = 1_000;
const DAY_MS = 86_400_000;
const THREE = 3;
const TWO = 2;
const ONE_HUNDRED_NINETEEN = 119;
const FIFTY_NINE = 59;

const MALAY_UNITS: Readonly<Record<RelativeTimeUnit, string>> = { year: "tahun", month: "bulan", week: "minggu", day: "hari", hour: "jam", minute: "minit" };

describe("formatRelativeTime", () => {
	it("words the past and the future in the largest unit that fits", () => {
		expect(formatRelativeTime(NOW - THREE * MINUTE_MS, NOW)).toBe("3 minutes ago");
		expect(formatRelativeTime(NOW + TWO * DAY_MS, NOW)).toBe("in 2 days");
		expect(formatRelativeTime(NOW - DAY_MS, NOW)).toBe("1 day ago");
	});

	it("truncates toward zero, and says `now` within a minute either way", () => {
		expect(formatRelativeTime(NOW - ONE_HUNDRED_NINETEEN * SECOND_MS, NOW)).toBe("1 minute ago");
		expect(formatRelativeTime(NOW, NOW)).toBe("now");
		expect(formatRelativeTime(NOW - FIFTY_NINE * SECOND_MS, NOW)).toBe("now");
		expect(formatRelativeTime(NOW + FIFTY_NINE * SECOND_MS, NOW)).toBe("now");
	});

	it("speaks the caller's words for another language", () => {
		const malay: RelativeTimeLabels = {
			now: "sekarang",
			amount: (count: number, unit: RelativeTimeUnit): string => `${String(count)} ${MALAY_UNITS[unit]}`,
			past: (amount: string): string => `${amount} yang lalu`,
			future: (amount: string): string => `dalam ${amount}`,
		};
		expect(formatRelativeTime(NOW - THREE * MINUTE_MS, NOW, malay)).toBe("3 minit yang lalu");
		expect(formatRelativeTime(NOW + TWO * DAY_MS, NOW, malay)).toBe("dalam 2 hari");
		expect(formatRelativeTime(NOW, NOW, malay)).toBe("sekarang");
	});

	it("never constructs Intl.RelativeTimeFormat, which Hermes (React Native's engine) does not have", () => {
		const relativeTimeFormat = jest.spyOn(Intl, "RelativeTimeFormat");
		formatRelativeTime(NOW - THREE * MINUTE_MS, NOW, DEFAULT_RELATIVE_TIME_LABELS);
		expect(relativeTimeFormat).not.toHaveBeenCalled();
	});
});

describe("RelativeTime", () => {
	it("shows the relative wording against the caller's clock, and names the absolute instant", async () => {
		await render(<RelativeTime value={NOW - THREE * MINUTE_MS} now={NOW} locale="en-GB" timeZone="UTC" testID="time" />);

		const absolute = formatAbsoluteTime(NOW - THREE * MINUTE_MS, "en-GB", "UTC");
		expect(absolute).toContain("2026");
		expect(screen.getByText("3 minutes ago")).toBeOnTheScreen();
		expect(screen.getByTestId("time")).toHaveAccessibleName(`3 minutes ago, ${absolute}`);
	});

	it("moves only when the caller passes a new `now` (controlled)", async () => {
		const value = NOW - THREE * MINUTE_MS;
		await render(<RelativeTime value={value} now={NOW} locale="en" />);
		expect(screen.getByText("3 minutes ago")).toBeOnTheScreen();

		await screen.rerender(<RelativeTime value={value} now={NOW + DAY_MS} locale="en" />);
		expect(screen.getByText("1 day ago")).toBeOnTheScreen();
	});

	it("takes an explicit accessible name", async () => {
		await render(<RelativeTime value={NOW} now={NOW} locale="en" accessibilityLabel="Updated just now" testID="time" />);
		expect(screen.getByTestId("time")).toHaveAccessibleName("Updated just now");
	});

	it("has variants and sizes, forwards its ref and merges className last", async () => {
		const ref = React.createRef<Text>();
		await render(<RelativeTime ref={ref} value={NOW} now={NOW} locale="en" variant="default" size="xs" className="text-sm" testID="time" />);

		expect(ref.current).not.toBeNull();
		const className = String(screen.getByTestId("time").props.className);
		expect(className).toContain("text-foreground");
		expect(className).toContain("text-sm");
		expect(className).not.toContain("text-xs");
	});
});
