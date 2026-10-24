import { render, screen } from "@testing-library/react-native";
import WifiIcon from "lucide-react-native/icons/wifi";
import * as React from "react";
import type { ViewInstance } from "react-native";

import { StatusBadge, type StatusBadgeTone } from "../status-badge";

/** Each tone's fill, its resting border and its emphasized border. */
const TONE_CASES: readonly (readonly [StatusBadgeTone, string, string, string])[] = [
	["neutral", "bg-muted", "border-border", "border-muted-foreground"],
	["info", "bg-info-soft", "border-info/30", "border-info"],
	["success", "bg-success-soft", "border-success/30", "border-success"],
	["warning", "bg-warning-soft", "border-warning/30", "border-warning"],
	["destructive", "bg-destructive-soft", "border-destructive/30", "border-destructive"],
];

/** The utility classes on an element, one by one. */
function classesOf(testID: string): string[] {
	return String(screen.getByTestId(testID).props.className).split(" ");
}

describe("StatusBadge", () => {
	it("reads as one piece of text named by its accessibility label, with its label shown", async () => {
		await render(<StatusBadge icon={WifiIcon} label="Online" accessibilityLabel="Online" tone="success" testID="pill" />);

		expect(screen.getByLabelText("Online")).toHaveProp("accessibilityRole", "text");
		expect(screen.getByText("Online")).toBeOnTheScreen();
	});

	it("shows the icon alone without a label, still named for screen readers", async () => {
		await render(<StatusBadge icon={WifiIcon} label={null} accessibilityLabel="Offline" tone="destructive" />);

		expect(screen.getByLabelText("Offline")).toBeOnTheScreen();
		expect(screen.queryByText("Offline")).toBeNull();
	});

	it("draws the tone's full-strength border when emphasized", async () => {
		const view = await render(<StatusBadge icon={WifiIcon} label="Refreshed" accessibilityLabel="Refreshed" tone="success" testID="pill" />);
		expect(classesOf("pill")).toContain("border-success/30");

		await view.rerender(<StatusBadge icon={WifiIcon} label="Refreshed" accessibilityLabel="Refreshed" tone="success" emphasized testID="pill" />);
		expect(classesOf("pill")).toContain("border-success");
		expect(classesOf("pill")).not.toContain("border-success/30");
	});

	it("sets a ticking label in fixed-width digits", async () => {
		await render(<StatusBadge icon={WifiIcon} label="14m 32s" accessibilityLabel="Token expires in 14m 32s" tabularLabel />);

		expect(screen.getByText("14m 32s").props.className).toContain("font-mono");
	});

	it("keeps its name while it breathes", async () => {
		await render(<StatusBadge icon={WifiIcon} label="Checking…" accessibilityLabel="Session status: checking" pulsing testID="pill" />);

		expect(screen.getByLabelText("Session status: checking")).toBeOnTheScreen();
		expect(screen.getByTestId("pill")).toHaveProp("accessibilityRole", "text");
	});

	it.each(TONE_CASES)("tints the %s tone, and draws its full border when emphasized", async (tone, fill, border, emphasizedBorder) => {
		const view = await render(<StatusBadge icon={WifiIcon} label="State" accessibilityLabel="State" tone={tone} testID="pill" />);
		expect(classesOf("pill")).toContain(fill);
		expect(classesOf("pill")).toContain(border);

		await view.rerender(<StatusBadge icon={WifiIcon} label="State" accessibilityLabel="State" tone={tone} emphasized testID="pill" />);
		expect(classesOf("pill")).toContain(emphasizedBorder);
		expect(classesOf("pill")).not.toContain(border);
	});

	it("pads an icon alone evenly", async () => {
		await render(<StatusBadge icon={WifiIcon} label={null} accessibilityLabel="Online" testID="pill" />);
		expect(classesOf("pill")).toContain("px-1.5");
		expect(classesOf("pill")).not.toContain("px-2.5");
	});

	it("forwards its ref, still or breathing", async () => {
		const stillRef = React.createRef<ViewInstance>();
		const pulsingRef = React.createRef<ViewInstance>();
		await render(
			<>
				<StatusBadge ref={stillRef} icon={WifiIcon} label="Online" accessibilityLabel="Online" />
				<StatusBadge ref={pulsingRef} icon={WifiIcon} label="Checking" accessibilityLabel="Checking" pulsing />
			</>,
		);
		expect(stillRef.current).not.toBeNull();
		expect(pulsingRef.current).not.toBeNull();
	});

	it("merges the caller's className last", async () => {
		await render(<StatusBadge icon={WifiIcon} label="Online" accessibilityLabel="Online" className="self-center" testID="pill" />);
		expect(classesOf("pill")).toContain("self-center");
		expect(classesOf("pill")).not.toContain("self-start");
	});
});
