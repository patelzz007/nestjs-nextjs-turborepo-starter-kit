// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import * as React from "react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { checkboxVariants } from "../../lib/form/field-variants";
import { Checkbox } from "../checkbox";

afterEach((): void => {
	cleanup();
});

function part(container: HTMLElement, slot: string): Element | null {
	return container.querySelector(`[data-slot="${slot}"]`);
}

describe("Checkbox", () => {
	it("forwards its ref to the checkbox root", (): void => {
		const ref = React.createRef<HTMLElement>();
		render(<Checkbox ref={ref} aria-label="Email" />);
		expect(ref.current?.dataset.slot).toBe("checkbox");
	});

	it("shows a tick while checked and nothing while unchecked", (): void => {
		const { container, rerender } = render(<Checkbox checked aria-label="Email" />);
		expect(screen.getByRole("checkbox").getAttribute("aria-checked")).toBe("true");
		expect(part(container, "checkbox-check")?.getAttribute("class")).toContain("in-data-indeterminate:hidden");

		rerender(<Checkbox checked={false} aria-label="Email" />);
		expect(screen.getByRole("checkbox").getAttribute("aria-checked")).toBe("false");
		expect(part(container, "checkbox-indicator")).toBeNull();
	});

	it("shows a dash and announces mixed while part-checked", (): void => {
		const { container } = render(<Checkbox checked={false} indeterminate aria-label="Account" />);
		const root = part(container, "checkbox");
		expect(root?.hasAttribute("data-indeterminate")).toBe(true);
		expect(screen.getByRole("checkbox").getAttribute("aria-checked")).toBe("mixed");
		expect(part(container, "checkbox-dash")?.getAttribute("class")).toContain("in-data-indeterminate:block");
		expect(checkboxVariants({})).toContain("data-indeterminate:bg-primary");
	});

	it("shows a lock, takes no presses and is not faded while locked", (): void => {
		const onCheckedChange = vi.fn<(checked: boolean) => void>();
		const { container } = render(<Checkbox checked locked onCheckedChange={onCheckedChange} aria-label="Security in the app" />);
		const root = part(container, "checkbox");
		expect(root?.hasAttribute("data-locked")).toBe(true);
		expect(root?.hasAttribute("data-disabled")).toBe(true);
		expect(part(container, "checkbox-lock")).not.toBeNull();
		expect(part(container, "checkbox-check")).toBeNull();
		expect(root?.className.split(" ")).not.toContain("opacity-50");

		fireEvent.click(screen.getByRole("checkbox"));
		expect(onCheckedChange).not.toHaveBeenCalled();
	});

	it("reports the next value when pressed", (): void => {
		const onCheckedChange = vi.fn<(checked: boolean) => void>();
		render(<Checkbox checked={false} onCheckedChange={onCheckedChange} aria-label="Email" />);
		fireEvent.click(screen.getByRole("checkbox"));
		const [checked] = onCheckedChange.mock.lastCall ?? [];
		expect(checked).toBe(true);
	});
});
