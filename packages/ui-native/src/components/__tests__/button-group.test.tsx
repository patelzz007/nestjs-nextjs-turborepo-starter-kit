import { fireEvent, render, screen } from "@testing-library/react-native";
import * as React from "react";
import type { View } from "react-native";

import { Button } from "../button";
import { ButtonGroup } from "../button-group";

describe("ButtonGroup", () => {
	it("is a named group whose buttons keep their own events", async () => {
		const onLeft = jest.fn();
		await render(
			<ButtonGroup accessibilityLabel="Alignment" testID="group">
				<Button label="Left" variant="secondary" onPress={onLeft} />
				<Button label="Right" variant="secondary" onPress={jest.fn()} />
			</ButtonGroup>,
		);

		const group = screen.getByTestId("group");
		expect(group).toHaveProp("role", "group");
		expect(group).toHaveAccessibleName("Alignment");
		await fireEvent.press(screen.getByRole("button", { name: "Left" }));
		expect(onLeft).toHaveBeenCalledTimes(1);
	});

	it("attaches horizontal buttons: squares the inner corners and drops the doubled border", async () => {
		await render(
			<ButtonGroup>
				<Button label="Day" variant="secondary" onPress={jest.fn()} />
				<Button label="Week" variant="secondary" onPress={jest.fn()} />
				{null}
				<Button label="Month" variant="secondary" onPress={jest.fn()} className="px-6" />
			</ButtonGroup>,
		);

		expect(screen.getByRole("button", { name: "Day" })).toHaveProp("className", expect.stringContaining("rounded-r-none"));
		expect(screen.getByRole("button", { name: "Week" })).toHaveProp("className", expect.stringContaining("rounded-none"));
		const last = String(screen.getByRole("button", { name: "Month" }).props.className);
		expect(last).toContain("rounded-l-none");
		expect(last).toContain("border-l-0");
		expect(last).toContain("px-6");
	});

	it("stacks vertically, and leaves a single button untouched", async () => {
		await render(
			<ButtonGroup orientation="vertical" testID="group">
				<Button label="Top" onPress={jest.fn()} />
				<Button label="Bottom" onPress={jest.fn()} />
			</ButtonGroup>,
		);
		expect(screen.getByTestId("group")).toHaveProp("className", expect.stringContaining("flex-col"));
		expect(screen.getByRole("button", { name: "Top" })).toHaveProp("className", expect.stringContaining("rounded-b-none"));
		expect(screen.getByRole("button", { name: "Bottom" })).toHaveProp("className", expect.stringContaining("rounded-t-none"));

		await render(
			<ButtonGroup>
				<Button label="Alone" onPress={jest.fn()} />
			</ButtonGroup>,
		);
		expect(screen.getByRole("button", { name: "Alone" })).not.toHaveProp("className", expect.stringContaining("-none"));
	});

	it("spaces separated buttons apart without touching their corners", async () => {
		await render(
			<ButtonGroup variant="separated" size="sm" testID="group">
				<Button label="Cancel" variant="secondary" size="sm" onPress={jest.fn()} />
				<Button label="Save" size="sm" onPress={jest.fn()} />
			</ButtonGroup>,
		);

		expect(screen.getByTestId("group")).toHaveProp("className", expect.stringContaining("gap-1.5"));
		expect(screen.getByRole("button", { name: "Cancel" })).not.toHaveProp("className", expect.stringContaining("-none"));
	});

	it("forwards its ref and merges className last", async () => {
		const ref = React.createRef<View>();
		await render(
			<ButtonGroup ref={ref} variant="separated" className="gap-4 self-start" testID="group">
				<Button label="One" onPress={jest.fn()} />
			</ButtonGroup>,
		);

		expect(ref.current).not.toBeNull();
		const className = String(screen.getByTestId("group").props.className);
		expect(className).toContain("gap-4");
		expect(className).not.toContain("gap-2");
	});
});
