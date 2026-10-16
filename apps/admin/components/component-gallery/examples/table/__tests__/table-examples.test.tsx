// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { UiKitTestProviders } from "@workspace/ui/testing/ui-kit-test-providers";
import { afterEach, describe, expect, it } from "vitest";

import { TABLE_EXAMPLES } from "@/components/component-gallery/examples/table";
import { Table5Example } from "@/components/component-gallery/examples/table/table-5";

afterEach(() => {
	cleanup();
});

describe("Table examples", () => {
	it.each(TABLE_EXAMPLES)("renders the $label example ($id)", ({ component: Component }) => {
		const { container } = render(<Component />, { wrapper: UiKitTestProviders });

		expect(container.querySelector("table")).not.toBeNull();
		expect(screen.getAllByRole("row").length).toBeGreaterThan(1);
	});

	it("lets a quantity be edited in place on the interactive rows example", () => {
		render(<Table5Example />, { wrapper: UiKitTestProviders });
		const quantity = screen.getByRole("spinbutton", { name: "Quantity of Item Beta" });

		expect(quantity).toHaveProperty("value", "2");
		fireEvent.change(quantity, { target: { value: "5" } });
		expect(quantity).toHaveProperty("value", "5");
	});
});
