import { fireEvent, render, screen } from "@testing-library/react-native";
import * as React from "react";
import type { ViewInstance } from "react-native";

import { Diagram } from "../diagram";

const FLOW = `flowchart LR
  accTitle: How a change ships
  accDescr: A pull request is reviewed, then merged.
  pr[Pull request] --> review{Review}
  review -->|approved| merge[Merge]`;

async function layout(width: number): Promise<void> {
	await fireEvent(screen.getByTestId("diagram-card"), "layout", { nativeEvent: { layout: { width, height: 300, x: 0, y: 0 } } });
}

describe("Diagram", () => {
	it("waits for its width, then draws the diagram named and summarised for a screen reader, with its caption", async () => {
		const ref = React.createRef<ViewInstance>();
		await render(<Diagram ref={ref} source={FLOW} caption="From pull request to merge" testID="diagram" className="mt-2" />);
		expect(screen.getByLabelText("Loading diagram…")).toBeOnTheScreen();
		await layout(320);
		expect(screen.getByRole("image", { name: "How a change ships. A pull request is reviewed, then merged." })).toBeOnTheScreen();
		expect(screen.getByText("From pull request to merge")).toBeOnTheScreen();
		expect(ref.current).not.toBeNull();
	});

	it("falls back to the caption for a diagram without accTitle, and says why a source cannot be drawn", async () => {
		const { rerender } = await render(<Diagram source={"flowchart LR\n a --> b"} caption="Two steps" testID="diagram" />);
		await layout(320);
		expect(screen.getByRole("image", { name: "Two steps" })).toBeOnTheScreen();

		await rerender(<Diagram source="not a diagram at all" testID="diagram" labels={{ error: "Cannot draw this" }} />);
		expect(screen.getByRole("alert")).toBeOnTheScreen();
		expect(screen.getByText("Cannot draw this")).toBeOnTheScreen();
	});
});
