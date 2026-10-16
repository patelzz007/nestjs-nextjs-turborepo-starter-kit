// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { UiKitTestProviders } from "@workspace/ui/testing/ui-kit-test-providers";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { SORTABLE_EXAMPLES } from "@/components/component-gallery/examples/sortable";
import { Sortable5Example } from "@/components/component-gallery/examples/sortable/sortable-5";

// jsdom has no layout engine: dnd-kit measures droppables through ResizeObserver.
class NoopResizeObserver {
	public observe(): void {
		return;
	}
	public unobserve(): void {
		return;
	}
	public disconnect(): void {
		return;
	}
}

beforeEach(() => {
	vi.stubGlobal("ResizeObserver", NoopResizeObserver);
});

afterEach(() => {
	cleanup();
	vi.unstubAllGlobals();
});

describe("Sortable examples", () => {
	it.each(SORTABLE_EXAMPLES)("renders the $label example ($id)", ({ component: Component }) => {
		const { container } = render(<Component />, { wrapper: UiKitTestProviders });

		expect(container.querySelectorAll('[data-slot="sortable-item"]').length).toBeGreaterThan(1);
		expect(container.textContent).not.toBe("");
	});

	it("toggles a channel on the settings priority example", () => {
		render(<Sortable5Example />, { wrapper: UiKitTestProviders });
		const sms = screen.getByRole("switch", { name: "Enable SMS" });

		expect(sms.getAttribute("aria-checked")).toBe("false");
		fireEvent.click(sms);
		expect(sms.getAttribute("aria-checked")).toBe("true");
	});
});
