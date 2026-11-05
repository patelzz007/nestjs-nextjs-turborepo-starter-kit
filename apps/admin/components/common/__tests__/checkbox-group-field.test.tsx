// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { UiKitTestProviders } from "@workspace/ui/testing/ui-kit-test-providers";
import * as React from "react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { CheckboxGroupField } from "@/components/common/form-fields";

const OPTIONS: readonly ("a" | "b" | "c")[] = ["a", "b", "c"];

function upperCase(option: string): string {
	return option.toUpperCase();
}

afterEach((): void => {
	cleanup();
});

describe("CheckboxGroupField", () => {
	it("adds and removes options, always in the options' order", () => {
		const onChange = vi.fn();
		const { rerender } = render(<CheckboxGroupField id="g" label="Letters" value={["c"]} options={OPTIONS} onChange={onChange} labelOf={upperCase} />, {
			wrapper: UiKitTestProviders,
		});
		act((): void => {
			fireEvent.click(screen.getByRole("checkbox", { name: "A" }));
		});
		expect(onChange).toHaveBeenLastCalledWith(["a", "c"]);

		rerender(<CheckboxGroupField id="g" label="Letters" value={["a", "c"]} options={OPTIONS} onChange={onChange} labelOf={upperCase} />);
		act((): void => {
			fireEvent.click(screen.getByRole("checkbox", { name: "C" }));
		});
		expect(onChange).toHaveBeenLastCalledWith(["a"]);
	});

	it("names the group and marks it invalid with its message", () => {
		render(<CheckboxGroupField id="g" label="Letters" value={[]} options={OPTIONS} onChange={vi.fn()} errors={[{ message: "Choose at least one" }]} />, {
			wrapper: UiKitTestProviders,
		});
		const group = screen.getByRole("group", { name: "Letters" });
		expect(group.getAttribute("aria-invalid")).toBe("true");
		expect(screen.getByText("Choose at least one")).toBeTruthy();
		expect(screen.getByRole("checkbox", { name: "a" })).toBeTruthy();
	});
});
