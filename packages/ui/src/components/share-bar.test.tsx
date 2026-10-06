import { cleanup, render, screen, within } from "@testing-library/react";
import * as React from "react";
import { afterEach, describe, expect, it } from "vitest";

import { ShareBar, shareWidths, type ShareSegment } from "./share-bar";

afterEach((): void => {
	cleanup();
});

const SEGMENTS: readonly ShareSegment[] = [
	{ key: "SCAN", label: "QR scan", value: 66, valueLabel: "66", shareLabel: "65%", color: "chart-1" },
	{ key: "MANUAL", label: "Backup code", value: 35, valueLabel: "35", shareLabel: "35%", color: "chart-2" },
];

describe("shareWidths", () => {
	it("splits 100% by value", () => {
		expect(shareWidths([75, 25])).toEqual([75, 25]);
	});

	it("is all zero for an empty whole and ignores negatives", () => {
		expect(shareWidths([0, 0])).toEqual([0, 0]);
		expect(shareWidths([-5, 10])).toEqual([0, 100]);
	});
});

describe("ShareBar", () => {
	it("lists every part with its name, value and share", (): void => {
		render(<ShareBar segments={SEGMENTS} label="Redemptions by method" />);

		const items = within(screen.getByRole("list", { name: "Redemptions by method" })).getAllByRole("listitem");
		expect(items.map((item) => item.textContent)).toEqual(["QR scan6665%", "Backup code3535%"]);
	});

	it("textures each part with its slot's pattern, in the bar and in the legend", (): void => {
		const { container } = render(<ShareBar segments={SEGMENTS} label="Redemptions by method" />);

		expect([...container.querySelectorAll("[data-pattern]")].map((element) => element.getAttribute("data-pattern"))).toEqual(["solid", "diagonal", "solid", "diagonal"]);
	});

	it("shows the empty message for an empty whole", (): void => {
		render(<ShareBar segments={SEGMENTS} label="Redemptions" state={{ status: "empty", message: "No redemptions" }} />);

		expect(screen.getByText("No redemptions")).toBeTruthy();
	});

	it("forwards its ref", (): void => {
		const ref = React.createRef<HTMLDivElement>();
		render(<ShareBar ref={ref} segments={SEGMENTS} label="Methods" data-testid="share" />);

		expect(ref.current).toBe(screen.getByTestId("share"));
	});
});
