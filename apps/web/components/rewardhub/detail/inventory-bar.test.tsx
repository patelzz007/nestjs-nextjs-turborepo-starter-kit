// @vitest-environment jsdom
import { cleanup, render, screen } from "@testing-library/react";
import * as React from "react";
import { afterEach, describe, expect, it } from "vitest";

import { RewardInventoryBar } from "@/components/rewardhub/detail/inventory-bar";

afterEach(() => {
	cleanup();
});

describe("RewardInventoryBar", () => {
	it("labels the compact count, so it never reads as a bare number", () => {
		render(<RewardInventoryBar compact remaining={28} total={35} />);

		expect(screen.getByText("28 left")).toBeDefined();
	});

	it("states remaining of total in the full variant", () => {
		render(<RewardInventoryBar remaining={28} total={35} />);

		expect(screen.getByText("28 of 35 left")).toBeDefined();
	});

	it("hides the purely visual bar from assistive technology (the text carries the meaning)", () => {
		const { container } = render(<RewardInventoryBar compact remaining={2} total={40} />);

		expect(container.querySelector('[aria-hidden="true"] > div')?.getAttribute("style")).toContain("width: 5%");
	});
});
