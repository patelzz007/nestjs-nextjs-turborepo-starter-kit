import { fireEvent, render, screen } from "@testing-library/react-native";
import CircleAlertIcon from "lucide-react-native/icons/circle-alert";
import * as React from "react";
import type { View } from "react-native";

import { Alert, type AlertTone } from "../alert";
import { Button } from "../button";

const NON_ERROR_TONES: readonly AlertTone[] = ["info", "success", "warning"];

describe("Alert", () => {
	it("announces an error assertively, as an alert", async () => {
		await render(<Alert tone="error" message="Something failed" />);

		const alert = screen.getByRole("alert");
		expect(alert).toHaveTextContent("Something failed");
		expect(alert).toHaveProp("accessibilityLiveRegion", "assertive");
		expect(alert).toHaveProp("className", expect.stringContaining("bg-destructive-soft"));
	});

	it.each(NON_ERROR_TONES)("announces a %s notice politely, as a summary", async (tone: AlertTone) => {
		await render(<Alert tone={tone} message="Note" testID="notice" />);

		const notice = screen.getByRole("summary");
		expect(notice).toHaveTextContent("Note");
		expect(notice).toHaveProp("accessibilityLiveRegion", "polite");
		expect(notice).toHaveProp("className", expect.stringContaining(`bg-${tone}-soft`));
		expect(screen.queryByRole("alert")).toBeNull();
	});

	it("shows a title above the message, and a glyph", async () => {
		await render(<Alert tone="warning" title="Almost out of codes" message="Generate new recovery codes." icon={CircleAlertIcon} />);

		expect(screen.getByRole("summary")).toHaveTextContent("Almost out of codesGenerate new recovery codes.");
		expect(screen.getByText("Almost out of codes")).toHaveProp("className", expect.stringContaining("text-warning-foreground"));
	});

	it("keeps its actions reachable on their own", async () => {
		const onRetry = jest.fn();
		await render(
			<Alert tone="error" message="Could not load">
				<Button label="Try again" onPress={onRetry} />
			</Alert>,
		);

		await fireEvent.press(screen.getByRole("button", { name: "Try again" }));
		expect(onRetry).toHaveBeenCalledTimes(1);
	});

	it("forwards its ref", async () => {
		const ref = React.createRef<View>();
		await render(<Alert ref={ref} tone="info" message="Note" />);
		expect(ref.current).not.toBeNull();
	});

	it("merges the caller's className last", async () => {
		await render(<Alert tone="info" message="Note" className="px-6" />);
		const className = String(screen.getByRole("summary").props.className);
		expect(className).toContain("px-6");
		expect(className).not.toContain("px-4");
	});
});
