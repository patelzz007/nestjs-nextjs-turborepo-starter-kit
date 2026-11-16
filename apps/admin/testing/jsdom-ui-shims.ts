// jsdom stand-ins for the browser APIs the UI kit's live examples touch. Used
// by the showcase's usage tests and the upload widget tests; call
// `installJsdomUiShims()` once per `describe`. Each caller still declares
// `// @vitest-environment jsdom` at the top of its own file.
import { cleanup } from "@testing-library/react";
import { afterEach, beforeEach, vi } from "vitest";

// ── jsdom fidelity shims ────────────────────────────────────────────────────
// jsdom has no layout engine and no animation timeline. Popups and scroll areas
// observe element sizes, lazy media and scrollspies observe visibility, the command list
// scrolls the active item into view, responsive hooks read media queries and
// base-ui waits on `getAnimations()` before unmounting. Give them inert,
// spec-shaped stand-ins: sizes never change, everything is on screen, no media
// query matches and no animation is running.

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

type VisibleEntry = Pick<IntersectionObserverEntry, "isIntersecting" | "intersectionRatio" | "target" | "boundingClientRect" | "intersectionRect" | "rootBounds" | "time">;
type VisibleCallback = (entries: readonly VisibleEntry[]) => void;

/** Reports every observed element as fully on screen, as soon as it is observed. */
class OnScreenIntersectionObserver {
	public readonly root: Element | null = null;
	public readonly rootMargin: string = "0px";
	public readonly thresholds: readonly number[] = [];

	public constructor(private readonly _callback: VisibleCallback) {}

	public observe(target: Element): void {
		const bounds = target.getBoundingClientRect();
		this._callback([{ isIntersecting: true, intersectionRatio: 1, target, boundingClientRect: bounds, intersectionRect: bounds, rootBounds: null, time: 0 }]);
	}
	public unobserve(): void {
		return;
	}
	public disconnect(): void {
		return;
	}
	public takeRecords(): readonly VisibleEntry[] {
		return [];
	}
}

/** A media query that never matches and never changes. */
class UnmatchedMediaQueryList extends EventTarget {
	public readonly matches: boolean = false;
	public onchange: ((event: Event) => void) | null = null;

	public constructor(public readonly media: string) {
		super();
	}

	/** Deprecated alias of `addEventListener("change")`, still called by some libraries. */
	public addListener(): void {
		return;
	}
	/** Deprecated alias of `removeEventListener("change")`. */
	public removeListener(): void {
		return;
	}
}

function unmatchedMediaQuery(query: string): UnmatchedMediaQueryList {
	return new UnmatchedMediaQueryList(query);
}

function noopScrollIntoView(): void {
	return;
}

function noAnimations(): readonly Animation[] {
	return [];
}

/** Web fonts that have already loaded: jsdom has no `document.fonts`, which the Diagram reads to re-measure its labels. */
const LOADED_FONTS: { readonly ready: Promise<void> } = { ready: Promise.resolve() };

/** Element methods jsdom lacks, installed on the prototype for the duration of each test. */
const ELEMENT_SHIM_NAMES: readonly ["scrollIntoView", "getAnimations"] = ["scrollIntoView", "getAnimations"];

/** Installs the jsdom shims before each test and removes them after it. Call once per `describe`. */
export function installJsdomUiShims(): void {
	beforeEach((): void => {
		vi.stubGlobal("ResizeObserver", NoopResizeObserver);
		vi.stubGlobal("IntersectionObserver", OnScreenIntersectionObserver);
		vi.stubGlobal("matchMedia", unmatchedMediaQuery);
		Object.defineProperty(Element.prototype, "scrollIntoView", { configurable: true, writable: true, value: noopScrollIntoView });
		Object.defineProperty(Element.prototype, "getAnimations", { configurable: true, writable: true, value: noAnimations });
		Object.defineProperty(document, "fonts", { configurable: true, value: LOADED_FONTS });
	});

	afterEach((): void => {
		cleanup();
		vi.unstubAllGlobals();
		Reflect.deleteProperty(document, "fonts");
		for (const name of ELEMENT_SHIM_NAMES) {
			Reflect.deleteProperty(Element.prototype, name);
		}
	});
}
