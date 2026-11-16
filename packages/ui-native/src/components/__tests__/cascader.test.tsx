import { act, fireEvent, render, screen, waitFor } from "@testing-library/react-native";
import * as Haptics from "expo-haptics";
import * as React from "react";
import { Text, type ViewInstance } from "react-native";

import type { CascaderNode } from "../../lib/cascader";
import { SHEET_MOTION } from "../../lib/motion";
import { Cascader, CascaderPanel } from "../cascader";

const TREE: readonly CascaderNode[] = [
	{
		value: "europe",
		label: "Europe",
		count: 2,
		children: [
			{
				value: "ch",
				label: "Switzerland",
				children: [
					{ value: "zrh", label: "Zürich" },
					{ value: "gva", label: "Geneva" },
				],
			},
			{ value: "de", label: "Germany", children: [{ value: "ber", label: "Berlin" }] },
		],
	},
	{ value: "asia", label: "Asia", hasChildren: true },
];

function renderValue(paths: readonly (readonly CascaderNode[])[]): React.JSX.Element {
	return <Text>{`picked ${String(paths.length)}`}</Text>;
}

function renderLabel(node: CascaderNode): React.JSX.Element {
	return <Text>{`→ ${node.label}`}</Text>;
}

function badgeOf(node: CascaderNode): React.JSX.Element {
	return <Text>{`#${node.value}`}</Text>;
}

describe("CascaderPanel", () => {
	beforeEach(() => {
		jest.spyOn(Haptics, "selectionAsync").mockResolvedValue(undefined);
	});

	afterEach(() => {
		jest.restoreAllMocks();
	});

	it("drills into branches, goes back, and picks a leaf with its path", async () => {
		const onChange = jest.fn();
		const ref = React.createRef<ViewInstance>();
		await render(<CascaderPanel ref={ref} items={TREE} value={null} onChange={onChange} renderTrailing={badgeOf} />);
		expect(screen.getByLabelText("2 items")).toBeOnTheScreen();
		await fireEvent.press(screen.getByRole("button", { name: "Europe" }));
		await fireEvent.press(screen.getByRole("button", { name: "Switzerland" }));
		expect(screen.getByRole("header", { name: "All / Europe / Switzerland" })).toBeOnTheScreen();
		await fireEvent.press(screen.getByRole("radio", { name: "Zürich" }));
		expect(onChange).toHaveBeenCalledWith(
			"zrh",
			expect.objectContaining({ reason: "select", path: [expect.objectContaining({ value: "europe" }), expect.anything(), expect.anything()] }),
		);
		await fireEvent.press(screen.getByRole("button", { name: "Back" }));
		expect(screen.getByRole("button", { name: "Germany" })).toBeOnTheScreen();
		expect(ref.current).not.toBeNull();
	});

	it("searches below the shown level and writes each hit's path", async () => {
		await render(<CascaderPanel items={TREE} value={null} onChange={jest.fn()} />);
		await fireEvent.changeText(screen.getByLabelText("Search"), "zurich");
		expect(screen.getByRole("radio", { name: "Zürich" })).toHaveProp("accessibilityHint", "Europe / Switzerland");
		await fireEvent.changeText(screen.getByLabelText("Search"), "nothing");
		expect(screen.getByText("No results.")).toBeOnTheScreen();
	});

	it("cascades ticks in tree mode and opens branches in place", async () => {
		const onChange = jest.fn();
		await render(<CascaderPanel items={TREE} multiple cascade mode="tree" value={["zrh"]} onChange={onChange} searchable={false} />);
		expect(screen.getByRole("checkbox", { name: "Europe" })).toHaveProp("accessibilityState", expect.objectContaining({ checked: "mixed" }));
		await fireEvent.press(screen.getByRole("button", { name: "Expand Europe" }));
		expect(screen.getByRole("checkbox", { name: "Switzerland" })).toBeOnTheScreen();
		await fireEvent.press(screen.getByRole("checkbox", { name: "Europe" }));
		expect(onChange).toHaveBeenCalledWith(["zrh", "gva", "ber"], expect.objectContaining({ reason: "select" }));
	});

	it("loads a level on demand, and offers a retry when it fails", async () => {
		const getChildren = jest
			.fn()
			.mockRejectedValueOnce(new Error("offline"))
			.mockResolvedValueOnce([{ value: "tyo", label: "Tokyo" }]);
		await render(<CascaderPanel items={TREE} value={null} onChange={jest.fn()} getChildren={getChildren} />);
		await fireEvent.press(screen.getByRole("button", { name: "Asia" }));
		await waitFor((): void => {
			expect(screen.getByRole("alert")).toBeOnTheScreen();
		});
		await fireEvent.press(screen.getByRole("button", { name: "Retry" }));
		await waitFor((): void => {
			expect(screen.getByRole("radio", { name: "Tokyo" })).toBeOnTheScreen();
		});
	});

	it("lays the open levels out as columns", async () => {
		await render(<CascaderPanel items={TREE} value={null} onChange={jest.fn()} mode="columns" path={["europe"]} selectable="any" />);
		expect(screen.getByLabelText("Columns")).toBeOnTheScreen();
		expect(screen.getByRole("radio", { name: "Germany" })).toBeOnTheScreen();
		expect(screen.getByRole("button", { name: "Open Europe" })).toBeOnTheScreen();
	});
});

