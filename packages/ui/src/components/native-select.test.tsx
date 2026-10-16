// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import * as React from "react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { NativeSelect, NativeSelectOptGroup, NativeSelectOption } from "./native-select";

afterEach((): void => {
	cleanup();
});

describe("NativeSelect", () => {
	it("renders a labelled native combobox with grouped options", (): void => {
		render(
			<>
				<label htmlFor="fruit">Fruit</label>
				<NativeSelect id="fruit" defaultValue="pear">
					<NativeSelectOptGroup label="Pome">
						<NativeSelectOption value="apple">Apple</NativeSelectOption>
						<NativeSelectOption value="pear">Pear</NativeSelectOption>
					</NativeSelectOptGroup>
				</NativeSelect>
			</>,
		);
		const select = screen.getByRole("combobox", { name: "Fruit" });
		expect(select.tagName).toBe("SELECT");
		expect(screen.getByRole("group", { name: "Pome" }).dataset.slot).toBe("native-select-optgroup");
		expect(screen.getByRole<HTMLOptionElement>("option", { name: "Pear" }).selected).toBe(true);
	});

	it("is controlled through value + onChange", (): void => {
		const onChange = vi.fn();
		render(
			<NativeSelect aria-label="Size" value="s" onChange={onChange}>
				<NativeSelectOption value="s">Small</NativeSelectOption>
				<NativeSelectOption value="l">Large</NativeSelectOption>
			</NativeSelect>,
		);
		fireEvent.change(screen.getByRole("combobox", { name: "Size" }), { target: { value: "l" } });
		expect(onChange).toHaveBeenCalledTimes(1);
	});

	it("applies the sm size to the select and its wrapper", (): void => {
		render(<NativeSelect aria-label="Size" size="sm" />);
		const select = screen.getByRole("combobox", { name: "Size" });
		expect(select.className).toContain("h-8");
		expect(select.dataset.size).toBe("sm");
		expect(select.parentElement?.dataset.size).toBe("sm");
	});

	it.each([
		["disabled", { disabled: true }, "cursor-not-allowed"],
		["error", { "aria-invalid": true }, "border-destructive"],
		["loading", { loading: true }, "pointer-events-none"],
	])("derives the %s state from standard props", (state, props, expected): void => {
		render(<NativeSelect aria-label="Pick" {...props} />);
		const select = screen.getByRole("combobox", { name: "Pick" });
		expect(select.className).toContain(expected);
		expect(select.parentElement?.dataset.state).toBe(state);
	});

	it("marks a loading select busy", (): void => {
		render(<NativeSelect aria-label="Pick" loading />);
		expect(screen.getByRole("combobox", { name: "Pick" }).getAttribute("aria-busy")).toBe("true");
	});

	it("merges className onto the wrapper and selectClassName onto the select", (): void => {
		render(<NativeSelect aria-label="Pick" className="w-full" selectClassName="pl-4" />);
		const select = screen.getByRole("combobox", { name: "Pick" });
		expect(select.className).toContain("pl-4");
		expect(select.className).not.toContain("pl-2.5");
		expect(select.parentElement?.className).toContain("w-full");
		expect(select.parentElement?.className).not.toContain("w-fit");
	});

	it("forwards the ref to the select element", (): void => {
		const ref = React.createRef<HTMLSelectElement>();
		render(<NativeSelect ref={ref} aria-label="Pick" />);
		expect(ref.current?.tagName).toBe("SELECT");
	});
});
