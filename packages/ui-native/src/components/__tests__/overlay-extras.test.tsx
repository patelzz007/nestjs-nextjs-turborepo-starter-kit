import { fireEvent, render, screen } from "@testing-library/react-native";
import * as React from "react";
import { Text } from "react-native";

import { AlertDialog } from "../alert-dialog";
import { CommandList } from "../command-palette";
import { Dialog, DialogBody, DialogFooter } from "../dialog";
import { Tooltip } from "../tooltip";

const BODY = "Long body";
const MEDIA = "media";
const EXTRA = "Receipt";
const RICH = "Rich bubble";

describe("Dialog extras", () => {
	it("adds a corner close button, a scrolling body, a full size and a row footer", async () => {
		const onOpenChange = jest.fn();
		await render(
			<Dialog open onOpenChange={onOpenChange} showCloseButton size="full" testID="dialog">
				<DialogBody height="fill" testID="body">
					<Text>{BODY}</Text>
				</DialogBody>
				<DialogFooter layout="row" testID="footer">
					<Text>{BODY}</Text>
				</DialogFooter>
			</Dialog>,
		);
		expect(screen.getByTestId("dialog")).toHaveProp("className", expect.stringContaining("h-11/12"));
		expect(screen.getByTestId("body")).toHaveProp("className", expect.stringContaining("flex-1"));
		expect(screen.getByTestId("footer")).toHaveProp("className", expect.stringContaining("flex-row"));
		await fireEvent.press(screen.getByTestId("dialog-close"));
		expect(onOpenChange).toHaveBeenCalledWith(false);
	});
});

describe("AlertDialog extras", () => {
	it("shows media and extra content, offers one action without a cancel, or two flush cells", async () => {
		const onConfirm = jest.fn();
		const onCancel = jest.fn();
		const view = await render(
			<AlertDialog visible title="Done" description="Saved." confirmLabel="OK" onConfirm={onConfirm} onCancel={onCancel} media={<Text>{MEDIA}</Text>} align="center">
				<Text>{EXTRA}</Text>
			</AlertDialog>,
		);
		expect(screen.getByText(MEDIA)).toBeOnTheScreen();
		expect(screen.getByText(EXTRA)).toBeOnTheScreen();
		expect(screen.getAllByRole("button").filter((button) => button.props.accessibilityLabel !== "Close")).toHaveLength(1);
		await view.rerender(
			<AlertDialog
				visible
				title="Sign out?"
				description="Sure?"
				confirmLabel="Yes"
				cancelLabel="No"
				onConfirm={onConfirm}
				onCancel={onCancel}
				actionsLayout="split"
				mediaPlacement="start"
				media={<Text>{MEDIA}</Text>}
				confirmDisabled
			/>,
		);
		await fireEvent.press(screen.getByRole("button", { name: "No" }));
		expect(onCancel).toHaveBeenCalled();
		expect(screen.getByRole("button", { name: "Yes" })).toBeDisabled();
		await view.rerender(
			<AlertDialog
				visible
				title="Delete?"
				description="Gone for good."
				confirmLabel="Delete"
				cancelLabel="Keep"
				onConfirm={onConfirm}
				onCancel={onCancel}
				actionsLayout="row"
				destructive
			/>,
		);
		await fireEvent.press(screen.getByRole("button", { name: "Delete" }));
		expect(onConfirm).toHaveBeenCalled();
	});
});

describe("CommandList", () => {
	it("lists rich, disabled and shortcut rows, searches keywords, and runs a command", async () => {
		const onSelect = jest.fn();
		await render(
			<CommandList
				placeholder="Search commands"
				emptyMessage="Nothing found."
				variant="card"
				groups={[
					{
						key: "general",
						title: "General",
						items: [
							{ key: "settings", label: "Settings", keywords: ["preferences"], shortcut: ["⌘", ","], onSelect },
							{ key: "calc", label: "Calculator", disabled: true, leading: <Text>{MEDIA}</Text>, trailing: <Text>{EXTRA}</Text>, onSelect: jest.fn() },
						],
					},
				]}
			/>,
		);
		expect(screen.getByRole("button", { name: "Calculator" })).toBeDisabled();
		await fireEvent.changeText(screen.getByLabelText("Search commands"), "prefer");
		await fireEvent.press(screen.getByRole("button", { name: "Settings" }));
		expect(onSelect).toHaveBeenCalled();
		await fireEvent.changeText(screen.getByLabelText("Search commands"), "zzz");
		expect(screen.getByText("Nothing found.")).toBeOnTheScreen();
	});
});

describe("Tooltip rich content", () => {
	it("draws rich content in the bubble while the hint stays the text", async () => {
		await render(
			<Tooltip content="3 services operational" richContent={<Text>{RICH}</Text>} accessibilityLabel="Status" open testID="tip">
				<Text>{BODY}</Text>
			</Tooltip>,
		);
		expect(screen.getByText(RICH, { includeHiddenElements: true })).toBeOnTheScreen();
		expect(screen.getByLabelText("Status")).toHaveProp("accessibilityHint", "3 services operational");
	});
});
