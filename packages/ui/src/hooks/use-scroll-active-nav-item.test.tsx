// @vitest-environment jsdom
import { cleanup, render } from "@testing-library/react";
import * as React from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { transitionsSettled, useScrollActiveNavItem } from "./use-scroll-active-nav-item";

function Harness({ navigationKey, activeTop }: { readonly navigationKey: string; readonly activeTop: number }): React.JSX.Element {
	const containerRef = React.useRef<HTMLDivElement>(null);
	useScrollActiveNavItem(containerRef, navigationKey);
	return (
		<div ref={containerRef}>
			<a href="/a" aria-current="page" data-top={activeTop}>
				A
			</a>
		</div>
	);
}

const scrollIntoView = vi.fn<(options?: ScrollIntoViewOptions) => void>();

beforeEach((): void => {
	scrollIntoView.mockClear();
	HTMLElement.prototype.scrollIntoView = scrollIntoView;
	window.matchMedia = vi.fn().mockReturnValue({ matches: false });
	// A 100px-tall scrolling container; the active row's top comes from `data-top`.
	Object.defineProperty(HTMLElement.prototype, "scrollHeight", { configurable: true, get: (): number => 500 });
	Object.defineProperty(HTMLElement.prototype, "clientHeight", { configurable: true, get: (): number => 100 });
	HTMLElement.prototype.getBoundingClientRect = function getBoundingClientRect(this: HTMLElement): DOMRect {
		const top = Number(this.dataset.top ?? "0");
		return this.tagName === "A" ? new DOMRect(0, top, 100, 20) : new DOMRect(0, 0, 100, 100);
	};
});

afterEach((): void => {
	cleanup();
});

describe("useScrollActiveNavItem", () => {
	it("scrolls the current page's row into view when it is outside the visible area", async () => {
		render(<Harness navigationKey="/a" activeTop={300} />);

		await vi.waitFor(() => {
			expect(scrollIntoView).toHaveBeenCalledWith({ block: "nearest", behavior: "smooth" });
		});
	});

	it("leaves the scroll position alone when the row is already visible", async () => {
		render(<Harness navigationKey="/a" activeTop={10} />);
		await transitionsSettled([]);

		expect(scrollIntoView).not.toHaveBeenCalled();
	});
});

describe("transitionsSettled", () => {
	it("waits for every transition, finished or cancelled", async () => {
		let finishFirst: () => void = (): void => undefined;
		let cancelSecond: () => void = (): void => undefined;
		const first = {
			finished: new Promise<string>(
				(resolve) =>
					(finishFirst = (): void => {
						resolve("first");
					}),
			),
		};
		const second = {
			finished: new Promise<string>(
				(_resolve, reject) =>
					(cancelSecond = (): void => {
						reject(new Error("cancelled"));
					}),
			),
		};
		let isSettled = false;

		const settled = transitionsSettled([first, second]).then((): void => {
			isSettled = true;
		});
		finishFirst();
		await Promise.resolve();
		expect(isSettled).toBe(false);

		cancelSecond();
		await settled;
		expect(isSettled).toBe(true);
	});
});
