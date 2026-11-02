// @vitest-environment jsdom
import { cleanup, render } from "@testing-library/react";
import * as React from "react";
import { afterEach, describe, expect, it } from "vitest";

import { switchVariants } from "../../lib/form/field-variants";
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
