// ============================================
// lib/url-state/browser-history-probe.ts - browser-test support for URL state
// ============================================
// The URL-state layer (use-url-state.ts) rests on one assumption no unit test
// can prove: writing the address bar with `history.pushState` /
// `history.replaceState` re-renders the page WITHOUT a document load, and the
// browser's Back/Forward (`popstate`) restores the view from the URL. This
// probe lets a Playwright spec observe exactly that in a real browser, for any
// app's list page — the spec names the page's controls, the probe owns the
// history bookkeeping.
//
// Test-only: imported by `e2e/*.browser.ts` specs, never by app code.

import { expect, type Page } from "@playwright/test";

/** Set on `window` once per document; it disappears if the page ever does a full load. */
const DOCUMENT_MARKER = "__urlStateDocumentMarker";

/** How one URL change reached the history stack. */
export type HistoryWrite = "push" | "replace";

export class BrowserHistoryProbe {
	private _historyLength = 0;

	public constructor(private readonly _page: Page) {}

	/** Marks the current document and records the history length. Call once the page has loaded. */
	public async start(): Promise<void> {
		await this._page.evaluate((marker: string): void => {
			Reflect.set(window, marker, true);
		}, DOCUMENT_MARKER);
		this._historyLength = await this.readHistoryLength();
	}

	/** The current URL's search params (decoded). */
	public searchParams(): URLSearchParams {
		return new URL(this._page.url()).searchParams;
	}

	/**
	 * Runs `action`, waits until the URL satisfies `isExpected`, then asserts the
	 * change was a client-side `write` (push adds one history entry, replace adds
	 * none) and that the document was NOT reloaded.
	 */
	public async expectUrlWrite(write: HistoryWrite, action: () => Promise<void>, isExpected: (params: URLSearchParams) => boolean): Promise<void> {
		await action();
		await expect.poll(() => isExpected(this.searchParams())).toBe(true);
		const nextLength = await this.readHistoryLength();
		expect(nextLength, `history.length after a ${write}`).toBe(write === "push" ? this._historyLength + 1 : this._historyLength);
		this._historyLength = nextLength;
		await this.expectSameDocument();
	}

	/** Back (`delta = -1`) or Forward (`delta = 1`) through history, waiting for the URL to match; the document must survive. */
	public async traverse(delta: -1 | 1, isExpected: (params: URLSearchParams) => boolean): Promise<void> {
		if (delta === -1) {
			await this._page.goBack();
		} else {
			await this._page.goForward();
		}
		await expect.poll(() => isExpected(this.searchParams())).toBe(true);
		await this.expectSameDocument();
	}

	/** Fails when the page did a full document load since `start()` (URL state must never reload). */
	public async expectSameDocument(): Promise<void> {
		const isSameDocument = await this._page.evaluate((marker: string): boolean => Reflect.get(window, marker) === true, DOCUMENT_MARKER);
		expect(isSameDocument, "the page reloaded instead of re-rendering from the URL").toBe(true);
	}

	private readHistoryLength(): Promise<number> {
		return this._page.evaluate((): number => window.history.length);
	}
}
