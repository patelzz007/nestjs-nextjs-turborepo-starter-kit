// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { initFeedback } from "./feedback";

const MARKUP = `
	<section data-feedback>
		<button data-feedback-value="yes" aria-pressed="false">Yes</button>
		<button data-feedback-value="no" aria-pressed="false">No</button>
		<p data-feedback-thanks hidden>Thanks</p>
	</section>`;

function button(value: string): HTMLButtonElement {
	const found = document.querySelector(`[data-feedback-value="${value}"]`);
	if (!(found instanceof HTMLButtonElement)) {
		throw new Error(`Missing ${value} button`);
	}
	return found;
}

function thanksHidden(): boolean {
	return document.querySelector<HTMLElement>("[data-feedback-thanks]")?.hidden !== false;
}

describe("initFeedback", () => {
	beforeEach(() => {
		window.localStorage.clear();
		document.body.innerHTML = MARKUP;
	});

	afterEach(() => {
		vi.restoreAllMocks();
	});

	it("records a vote per page and thanks the reader", () => {
		initFeedback();
		expect(thanksHidden()).toBe(true);
		button("no").click();
		expect(button("no").getAttribute("aria-pressed")).toBe("true");
		expect(button("yes").getAttribute("aria-pressed")).toBe("false");
		expect(thanksHidden()).toBe(false);
		expect(window.localStorage.getItem(`docs:feedback:${window.location.pathname}`)).toBe("no");
	});

	it("restores a previous vote", () => {
		window.localStorage.setItem(`docs:feedback:${window.location.pathname}`, "yes");
		initFeedback();
		expect(button("yes").getAttribute("aria-pressed")).toBe("true");
		expect(thanksHidden()).toBe(false);
	});

	it("still thanks the reader when storage is blocked", () => {
		vi.spyOn(Storage.prototype, "getItem").mockImplementation(() => {
			throw new Error("blocked");
		});
		vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
			throw new Error("blocked");
		});
		initFeedback();
		button("yes").click();
		expect(thanksHidden()).toBe(false);
	});

	it("does nothing on pages without the widget", () => {
		document.body.innerHTML = "";
		expect(() => {
			initFeedback();
		}).not.toThrow();
	});
});
