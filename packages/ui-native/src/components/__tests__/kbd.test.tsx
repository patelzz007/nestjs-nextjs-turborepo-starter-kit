import { render, screen } from "@testing-library/react-native";
import ArrowLeftIcon from "lucide-react-native/icons/arrow-left";
import * as React from "react";
import type { ViewInstance } from "react-native";

import { Kbd, KbdGroup } from "../kbd";

describe("Kbd", () => {
	it("shows the key's name on a cap that screen readers skip", async () => {
		await render(<Kbd label="⌘K" testID="key" />);
		expect(screen.getByText("⌘K", { includeHiddenElements: true })).toBeOnTheScreen();
		expect(screen.getByTestId("key", { includeHiddenElements: true })).toHaveProp("importantForAccessibility", "no-hide-descendants");
	});

	it("leads with a glyph, or is only its glyph", async () => {
		await render(<Kbd label="" icon={ArrowLeftIcon} testID="key" />);
		expect(screen.queryByText("", { includeHiddenElements: true })).toBeNull();
	});

	it("has an inverse tone for a dark tooltip and a larger size", async () => {
		await render(<Kbd label="S" tone="inverse" size="md" testID="key" />);
		const cap = screen.getByTestId("key", { includeHiddenElements: true });
		expect(String(cap.props.className)).toContain("bg-background/20");
		expect(String(cap.props.className)).toContain("h-6");
		expect(screen.getByText("S", { includeHiddenElements: true })).toHaveProp("className", expect.stringContaining("text-background"));
	});

	it("forwards its ref and merges the caller's className", async () => {
		const ref = React.createRef<ViewInstance>();
		await render(<Kbd ref={ref} label="Esc" className="ml-2" testID="key" />);
		expect(ref.current).not.toBeNull();
		expect(String(screen.getByTestId("key", { includeHiddenElements: true }).props.className)).toContain("ml-2");
	});
});

describe("KbdGroup", () => {
	it("sets a chord's keys side by side, read out as the caller names it", async () => {
		await render(<KbdGroup keys={["Ctrl", "Shift", "P"]} accessibilityLabel="Control Shift P" testID="chord" />);
		expect(screen.getByLabelText("Control Shift P")).toBeOnTheScreen();
		expect(screen.getByText("Shift", { includeHiddenElements: true })).toBeOnTheScreen();
	});

	it("is hidden from screen readers when it has no name", async () => {
		await render(<KbdGroup keys={["⌘", "K"]} testID="chord" />);
		expect(screen.getByTestId("chord", { includeHiddenElements: true })).toHaveProp("importantForAccessibility", "no-hide-descendants");
	});

	it("forwards its ref", async () => {
		const ref = React.createRef<ViewInstance>();
		await render(<KbdGroup ref={ref} keys={["A"]} />);
		expect(ref.current).not.toBeNull();
	});
});
