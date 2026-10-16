import { render, screen } from "@testing-library/react-native";
import WalletIcon from "lucide-react-native/icons/wallet";
import * as React from "react";
import type { View } from "react-native";

import { IconTile, iconTileGlyphVariants, type IconTileTone } from "../icon-tile";

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
		["sm", "size-8"],
		["md", "size-10"],
		["lg", "size-12"],
	] satisfies [React.ComponentProps<typeof IconTile>["size"], string][])("has a %s size (%s)", async (size, sizeClass) => {
		await render(<IconTile icon={WalletIcon} size={size} testID="tile" />);
		expect(String(tile().props.className).split(" ")).toContain(sizeClass);
	});

	it("forwards its ref", async () => {
		const ref = React.createRef<View>();
		await render(<IconTile ref={ref} icon={WalletIcon} />);
		expect(ref.current).not.toBeNull();
	});

	it("merges the caller's className last", async () => {
		await render(<IconTile icon={WalletIcon} className="rounded-full" testID="tile" />);
		const className = String(tile().props.className);
		expect(className).toContain("rounded-full");
		expect(className).not.toContain("rounded-lg");
	});
});
