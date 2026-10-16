import { render, screen } from "@testing-library/react-native";
import * as React from "react";
import type { View } from "react-native";

import { DetailList, type DetailItem } from "../detail-list";

const ITEMS: readonly DetailItem[] = [
	{ label: "Signed in", value: "3 Oct 2026" },
	{ label: "IP", value: "<script>" },
];

describe("DetailList", () => {
	it("reads each pair as `label: value`, rendering values as plain text", async () => {
		await render(<DetailList items={ITEMS} />);

		expect(screen.getByLabelText("Signed in: 3 Oct 2026")).toBeOnTheScreen();
		expect(screen.getByText("Signed in:")).toBeOnTheScreen();
		expect(screen.getByText("<script>")).toBeOnTheScreen();
	});

	it("stacks the label above its value without the colon", async () => {
		await render(<DetailList items={ITEMS} variant="stacked" size="sm" testID="details" />);

		expect(screen.getByText("Signed in")).toBeOnTheScreen();
		expect(screen.getByText("Signed in")).toHaveProp("className", expect.stringContaining("text-xs"));
		expect(screen.getByTestId("details")).toHaveProp("className", expect.stringContaining("gap-0.5"));
	});

	it("forwards its ref and merges the caller's className last", async () => {
		const ref = React.createRef<View>();
		await render(<DetailList ref={ref} items={ITEMS} className="mt-2 gap-4" testID="details" />);

		expect(ref.current).not.toBeNull();
		const className = String(screen.getByTestId("details").props.className);
		expect(className).toContain("gap-4");
		expect(className).toContain("mt-2");
		expect(className).not.toContain("gap-1");
	});
});
