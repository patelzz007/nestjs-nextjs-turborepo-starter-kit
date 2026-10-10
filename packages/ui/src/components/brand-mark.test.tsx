import { cleanup, render, screen } from "@testing-library/react";
import { BRAND_MARK_FACETS, BRAND_MARK_VIEW_BOX } from "@workspace/tokens";
import * as React from "react";
import { afterEach, describe, expect, it } from "vitest";

import { BrandMark } from "./brand-mark";

afterEach((): void => {
	cleanup();
});

describe("BrandMark", () => {
	it("draws every facet of the shared mark in the current colour at its own strength", (): void => {
		render(<BrandMark data-testid="mark" className="size-5" />);

		const mark = screen.getByTestId("mark");
		expect(mark.getAttribute("viewBox")).toBe(BRAND_MARK_VIEW_BOX);
		expect(mark.getAttribute("fill")).toBe("currentColor");
		expect(mark.getAttribute("class")).toBe("size-5");
		const paths = [...mark.querySelectorAll("path")].map((path) => [path.getAttribute("d"), path.getAttribute("fill-opacity")]);
		expect(paths).toStrictEqual(BRAND_MARK_FACETS.map((facet) => [facet.path, String(facet.opacity)]));
	});

	it("is decorative next to a written brand name", (): void => {
		render(<BrandMark data-testid="mark" />);

		expect(screen.getByTestId("mark").getAttribute("aria-hidden")).toBe("true");
	});

	it("is a named image when it stands alone", (): void => {
		render(<BrandMark label="Reward Hub" />);

		expect(screen.getByRole("img", { name: "Reward Hub" })).toBeDefined();
	});
});
