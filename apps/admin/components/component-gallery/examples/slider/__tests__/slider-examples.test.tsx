// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { UiKitTestProviders } from "@workspace/ui/testing/ui-kit-test-providers";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { GalleryExample } from "@/components/component-gallery/examples/gallery-example";
import { SLIDER_EXAMPLES } from "@/components/component-gallery/examples/slider";

// ── jsdom fidelity shims ────────────────────────────────────────────────────
// jsdom has no layout engine; base-ui's slider observes its track's size. With
// nothing measured, base-ui keeps each thumb `visibility: hidden`, so the range
// inputs are queried with `hidden: true`.

const INCLUDE_UNMEASURED = { hidden: true };

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

beforeEach((): void => {
	vi.stubGlobal("ResizeObserver", NoopResizeObserver);
});

afterEach((): void => {
	cleanup();
	vi.unstubAllGlobals();
});

function exampleById(id: string): GalleryExample {
	const example = SLIDER_EXAMPLES.find((candidate) => candidate.id === id);
	if (example === undefined) throw new Error(`Missing example ${id}`);
	return example;
}

describe("Slider gallery examples", () => {
	it.each(SLIDER_EXAMPLES.map((example): [string, GalleryExample] => [example.label, example]))(
		"renders %s",
		(_label: string, { component: Component }: GalleryExample): void => {
			render(<Component />, { wrapper: UiKitTestProviders });

			expect(screen.getAllByRole("slider", INCLUDE_UNMEASURED).length).toBeGreaterThan(0);
		},
	);

	it("keeps the number field and the slider in sync", (): void => {
		const { component: Component } = exampleById("c-slider-7");
		render(<Component />, { wrapper: UiKitTestProviders });

		const slider = screen.getByRole("slider", INCLUDE_UNMEASURED);
		expect(slider).toHaveProperty("value", "50");

		fireEvent.keyDown(slider, { key: "ArrowRight" });

		expect(slider).toHaveProperty("value", "51");
		expect(screen.getByRole("spinbutton", { name: "Opacity" })).toHaveProperty("value", "51");
	});
});
