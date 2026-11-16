import { fireEvent, render, screen } from "@testing-library/react-native";
import * as React from "react";
import { Text, type ViewInstance } from "react-native";

import { Item, ItemActions, ItemContent, ItemDescription, ItemFooter, ItemGroup, ItemHeader, ItemMedia, ItemSeparator, ItemTitle } from "../item";

const TITLE = "Email Notifications";
const DESCRIPTION = "Receive updates via email";
const SMALL = "Small";
const PROFILE = "Profile";
const PLAIN = "Plain";

function classesOf(testID: string): readonly string[] {
	return String(screen.getByTestId(testID, { includeHiddenElements: true }).props.className).split(" ");
}

describe("Item", () => {
	it("lays out media, a title, a description and actions", async () => {
		await render(
			<Item variant="outline" testID="item">
				<ItemMedia variant="icon" testID="media">
					<Text>glyph</Text>
				</ItemMedia>
				<ItemContent>
					<ItemTitle>{TITLE}</ItemTitle>
					<ItemDescription>{DESCRIPTION}</ItemDescription>
				</ItemContent>
				<ItemActions>
					<Text>Configure</Text>
				</ItemActions>
			</Item>,
		);
		expect(screen.getByText("Email Notifications")).toBeOnTheScreen();
		expect(screen.getByText("Receive updates via email")).toBeOnTheScreen();
		expect(classesOf("item")).toContain("border-border");
		// The media is decorative: the title names the row.
		expect(screen.queryByTestId("media")).toBeNull();
	});

	it("fills the muted surface, and tightens its padding with the size", async () => {
		const view = await render(<Item variant="muted" size="xs" testID="item" />);
		expect(classesOf("item")).toContain("bg-muted/50");
		expect(classesOf("item")).toContain("py-2");
		await view.rerender(<Item size="sm" testID="item" />);
		expect(classesOf("item")).toContain("py-2.5");
	});

	it("sizes an image thumbnail and the description to the item", async () => {
		await render(
			<Item size="xs">
				<ItemMedia variant="image" testID="media" />
				<ItemContent>
					<ItemDescription testID="description">{SMALL}</ItemDescription>
				</ItemContent>
			</Item>,
		);
		expect(classesOf("media")).toContain("size-6");
		expect(classesOf("description")).toContain("text-caption");
	});

	it("is a named link of its own with onPress", async () => {
		const onPress = jest.fn();
		await render(
			<Item onPress={onPress} accessibilityLabel="Profile">
				<ItemContent>
					<ItemTitle>{PROFILE}</ItemTitle>
				</ItemContent>
			</Item>,
		);
		await fireEvent.press(screen.getByRole("link", { name: "Profile" }));
		expect(onPress).toHaveBeenCalledTimes(1);
	});

	it("adds full-width header and footer rows, and stacks items in a group with separators", async () => {
		await render(
			<ItemGroup size="sm" testID="group">
				<Item>
					<ItemHeader testID="header">
						<Text>Design</Text>
					</ItemHeader>
					<ItemFooter testID="footer">
						<Text>65%</Text>
					</ItemFooter>
				</Item>
				<ItemSeparator testID="separator" />
			</ItemGroup>,
		);
		expect(classesOf("header")).toContain("basis-full");
		expect(classesOf("footer")).toContain("basis-full");
		expect(classesOf("group")).toContain("gap-2.5");
		expect(screen.getByTestId("group")).toHaveProp("accessibilityRole", "list");
		expect(screen.getByTestId("separator", { includeHiddenElements: true })).toBeTruthy();
	});

	it("forwards its ref and merges className last", async () => {
		const ref = React.createRef<ViewInstance>();
		await render(<Item ref={ref} className="mt-2" testID="item" />);
		expect(ref.current).not.toBeNull();
		expect(classesOf("item").at(-1)).toBe("mt-2");
	});

	it("uses its parts' defaults: plain media, a medium group and a bare separator", async () => {
		await render(
			<ItemGroup>
				<Item>
					<ItemMedia>
						<Text>icon</Text>
					</ItemMedia>
					<ItemContent>
						<ItemTitle>{PLAIN}</ItemTitle>
					</ItemContent>
				</Item>
				<ItemSeparator />
			</ItemGroup>,
		);
		expect(screen.getByText(PLAIN)).toBeOnTheScreen();
		expect(screen.getByText("icon", { includeHiddenElements: true })).toBeOnTheScreen();
	});
});
