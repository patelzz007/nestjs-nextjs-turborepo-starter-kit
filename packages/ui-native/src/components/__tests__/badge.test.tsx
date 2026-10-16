import { render, screen } from "@testing-library/react-native";
import CheckIcon from "lucide-react-native/icons/check";
import * as React from "react";
import type { View } from "react-native";

import { Badge, type BadgeTone } from "../badge";

/** Each tone's soft fill, solid fill and soft label colour. */
const TONE_CASES: readonly (readonly [BadgeTone, string, string, string])[] = [
	["neutral", "bg-muted", "bg-invert", "text-muted-foreground"],
	["info", "bg-info-soft", "bg-info", "text-info-foreground"],
	["success", "bg-success-soft", "bg-success", "text-success-foreground"],
	["warning", "bg-warning-soft", "bg-warning", "text-warning-foreground"],
	["destructive", "bg-destructive-soft", "bg-destructive", "text-destructive-foreground"],
];

function classNameOf(testID: string): string {
	return String(screen.getByTestId(testID).props.className);
}

describe("Badge", () => {
	it("shows its label on one line", async () => {
		await render(<Badge label="This device" />);
		expect(screen.getByText("This device")).toHaveProp("numberOfLines", 1);
	});

	it.each(TONE_CASES)("draws the %s tone soft, solid or outlined", async (tone, softFill, solidFill, softLabel) => {
		const view = await render(<Badge label="Label" tone={tone} testID="badge" />);
		expect(classNameOf("badge")).toContain(softFill);
		expect(screen.getByText("Label")).toHaveProp("className", expect.stringContaining(softLabel));

		await view.rerender(<Badge label="Label" tone={tone} variant="solid" testID="badge" />);
		expect(classNameOf("badge")).toContain(solidFill);
		expect(classNameOf("badge")).not.toContain(softFill);

		await view.rerender(<Badge label="Label" tone={tone} variant="outline" testID="badge" />);
		expect(classNameOf("badge")).toContain("border-border bg-card");
	});

	it("labels a solid tone in the status foreground", async () => {
		await render(<Badge label="Paid" tone="success" variant="solid" />);
		expect(screen.getByText("Paid")).toHaveProp("className", expect.stringContaining("text-status-foreground"));
	});

	it("has a compact size", async () => {
		await render(<Badge label="New" size="sm" testID="badge" />);
		expect(classNameOf("badge").split(" ")).toContain("px-2");
		expect(screen.getByText("New")).toHaveProp("className", expect.stringContaining("text-badge-sm"));
	});

	it("draws a glyph before the label", async () => {
		await render(<Badge label="Verified" icon={CheckIcon} testID="badge" />);
		expect(screen.getByText("Verified")).toBeOnTheScreen();
	});

	it("forwards its ref", async () => {
		const ref = React.createRef<View>();
		await render(<Badge ref={ref} label="On" />);
		expect(ref.current).not.toBeNull();
	});

	it("merges the caller's className last", async () => {
		await render(<Badge label="On" className="px-4" testID="badge" />);
		expect(classNameOf("badge")).toContain("px-4");
		expect(classNameOf("badge")).not.toContain("px-2.5");
	});
});
