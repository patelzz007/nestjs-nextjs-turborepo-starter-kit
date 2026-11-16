import { act, fireEvent, render, screen } from "@testing-library/react-native";
import HomeIcon from "lucide-react-native/icons/home";
import * as React from "react";
import { Text, type ViewInstance } from "react-native";

import { SHEET_MOTION } from "../../lib/motion";
import { Breadcrumb, type BreadcrumbItemData, breadcrumbCrumbsOf } from "../breadcrumb";

const LEADING = "avatar";

function trail(onPress: () => void): readonly BreadcrumbItemData[] {
	return [
		{ key: "home", label: "Home", icon: HomeIcon, iconOnly: true, onPress },
		{ key: "docs", label: "Docs", onPress },
		{ key: "guides", label: "Guides", onPress, badge: "3" },
		{ key: "auth", label: "Authentication", onPress, leading: <Text>{LEADING}</Text>, description: "ava@acme.com" },
		{ key: "sso", label: "Single sign-on" },
	];
}

describe("breadcrumbCrumbsOf", () => {
	it("keeps every level, or folds the middle past maxItems", () => {
		const items = trail(jest.fn());
		expect(breadcrumbCrumbsOf(items, undefined)).toHaveLength(5);
		expect(breadcrumbCrumbsOf(items, 4).map((crumb) => (crumb.kind === "item" ? crumb.item.key : "…"))).toStrictEqual(["home", "…", "auth", "sso"]);
		expect(breadcrumbCrumbsOf(items, 3).map((crumb) => (crumb.kind === "item" ? crumb.item.key : "…"))).toStrictEqual(["home", "…", "sso"]);
	});
});

describe("Breadcrumb", () => {
	beforeEach((): void => {
		jest.useFakeTimers();
	});

	afterEach((): void => {
		jest.useRealTimers();
	});

	it("links the levels, marks the current page, and draws counts, leading parts and second lines", async () => {
		const onPress = jest.fn();
		const ref = React.createRef<ViewInstance>();
		await render(<Breadcrumb ref={ref} items={trail(onPress)} separator="slash" variant="card" />);
		await fireEvent.press(screen.getByRole("link", { name: "Home" }));
		expect(onPress).toHaveBeenCalled();
		expect(screen.getByLabelText("Single sign-on, current page")).toBeOnTheScreen();
		expect(screen.getByText("3")).toBeOnTheScreen();
		expect(screen.getByText(LEADING)).toBeOnTheScreen();
		expect(screen.getByText("ava@acme.com")).toBeOnTheScreen();
		expect(ref.current).not.toBeNull();
	});

	it("sets its levels in caption text at the small size, and body text by default", async () => {
		const { rerender } = await render(<Breadcrumb items={trail(jest.fn())} size="sm" testID="trail" />);
		expect(screen.getByText("Docs").props.className).toContain("text-caption");
		await rerender(<Breadcrumb items={trail(jest.fn())} testID="trail" />);
		expect(screen.getByText("Docs").props.className).toContain("text-body");
	});

	it("keeps its scroll view to the trail's own height: it never grows into a parent with no set height", async () => {
		await render(<Breadcrumb items={trail(jest.fn())} testID="trail" />);
		expect(screen.getByTestId("trail-scroll").props.className).toContain("grow-0");
	});

	it("folds the middle into a menu of the hidden levels", async () => {
		const onPress = jest.fn();
		await render(<Breadcrumb items={trail(onPress)} maxItems={3} collapsedMenu separator="double-chevron" />);
		await fireEvent.press(screen.getByRole("button", { name: "Show hidden levels" }));
		await fireEvent.press(screen.getByRole("menuitem", { name: "Guides" }));
		expect(onPress).toHaveBeenCalled();
		await act((): void => {
			jest.advanceTimersByTime(SHEET_MOTION.exit.duration);
		});
		await render(<Breadcrumb items={trail(onPress)} maxItems={3} separator="bar" />);
		expect(screen.getByLabelText("3 more levels")).toBeOnTheScreen();
	});

	it("draws each level as a button", async () => {
		await render(<Breadcrumb items={trail(jest.fn())} variant="buttons" />);
		expect(screen.getByRole("button", { name: "Single sign-on, current page" })).toBeDisabled();
		expect(screen.getByRole("button", { name: "Docs" })).toBeEnabled();
	});
});
