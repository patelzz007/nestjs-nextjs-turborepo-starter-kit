// @vitest-environment jsdom
import { act, cleanup, render, screen } from "@testing-library/react";
import type * as React from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { useElementWidth } from "../use-element-width";

type ResizeCallback = (entries: ResizeObserverEntry[]) => void;

/** A ResizeObserver the test drives: `report(width)` tells every observer the element is now that wide. */
class ControlledResizeObserver {
	public static readonly instances: ControlledResizeObserver[] = [];
	public observed: Element | null = null;
	public disconnected = false;

	public constructor(private readonly _callback: ResizeCallback) {
		ControlledResizeObserver.instances.push(this);
	}

	public observe(element: Element): void {
		this.observed = element;
	}

	public unobserve(): void {
		this.observed = null;
	}

	public disconnect(): void {
		this.disconnected = true;
	}

	public report(width: number): void {
		const target = this.observed;
		if (target === null) {
			return;
		}
		const entry: ResizeObserverEntry = {
			target,
			contentRect: new DOMRectReadOnly(0, 0, width, 0),
			borderBoxSize: [],
			contentBoxSize: [],
			devicePixelContentBoxSize: [],
		};
		this._callback([entry]);
	}
}

function Probe(): React.JSX.Element {
	const { ref, width } = useElementWidth<HTMLDivElement>();
	return <div ref={ref}>{width === null ? "unmeasured" : String(width)}</div>;
}

beforeEach((): void => {
	ControlledResizeObserver.instances.length = 0;
	vi.stubGlobal("ResizeObserver", ControlledResizeObserver);
});

afterEach((): void => {
	cleanup();
	vi.unstubAllGlobals();
});

function lastObserver(): ControlledResizeObserver {
	const observer = ControlledResizeObserver.instances.at(-1);
	if (observer === undefined) {
		throw new Error("the hook created an observer");
	}
	return observer;
}

describe("useElementWidth", () => {
	it("is null until the element is measured", () => {
		render(<Probe />);
		expect(screen.getByText("unmeasured")).toBeTruthy();
	});

	it("follows the element's width as the observer reports it", () => {
		render(<Probe />);

		act((): void => {
			lastObserver().report(480);
		});
		expect(screen.getByText("480")).toBeTruthy();

		act((): void => {
			lastObserver().report(900);
		});
		expect(screen.getByText("900")).toBeTruthy();
	});

	it("stays unmeasured, without failing, where there is no ResizeObserver", () => {
		vi.stubGlobal("ResizeObserver", undefined);
		render(<Probe />);
		expect(screen.getByText("unmeasured")).toBeTruthy();
	});

	it("stops observing when the element leaves the page", () => {
		const { unmount } = render(<Probe />);
		const observer = lastObserver();

		unmount();

		expect(observer.disconnected).toBe(true);
	});
});
