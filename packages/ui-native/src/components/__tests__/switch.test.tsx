import { fireEvent, render, screen } from "@testing-library/react-native";
import * as React from "react";
import type { ViewInstance } from "react-native";

import { Switch } from "../switch";

describe("Switch", () => {
	it("is a controlled switch named by its label", async () => {
		const onChange = jest.fn();
		const { rerender } = await render(<Switch label="Notifications" checked={false} onChange={onChange} />);

		const control = screen.getByRole("switch", { name: "Notifications" });
		expect(control).not.toBeChecked();
		expect(screen.getByText("Notifications")).toBeOnTheScreen();
		await fireEvent.press(control);
		expect(onChange).toHaveBeenCalledWith(true);

		await rerender(<Switch label="Notifications" checked onChange={onChange} />);
		expect(screen.getByRole("switch")).toBeChecked();
		await fireEvent.press(screen.getByRole("switch"));
		expect(onChange).toHaveBeenLastCalledWith(false);
	});

	it("can hide its label and still be named by it", async () => {
		await render(<Switch label="Notifications" hideLabel checked onChange={jest.fn()} />);

		expect(screen.getByRole("switch", { name: "Notifications" })).toBeOnTheScreen();
		expect(screen.queryByText("Notifications")).toBeNull();
	});

	it("shows a description and reads it as the hint", async () => {
		await render(<Switch label="Digest" description="Every Monday" checked={false} onChange={jest.fn()} />);
		expect(screen.getByRole("switch")).toHaveProp("accessibilityHint", "Every Monday");
	});

	it("blocks presses while disabled or loading", async () => {
		const onChange = jest.fn();
		await render(<Switch label="Notifications" checked={false} onChange={onChange} disabled />);
		expect(screen.getByRole("switch")).toBeDisabled();
		await fireEvent.press(screen.getByRole("switch"));

		await render(<Switch label="Notifications" checked={false} onChange={onChange} loading />);
		expect(screen.getByRole("switch")).toBeBusy();
		await fireEvent.press(screen.getByRole("switch"));
		expect(onChange).not.toHaveBeenCalled();
	});

	it("outlines its track while invalid, unless disabled", async () => {
		await render(<Switch label="Terms" checked={false} onChange={jest.fn()} invalid />);
		expect(JSON.stringify(screen.toJSON())).toContain("border-destructive");

		await render(<Switch label="Terms" checked={false} onChange={jest.fn()} invalid disabled />);
		expect(JSON.stringify(screen.toJSON())).not.toContain("border-destructive");
	});

	it("has a card variant and a compact size", async () => {
		await render(<Switch label="Notifications" checked onChange={jest.fn()} variant="card" size="sm" />);
		expect(screen.getByRole("switch")).toHaveProp("className", expect.stringContaining("border-border"));
		expect(JSON.stringify(screen.toJSON())).toContain("w-9");
	});

	it("forwards its ref, merges the caller's className last and reports focus and blur", async () => {
		const ref = React.createRef<ViewInstance>();
		const onFocus = jest.fn();
		const onBlur = jest.fn();
		await render(<Switch ref={ref} label="Notifications" checked onChange={jest.fn()} onFocus={onFocus} onBlur={onBlur} className="gap-6" />);

		expect(ref.current).not.toBeNull();
		const control = screen.getByRole("switch");
		expect(String(control.props.className)).toContain("gap-6");
		expect(String(control.props.className)).not.toContain("gap-3");
		await fireEvent(control, "focus");
		await fireEvent(control, "blur");
		expect(onFocus).toHaveBeenCalledTimes(1);
		expect(onBlur).toHaveBeenCalledTimes(1);
	});
});
