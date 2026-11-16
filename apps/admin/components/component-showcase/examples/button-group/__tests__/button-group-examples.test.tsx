// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { UiKitTestProviders } from "@workspace/ui/testing/ui-kit-test-providers";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { FEATURE_EXAMPLES as BUTTON_GROUP_EXAMPLES } from "@/components/component-showcase/generated/examples/button-group";

import { ButtonGroup25Example } from "@/components/component-showcase/examples/button-group/button-group-25";
import { ButtonGroup28Example } from "@/components/component-showcase/examples/button-group/button-group-28";
import type { ShowcaseFeatureExample } from "@/components/component-showcase/showcase-feature";

// ── jsdom fidelity shims ────────────────────────────────────────────────────
// jsdom has no layout engine: the base-ui popups (select, menus, tooltips)
// observe element sizes and scroll their active item into view.

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

describe("Button group examples", () => {
	it.each(BUTTON_GROUP_EXAMPLES.map((example: ShowcaseFeatureExample): [string, ShowcaseFeatureExample] => [example.id, example]))(
		"renders %s without throwing",
		(_id: string, example: ShowcaseFeatureExample): void => {
			const { container } = render(<example.component />, { wrapper: UiKitTestProviders });
			expect(container.firstElementChild).not.toBeNull();
			expect(container.querySelector("[data-slot]")).not.toBeNull();
		},
	);

	it("steps the volume up and toggles mute", (): void => {
		render(<ButtonGroup28Example />, { wrapper: UiKitTestProviders });
		expect(screen.getByRole("button", { name: "50%" })).toBeTruthy();

		act((): void => {
			fireEvent.click(screen.getByRole("button", { name: "Increase Volume" }));
		});
		expect(screen.getByRole("button", { name: "55%" })).toBeTruthy();

		act((): void => {
			fireEvent.click(screen.getByRole("button", { name: "55%" }));
		});
		expect(screen.getByRole("button", { name: "Muted" })).toBeTruthy();
	});

	it("marks only the chosen score as pressed", (): void => {
		render(<ButtonGroup25Example />, { wrapper: UiKitTestProviders });
		act((): void => {
			fireEvent.click(screen.getByRole("button", { name: "7" }));
		});
		expect(screen.getByRole("button", { name: "7" }).getAttribute("aria-pressed")).toBe("true");
		expect(screen.getByRole("button", { name: "8" }).getAttribute("aria-pressed")).toBe("false");
	});
});
