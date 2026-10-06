import { cleanup, render, screen } from "@testing-library/react";
import { MapPin } from "lucide-react";
import * as React from "react";
import { afterEach, describe, expect, it } from "vitest";

import { IconTile } from "./icon-tile";

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
});
