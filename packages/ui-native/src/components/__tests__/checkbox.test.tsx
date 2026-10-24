import { fireEvent, render, screen } from "@testing-library/react-native";
import * as React from "react";
import type { ViewInstance } from "react-native";

import { Checkbox } from "../checkbox";

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
