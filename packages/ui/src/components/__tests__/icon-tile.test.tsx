import { cleanup, render, screen } from "@testing-library/react";
import { MapPin } from "lucide-react";
import * as React from "react";
import { afterEach, describe, expect, it } from "vitest";

import { IconTile, IconTileToneSchema, type IconTileTone, IconTileVariantSchema, type IconTileVariant, type IconTileSize } from "../icon-tile";

afterEach((): void => {
	cleanup();
});

describe("IconTile", () => {
	it("is decorative and paints its tone from the tone palette", (): void => {
		render(
			<IconTile tone="green" data-testid="tile">
				<MapPin />
			</IconTile>,
		);

		const tile = screen.getByTestId("tile");
		expect(tile.getAttribute("aria-hidden")).toBe("true");
		expect(tile.className).toContain("bg-tone-green-soft");
		expect(tile.className).toContain("text-tone-green");
	});

	it("defaults to the neutral tone", (): void => {
		render(<IconTile data-testid="tile" />);

		expect(screen.getByTestId("tile").dataset.tone).toBe("neutral");
		expect(screen.getByTestId("tile").className).toContain("bg-muted");
	});

	it("forwards its ref", (): void => {
		const ref = React.createRef<HTMLSpanElement>();
		render(<IconTile ref={ref} />);

		expect(ref.current?.dataset.slot).toBe("icon-tile");
	});
	it("keeps the tint variant as the default look", (): void => {
		render(<IconTile data-testid="tile" />);

		expect(screen.getByTestId("tile").dataset.variant).toBe("tint");
		expect(screen.getByTestId("tile").dataset.size).toBe("md");
	});

	it.each(IconTileToneSchema.options)("paints the %s tone in every variant", (tone: IconTileTone): void => {
		for (const variant of IconTileVariantSchema.options) {
			render(<IconTile data-testid="tile" variant={variant} tone={tone} />);
			const tile = screen.getByTestId("tile");
			expect(tile.dataset.variant).toBe(variant);
			expect(tile.dataset.tone).toBe(tone);
			cleanup();
		}
	});

	it.each([
		["outline", "border-border"],
		["elevated", "shadow-sm"],
		["soft", "bg-current/10"],
		["frame", "after:bg-card"],
	] satisfies [IconTileVariant, string][])("paints the %s surface", (variant: IconTileVariant, surfaceClass: string): void => {
		render(<IconTile data-testid="tile" variant={variant} tone="green" />);

		const tile = screen.getByTestId("tile");
		expect(tile.className).toContain(surfaceClass);
		expect(tile.className).toContain("text-tone-green");
		expect(tile.className).not.toContain("bg-tone-green-soft");
	});

	it("inverts the tone's AA pair for the solid variant", (): void => {
		render(<IconTile data-testid="tile" variant="solid" tone="violet" />);

		const tile = screen.getByTestId("tile");
		expect(tile.className).toContain("bg-tone-violet");
		expect(tile.className).toContain("text-tone-violet-soft");
		expect(tile.className).not.toContain("bg-tone-violet-soft");
	});

	it("fills the brand solid tile with the primary colour", (): void => {
		render(<IconTile data-testid="tile" variant="solid" tone="brand" />);

		expect(screen.getByTestId("tile").className).toContain("bg-primary text-primary-foreground");
	});

	it("lets a className text colour retint the soft variant, as ReUI does", (): void => {
		render(<IconTile data-testid="tile" variant="soft" className="text-success" />);

		const tile = screen.getByTestId("tile");
		expect(tile.className).toContain("text-success");
		expect(tile.className).not.toContain("text-muted-foreground");
	});

	it.each([
		["xs", "--spacing(6)"],
		["sm", "--spacing(8)"],
		["md", "--spacing(10)"],
		["default", "--spacing(10)"],
		["lg", "--spacing(12)"],
		["xl", "--spacing(14)"],
	] satisfies [IconTileSize, string][])("sizes the %s tile through its CSS variable", (size: IconTileSize, tileSize: string): void => {
		render(<IconTile data-testid="tile" size={size} />);

		const tile = screen.getByTestId("tile");
		expect(tile.className).toContain(`[--icon-tile-size:${tileSize}]`);
		expect(tile.dataset.size).toBe(size);
	});

	it("leaves an icon that sets its own size alone", (): void => {
		render(<IconTile data-testid="tile" />);

		expect(screen.getByTestId("tile").className).toContain("[&_svg:not([class*=size-])]:size-(--icon-tile-icon-size)");
	});

	it("rounds into a circle with radius=full", (): void => {
		render(<IconTile data-testid="tile" radius="full" />);

		expect(screen.getByTestId("tile").className).toContain("[--icon-tile-radius:calc(infinity*1px)]");
	});

	it("renders as another element through the render prop", (): void => {
		render(<IconTile data-testid="tile" render={<div />} />);

		expect(screen.getByTestId("tile").tagName).toBe("DIV");
		expect(screen.getByTestId("tile").dataset.slot).toBe("icon-tile");
	});

	it("lets a caller expose a meaningful tile to assistive technology", (): void => {
		render(
			<IconTile data-testid="tile" aria-hidden={false} role="img" aria-label="Location">
				<MapPin />
			</IconTile>,
		);

		expect(screen.getByRole("img", { name: "Location" }).dataset.slot).toBe("icon-tile");
	});
});
