import { fireEvent, render, screen } from "@testing-library/react-native";
import BoldIcon from "lucide-react-native/icons/bold";
import * as React from "react";
import type { ViewInstance } from "react-native";

import { Toggle } from "../toggle";

const PRESSED = { checked: true };
const NOT_PRESSED = { checked: false };

describe("Toggle", () => {
	it("is a toggle button that reports the opposite of its pressed state", async () => {
		const onChange = jest.fn();
		const { rerender } = await render(<Toggle label="Bold" pressed={false} onChange={onChange} />);

		const toggle = screen.getByRole("togglebutton", { name: "Bold" });
		expect(toggle).toHaveProp("accessibilityState", expect.objectContaining(NOT_PRESSED));
		await fireEvent.press(toggle);
		expect(onChange).toHaveBeenCalledWith(true);

		await rerender(<Toggle label="Bold" pressed onChange={onChange} />);
		expect(screen.getByRole("togglebutton")).toHaveProp("accessibilityState", expect.objectContaining(PRESSED));
		expect(screen.getByRole("togglebutton")).toHaveProp("className", expect.stringContaining("bg-secondary"));
		await fireEvent.press(screen.getByRole("togglebutton"));
		expect(onChange).toHaveBeenLastCalledWith(false);
	});

	it("can show only its glyph, still named by its label", async () => {
		await render(<Toggle label="Bold" icon={BoldIcon} hideLabel pressed={false} onChange={jest.fn()} />);

		expect(screen.getByRole("togglebutton", { name: "Bold" })).toBeOnTheScreen();
		expect(screen.queryByText("Bold")).toBeNull();
	});

	it("blocks presses while disabled or loading", async () => {
		const onChange = jest.fn();
		await render(<Toggle label="Bold" pressed={false} onChange={onChange} disabled />);
		expect(screen.getByRole("togglebutton")).toBeDisabled();
		await fireEvent.press(screen.getByRole("togglebutton"));

		await render(<Toggle label="Bold" pressed={false} onChange={onChange} loading />);
		expect(screen.getByRole("togglebutton")).toBeBusy();
		await fireEvent.press(screen.getByRole("togglebutton"));
		expect(onChange).not.toHaveBeenCalled();
	});

	it("outlines itself while invalid, unless disabled", async () => {
		await render(<Toggle label="Bold" pressed={false} onChange={jest.fn()} invalid />);
		expect(screen.getByRole("togglebutton")).toHaveProp("className", expect.stringContaining("border-destructive"));

		await render(<Toggle label="Bold" pressed={false} onChange={jest.fn()} invalid disabled />);
		expect(screen.getByRole("togglebutton")).not.toHaveProp("className", expect.stringContaining("border-destructive"));
	});

	it("has an outline variant and a compact size whose touch area still reaches 44 pt", async () => {
		await render(<Toggle label="Bold" pressed={false} onChange={jest.fn()} variant="outline" size="sm" />);
		const toggle = screen.getByRole("togglebutton");
		expect(toggle).toHaveProp("className", expect.stringContaining("border-input"));
		expect(toggle).toHaveProp("className", expect.stringContaining("min-h-9"));
		expect(toggle).toHaveProp("hitSlop", 4);
	});

	it("forwards its ref, merges the caller's className last and reports focus and blur", async () => {
		const ref = React.createRef<ViewInstance>();
		const onFocus = jest.fn();
		const onBlur = jest.fn();
		await render(<Toggle ref={ref} label="Bold" pressed={false} onChange={jest.fn()} onFocus={onFocus} onBlur={onBlur} className="px-6" />);

		expect(ref.current).not.toBeNull();
		const toggle = screen.getByRole("togglebutton");
		expect(String(toggle.props.className)).toContain("px-6");
		expect(String(toggle.props.className)).not.toContain("px-3");
		await fireEvent(toggle, "focus");
		await fireEvent(toggle, "blur");
		expect(onFocus).toHaveBeenCalledTimes(1);
		expect(onBlur).toHaveBeenCalledTimes(1);
	});
});
