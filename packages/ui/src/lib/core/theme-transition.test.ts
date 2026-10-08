// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
	runThemeTransition,
	THEME_TRANSITION_DURATION_MS,
	THEME_TRANSITION_EASING,
	THEME_TRANSITION_FALLBACK_INSET_PX,
	themeTransitionOrigin,
	themeTransitionRadius,
} from "./theme-transition";

const VIEWPORT = { width: 1000, height: 600 };
const ORIGIN = { x: 900, y: 40 };

/** The parts of a `ViewTransition` the helper reads. */
interface FakeViewTransition {
	readonly ready: Promise<void>;
	readonly finished: Promise<void>;
}

/** Installs a View Transitions API that runs the update at once and settles when `settle()` is called. */
function installViewTransitions(): { readonly start: ReturnType<typeof vi.fn<(update: () => void) => FakeViewTransition>>; readonly settle: () => void } {
	let resolveFinished: (() => void) | undefined;
	const finished = new Promise<void>((resolve) => {
		resolveFinished = resolve;
	});
	const start = vi.fn<(update: () => void) => FakeViewTransition>((update) => {
		update();
		return { ready: Promise.resolve(), finished };
	});
	Object.defineProperty(document, "startViewTransition", { configurable: true, value: start });
	return {
		start,
		settle: (): void => {
			resolveFinished?.();
		},
	};
}

function stubReducedMotion(reduce: boolean): void {
	vi.stubGlobal("matchMedia", (query: string): { readonly matches: boolean; readonly media: string } => ({ matches: reduce, media: query }));
}

beforeEach((): void => {
	vi.stubGlobal("innerWidth", VIEWPORT.width);
	vi.stubGlobal("innerHeight", VIEWPORT.height);
});

afterEach((): void => {
	Reflect.deleteProperty(document, "startViewTransition");
	Reflect.deleteProperty(document.documentElement, "animate");
	delete document.documentElement.dataset.themeTransition;
	vi.unstubAllGlobals();
});

describe("runThemeTransition", () => {
	it("switches instantly when the browser has no View Transitions API", () => {
		const apply = vi.fn();

		runThemeTransition(apply, ORIGIN);

		expect(apply).toHaveBeenCalledTimes(1);
		expect(document.documentElement.dataset.themeTransition).toBeUndefined();
	});

	it("switches instantly, without a transition, for people who prefer reduced motion", () => {
		const { start } = installViewTransitions();
		stubReducedMotion(true);
		const apply = vi.fn();

		runThemeTransition(apply, ORIGIN);

		expect(apply).toHaveBeenCalledTimes(1);
		expect(start).not.toHaveBeenCalled();
	});

	it("applies the theme inside a view transition and clips the new theme open from the origin to the farthest corner", async () => {
		const { start, settle } = installViewTransitions();
		stubReducedMotion(false);
		const animate = vi.fn();
		Object.defineProperty(document.documentElement, "animate", { configurable: true, value: animate });
		const apply = vi.fn();

		runThemeTransition(apply, ORIGIN);

		expect(start).toHaveBeenCalledTimes(1);
		expect(apply).toHaveBeenCalledTimes(1);
		expect(document.documentElement.dataset.themeTransition).toBe("");

		await vi.waitFor((): void => {
			expect(animate).toHaveBeenCalledTimes(1);
		});
		const farthestCorner = Math.hypot(ORIGIN.x, VIEWPORT.height - ORIGIN.y);
		expect(animate).toHaveBeenCalledWith(
			{ clipPath: [`circle(0px at ${String(ORIGIN.x)}px ${String(ORIGIN.y)}px)`, `circle(${String(farthestCorner)}px at ${String(ORIGIN.x)}px ${String(ORIGIN.y)}px)`] },
			{ duration: THEME_TRANSITION_DURATION_MS, easing: THEME_TRANSITION_EASING, pseudoElement: "::view-transition-new(root)" },
		);

		settle();
		await vi.waitFor((): void => {
			expect(document.documentElement.dataset.themeTransition).toBeUndefined();
		});
	});
});

describe("themeTransitionOrigin", () => {
	it("is the centre of the control that switched the theme", () => {
		const button = document.createElement("button");
		button.getBoundingClientRect = (): DOMRect => new DOMRect(100, 20, 40, 30);

		expect(themeTransitionOrigin(button)).toEqual({ x: 120, y: 35 });
	});

	it("falls back to the top-right corner when there is no control, or it is hidden at this size", () => {
		const hidden = document.createElement("button");
		hidden.getBoundingClientRect = (): DOMRect => new DOMRect(0, 0, 0, 0);

		const topRight = { x: VIEWPORT.width - THEME_TRANSITION_FALLBACK_INSET_PX, y: THEME_TRANSITION_FALLBACK_INSET_PX };
		expect(themeTransitionOrigin(null)).toEqual(topRight);
		expect(themeTransitionOrigin(hidden)).toEqual(topRight);
	});
});

describe("themeTransitionRadius", () => {
	it("reaches the farthest viewport corner from any origin", () => {
		expect(themeTransitionRadius({ x: 0, y: 0 })).toBe(Math.hypot(VIEWPORT.width, VIEWPORT.height));
		expect(themeTransitionRadius({ x: VIEWPORT.width / 2, y: VIEWPORT.height / 2 })).toBe(Math.hypot(VIEWPORT.width / 2, VIEWPORT.height / 2));
	});
});
