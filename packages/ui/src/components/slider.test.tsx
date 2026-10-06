// @vitest-environment jsdom
import { cleanup, render } from "@testing-library/react";
import * as React from "react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { Slider } from "./slider";

/** jsdom has no ResizeObserver; base-ui's slider measures its track with one. */
class ResizeObserverStub {
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

afterEach((): void => {
	cleanup();
	vi.unstubAllGlobals();
});

function countThumbs(container: HTMLElement): number {
	return container.querySelectorAll('[data-slot="slider-thumb"]').length;
}

describe("Slider", () => {
	it("renders one thumb for a scalar value", (): void => {
		vi.stubGlobal("ResizeObserver", ResizeObserverStub);
		const { container } = render(<Slider defaultValue={40} />);
		expect(countThumbs(container)).toBe(1);
	});

	it("renders one thumb per value of an array", (): void => {
		vi.stubGlobal("ResizeObserver", ResizeObserverStub);
		const { container } = render(<Slider defaultValue={[10, 40, 80]} />);
		expect(countThumbs(container)).toBe(3);
	});

	it("forwards its ref to the root", (): void => {
		vi.stubGlobal("ResizeObserver", ResizeObserverStub);
		const ref = React.createRef<HTMLDivElement>();
		render(<Slider ref={ref} defaultValue={[20, 60]} />);
		expect(ref.current?.dataset.slot).toBe("slider");
	});
});
