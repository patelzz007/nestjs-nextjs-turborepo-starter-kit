// @vitest-environment jsdom
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { Badge } from "./badge";

describe("Badge", () => {
	it("renders its children", (): void => {
		render(<Badge>New</Badge>);
		expect(screen.getByText("New")).toBeTruthy();
	});

	it("applies the destructive variant styling", (): void => {
		render(<Badge variant="destructive">Danger</Badge>);
		const badge = screen.getByText("Danger");
		expect(badge.className).toContain("text-destructive");
	});

	it("accepts a custom className alongside variants", (): void => {
		render(<Badge className="uppercase">Tag</Badge>);
		expect(screen.getByText("Tag").className).toContain("uppercase");
	});
});
