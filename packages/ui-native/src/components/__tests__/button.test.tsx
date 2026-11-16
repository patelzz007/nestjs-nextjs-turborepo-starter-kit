import { fireEvent, render, screen } from "@testing-library/react-native";
import ArrowRightIcon from "lucide-react-native/icons/arrow-right";
import * as React from "react";
import { Text, type ViewInstance } from "react-native";

import { Button } from "../button";

describe("Button", () => {
	it("sets its label in Bricolage Grotesque, the one place that face appears (font-button)", async () => {
		await render(<Button label="Save changes" onPress={jest.fn()} />);

		expect(screen.getByText("Save changes")).toHaveProp("className", expect.stringContaining("font-button"));
	});

	it("is an accessible button that reports presses", async () => {
		const onPress = jest.fn();
		await render(<Button label="Save" onPress={onPress} accessibilityHint="Saves your profile" />);

		const button = screen.getByRole("button", { name: "Save" });
		expect(button).toHaveAccessibleName("Save");
		await fireEvent.press(button);
		expect(onPress).toHaveBeenCalledTimes(1);
	});

	it("blocks presses and announces busy while loading", async () => {
		const onPress = jest.fn();
		await render(<Button label="Save" onPress={onPress} loading />);

		const button = screen.getByRole("button", { name: "Save" });
		expect(button).toBeBusy();
		expect(button).toBeDisabled();
		await fireEvent.press(button);
		expect(onPress).not.toHaveBeenCalled();
	});

	it("can be disabled, and takes an accessible name other than its label", async () => {
		await render(<Button label="Revoke" accessibilityLabel="Revoke Alex’s iPhone" variant="destructive" onPress={jest.fn()} disabled />);
		expect(screen.getByRole("button", { name: "Revoke Alex’s iPhone" })).toBeDisabled();
	});

	it("forwards its ref", async () => {
		const ref = React.createRef<ViewInstance>();
		await render(<Button ref={ref} label="Go" variant="ghost" onPress={jest.fn()} />);
		expect(ref.current).not.toBeNull();
	});

	it("has a compact size whose touch area still reaches 44 pt", async () => {
		await render(<Button label="View on GitHub" size="sm" onPress={jest.fn()} />);

		const button = screen.getByRole("button", { name: "View on GitHub" });
		expect(button).toHaveProp("className", expect.stringContaining("min-h-9"));
		expect(button).toHaveProp("hitSlop", 4);
	});

	it("draws a secondary button on the soft surface, not as a second solid one", async () => {
		await render(<Button label="Review changes" variant="secondary" onPress={jest.fn()} />);

		const className = String(screen.getByRole("button", { name: "Review changes" }).props.className).split(" ");
		expect(className).toEqual(expect.arrayContaining(["bg-secondary", "active:bg-surface-selected"]));
		expect(className).not.toContain("bg-primary");
		expect(screen.getByText("Review changes")).toHaveProp("className", expect.stringContaining("text-secondary-foreground"));
	});

	it("draws the spec's button: 48 pt tall, 20 pt sides, 10 pt corners, a 15 pt label, an 8 pt gap to the glyph", async () => {
		await render(<Button label="Continue" onPress={jest.fn()} />);

		const className = String(screen.getByRole("button", { name: "Continue" }).props.className).split(" ");
		expect(className).toEqual(expect.arrayContaining(["min-h-12", "px-5", "rounded-button", "gap-2"]));
		expect(screen.getByText("Continue")).toHaveProp("className", expect.stringContaining("text-button"));
	});

	it("darkens a solid button while it is pressed instead of fading it", async () => {
		await render(<Button label="Continue" onPress={jest.fn()} />);

		const className = String(screen.getByRole("button", { name: "Continue" }).props.className).split(" ");
		expect(className).toContain("active:bg-primary-pressed");
		expect(className).not.toContain("active:opacity-80");
	});

	it("gives a disabled solid button the disabled fill, at full opacity", async () => {
		await render(<Button label="Continue" disabled onPress={jest.fn()} />);

		const className = String(screen.getByRole("button", { name: "Continue" }).props.className).split(" ");
		expect(className).toEqual(expect.arrayContaining(["bg-disabled", "opacity-100"]));
		expect(className).not.toContain("bg-primary");
		expect(className).not.toContain("opacity-60");
	});

	it("draws an outline button with a border and no fill", async () => {
		await render(<Button label="Cancel" variant="outline" onPress={jest.fn()} />);

		expect(screen.getByRole("button", { name: "Cancel" })).toHaveProp("className", expect.stringContaining("border-input"));
		expect(screen.getByText("Cancel")).toHaveProp("className", expect.stringContaining("text-foreground"));
	});

	it("keeps its label on one line, whatever width it is given", async () => {
		await render(<Button label="Review changes" variant="secondary" onPress={jest.fn()} />);

		expect(screen.getByText("Review changes")).toHaveProp("numberOfLines", 1);
	});

	it("shows the caller's validation outcome as its error state, unless it is inactive", async () => {
		await render(<Button label="Submit" onPress={jest.fn()} invalid />);
		expect(screen.getByRole("button", { name: "Submit" })).toHaveProp("className", expect.stringContaining("border-destructive"));

		await render(<Button label="Submit" onPress={jest.fn()} invalid disabled />);
		expect(screen.getByRole("button", { name: "Submit" })).not.toHaveProp("className", expect.stringContaining("border-destructive"));
	});

	it("merges the caller's className last, so layout classes win", async () => {
		await render(<Button label="Save" onPress={jest.fn()} className="flex-1 px-8" />);
		const className = String(screen.getByRole("button", { name: "Save" }).props.className);
		expect(className).toContain("flex-1");
		expect(className).toContain("px-8");
		expect(className).not.toContain("px-4");
	});

	it("reports focus and blur (keyboard and switch-control users)", async () => {
		const onFocus = jest.fn();
		const onBlur = jest.fn();
		await render(<Button label="Save" onPress={jest.fn()} onFocus={onFocus} onBlur={onBlur} />);
		const button = screen.getByRole("button", { name: "Save" });
		await fireEvent(button, "focus");
		await fireEvent(button, "blur");
		expect(onFocus).toHaveBeenCalledTimes(1);
		expect(onBlur).toHaveBeenCalledTimes(1);
	});

	it("puts its glyph after the label when asked", async () => {
		await render(<Button label="Get started" icon={ArrowRightIcon} iconPosition="end" onPress={jest.fn()} testID="button" />);
		const children = screen.getByTestId("button").children;
		expect(screen.getByText("Get started")).toBeOnTheScreen();
		expect(children.length).toBeGreaterThan(1);
	});

	it("draws what the caller puts before and after the label", async () => {
		await render(<Button label="Inbox" onPress={jest.fn()} leading={<Text>avatar</Text>} trailing={<Text>12</Text>} />);
		expect(screen.getByText("avatar")).toBeOnTheScreen();
		expect(screen.getByText("12")).toBeOnTheScreen();
	});

	it("becomes a left-aligned two-line choice with a description", async () => {
		await render(<Button label="Credit card" description="Visa, Mastercard and Amex" variant="outline" onPress={jest.fn()} testID="button" />);
		expect(screen.getByText("Visa, Mastercard and Amex")).toHaveProp("numberOfLines", 2);
		expect(String(screen.getByTestId("button").props.className)).toContain("justify-start");
	});

	it("has a link variant and the extra small and large sizes, the small ones with a 44 pt touch area", async () => {
		await render(<Button label="Help" variant="link" size="xs" onPress={jest.fn()} testID="xs" />);
		expect(screen.getByText("Help")).toHaveProp("className", expect.stringContaining("text-link"));
		expect(screen.getByTestId("xs")).toHaveProp("hitSlop", 8);

		await render(<Button label="Upgrade" size="lg" onPress={jest.fn()} testID="lg" />);
		expect(String(screen.getByTestId("lg").props.className)).toContain("min-h-14");
		expect(screen.getByTestId("lg").props.hitSlop).toBeUndefined();
	});
});
