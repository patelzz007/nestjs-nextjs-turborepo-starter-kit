import { render, screen } from "@testing-library/react-native";
import * as React from "react";
import type { ViewInstance } from "react-native";

import { StatTiles, type StatTile } from "../stat-tiles";

const ITEMS: readonly StatTile[] = [
	{ label: "Stars", value: "1,204" },
	{ label: "Forks", value: "7" },
];

describe("StatTiles", () => {
	it("reads each tile as `label: value`", async () => {
		await render(<StatTiles items={ITEMS} />);

		expect(screen.getByLabelText("Stars: 1,204")).toBeOnTheScreen();
		expect(screen.getByLabelText("Forks: 7")).toHaveProp("className", expect.stringContaining("bg-muted"));
		expect(screen.getByText("1,204")).toHaveProp("className", expect.stringContaining("text-lg"));
	});

	it("has an outline variant and a compact size", async () => {
		await render(<StatTiles items={ITEMS} variant="outline" size="sm" />);

		expect(screen.getByLabelText("Stars: 1,204")).toHaveProp("className", expect.stringContaining("border-border"));
		expect(screen.getByText("1,204")).toHaveProp("className", expect.stringContaining("text-base"));
	});

	it("forwards its ref and merges className last", async () => {
		const ref = React.createRef<ViewInstance>();
		await render(<StatTiles ref={ref} items={ITEMS} className="gap-4" testID="tiles" />);

		expect(ref.current).not.toBeNull();
		const className = String(screen.getByTestId("tiles").props.className);
		expect(className).toContain("gap-4");
		expect(className).not.toContain("gap-2");
	});
});
