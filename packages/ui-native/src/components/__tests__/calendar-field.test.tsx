import { fireEvent, render, screen } from "@testing-library/react-native";
import * as React from "react";
import { Text, type ViewInstance } from "react-native";

import { CalendarField } from "../calendar-field";

function renderSheet(close: () => void): React.ReactNode {
	return (
		<Text accessibilityRole="button" onPress={close}>
			Pick
		</Text>
	);
}

async function renderField(props: Partial<React.ComponentProps<typeof CalendarField>> = {}): Promise<{ readonly onFocus: jest.Mock; readonly onBlur: jest.Mock }> {
	const onFocus = jest.fn();
	const onBlur = jest.fn();
	await render(
		<CalendarField label="Start date" summary={null} placeholder="Pick a day" onFocus={onFocus} onBlur={onBlur} renderSheet={renderSheet} testID="start" {...props} />,
	);
	return { onFocus, onBlur };
}

describe("CalendarField", () => {
	it("is a button named by its label and what is picked, showing the placeholder while empty", async () => {
		await renderField();
		expect(screen.getByRole("button", { name: "Start date, none picked" })).toHaveProp("accessibilityHint", "Opens the calendar");
		expect(screen.getByText("Pick a day")).toBeOnTheScreen();

		await renderField({ summary: "1 October 2026" });
		expect(screen.getByRole("button", { name: "Start date, 1 October 2026" })).toBeOnTheScreen();
		expect(screen.queryByText("Pick a day")).toBeNull();
	});

	it("opens its sheet on press (focus), mounts the content only while open, and closes it (blur)", async () => {
		const { onFocus, onBlur } = await renderField();
		expect(screen.queryByText("Pick")).toBeNull();

		await fireEvent.press(screen.getByTestId("start"));
		expect(onFocus).toHaveBeenCalledTimes(1);
		expect(screen.getByTestId("start")).toBeExpanded();
		expect(screen.getByTestId("start-sheet")).toBeOnTheScreen();

		await fireEvent.press(screen.getByText("Pick"));
		expect(onBlur).toHaveBeenCalledTimes(1);
		expect(screen.queryByText("Pick")).toBeNull();
		expect(screen.getByTestId("start")).toBeCollapsed();
	});

	it("shows an error in place of the hint, and marks the trigger invalid", async () => {
		await renderField({ hint: "Any weekday.", error: "Pick a start date." });
		expect(screen.getByText("Pick a start date.")).toBeOnTheScreen();
		expect(screen.queryByText("Any weekday.")).toBeNull();
		expect(screen.getByTestId("start")).toHaveProp("className", expect.stringContaining("border-destructive"));

		await renderField({ hint: "Any weekday.", error: "" });
		expect(screen.getByText("Any weekday.")).toBeOnTheScreen();
		expect(screen.getByTestId("start")).not.toHaveProp("className", expect.stringContaining("border-destructive"));
	});

	it("resolves its state as disabled over loading over error", async () => {
		await renderField({ invalid: true });
		expect(screen.getByTestId("start")).toHaveProp("className", expect.stringContaining("border-destructive"));

		await renderField({ invalid: true, loading: true });
		const busy = screen.getByTestId("start");
		expect(busy).toBeBusy();
		expect(busy).toBeDisabled();
		expect(busy).toHaveProp("className", expect.stringContaining("opacity-60"));
		expect(busy).not.toHaveProp("className", expect.stringContaining("border-destructive"));

		await renderField({ invalid: true, loading: true, disabled: true });
		const disabled = screen.getByTestId("start");
		expect(disabled).toBeDisabled();
		expect(disabled).toHaveProp("className", expect.stringContaining("opacity-50"));
	});

	it("cannot open while disabled", async () => {
		const { onFocus } = await renderField({ disabled: true });
		await fireEvent.press(screen.getByTestId("start"));
		expect(onFocus).not.toHaveBeenCalled();
		expect(screen.queryByText("Pick")).toBeNull();
	});

	it("has a filled variant and a compact size", async () => {
		await renderField({ variant: "filled", size: "sm" });
		const className = String(screen.getByTestId("start").props.className);
		expect(className).toContain("bg-muted");
		expect(className).toContain("min-h-11");
		expect(className).not.toContain("bg-card");
	});

	it("forwards its ref to the trigger, and merges the caller's className onto the field", async () => {
		const ref = React.createRef<ViewInstance>();
		await renderField({ ref, className: "flex-1 gap-2" });
		expect(ref.current).not.toBeNull();
		const className = String(screen.getByText("Start date").parent?.props.className);
		expect(className).toContain("flex-1");
		expect(className).toContain("gap-2");
		expect(className).not.toContain("gap-1.5");
	});
});
