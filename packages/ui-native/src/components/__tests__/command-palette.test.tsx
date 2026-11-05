import { fireEvent, render, screen } from "@testing-library/react-native";
import HouseIcon from "lucide-react-native/icons/house";
import ShieldCheckIcon from "lucide-react-native/icons/shield-check";
import * as React from "react";
import type { ViewInstance } from "react-native";

import { CommandPalette, commandMatches, matchingGroups, type CommandPaletteGroup } from "../command-palette";

function groupsWith(onHome: () => void, onSecurity: () => void): readonly CommandPaletteGroup[] {
	return [
		{ key: "go", title: "Go to", items: [{ key: "home", label: "Home", icon: HouseIcon, onSelect: onHome, testID: "command-home" }] },
		{
			key: "account",
			title: "Account",
			items: [
				{
					key: "security",
					label: "Security",
					description: "Password, two-factor, backup codes",
					icon: ShieldCheckIcon,
					tone: "blue",
					onSelect: onSecurity,
					testID: "command-security",
				},
			],
		},
	];
}

async function renderPalette(onClose = jest.fn(), onHome = jest.fn(), onSecurity = jest.fn()): Promise<void> {
	await render(
		<CommandPalette
			visible
			onClose={onClose}
			groups={groupsWith(onHome, onSecurity)}
			title="Search"
			placeholder="Search the app"
			emptyMessage="No matches."
			testID="palette"
		/>,
	);
}

describe("commandMatches", () => {
	it("matches the label or the line under it, ignoring case and outer spaces, and everything for no text", () => {
		expect(commandMatches({ label: "Security" }, "  SEC ")).toBe(true);
		expect(commandMatches({ label: "Security", description: "Password, two-factor" }, "two-factor")).toBe(true);
		expect(commandMatches({ label: "Home" }, "sec")).toBe(false);
		expect(commandMatches({ label: "Home" }, "   ")).toBe(true);
	});
});

describe("matchingGroups", () => {
	it("keeps only the matching commands, and drops a group left empty", () => {
		const shown = matchingGroups(groupsWith(jest.fn(), jest.fn()), "secur");

		expect(shown.map((group: CommandPaletteGroup): string => group.key)).toEqual(["account"]);
	});
});

describe("CommandPalette", () => {
	it("shows every group's commands under their titles, each as a button", async () => {
		await renderPalette();

		expect(screen.getByRole("header", { name: "Go to" })).toBeOnTheScreen();
		expect(screen.getByRole("header", { name: "Account" })).toBeOnTheScreen();
		expect(screen.getByRole("button", { name: "Home" })).toBeOnTheScreen();
		expect(screen.getByRole("button", { name: "Security, Password, two-factor, backup codes" })).toBeOnTheScreen();
	});

	it("narrows the commands to what is typed, and says so when nothing matches", async () => {
		await renderPalette();

		await fireEvent.changeText(screen.getByLabelText("Search the app"), "secu");
		expect(screen.queryByRole("button", { name: "Home" })).toBeNull();
		expect(screen.getByTestId("command-security")).toBeOnTheScreen();

		await fireEvent.changeText(screen.getByLabelText("Search the app"), "zzz");
		expect(screen.getByText("No matches.")).toBeOnTheScreen();
	});

	it("closes, then runs a chosen command", async () => {
		const order: string[] = [];
		await renderPalette(
			jest.fn((): void => {
				order.push("close");
			}),
			jest.fn((): void => {
				order.push("home");
			}),
		);

		await fireEvent.press(screen.getByTestId("command-home"));
		expect(order).toEqual(["close", "home"]);
	});

	it("clears what was typed when it closes", async () => {
		const onClose = jest.fn();
		await renderPalette(onClose);
		await fireEvent.changeText(screen.getByLabelText("Search the app"), "secu");

		await fireEvent.press(screen.getByTestId("command-security"));
		expect(onClose).toHaveBeenCalledTimes(1);
		expect(screen.getByLabelText("Search the app")).toHaveDisplayValue("");
	});

	it("forwards its ref to the sheet", async () => {
		const ref = React.createRef<ViewInstance>();
		await render(
			<CommandPalette
				ref={ref}
				visible
				onClose={jest.fn()}
				groups={groupsWith(jest.fn(), jest.fn())}
				title="Search"
				placeholder="Search the app"
				emptyMessage="No matches."
			/>,
		);

		expect(ref.current).not.toBeNull();
	});
});