describe("Cascader", () => {
	beforeEach(() => {
		jest.useFakeTimers();
		jest.spyOn(Haptics, "selectionAsync").mockResolvedValue(undefined);
	});

	afterEach(() => {
		jest.useRealTimers();
		jest.restoreAllMocks();
	});

	it("writes the picked path, shortened, and clears it", async () => {
		const onClear = jest.fn();
		await render(<Cascader label="City" items={TREE} value="zrh" onChange={jest.fn()} maxSegments={2} collapse="start" onClear={onClear} />);
		expect(screen.getByRole("combobox", { name: "City, … / Zürich" })).toBeOnTheScreen();
		await fireEvent.press(screen.getByRole("button", { name: "Clear city" }));
		expect(onClear).toHaveBeenCalled();
	});

	it("closes after a pick, and counts several picks", async () => {
		const onChange = jest.fn();
		await render(<Cascader label="City" items={TREE} value={null} onChange={onChange} placeholder="Pick a city" />);
		await fireEvent.press(screen.getByRole("combobox", { name: "City, Pick a city" }));
		await fireEvent.changeText(screen.getByLabelText("Search"), "berlin");
		await fireEvent.press(screen.getByRole("radio", { name: "Berlin" }));
		expect(onChange).toHaveBeenCalledWith("ber", expect.anything());
		await act((): void => {
			jest.advanceTimersByTime(SHEET_MOTION.exit.duration);
		});
		expect(screen.queryByLabelText("Search")).toBeNull();

		await render(<Cascader label="Cities" items={TREE} multiple value={["zrh", "ber"]} onChange={jest.fn()} />);
		expect(screen.getByRole("combobox", { name: "Cities, 2 selected" })).toBeOnTheScreen();
		await fireEvent.press(screen.getByRole("combobox"));
		expect(screen.getByRole("button", { name: "Done" })).toBeOnTheScreen();
	});

	it("shows a hint or an error, hides its label on request, and draws the value the caller's way", async () => {
		const { rerender } = await render(<Cascader label="City" items={TREE} value="zrh" onChange={jest.fn()} hint="Where you work" display="leaf" renderValue={renderValue} />);
		expect(screen.getByText("Where you work")).toBeOnTheScreen();
		expect(screen.getByText("picked 1")).toBeOnTheScreen();

		await rerender(<Cascader label="City" items={TREE} value={null} onChange={jest.fn()} error="Pick a city" hideLabel disabled />);
		expect(screen.getByRole("alert")).toBeOnTheScreen();

		await rerender(<Cascader label="Cities" items={TREE} multiple value={["zrh", "ber"]} onChange={jest.fn()} display="leaf" />);
		expect(screen.getByRole("combobox", { name: "Cities, Zürich, Berlin" })).toBeOnTheScreen();
	});

	it("stays open after a pick when asked to", async () => {
		const onChange = jest.fn();
		await render(<Cascader label="City" items={TREE} value={null} onChange={onChange} closeOnSelect={false} />);
		await fireEvent.press(screen.getByRole("combobox"));
		await fireEvent.changeText(screen.getByLabelText("Search"), "berlin");
		await fireEvent.press(screen.getByRole("radio", { name: "Berlin" }));
		await act((): void => {
			jest.advanceTimersByTime(SHEET_MOTION.exit.duration);
		});
		expect(screen.getByLabelText("Search")).toBeOnTheScreen();
	});
});

describe("CascaderPanel options", () => {
	beforeEach(() => {
		jest.spyOn(Haptics, "selectionAsync").mockResolvedValue(undefined);
	});

	afterEach(() => {
		jest.restoreAllMocks();
	});

	const GROUPED: readonly CascaderNode[] = [
		{ value: "zrh", label: "Zürich", group: "Switzerland", icon: <Text>flag</Text> },
		{ value: "gva", label: "Geneva", group: "Switzerland", disabled: true },
		{ value: "ber", label: "Berlin", group: "Germany" },
	];

	it("heads each group, draws icons and the caller's labels, and skips a disabled row", async () => {
		const onChange = jest.fn();
		await render(<CascaderPanel items={GROUPED} value="zrh" onChange={onChange} renderLabel={renderLabel} />);
		expect(screen.getByRole("header", { name: "Switzerland" })).toBeOnTheScreen();
		expect(screen.getByRole("header", { name: "Germany" })).toBeOnTheScreen();
		expect(screen.getByText("→ Berlin")).toBeOnTheScreen();
		await fireEvent.press(screen.getByText("→ Geneva"));
		expect(onChange).not.toHaveBeenCalled();
	});

	it("caps several picks at max, ticks without cascading, and unticks a pick", async () => {
		const onChange = jest.fn();
		await render(<CascaderPanel items={GROUPED} multiple value={["zrh"]} onChange={onChange} max={1} cascade={false} />);
		await fireEvent.press(screen.getByRole("checkbox", { name: "Berlin" }));
		expect(onChange).not.toHaveBeenCalled();
		await fireEvent.press(screen.getByRole("checkbox", { name: "Zürich" }));
		expect(onChange).toHaveBeenCalledWith([], expect.objectContaining({ reason: "deselect" }));
	});
});
