import { fireEvent, render, screen } from "@testing-library/react-native";
import SettingsIcon from "lucide-react-native/icons/settings";
import * as React from "react";
import type { ViewInstance } from "react-native";

import { ListRow } from "../list-row";

describe("ListRow", () => {
	it("is a button named by its label and value that reports presses", async () => {
		const onPress = jest.fn();
		await render(<ListRow label="Appearance" value="Dark" description="Theme" icon={SettingsIcon} onPress={onPress} />);

		const row = screen.getByRole("button", { name: "Appearance, Dark" });
		expect(screen.getByText("Theme")).toBeOnTheScreen();
		await fireEvent.press(row);
		expect(onPress).toHaveBeenCalledTimes(1);
	});

	it("is named by its label alone without a value, or by an explicit name", async () => {
		await render(<ListRow label="Security" onPress={jest.fn()} />);
		expect(screen.getByRole("button", { name: "Security" })).toBeOnTheScreen();

		await render(<ListRow label="Security" accessibilityLabel="Security settings" accessibilityHint="Opens security" onPress={jest.fn()} />);
		expect(screen.getByRole("button", { name: "Security settings" })).toBeOnTheScreen();
	});

	it("blocks presses when disabled, and announces busy while loading", async () => {
		const onPress = jest.fn();
		await render(<ListRow label="Export" onPress={onPress} disabled />);
		const disabledRow = screen.getByRole("button", { name: "Export" });
		expect(disabledRow).toBeDisabled();
		await fireEvent.press(disabledRow);
		expect(onPress).not.toHaveBeenCalled();

		await render(<ListRow label="Export" onPress={onPress} loading />);
		const loadingRow = screen.getByRole("button", { name: "Export" });
		expect(loadingRow).toBeBusy();
		expect(loadingRow).toBeDisabled();
	});

	it("lets disabled win over loading (state precedence)", async () => {
		await render(<ListRow label="Export" onPress={jest.fn()} disabled loading />);
		expect(screen.getByRole("button", { name: "Export" })).toHaveProp("className", expect.stringContaining("opacity-60"));
	});

	it("has a destructive variant and a compact size", async () => {
		await render(<ListRow label="Sign out everywhere" variant="destructive" size="sm" onPress={jest.fn()} />);

		expect(screen.getByText("Sign out everywhere")).toHaveProp("className", expect.stringContaining("text-destructive-foreground"));
		expect(screen.getByRole("button", { name: "Sign out everywhere" })).toHaveProp("className", expect.stringContaining("min-h-11"));
	});

	it("forwards its ref, merges className last and reports focus and blur", async () => {
		const ref = React.createRef<ViewInstance>();
		const onFocus = jest.fn();
		const onBlur = jest.fn();
		await render(<ListRow ref={ref} label="Profile" onPress={jest.fn()} onFocus={onFocus} onBlur={onBlur} className="py-4" />);

		expect(ref.current).not.toBeNull();
		const row = screen.getByRole("button", { name: "Profile" });
		const className = String(row.props.className);
		expect(className).toContain("py-4");
		expect(className).not.toContain("py-3");
		await fireEvent(row, "focus");
		await fireEvent(row, "blur");
		expect(onFocus).toHaveBeenCalledTimes(1);
		expect(onBlur).toHaveBeenCalledTimes(1);
	});
});
