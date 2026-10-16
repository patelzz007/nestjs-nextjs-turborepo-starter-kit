import { render, screen } from "@testing-library/react-native";
import * as React from "react";
import type { View } from "react-native";

import { Timeline, describeTimelineItem, type TimelineItem } from "../timeline";

const ITEMS: readonly TimelineItem[] = [
	{ key: "a", title: "Kopi Kaki", detail: "Sat, 10 Oct · 7:42 pm", value: "RM 14.50", badge: { label: "Reward redeemed", tone: "success" } },
	{ key: "b", title: "Urban Threads", detail: "Fri, 9 Oct · 1:05 pm", value: "RM 89.00" },
];

describe("Timeline", () => {
	it("reads each event as one sentence, with its badge when it has one", async () => {
		await render(<Timeline items={ITEMS} />);

		expect(screen.getByLabelText("Kopi Kaki, RM 14.50, Sat, 10 Oct · 7:42 pm, Reward redeemed")).toBeOnTheScreen();
		expect(screen.getByLabelText("Urban Threads, RM 89.00, Fri, 9 Oct · 1:05 pm")).toBeOnTheScreen();
		expect(screen.getByText("Reward redeemed")).toBeOnTheScreen();
	});

	it("describes an event without a badge by its title, value and detail", () => {
		const [, plain] = ITEMS;
		expect(plain === undefined ? "" : describeTimelineItem(plain)).toBe("Urban Threads, RM 89.00, Fri, 9 Oct · 1:05 pm");
	});

	it("has a compact size", async () => {
		await render(<Timeline items={ITEMS} variant="muted" size="sm" />);
		expect(screen.getByText("Kopi Kaki")).toHaveProp("className", expect.stringContaining("text-xs"));
	});

	it("forwards its ref and merges className last", async () => {
		const ref = React.createRef<View>();
		await render(<Timeline ref={ref} items={ITEMS} className="mt-2" testID="timeline" />);

		expect(ref.current).not.toBeNull();
		expect(screen.getByTestId("timeline")).toHaveProp("className", expect.stringContaining("mt-2"));
	});
});
