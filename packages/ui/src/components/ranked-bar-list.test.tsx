import { cleanup, render, screen, within } from "@testing-library/react";
import * as React from "react";
import { afterEach, describe, expect, it } from "vitest";

import { RankedBarList, rankedBarPercent, type RankedBarItem } from "./ranked-bar-list";

afterEach((): void => {
	cleanup();
});

const ITEMS: readonly RankedBarItem[] = [
	{ key: "a", label: "Brew & Bean", value: 2000, valueLabel: "RM 20.00", detail: "8 bills" },
	{ key: "b", label: "Noodle House", value: 500, valueLabel: "RM 5.00" },
];

describe("rankedBarPercent", () => {
	it("scales to the largest value", () => {
		expect(rankedBarPercent(2000, 2000)).toBe(100);
		expect(rankedBarPercent(500, 2000)).toBe(25);
	});

	it("keeps a tiny non-zero value visible and a zero value empty", () => {
		expect(rankedBarPercent(1, 100_000)).toBe(1);
		expect(rankedBarPercent(0, 2000)).toBe(0);
		expect(rankedBarPercent(5, 0)).toBe(0);
	});
});

describe("RankedBarList", () => {
	it("is a named ordered list whose rows state every name and value as text", (): void => {
		render(<RankedBarList items={ITEMS} label="Merchants ranked by sales" showRank />);

		const list = screen.getByRole("list", { name: "Merchants ranked by sales" });
		const rows = within(list).getAllByRole("listitem");
		expect(rows).toHaveLength(2);
		expect(rows[0]?.textContent).toContain("Brew & Bean");
		expect(rows[0]?.textContent).toContain("RM 20.00");
		expect(rows[0]?.textContent).toContain("8 bills");
		expect(rows[1]?.textContent).toContain("RM 5.00");
	});

	it("orders lightness by rank when the order is the point, and keeps one strength otherwise", (): void => {
		const { container, rerender } = render(<RankedBarList items={ITEMS} label="Merchants" tone="ranked" />);
		const opacities = (): string[] => [...container.querySelectorAll<HTMLElement>("li [aria-hidden] > div")].map((bar) => bar.style.opacity);

		expect(opacities()).toEqual(["1", "0.45"]);
		rerender(<RankedBarList items={ITEMS} label="Merchants" />);
		expect(opacities()).toEqual(["1", "1"]);
	});

	it("shows the empty message instead of rows", (): void => {
		render(<RankedBarList items={[]} label="Stores" state={{ status: "empty", message: "No stores yet" }} />);

		expect(screen.getByText("No stores yet")).toBeTruthy();
		expect(screen.queryByRole("list")).toBeNull();
	});

	it("forwards its ref to the list", (): void => {
		const ref = React.createRef<HTMLOListElement>();
		render(<RankedBarList ref={ref} items={ITEMS} label="Merchants" />);

		expect(ref.current).toBe(screen.getByRole("list", { name: "Merchants" }));
	});
});
