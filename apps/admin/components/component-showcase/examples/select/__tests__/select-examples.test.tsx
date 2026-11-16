// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { UiKitTestProviders } from "@workspace/ui/testing/ui-kit-test-providers";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { FEATURE_EXAMPLES as SELECT_EXAMPLES } from "@/components/component-showcase/generated/examples/select";

import type { ShowcaseFeatureExample } from "@/components/component-showcase/showcase-feature";
import { Select17Example } from "@/components/component-showcase/examples/select/select-17";
import { Select21Example } from "@/components/component-showcase/examples/select/select-21";

// ── jsdom fidelity shims ────────────────────────────────────────────────────
// jsdom has no layout engine: base-ui's select positioner observes element
// sizes, and the popup scrolls the selected option into view.

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

function noopScrollIntoView(): void {
	return;
}

beforeEach((): void => {
	vi.stubGlobal("ResizeObserver", NoopResizeObserver);
	Object.defineProperty(Element.prototype, "scrollIntoView", { configurable: true, writable: true, value: noopScrollIntoView });
});

afterEach((): void => {
	cleanup();
	vi.unstubAllGlobals();
	Reflect.deleteProperty(Element.prototype, "scrollIntoView");
});

/** The trigger's value slot — scoped so an open popup's item text is never matched. */
function triggerValueText(): string | null | undefined {
	return screen.getByRole("combobox").querySelector("[data-slot='select-value']")?.textContent;
}

describe("Select examples", () => {
	it.each(SELECT_EXAMPLES.map((example: ShowcaseFeatureExample): [string, ShowcaseFeatureExample] => [example.id, example]))(
		"renders %s without throwing",
		(_id: string, example: ShowcaseFeatureExample): void => {
			const { container } = render(<example.component />, { wrapper: UiKitTestProviders });
			expect(container.textContent).not.toBe("");
			expect(container.querySelector("[data-slot]")).not.toBeNull();
		},
	);

	it("shows the default option's rich label in the closed trigger", (): void => {
		render(<Select17Example />, { wrapper: UiKitTestProviders });
		expect(triggerValueText()).toBe("Completed");
	});

	it("selects an option and clears it again with the clear button", (): void => {
		render(<Select21Example />, { wrapper: UiKitTestProviders });
		expect(triggerValueText()).toBe("Select framework");
		expect(screen.queryByRole("button", { name: "Clear selection" })).toBeNull();

		act((): void => {
			fireEvent.click(screen.getByRole("combobox"));
		});
		// A real mouse press: base-ui only commits a click that started on the item.
		const option = screen.getByRole("option", { name: "Astro" });
		act((): void => {
			fireEvent.pointerDown(option, { pointerType: "mouse" });
			fireEvent.click(option);
		});
		expect(triggerValueText()).toBe("Astro");

		act((): void => {
			fireEvent.click(screen.getByRole("button", { name: "Clear selection" }));
		});
		expect(triggerValueText()).toBe("Select framework");
	});
});
