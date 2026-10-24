import { render, screen } from "@testing-library/react-native";
import * as React from "react";
import type { ViewInstance } from "react-native";

import { Spinner, type SpinnerVariant } from "../spinner";

const VARIANT_COLORS: readonly (readonly [SpinnerVariant, string])[] = [
	["default", "accent-foreground"],
	["muted", "accent-muted-foreground"],
	["primary", "accent-primary"],
];

function indicator(): ReturnType<typeof screen.getByTestId> {
	return screen.getByTestId("spinner-indicator", { includeHiddenElements: true });
}

function indicatorColor(): string {
	return String(indicator().props.colorClassName);
}

describe("Spinner", () => {
	it("is announced as a busy progress bar when it says what is loading", async () => {
		await render(<Spinner testID="spinner" accessibilityLabel="Loading comments" />);

		const spinner = screen.getByRole("progressbar", { name: "Loading comments" });
		expect(spinner).toBeBusy();
	});

	it("is decorative without a label", async () => {
		await render(<Spinner testID="spinner" />);

		expect(screen.queryByRole("progressbar")).toBeNull();
		expect(screen.queryByTestId("spinner")).toBeNull();
		expect(screen.getByTestId("spinner", { includeHiddenElements: true })).toBeOnTheScreen();
	});

	it.each(VARIANT_COLORS)("colours the %s variant with %s", async (variant, color) => {
		await render(<Spinner testID="spinner" variant={variant} />);
		expect(indicatorColor()).toBe(color);
	});

	it("uses the native small and large sizes", async () => {
		const view = await render(<Spinner testID="spinner" />);
		expect(indicator()).toHaveProp("size", "small");

		await view.rerender(<Spinner testID="spinner" size="lg" />);
		expect(indicator()).toHaveProp("size", "large");
	});

	it("turns destructive when invalid, but dims instead once disabled", async () => {
		const view = await render(<Spinner variant="primary" invalid testID="spinner" />);
		expect(indicatorColor()).toBe("accent-destructive");

		await view.rerender(<Spinner variant="primary" invalid disabled testID="spinner" />);
		expect(indicatorColor()).toBe("accent-primary");
		expect(String(screen.getByTestId("spinner", { includeHiddenElements: true }).props.className)).toContain("opacity-60");
	});

	it("takes a colour override", async () => {
		await render(<Spinner testID="spinner" colorClassName="accent-primary-foreground" />);
		expect(indicatorColor()).toBe("accent-primary-foreground");
	});

	it("forwards its ref", async () => {
		const ref = React.createRef<ViewInstance>();
		await render(<Spinner testID="spinner" ref={ref} />);
		expect(ref.current).not.toBeNull();
	});

	it("merges the caller's className last", async () => {
		await render(<Spinner testID="spinner" accessibilityLabel="Loading" className="justify-start py-4" />);
		const className = String(screen.getByRole("progressbar", { name: "Loading" }).props.className);
		expect(className).toContain("justify-start");
		expect(className).not.toContain("justify-center");
	});
});
