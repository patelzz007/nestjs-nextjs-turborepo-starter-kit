import { fireEvent, render, screen } from "@testing-library/react-native";
import WalletIcon from "lucide-react-native/icons/wallet";
import * as React from "react";
import { View, type ViewInstance } from "react-native";

import { IconTile, iconTileGlyphVariants, iconTileTextVariants, type IconTileTone } from "../icon-tile";

/** Each tone's fill and glyph colour: the same tone palette as the web's IconTile. */
const TONE_CASES: readonly (readonly [IconTileTone, string, string])[] = [
	["brand", "bg-primary/10", "accent-primary"],
	["neutral", "bg-muted", "accent-muted-foreground"],
	["green", "bg-tone-green-soft", "accent-tone-green"],
	["blue", "bg-tone-blue-soft", "accent-tone-blue"],
	["yellow", "bg-tone-yellow-soft", "accent-tone-yellow"],
	["red", "bg-tone-red-soft", "accent-tone-red"],
	["orange", "bg-tone-orange-soft", "accent-tone-orange"],
	["teal", "bg-tone-teal-soft", "accent-tone-teal"],
	["violet", "bg-tone-violet-soft", "accent-tone-violet"],
];

function tile(): ReturnType<typeof screen.getByTestId> {
	return screen.getByTestId("tile", { includeHiddenElements: true });
}

describe("IconTile", () => {
	it("is decorative: hidden from screen readers (the label beside it carries the meaning)", async () => {
		await render(<IconTile icon={WalletIcon} testID="tile" />);

		expect(screen.queryByTestId("tile")).toBeNull();
		expect(tile()).toBeOnTheScreen();
	});

	it.each(TONE_CASES)("tints the %s tone", async (tone, fill, glyph) => {
		await render(<IconTile icon={WalletIcon} tone={tone} testID="tile" />);

		expect(String(tile().props.className)).toContain(fill);
		expect(iconTileGlyphVariants({ tone })).toBe(glyph);
	});

	it.each([
		["xs", "size-6"],
		["sm", "size-8"],
		["md", "size-10"],
		["lg", "size-12"],
		["xl", "size-14"],
	] satisfies [React.ComponentProps<typeof IconTile>["size"], string][])("has a %s size (%s)", async (size, sizeClass) => {
		await render(<IconTile icon={WalletIcon} size={size} testID="tile" />);
		expect(String(tile().props.className).split(" ")).toContain(sizeClass);
	});

	it("forwards its ref", async () => {
		const ref = React.createRef<ViewInstance>();
		await render(<IconTile ref={ref} icon={WalletIcon} />);
		expect(ref.current).not.toBeNull();
	});

	it("merges the caller's className last", async () => {
		await render(<IconTile icon={WalletIcon} className="rounded-full" testID="tile" />);
		const className = String(tile().props.className);
		expect(className).toContain("rounded-full");
		expect(className).not.toContain("rounded-lg");
	});

	it("draws each surface: outline and elevated keep the tone on the glyph, solid fills with the tone", async () => {
		const view = await render(<IconTile icon={WalletIcon} variant="outline" tone="green" testID="tile" />);
		expect(String(tile().props.className)).toContain("border-border");
		expect(String(tile().props.className)).not.toContain("bg-tone-green-soft");
		await view.rerender(<IconTile icon={WalletIcon} variant="elevated" testID="tile" />);
		expect(String(tile().props.className)).toContain("shadow-sm");
		await view.rerender(<IconTile icon={WalletIcon} variant="solid" tone="green" testID="tile" />);
		expect(String(tile().props.className)).toContain("bg-tone-green");
		expect(iconTileGlyphVariants({ tone: "green", variant: "solid" })).toContain("accent-tone-green-soft");
		expect(iconTileGlyphVariants({ tone: "brand", variant: "solid" })).toContain("accent-primary-foreground");
	});

	it("insets a card inside the soft and frame surfaces", async () => {
		const view = await render(<IconTile icon={WalletIcon} variant="frame" testID="tile" />);
		expect(tile().children).toHaveLength(2);
		await view.rerender(<IconTile icon={WalletIcon} variant="soft" tone="violet" testID="tile" />);
		expect(String(tile().props.className)).toContain("bg-tone-violet/10");
		await view.rerender(<IconTile icon={WalletIcon} testID="tile" />);
		expect(tile().children).toHaveLength(1);
	});

	it("is a circle with radius full", async () => {
		await render(<IconTile icon={WalletIcon} radius="full" testID="tile" />);
		const className = String(tile().props.className).split(" ");
		expect(className).toContain("rounded-full");
		expect(className).not.toContain("rounded-lg");
	});

	it("holds initials or a count in the glyph's colour", async () => {
		await render(<IconTile text="AJ" tone="blue" size="lg" testID="tile" />);
		expect(screen.getByText("AJ", { includeHiddenElements: true })).toHaveProp("className", iconTileTextVariants({ tone: "blue", size: "lg" }));
	});

	it("is a named link of its own with onPress", async () => {
		const onPress = jest.fn();
		await render(<IconTile icon={WalletIcon} onPress={onPress} accessibilityLabel="Open the wallet" />);
		await fireEvent.press(screen.getByRole("link", { name: "Open the wallet" }));
		expect(onPress).toHaveBeenCalledTimes(1);
	});

	it("pins a badge to its top-end corner", async () => {
		await render(<IconTile icon={WalletIcon} badge={<View testID="dot" />} testID="tile" />);
		expect(screen.getByTestId("dot", { includeHiddenElements: true })).toBeTruthy();
	});
});
