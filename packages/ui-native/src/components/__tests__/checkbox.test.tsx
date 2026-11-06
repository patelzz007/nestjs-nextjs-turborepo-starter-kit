import { fireEvent, render, screen } from "@testing-library/react-native";
import * as React from "react";
import type { ViewInstance } from "react-native";

import { Checkbox } from "../checkbox";
import { ICON_SIZES, ICON_STROKE_WIDTHS } from "../icon";

/** Every class name in the rendered tree (Uniwind is not compiled under Jest, so classes are checked as written). */
function renderedClassNames(): string {
	return JSON.stringify(screen.toJSON());
}

describe("Checkbox", () => {
	it("is a controlled, accessible checkbox", async () => {
		const onChange = jest.fn();
		const { rerender } = await render(<Checkbox label="I saved my backup codes" checked={false} onChange={onChange} />);

		const checkbox = screen.getByRole("checkbox", { name: "I saved my backup codes" });
		expect(checkbox).not.toBeChecked();
		await fireEvent.press(checkbox);
		expect(onChange).toHaveBeenCalledWith(true);

		await rerender(<Checkbox label="I saved my backup codes" checked onChange={onChange} />);
		expect(screen.getByRole("checkbox")).toBeChecked();
		await fireEvent.press(screen.getByRole("checkbox"));
		expect(onChange).toHaveBeenLastCalledWith(false);
	});

	it("shows a description and reads it as the hint", async () => {
		await render(<Checkbox label="Weekly digest" description="Every Monday morning" checked={false} onChange={jest.fn()} />);

		expect(screen.getByText("Every Monday morning")).toBeOnTheScreen();
		expect(screen.getByRole("checkbox", { name: "Weekly digest" })).toHaveProp("accessibilityHint", "Every Monday morning");
	});

	it("can be disabled", async () => {
		const onChange = jest.fn();
		await render(<Checkbox label="Agree" checked={false} onChange={onChange} disabled />);

		const checkbox = screen.getByRole("checkbox");
		expect(checkbox).toBeDisabled();
		await fireEvent.press(checkbox);
		expect(onChange).not.toHaveBeenCalled();
	});

	it("blocks presses and announces busy while loading", async () => {
		const onChange = jest.fn();
		await render(<Checkbox label="Agree" checked={false} onChange={onChange} loading />);

		const checkbox = screen.getByRole("checkbox");
		expect(checkbox).toBeBusy();
		expect(checkbox).toBeDisabled();
		await fireEvent.press(checkbox);
		expect(onChange).not.toHaveBeenCalled();
	});

	it("shows the caller's validation outcome on its box, unless it is inactive", async () => {
		await render(<Checkbox label="Agree" checked={false} onChange={jest.fn()} invalid />);
		expect(renderedClassNames()).toContain("border-destructive");

		await render(<Checkbox label="Agree" checked={false} onChange={jest.fn()} invalid disabled />);
		expect(renderedClassNames()).not.toContain("border-destructive");
	});

	it("shows a dash and reads as mixed while part-checked; pressing it checks", async () => {
		const onChange = jest.fn();
		await render(<Checkbox label="Account" checked={false} indeterminate onChange={onChange} />);

		const checkbox = screen.getByRole("checkbox", { name: "Account" });
		expect(checkbox).toBePartiallyChecked();
		expect(screen.getByTestId("checkbox-dash", { includeHiddenElements: true })).toBeOnTheScreen();
		expect(screen.queryByTestId("checkbox-tick", { includeHiddenElements: true })).toBeNull();
		expect(renderedClassNames()).toContain("bg-primary");
		await fireEvent.press(checkbox);
		expect(onChange).toHaveBeenCalledWith(true);
	});

	it("shows a tick only while checked", async () => {
		const { rerender } = await render(<Checkbox label="Email" checked onChange={jest.fn()} />);
		expect(screen.getByTestId("checkbox-tick", { includeHiddenElements: true })).toBeOnTheScreen();

		await rerender(<Checkbox label="Email" checked={false} onChange={jest.fn()} />);
		expect(screen.queryByTestId("checkbox-tick", { includeHiddenElements: true })).toBeNull();
		expect(screen.queryByTestId("checkbox-dash", { includeHiddenElements: true })).toBeNull();
	});

	it("draws the lock light and small so it does not outweigh the ticks", async () => {
		await render(<Checkbox label="In the app" checked locked onChange={jest.fn()} />);

		const lock = screen.getByTestId("checkbox-lock", { includeHiddenElements: true });
		expect(lock).toHaveProp("width", ICON_SIZES.control);
		expect(lock).toHaveProp("strokeWidth", ICON_STROKE_WIDTHS.light);
	});

	it("rings an unticked box in the control colour, not the fields' softer one", async () => {
		await render(<Checkbox label="Weekly digest" checked={false} onChange={jest.fn()} />);

		expect(renderedClassNames()).toContain("border-control-ring");
	});

	it("shows a lock, takes no presses and is not faded while locked", async () => {
		const onChange = jest.fn();
		await render(<Checkbox label="In the app" checked locked onChange={onChange} />);

		const checkbox = screen.getByRole("checkbox", { name: "In the app" });
		expect(checkbox).toBeDisabled();
		expect(checkbox).toBeChecked();
		expect(screen.getByTestId("checkbox-lock", { includeHiddenElements: true })).toBeOnTheScreen();
		expect(String(checkbox.props.className)).not.toContain("opacity-60");
		expect(renderedClassNames()).toContain("bg-primary/20");
		await fireEvent.press(checkbox);
		expect(onChange).not.toHaveBeenCalled();
	});

	it("has a card variant and a compact size", async () => {
		await render(<Checkbox label="Agree" checked onChange={jest.fn()} variant="card" size="sm" />);
		const className = String(screen.getByRole("checkbox").props.className);
		expect(className).toContain("border-border");
		expect(className).toContain("gap-2.5");
	});

	it("forwards its ref", async () => {
		const ref = React.createRef<ViewInstance>();
		await render(<Checkbox ref={ref} label="Agree" checked={false} onChange={jest.fn()} />);
		expect(ref.current).not.toBeNull();
	});

	it("merges the caller's className last", async () => {
		await render(<Checkbox label="Agree" checked={false} onChange={jest.fn()} className="self-start py-4" />);
		const className = String(screen.getByRole("checkbox").props.className);
		expect(className).toContain("py-4");
		expect(className).toContain("self-start");
		expect(className).not.toContain("py-2");
	});

	it("reports focus and blur", async () => {
		const onFocus = jest.fn();
		const onBlur = jest.fn();
		await render(<Checkbox label="Agree" checked={false} onChange={jest.fn()} onFocus={onFocus} onBlur={onBlur} />);
		await fireEvent(screen.getByRole("checkbox"), "focus");
		await fireEvent(screen.getByRole("checkbox"), "blur");
		expect(onFocus).toHaveBeenCalledTimes(1);
		expect(onBlur).toHaveBeenCalledTimes(1);
	});
});
