// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import * as React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { afterEach, describe, expect, it, vi } from "vitest";

import { switchVariants } from "@workspace/ui/lib/form/field-variants";
import { Label } from "../label";
import { Switch } from "../switch";

afterEach((): void => {
	cleanup();
});

function part(container: HTMLElement, slot: string): Element | null {
	return container.querySelector(`[data-slot="${slot}"]`);
}

describe("Switch", () => {
	it("forwards its ref to the switch root", (): void => {
		const ref = React.createRef<HTMLElement>();
		render(<Switch ref={ref} />);
		expect(ref.current?.dataset.slot).toBe("switch");
	});

	it("moves the thumb by the travel token and sizes it per size", (): void => {
		const { container, rerender } = render(<Switch />);
		expect(part(container, "switch-thumb")?.className).toContain("data-checked:translate-x-(--switch-thumb-travel)");
		expect(part(container, "switch-thumb")?.className).toContain("size-(--switch-thumb-size)");

		rerender(<Switch size="sm" />);
		expect(part(container, "switch-thumb")?.className).toContain("size-(--switch-thumb-size-sm)");
		expect(part(container, "switch-thumb")?.className).toContain("data-checked:translate-x-(--switch-thumb-travel-sm)");
	});

	it("draws off as a hollow track, on as a solid one and disabled as a dashed grey one", (): void => {
		const track = switchVariants({});
		expect(track).toContain("data-unchecked:bg-transparent");
		expect(track).toContain("data-unchecked:border-muted-foreground");
		expect(track).toContain("data-checked:bg-primary");
		expect(track).toContain("data-disabled:border-dashed");
		expect(track).not.toContain("opacity-50");
	});

	it("carries a check that shows only while on", (): void => {
		const { container } = render(<Switch defaultChecked />);
		expect(part(container, "switch-check")?.getAttribute("class")).toContain("group-data-checked/switch:block");
		expect(part(container, "switch-lock")).toBeNull();
	});

	it("shows a lock and is disabled while locked", (): void => {
		const { container } = render(<Switch checked locked aria-label="Security by email" />);
		const root = part(container, "switch");
		expect(root?.hasAttribute("data-locked")).toBe(true);
		expect(root?.hasAttribute("data-disabled")).toBe(true);
		expect(part(container, "switch-lock")).not.toBeNull();
		expect(part(container, "switch-check")).toBeNull();
		expect(part(container, "switch-thumb")?.className).toContain("bg-card");
	});
});

describe("Switch labels", () => {
	/** The server's HTML, before any script runs: a label names only the control the HTML rules give it. */
	function serverRendered(element: React.ReactElement): HTMLElement {
		const host = document.createElement("div");
		host.innerHTML = renderToStaticMarkup(element);
		document.body.append(host);
		return host;
	}

	it("is named by a wrapping label in the server-rendered HTML, before hydration", (): void => {
		const host = serverRendered(
			<Label>
				<Switch />
				Share with the team
			</Label>,
		);
		const control = host.querySelector('[role="switch"]');
		expect(control?.tagName).toBe("BUTTON");
		expect(host.querySelector("label")?.control).toBe(control);
		host.remove();
	});

	it("is named by a sibling label's htmlFor in the server-rendered HTML", (): void => {
		const host = serverRendered(
			<>
				<Switch id="share" />
				<label htmlFor="share">Share with the team</label>
			</>,
		);
		expect(host.querySelector("label")?.control).toBe(host.querySelector('[role="switch"]'));
		host.remove();
	});

	it("toggles once when its label's text is clicked", (): void => {
		const onCheckedChange = vi.fn<(checked: boolean) => void>();
		render(
			<Label>
				<Switch checked={false} onCheckedChange={onCheckedChange} />
				Share with the team
			</Label>,
		);
		fireEvent.click(screen.getByText("Share with the team"));
		expect(onCheckedChange).toHaveBeenCalledTimes(1);
		expect(screen.getByRole("switch", { name: "Share with the team" })).toBeTruthy();
	});

	it("never submits the form it sits in", (): void => {
		const onSubmit = vi.fn<(event: React.SubmitEvent<HTMLFormElement>) => void>((event): void => {
			event.preventDefault();
		});
		render(
			<form onSubmit={onSubmit}>
				<Switch aria-label="Share with the team" />
			</form>,
		);
		expect(screen.getByRole("switch").getAttribute("type")).toBe("button");
		fireEvent.click(screen.getByRole("switch"));
		expect(onSubmit).not.toHaveBeenCalled();
	});
});
