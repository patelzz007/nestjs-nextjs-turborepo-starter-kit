import { fireEvent, render, screen } from "@testing-library/react-native";
import EyeIcon from "lucide-react-native/icons/eye";
import * as React from "react";
import { Text, type ViewInstance } from "react-native";

import { DataTableCard } from "../data-table-card";

describe("DataTableCard", () => {
	it("shows a title, a subtitle, a badge and labelled values read as pairs", async () => {
		await render(
			<DataTableCard
				title="Cover page"
				subtitle="Eddie Lake"
				badge={<Text>Done</Text>}
				fields={[
					{ label: "Type", value: "Narrative" },
					{ label: "Target", value: "18" },
				]}
			/>,
		);

		expect(screen.getByText("Cover page")).toBeOnTheScreen();
		expect(screen.getByText("Eddie Lake")).toBeOnTheScreen();
		expect(screen.getByText("Done")).toBeOnTheScreen();
		expect(screen.getByLabelText("Type: Narrative")).toBeOnTheScreen();
		expect(screen.getByLabelText("Target: 18")).toBeOnTheScreen();
	});

	it("draws each action as a button, destructive ones in red", async () => {
		const open = jest.fn();
		const remove = jest.fn();
		await render(
			<DataTableCard
				title="Cover page"
				actions={[
					{ key: "open", label: "Open", icon: EyeIcon, destructive: false, onPress: open },
					{ key: "delete", label: "Delete", destructive: true, onPress: remove },
				]}
			/>,
		);

		await fireEvent.press(screen.getByRole("button", { name: "Open" }));
		await fireEvent.press(screen.getByRole("button", { name: "Delete" }));

		expect(open).toHaveBeenCalled();
		expect(remove).toHaveBeenCalled();
		expect(screen.getByRole("button", { name: "Delete" })).toHaveProp("className", expect.stringContaining("bg-destructive"));
	});

	it("leaves out what it is not given", async () => {
		await render(<DataTableCard title="Cover page" testID="card" />);

		expect(screen.queryAllByRole("button")).toHaveLength(0);
		expect(screen.getByTestId("card").children).toHaveLength(1);
	});

	it("forwards its ref and merges the caller's className", async () => {
		const ref = React.createRef<ViewInstance>();
		await render(<DataTableCard ref={ref} title="Cover page" className="mt-2" testID="card" />);

		expect(ref.current).not.toBeNull();
		expect(screen.getByTestId("card")).toHaveProp("className", expect.stringContaining("mt-2"));
	});
});
