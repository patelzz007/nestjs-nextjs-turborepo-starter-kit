import { render, screen } from "@testing-library/react-native";
import WifiIcon from "lucide-react-native/icons/wifi";
import * as React from "react";

import { CornerOverlay } from "./corner-overlay";
import { StatusPill } from "./status-pill";

/** The utility classes on an element, one by one. */
function classesOf(testID: string): string[] {
	return String(screen.getByTestId(testID).props.className).split(" ");
}

describe("StatusPill", () => {
	it("reads as one piece of text named by its accessibility label, with its label shown", async () => {
		await render(<StatusPill icon={WifiIcon} label="Online" accessibilityLabel="Online" tone="success" testID="pill" />);

		expect(screen.getByLabelText("Online")).toHaveProp("accessibilityRole", "text");
		expect(screen.getByText("Online")).toBeOnTheScreen();
	});

	it("shows the icon alone without a label, still named for screen readers", async () => {
		await render(<StatusPill icon={WifiIcon} label={null} accessibilityLabel="Offline" tone="destructive" />);

		expect(screen.getByLabelText("Offline")).toBeOnTheScreen();
		expect(screen.queryByText("Offline")).toBeNull();
	});

	it("draws the tone's full-strength border when emphasized", async () => {
		const view = await render(<StatusPill icon={WifiIcon} label="Refreshed" accessibilityLabel="Refreshed" tone="success" testID="pill" />);
		expect(classesOf("pill")).toContain("border-success/30");

		await view.rerender(<StatusPill icon={WifiIcon} label="Refreshed" accessibilityLabel="Refreshed" tone="success" emphasized testID="pill" />);
		expect(classesOf("pill")).toContain("border-success");
		expect(classesOf("pill")).not.toContain("border-success/30");
	});

	it("sets a ticking label in fixed-width digits", async () => {
		await render(<StatusPill icon={WifiIcon} label="14m 32s" accessibilityLabel="Token expires in 14m 32s" tabularLabel />);

		expect(screen.getByText("14m 32s").props.className).toContain("font-mono");
	});

	it("keeps its name while it breathes", async () => {
		await render(<StatusPill icon={WifiIcon} label="Checking…" accessibilityLabel="Session status: checking" pulsing testID="pill" />);

		expect(screen.getByLabelText("Session status: checking")).toBeOnTheScreen();
		expect(screen.getByTestId("pill")).toHaveProp("accessibilityRole", "text");
	});
});

describe("CornerOverlay", () => {
	it("sits in the chosen top corner, below the safe area", async () => {
		const view = await render(
			<CornerOverlay side="right" visible topInset={47} testID="corner">
				<StatusPill icon={WifiIcon} label={null} accessibilityLabel="Online" />
			</CornerOverlay>,
		);
		expect(screen.getByTestId("corner")).toHaveStyle({ top: 71, right: 20 });

		await view.rerender(
			<CornerOverlay side="left" visible topInset={47} testID="corner">
				<StatusPill icon={WifiIcon} label={null} accessibilityLabel="Online" />
			</CornerOverlay>,
		);
		expect(screen.getByTestId("corner")).toHaveStyle({ top: 71, left: 20 });
	});

	it("passes touches through to its content while visible, and hides it from screen readers while not", async () => {
		const view = await render(
			<CornerOverlay side="right" visible topInset={0} testID="corner">
				<StatusPill icon={WifiIcon} label={null} accessibilityLabel="Online" />
			</CornerOverlay>,
		);
		expect(screen.getByTestId("corner")).toHaveProp("pointerEvents", "box-none");
		expect(screen.getByLabelText("Online")).toBeOnTheScreen();

		await view.rerender(
			<CornerOverlay side="right" visible={false} topInset={0} testID="corner">
				<StatusPill icon={WifiIcon} label={null} accessibilityLabel="Online" />
			</CornerOverlay>,
		);
		expect(screen.getByTestId("corner", { includeHiddenElements: true })).toHaveProp("pointerEvents", "none");
		expect(screen.queryByLabelText("Online")).toBeNull();
	});
});
