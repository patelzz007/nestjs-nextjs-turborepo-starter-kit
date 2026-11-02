import { render, screen } from "@testing-library/react-native";
import * as React from "react";
import type { ViewInstance } from "react-native";

import { COUNT_BADGE_MAX, CountBadge, countBadgeText } from "../count-badge";

const THREE = 3;
const HUNDRED = 100;
const NINE = 9;

function badge(): ReturnType<typeof screen.getByTestId> {
	return screen.getByTestId("badge", { includeHiddenElements: true });
}

describe("countBadgeText", () => {
	it("says the count, and the most past `max`", () => {
		expect(countBadgeText(THREE)).toBe("3");
		expect(countBadgeText(COUNT_BADGE_MAX)).toBe("99");
		expect(countBadgeText(HUNDRED)).toBe("99+");
		expect(countBadgeText(HUNDRED, NINE)).toBe("9+");
	});
});

describe("CountBadge", () => {
	it("shows the count, decorative: the button it sits on says it", async () => {
		await render(<CountBadge count={THREE} testID="badge" />);

		expect(screen.queryByTestId("badge")).toBeNull();
		expect(screen.getByText("3", { includeHiddenElements: true })).toBeOnTheScreen();
		expect(badge().props.pointerEvents).toBe("none");
	});

	it("draws nothing at zero", async () => {
		await render(<CountBadge count={0} testID="badge" />);

		expect(screen.queryByTestId("badge", { includeHiddenElements: true })).toBeNull();
	});

	it("centres the digit: no Android font padding pushing it low", async () => {
		await render(<CountBadge count={THREE} testID="badge" />);

		const digit = screen.getByText("3", { includeHiddenElements: true });
		expect(digit).toHaveStyle({ includeFontPadding: false, textAlignVertical: "center" });
		expect(String(digit.props.className)).toContain("text-center");
		expect(String(badge().props.className)).toContain("items-center");
	});

	it("caps a long count so the pill keeps its size", async () => {
		await render(<CountBadge count={HUNDRED} testID="badge" />);

		expect(screen.getByText("99+", { includeHiddenElements: true })).toBeOnTheScreen();
	});

	it.each([
		["sm", "h-5"],
		["md", "h-6"],
	] satisfies [React.ComponentProps<typeof CountBadge>["size"], string][])("has a %s size (%s)", async (size, sizeClass) => {
		await render(<CountBadge count={THREE} size={size} testID="badge" />);

		expect(String(badge().props.className).split(" ")).toContain(sizeClass);
	});

	it("forwards its ref and merges the caller's className last", async () => {
		const ref = React.createRef<ViewInstance>();
		await render(<CountBadge ref={ref} count={THREE} className="absolute border-card" testID="badge" />);

		expect(ref.current).not.toBeNull();
		const className = String(badge().props.className);
		expect(className).toContain("border-card");
		expect(className).not.toContain("border-background");
	});
});
