// @vitest-environment jsdom
import { render, screen } from "@testing-library/react";
import * as React from "react";
import { describe, expect, it } from "vitest";

import { Badge } from "./badge";

describe("Badge", () => {
	it("renders its children", (): void => {
		render(<Badge>New</Badge>);
		expect(screen.getByText("New")).toBeTruthy();
	});

	it("applies ReUI's solid destructive fill with the status text token", (): void => {
		render(<Badge variant="destructive">Danger</Badge>);
		const badge = screen.getByText("Danger");
		expect(badge.className).toContain("bg-destructive");
		expect(badge.className).toContain("text-status-foreground");
	});

	it("applies a light status variant: a tint with the status foreground text", (): void => {
		render(<Badge variant="destructive-light">Rejected</Badge>);
		const badge = screen.getByText("Rejected");
		expect(badge.className).toContain("bg-destructive/10");
		expect(badge.className).toContain("text-destructive-foreground");
	});

	it("sizes the smallest badges through the badge type tokens", (): void => {
		render(<Badge size="xs">Tiny</Badge>);
		expect(screen.getByText("Tiny").className).toContain("text-[length:var(--text-badge-xs)]");
	});

	it("switches to a pill shape with radius=full", (): void => {
		render(<Badge radius="full">Pill</Badge>);
		expect(screen.getByText("Pill").className).toContain("rounded-full");
	});

	it("forwards its ref and marks its slot", (): void => {
		const ref = React.createRef<HTMLSpanElement>();
		render(<Badge ref={ref}>Ref</Badge>);
		expect(ref.current?.dataset.slot).toBe("badge");
	});

	it.each(["green", "blue", "yellow", "red", "orange", "teal", "violet"] satisfies ("green" | "blue" | "yellow" | "red" | "orange" | "teal" | "violet")[])(
		"applies the %s tone: its soft fill and its text colour",
		(tone): void => {
			render(<Badge variant={tone}>{tone}</Badge>);
			const badge = screen.getByText(tone);
			expect(badge.className).toContain(`bg-tone-${tone}-soft`);
			expect(badge.className).toContain(`text-tone-${tone}`);
		},
	);

	it("accepts a custom className alongside variants", (): void => {
		render(<Badge className="uppercase">Tag</Badge>);
		expect(screen.getByText("Tag").className).toContain("uppercase");
	});
});
